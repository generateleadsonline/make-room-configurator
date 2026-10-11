import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_CONFIG, WIDTHS, allowedDepths, allowedDoors, claddingFinishes, USES, CLADDINGS, FLOORS, ELECTRICAL, SIDES, normalizeConfig } from '../src/catalog.js';
import { calculateQuote } from './pricing.mjs';

const MAX_BODY_BYTES = 16384;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_NAME = 'make_room_quote_session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_TOKEN = /^[a-f0-9]{64}$/;
const POSTCODE = /^(?:GIR\s?0AA|(?:[A-PR-UWYZ]\d(?:\d|[A-HJKPSTUW])?|[A-PR-UWYZ][A-HK-Y]\d(?:\d|[ABEHMNPRVWXY])?)\s?\d[ABD-HJLNP-UW-Z]{2})$/i;


export class QuoteInputError extends Error {
  constructor(message, status = 400, field) { super(message); this.status = status; this.field = field; }
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function knownKeys(value, keys) { for (const key of Object.keys(value)) if (!keys.includes(key)) throw new QuoteInputError('Please check the information sent.'); }
function text(value, field, { required = false, max = 200, multiline = false } = {}) {
  if (value === undefined || value === null) value = '';
  const disallowed = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u : /[\u0000-\u001f\u007f<>]/u;
  if (typeof value !== 'string' || value.length > max || disallowed.test(value)) throw new QuoteInputError(`Please check your ${field}.`, 400, field);
  const result = value.trim();
  if (required && !result) throw new QuoteInputError(`Please enter your ${field}.`, 400, field);
  return result;
}
export function validateLead(input) {
  if (!object(input)) throw new QuoteInputError('Please enter your contact details.');
  knownKeys(input, ['name', 'email', 'postcode', 'phone', 'timeline', 'notes', 'marketing']);
  const name = text(input.name, 'name', { required: true, max: 100 });
  if (name.length < 2) throw new QuoteInputError('Please enter your name.', 400, 'name');
  const email = text(input.email, 'email', { required: true, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) throw new QuoteInputError('Please enter a valid email address.', 400, 'email');
  const postcodeInput = text(input.postcode, 'postcode', { required: true, max: 12 }).toUpperCase().replace(/\s+/g, '');
  if (!POSTCODE.test(postcodeInput)) throw new QuoteInputError('Please enter a valid UK postcode.', 400, 'postcode');
  const postcode = `${postcodeInput.slice(0, -3)} ${postcodeInput.slice(-3)}`;
  const phone = text(input.phone, 'phone', { max: 30 });
  if (phone && (!/^[+()\d\s.-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) throw new QuoteInputError('Please check your phone number.', 400, 'phone');
  if (input.marketing !== undefined && typeof input.marketing !== 'boolean') throw new QuoteInputError('Please check your contact preferences.');
  return { name, email, postcode, phone, timeline: text(input.timeline, 'timeline', { max: 80 }), notes: text(input.notes, 'notes', { max: 1200, multiline: true }), marketing: input.marketing === true };
}

export function validateConfig(input) {
  if (!object(input)) throw new QuoteInputError('Please check your garden room design.');
  knownKeys(input, Object.keys(DEFAULT_CONFIG));
  if (!WIDTHS.includes(input.width)) throw new QuoteInputError('Please choose a Make Room modular width.', 400, 'width');
  if (!allowedDepths(input.width).includes(input.depth)) throw new QuoteInputError('Please choose a depth available for this width.', 400, 'depth');
  const enums={use:USES.map(x=>x.id),type:['garden','extension'],cladding:CLADDINGS.map(x=>x.id),floor:FLOORS.map(x=>x.id),doors:allowedDoors(input.width).map(x=>x.id),windows:['none','left','right','both'],electrical:ELECTRICAL.map(x=>x.id)};
  for(const [key,values]of Object.entries(enums))if(!values.includes(input[key]))throw new QuoteInputError(`Please check your ${key} selection.`,400,key);
  if(input.type==='extension'&&input.cladding==='steel')throw new QuoteInputError('Steel cladding is available for garden rooms. Please choose an extension cladding.',400,'cladding');
  if(!claddingFinishes(input).some(f=>f.id===input.claddingColor))throw new QuoteInputError('Please choose an available cladding colour.',400,'claddingColor');
  for(const key of ['overhang','decking'])if(!Array.isArray(input[key])||input[key].length>4||new Set(input[key]).size!==input[key].length||input[key].some(x=>!SIDES.includes(x)))throw new QuoteInputError(`Please check your ${key} selection.`,400,key);
  return normalizeConfig(input);
}

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function response(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({ 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', ...extraHeaders });
  if (headers.has('Set-Cookie')) {
    // Send a separate cookie field: clear the old, narrower path during migration.
    headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/api/quote; Max-Age=0; HttpOnly; SameSite=Lax`);
  }
  return Response.json(data, { status, headers });
}
export function sameOrigin(request){
 const origin=request.headers.get('origin');
 if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new QuoteInputError('Please submit this request from the configurator.',403);
}
export function tokenFrom(request) {
  const cookies = request.headers.get('cookie') || '';
  const token = cookies.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  return SESSION_TOKEN.test(token || '') ? token : null;
}
function cookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/api; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function enquiryStore(getStore, context = {}) {
  const production = context.deploy?.context === 'production';
  const suffix = production ? '' : `-preview-${String(context.deploy?.id || 'local').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`;
  return getStore({ name: `make-room-leads${suffix}`, consistency: 'strong' });
}

export async function acceptedSession(request, store, now = Date.now) {
  const token = tokenFrom(request);
  if (!token) throw new QuoteInputError('Submit your details to unlock your estimate first.', 401);
  const session = await store.get(`sessions/${digest(token)}`, { type: 'json' });
  if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) throw new QuoteInputError('Please submit your details again to unlock your estimate.', 401);
  const leadReceipt = await store.get(`leads/${session.leadId}`, { type: 'json' });
  if (!leadReceipt?.lead || !leadReceipt?.quote) throw new QuoteInputError('Please submit your details to unlock your estimate.', 401);
  return { token, session, leadReceipt };
}
async function body(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new QuoteInputError('Please send a valid quote request.', 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new QuoteInputError('This request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new QuoteInputError('Please enter your design and contact details.');
  const parts = []; let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new QuoteInputError('This request is too large.', 413); }
    parts.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new QuoteInputError('Please send a valid quote request.'); }
}

export function createQuoteHandler({ getStore, now = () => Date.now(), makeToken = () => randomBytes(32).toString('hex'), makeId = randomUUID } = {}) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return response({ error: 'Please submit your design and contact details to unlock your estimate.' }, 405, { Allow: 'POST' });
    try {
      sameOrigin(request);
      const input = await body(request);
      if (!object(input)) throw new QuoteInputError('Please check your quote request.');
      knownKeys(input, ['config', 'lead', 'requestId', 'botField']);
      if (input.botField !== undefined && (typeof input.botField !== 'string' || input.botField.trim())) throw new QuoteInputError('We could not accept this request.');
      const design = validateConfig(input.config);
      const timestamp = new Date(now()).toISOString();
      const store = enquiryStore(getStore, context);

      if (input.lead === undefined) {
        const { token, session, leadReceipt } = await acceptedSession(request, store, now);
        const quote = calculateQuote(design, { reference: leadReceipt.quote.reference, createdAt: timestamp });
        const revisionId = input.requestId || makeId();
        if(!UUID.test(revisionId))throw new QuoteInputError('Please update your design again.');
        const revisionResult = await store.setJSON(`revisions/${session.leadId}/${revisionId}`, { quote, createdAt: timestamp }, { onlyIfNew: true });
        let savedQuote=quote;
        if (!revisionResult.modified){
          const previous=await store.get(`revisions/${session.leadId}/${revisionId}`,{type:'json'});
          if(!previous?.quote)throw new Error('Design revision write not confirmed');
          if(previous.quote.designReference!==quote.designReference)throw new QuoteInputError('This design update reference has already been used. Please try again.',409);
          savedQuote=previous.quote;
        }
        const designSaved=await store.setJSON(`designs/${session.leadId}/${quote.designReference}`, { quote, createdAt: timestamp }, { onlyIfNew: true });
        if(!designSaved.modified){const previous=await store.get(`designs/${session.leadId}/${quote.designReference}`,{type:'json'});if(!previous?.quote)throw new Error('Saved design not confirmed');}
        return response({ quote:savedQuote, receipt: { id: session.leadId }, saved: true }, 200, { 'Set-Cookie': cookie(token, request) });
      }

      const lead = validateLead(input.lead);
      if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) throw new QuoteInputError('Please try submitting your details again.');
      const leadId = input.requestId.toLowerCase();
      const fingerprint = digest(JSON.stringify({ lead, config: design }));
      const reference = `MR-${leadId.slice(0, 8).toUpperCase()}`;
      const quote = calculateQuote(design, { reference, createdAt: timestamp });
      const record = { id: leadId, createdAt: timestamp, lead, config: design, quote, fingerprint, source: 'Make Room Outside Living configurator', consent: { enquiryRequested: true, marketing: lead.marketing, privacyUrl: '/privacy.html', companyPrivacyUrl: 'https://www.makeroomoutside.co.uk/privacy-policy/' } };
      const result = await store.setJSON(`leads/${leadId}`, record, { onlyIfNew: true });
      let saved = record;
      if (!result.modified) {
        saved = await store.get(`leads/${leadId}`, { type: 'json' });
        if (!saved || saved.fingerprint !== fingerprint) throw new QuoteInputError('This submission reference has already been used. Please try again.', 409);
      }
      const newToken = makeToken();
      if(!SESSION_TOKEN.test(newToken))throw new Error('Invalid session token');
      const sessionResult = await store.setJSON(`sessions/${digest(newToken)}`, { leadId, createdAt: timestamp, expiresAt: now() + SESSION_SECONDS * 1000 }, { onlyIfNew: true });
      if (!sessionResult.modified) throw new Error('Session write not confirmed');
      return response({ quote: saved.quote, receipt: { id: leadId }, saved: true }, 200, { 'Set-Cookie': cookie(newToken, request) });
    } catch (error) {
      if (error instanceof QuoteInputError) return response({ error: error.message, ...(error.field ? { field: error.field } : {}) }, error.status);
      // No names, emails, addresses, payloads or tokens enter function logs.
      console.warn('Make Room quote persistence unavailable', error?.name || 'StorageError');
      return response({ error: 'We could not save your request yet. Your design is safe. Please try again.' }, 503);
    }
  };
}
