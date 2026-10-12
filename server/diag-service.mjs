import { randomUUID } from 'node:crypto';

// 3D diagnostics: when the 3D view fails or falls back to safe mode, the
// browser sends what happened (device, GPU, stages) so failures on real
// devices can be read back. Nothing personal: no names, contacts, IP or cookies.
const MAX_BYTES = 8192;
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
const text = (v, max = 200) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').slice(0, max) : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
const pick = (obj, spec) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const out = {};
  for (const [k, kind] of Object.entries(spec)) {
    const v = kind === 'text' ? text(obj[k], 300) : kind === 'num' ? num(obj[k]) : kind === 'bool' ? bool(obj[k]) : kind === 'pair' && Array.isArray(obj[k]) ? obj[k].slice(0, 2).map(num) : undefined;
    if (v !== undefined) out[k] = v;
  }
  return out;
};
const detail = (d) => (d === undefined ? undefined : text(typeof d === 'string' ? d : JSON.stringify(d), 300));

export function cleanReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('shape');
  const reason = text(input.reason, 40);
  const session = text(input.session, 12);
  if (!reason || !/^[a-z0-9-]+$/.test(reason) || !session || !/^[0-9A-F]{6}$/.test(session)) throw new Error('fields');
  return {
    reason,
    session,
    at: text(input.at, 40),
    page: text(input.page, 80),
    mode: text(input.mode, 12),
    quality: text(input.quality, 12),
    previousMode: text(input.previousMode, 12),
    device: pick(input.device, { ua: 'text', platform: 'text', mobile: 'bool', screen: 'pair', viewport: 'pair', dpr: 'num', memory: 'num', cores: 'num', touch: 'num' }),
    gpu: pick(input.gpu, { level: 'num', webgl2: 'bool', webgl1: 'bool', vendor: 'text', renderer: 'text', version: 'text', maxTexture: 'num', maxRenderbuffer: 'num', fragmentUniforms: 'num', fragmentHighp: 'bool', halfFloatTarget: 'bool', extensions: 'num', error: 'text' }),
    error: pick(input.error, { name: 'text', message: 'text', stage: 'text', stack: 'text' }),
    events: Array.isArray(input.events) ? input.events.slice(-80).map((e) => ({ t: num(e?.t), type: text(e?.type, 40), detail: detail(e?.detail) })) : [],
  };
}

export function diagStore(getStore, context = {}) {
  const production = context.deploy?.context === 'production';
  const suffix = production ? '' : `-preview-${String(context.deploy?.id || 'local').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)}`;
  return getStore({ name: `make-room-diagnostics${suffix}` });
}

export function createDiagHandler({ getStore, now = () => Date.now(), makeId = randomUUID } = {}) {
  return async (request, context = {}) => {
    if (request.method !== 'POST') return json({ error: 'POST a diagnostics report.' }, 405);
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Same origin only.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return json({ error: 'Too large.' }, 413);
    let raw;
    try {
      raw = await request.text();
    } catch {
      return json({ error: 'Unreadable.' }, 400);
    }
    if (raw.length > MAX_BYTES) return json({ error: 'Too large.' }, 413);
    let report;
    try {
      report = cleanReport(JSON.parse(raw));
    } catch {
      return json({ error: 'Not a diagnostics report.' }, 400);
    }
    const day = new Date(now()).toISOString().slice(0, 10);
    const key = `reports/${day}/${report.session}-${report.reason}-${makeId().slice(0, 8)}`;
    try {
      await diagStore(getStore, context).setJSON(key, { ...report, receivedAt: new Date(now()).toISOString() });
    } catch {
      console.warn('Make Room diagnostics storage unavailable');
      return json({ error: 'Not stored.' }, 503);
    }
    return json({ saved: true, key });
  };
}
