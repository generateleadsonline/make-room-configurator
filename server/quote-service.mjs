import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/catalog.js';
import { BUDGETS, INSTALL_TIMES, normaliseUkPhone, validateEmail, validateName, validatePostcode } from '../src/validation.js';
import { calculateQuote } from './pricing.mjs';

const MAX_BODY_BYTES = 16384;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_NAME = 'make_room_quote_session';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_TOKEN = /^[a-f0-9]{64}$/;
const MAX_OPENINGS = 24;
export const LEAD_SOURCE = 'Make Room Outside Living configurator';

export class QuoteInputError extends Error {
  constructor(message, status = 400, field) { super(message); this.status = status; this.field = field; }
}

export function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function assertKnownKeys(value, keys) { for (const key of Object.keys(value)) if (!keys.includes(key)) throw new QuoteInputError('Please check the information sent.'); }
// Free text: no control characters (tab/newline allowed when multiline) and no angle brackets.
export function cleanText(value, field, { required = false, max = 200, multiline = false, label = field } = {}) {
  if (value === undefined || value === null) value = '';
  const scanned = typeof value === 'string' && multiline ? value.replace(/[\t\n\r]/g, ' ') : value;
  if (typeof value !== 'string' || value.length > max || /[\p{Cc}<>]/u.test(scanned)) throw new QuoteInputError(`Please check your ${label}.`, 400, field);
  const result = value.trim();
  if (required && !result) throw new QuoteInputError(`Please enter your ${label}.`, 400, field);
  return result;
}
// Applies a src/validation.js result, or throws with the input's own name as the field.
export function checked(result, field) {
  if (!result.ok) throw new QuoteInputError(result.error, 400, field);
  return result;
}
export function optionOf(value, options, field, label) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !options.includes(value)) throw new QuoteInputError(`Please choose your ${label} from the list.`, 400, field);
  return value;
}
export function optionalBoolean(value, field) {
  if (value !== undefined && typeof value !== 'boolean') throw new QuoteInputError('Please check your contact preferences.', 400, field);
  return value === true;
}

export const LEAD_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'postcode', 'timeline', 'budget', 'notes', 'marketing'];
export function validateLead(input) {
  if (!isPlainObject(input)) throw new QuoteInputError('Please enter your contact details.');
  assertKnownKeys(input, LEAD_FIELDS);
  const firstName = checked(validateName(input.firstName, 'first name'), 'firstName').value;
  const lastName = checked(validateName(input.lastName, 'last name'), 'lastName').value;
  const email = checked(validateEmail(input.email), 'email').value;
  const phone = checked(normaliseUkPhone(input.phone), 'phone');
  const postcode = checked(validatePostcode(input.postcode), 'postcode').value;
  return {
    firstName,
    lastName,
    email,
    phone: phone.national,
    phoneE164: phone.e164,
    postcode,
    timeline: optionOf(input.timeline, INSTALL_TIMES, 'timeline', 'installation timescale'),
    budget: optionOf(input.budget, BUDGETS, 'budget', 'budget'),
    notes: cleanText(input.notes, 'notes', { max: 1200, multiline: true, label: 'notes' }),
    marketing: optionalBoolean(input.marketing, 'marketing'),
  };
}

// Deep equality where object key order does not matter but array order does.
function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
  }
  return Object.is(a, b);
}
const CONFIG_MESSAGES = {
  type: 'Please choose a garden room or a modular extension.',
  use: 'Please check how you will use your room.',
  width: 'Please choose a Make Room modular width.',
  depth: 'Please choose a length available for this width.',
  cladding: 'Please choose an available cladding finish for each wall.',
  openings: 'Please check your doors and windows: one no longer fits where it was placed.',
  overhang: 'Please check your roof overhang sizes.',
  decking: 'Please check your decking sizes.',
  deckingColour: 'Please choose an available decking colour.',
  floor: 'Please choose an available flooring colour.',
  electrical: 'Please choose an electrical package.',
};
const configError = (field) => new QuoteInputError(CONFIG_MESSAGES[field] || 'Please check your garden room design.', 400, field);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);

// Strict v2 check. The browser always sends designs that have been through
// normalizeConfig, so anything normalizeConfig would change is refused.
export function validateConfig(input) {
  if (!isPlainObject(input)) throw new QuoteInputError('Please check your garden room design.', 400, 'config');
  for (const key of Object.keys(input)) if (!Object.hasOwn(DEFAULT_CONFIG, key)) throw new QuoteInputError('Please check your garden room design.', 400, 'config');
  if (input.v !== 2) throw new QuoteInputError('Please refresh the configurator and try again.', 400, 'config');
  if (!finite(input.width)) throw configError('width');
  if (!finite(input.depth)) throw configError('depth');
  for (const key of ['cladding', 'overhang', 'decking']) {
    if (!isPlainObject(input[key])) throw configError(key);
    if (key !== 'cladding' && Object.values(input[key]).some((n) => !finite(n))) throw configError(key);
  }
  if (!Array.isArray(input.openings) || input.openings.length > MAX_OPENINGS) throw configError('openings');
  if (input.openings.some((o) => !isPlainObject(o) || !finite(o.offset))) throw configError('openings');
  const normal = normalizeConfig(input);
  for (const key of Object.keys(normal)) if (!sameValue(normal[key], input[key])) throw configError(key);
  return normal;
}

export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
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
export async function readJsonBody(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new QuoteInputError('Please send a valid request.', 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new QuoteInputError('This request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new QuoteInputError('Please enter your contact details.');
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
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new QuoteInputError('Please send a valid request.'); }
}

export function createQuoteHandler({ getStore, now = () => Date.now(), makeToken = () => randomBytes(32).toString('hex'), makeId = randomUUID } = {}) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return response({ error: 'Please submit your design and contact details to unlock your estimate.' }, 405, { Allow: 'POST' });
    try {
      sameOrigin(request);
      const input = await readJsonBody(request);
      if (!isPlainObject(input)) throw new QuoteInputError('Please check your quote request.');
      assertKnownKeys(input, ['config', 'lead', 'requestId', 'botField']);
      if (input.botField !== undefined && (typeof input.botField !== 'string' || input.botField.trim())) throw new QuoteInputError('We could not accept this request.');
      const design = validateConfig(input.config);
      const timestamp = new Date(now()).toISOString();
      const store = enquiryStore(getStore, context);

      if (input.lead === undefined) {
        // A first visit has no session yet: answer plainly rather than with an
        // error, so browsers do not log a failed request on every page load.
        if (!tokenFrom(request)) return response({ saved: false, session: false }, 200);
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
      const record = { id: leadId, createdAt: timestamp, submittedAt: timestamp, lead, config: design, quote, fingerprint, source: LEAD_SOURCE, consent: { enquiryRequested: true, marketing: lead.marketing, privacyUrl: '/privacy.html', companyPrivacyUrl: 'https://www.makeroomoutside.co.uk/privacy-policy/' } };
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
