import { BEST_TIMES, REQUEST_TOPICS, normaliseUkPhone, validateEmail, validateName, validatePostcode } from '../src/validation.js';
import { designReferenceFor } from './pricing.mjs';
import {
  QuoteInputError, UUID, LEAD_SOURCE, acceptedSession, assertKnownKeys, checked, cleanText, digest, enquiryStore,
  isPlainObject, optionOf, optionalBoolean, readJsonBody, sameOrigin, validateConfig,
} from './quote-service.mjs';

// Callback, show-village visit and brochure requests. Saved privately beside
// quote enquiries in the same Netlify Blobs store under requests/{requestId}.
const DAY = 24 * 60 * 60 * 1000;
export const PREFERRED_DATE_WINDOW_DAYS = 120;
export const REQUEST_FIELDS = ['topic', 'firstName', 'lastName', 'phone', 'email', 'postcode', 'bestTime', 'preferredDate', 'notes', 'marketing', 'config', 'requestId', 'botField'];
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { ...HEADERS, ...extra } });
const blank = (value) => value === undefined || value === null || (typeof value === 'string' && !value.trim());

export function validatePreferredDate(value, nowMs) {
  if (blank(value)) return '';
  const message = 'Please choose a date between today and the next four months.';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) throw new QuoteInputError(message, 400, 'preferredDate');
  const text = value.trim();
  const [y, m, d] = text.split('-').map(Number);
  const day = Date.UTC(y, m - 1, d);
  const real = new Date(day);
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) throw new QuoteInputError(message, 400, 'preferredDate');
  const now = new Date(nowMs);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (day < today || day > today + PREFERRED_DATE_WINDOW_DAYS * DAY) throw new QuoteInputError(message, 400, 'preferredDate');
  return text;
}

export function validateRequest(input, nowMs = Date.now()) {
  if (!isPlainObject(input)) throw new QuoteInputError('Please enter your contact details.');
  assertKnownKeys(input, REQUEST_FIELDS);
  if (input.botField !== undefined && (typeof input.botField !== 'string' || input.botField.trim())) throw new QuoteInputError('We could not accept this request.');
  if (typeof input.topic !== 'string' || !Object.hasOwn(REQUEST_TOPICS, input.topic)) throw new QuoteInputError('Please choose what you would like us to arrange.', 400, 'topic');
  const topic = input.topic;
  const firstName = checked(validateName(input.firstName, 'first name'), 'firstName').value;
  const lastName = checked(validateName(input.lastName, 'last name'), 'lastName').value;
  const phone = checked(normaliseUkPhone(input.phone), 'phone');
  // A brochure needs somewhere to go; callbacks and visits only need a phone number.
  const email = topic === 'brochure' || !blank(input.email) ? checked(validateEmail(input.email), 'email').value : '';
  const postcode = blank(input.postcode) ? '' : checked(validatePostcode(input.postcode), 'postcode').value;
  const config = input.config === undefined || input.config === null ? null : validateConfig(input.config);
  return {
    topic,
    contact: { firstName, lastName, phone: phone.national, phoneE164: phone.e164, email, postcode },
    bestTime: optionOf(input.bestTime, BEST_TIMES, 'bestTime', 'best time to call'),
    preferredDate: validatePreferredDate(input.preferredDate, nowMs),
    notes: cleanText(input.notes, 'notes', { max: 1200, multiline: true, label: 'notes' }),
    marketing: optionalBoolean(input.marketing, 'marketing'),
    config,
  };
}

// A quote session is optional here: when present it links this request to the saved enquiry.
async function linkedLeadId(request, store, now) {
  try {
    return (await acceptedSession(request, store, now)).session.leadId;
  } catch (error) {
    if (error instanceof QuoteInputError) return null;
    throw error;
  }
}

export function createRequestHandler({ getStore, now = () => Date.now() } = {}) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return json({ error: 'Please send your request from the configurator.' }, 405, { Allow: 'POST' });
    try {
      sameOrigin(request);
      const input = await readJsonBody(request);
      if (!isPlainObject(input)) throw new QuoteInputError('Please enter your contact details.');
      const details = validateRequest(input, now());
      if (typeof input.requestId !== 'string' || !UUID.test(input.requestId)) throw new QuoteInputError('Please try sending your request again.');
      const requestId = input.requestId.toLowerCase();
      const reference = `MR-REQ-${requestId.slice(0, 8).toUpperCase()}`;
      const store = enquiryStore(getStore, context);
      const leadId = await linkedLeadId(request, store, now);
      const timestamp = new Date(now()).toISOString();
      const fingerprint = digest(JSON.stringify(details));
      const record = {
        id: requestId,
        reference,
        topic: details.topic,
        topicLabel: REQUEST_TOPICS[details.topic],
        createdAt: timestamp,
        submittedAt: timestamp,
        contact: details.contact,
        bestTime: details.bestTime,
        preferredDate: details.preferredDate,
        notes: details.notes,
        config: details.config,
        designReference: details.config ? designReferenceFor(details.config) : null,
        leadId,
        fingerprint,
        source: LEAD_SOURCE,
        consent: { contactRequested: true, marketing: details.marketing, privacyUrl: '/privacy.html', companyPrivacyUrl: 'https://www.makeroomoutside.co.uk/privacy-policy/' },
      };
      const result = await store.setJSON(`requests/${requestId}`, record, { onlyIfNew: true });
      if (!result.modified) {
        const saved = await store.get(`requests/${requestId}`, { type: 'json' });
        if (!saved) throw new Error('Request write not confirmed');
        if (saved.fingerprint !== fingerprint) throw new QuoteInputError('This request reference has already been used. Please try again.', 409);
      }
      return json({ saved: true, reference });
    } catch (error) {
      if (error instanceof QuoteInputError) return json({ error: error.message, ...(error.field ? { field: error.field } : {}) }, error.status);
      // No names, phone numbers, emails, payloads or tokens enter function logs.
      console.warn('Make Room request persistence unavailable', error?.name || 'StorageError');
      return json({ error: 'We could not send your request yet. Please try again, or call Make Room on 01422 580172.' }, 503);
    }
  };
}
