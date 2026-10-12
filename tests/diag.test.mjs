import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagHandler, cleanReport } from '../server/diag-service.mjs';

const NOW = Date.UTC(2026, 9, 13, 12);
function fixture() {
  const records = new Map();
  const store = { async setJSON(key, value) { records.set(key, structuredClone(value)); return { modified: true }; } };
  return { records, handler: createDiagHandler({ getStore: () => store, now: () => NOW, makeId: () => 'abcdef12-0000-4000-8000-000000000000' }) };
}
const post = (body, headers = {}) => new Request('https://test.netlify.app/api/diag', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://test.netlify.app', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const report = { reason: 'crash-init', session: 'A1B2C3', mode: 'normal', device: { ua: 'Mozilla/5.0 (Linux; Android 16; Pixel 10)', screen: [412, 915], dpr: 2.625, memory: 8 }, gpu: { level: 2, renderer: 'PowerVR D-Series DXT-48-1536', maxTexture: 8192 }, error: { name: 'Error', message: 'boom', stage: 'init' }, events: [{ t: 0.1, type: 'start', detail: 'normal' }] };

test('diagnostics reports are cleaned and stored by day', async () => {
  const f = fixture();
  const res = await f.handler(post(report), { deploy: { context: 'production' } });
  assert.equal(res.status, 200);
  const key = [...f.records.keys()][0];
  assert.equal(key, 'reports/2026-10-13/A1B2C3-crash-init-abcdef12');
  const saved = f.records.get(key);
  assert.equal(saved.gpu.renderer, 'PowerVR D-Series DXT-48-1536');
  assert.deepEqual(saved.device.screen, [412, 915]);
  assert.equal(saved.error.stage, 'init');
});

test('unknown fields are dropped and markup is neutralised', () => {
  const cleaned = cleanReport({ ...report, email: 'x@y.z', device: { ua: '<script>alert(1)</script>', cookie: 'a=b' } });
  assert.equal(cleaned.email, undefined);
  assert.equal(cleaned.device.cookie, undefined);
  assert.ok(!cleaned.device.ua.includes('<'));
});

test('bad shape, cross-site and oversized posts are refused', async () => {
  const f = fixture();
  assert.equal((await f.handler(post({ reason: 'Bad Reason!', session: 'A1B2C3' }))).status, 400);
  assert.equal((await f.handler(post({ reason: 'crash', session: 'nothex' }))).status, 400);
  assert.equal((await f.handler(post('not json'))).status, 400);
  assert.equal((await f.handler(post(report, { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await f.handler(post({ ...report, page: 'x'.repeat(9000) }))).status, 413);
  assert.equal((await f.handler(new Request('https://test.netlify.app/api/diag'))).status, 405);
  assert.equal(f.records.size, 0);
});
