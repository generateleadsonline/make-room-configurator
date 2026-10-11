import { acceptedSession, enquiryStore, QuoteInputError } from './quote-service.mjs';

// Netlify's buffered function request ceiling includes binary transport overhead.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const DESIGN_REFERENCE = /^MR-[A-F0-9]{12}$/;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' };

function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { ...PRIVATE_HEADERS, ...extra } });
}
function designReference(request) {
  const url = new URL(request.url);
  const value = request.method === 'POST' ? request.headers.get('x-design-reference') : url.searchParams.get('designReference');
  if (!DESIGN_REFERENCE.test(value || '')) throw new QuoteInputError('Please select a saved design pack.', 400);
  return value;
}
async function readPdf(request) {
  if (request.headers.get('content-type')?.toLowerCase().split(';')[0].trim() !== 'application/pdf') throw new QuoteInputError('Please upload a PDF design pack.', 400);
  if (Number(request.headers.get('content-length') || 0) > MAX_PDF_BYTES) throw new QuoteInputError('This PDF is too large. Please use a file smaller than 4 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new QuoteInputError('Please upload a PDF design pack.', 400);
  const parts = []; let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_PDF_BYTES) { await reader.cancel(); throw new QuoteInputError('This PDF is too large. Please use a file smaller than 4 MB.', 413); }
    parts.push(part.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  const decoder = new TextDecoder('latin1');
  const header = decoder.decode(bytes.subarray(0, 16));
  const trailer = decoder.decode(bytes.subarray(Math.max(0, size - 1024)));
  if (size < 20 || !/^%PDF-(?:1\.[0-9]|2\.0)/.test(header) || !/%%EOF\s*$/.test(trailer)) throw new QuoteInputError('This file is not a complete PDF design pack.', 400);
  return bytes;
}

export function createPdfHandler({ getStore, now = () => Date.now() } = {}) {
  return async (request, context = {}) => {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Use GET to download or POST to save your design pack.' }, 405, { Allow: 'GET, POST' });
    try {
      const origin = request.headers.get('origin');
      if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site')==='cross-site') throw new QuoteInputError('Please open your design pack from the configurator.', 403);
      const store = enquiryStore(getStore, context);
      const { session, leadReceipt } = await acceptedSession(request, store, now);
      const reference = designReference(request);
      if (leadReceipt.quote.designReference !== reference) {
        const design = await store.get(`designs/${session.leadId}/${reference}`, { type: 'json' });
        if (design?.quote?.designReference !== reference || design?.quote?.reference !== leadReceipt.quote.reference) throw new QuoteInputError('Please update your estimate before downloading this design pack.', 400);
      }
      const key = `pdfs/${session.leadId}/${reference}`;
      if (request.method === 'POST') {
        const bytes = await readPdf(request);
        const saved = await store.set(key, bytes.buffer, { metadata: { designReference: reference, quoteReference: leadReceipt.quote.reference, savedAt: new Date(now()).toISOString() } });
        if (!saved.modified) throw new Error('PDF write not confirmed');
        return json({ downloadUrl: `/api/design-pack?designReference=${reference}` });
      }
      const pdf = await store.get(key, { type: 'arrayBuffer' });
      if (pdf === null) throw new QuoteInputError('Please save this design pack before downloading it.', 400);
      const safeReference = String(leadReceipt.quote.reference).replace(/[^A-Za-z0-9-]/g, '');
      return new Response(pdf, { status: 200, headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${safeReference}-garden-room-design.pdf"`, 'Content-Length': String(pdf.byteLength) } });
    } catch (error) {
      if (error instanceof QuoteInputError) return json({ error: error.message }, error.status);
      console.warn('Make Room design pack storage unavailable', error?.name || 'StorageError');
      return json({ error: 'We could not save or retrieve your design pack yet. Please try again.' }, 503);
    }
  };
}
