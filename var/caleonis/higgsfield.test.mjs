import test from 'node:test';
import assert from 'node:assert/strict';
import { HiggsfieldEngine, parseCredentials, imageInput, statusUrl } from '../../libraries/nestjs-libraries/src/3rdparties/higgsfield/higgsfield.engine.ts';

const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const credentials = 'test_key_id:test_key_secret';
const input = { prompt: 'Une campagne fictive de test', resolution: '1k', aspect_ratio: '1:1', confirmPaidGeneration: true };
function setup(responses = []) {
  const data = new Map(); const calls = [];
  const engine = new HiggsfieldEngine({
    async get(key) { return data.get(key) ?? null; },
    async put(key, value, ttl, nx) { assert.equal(ttl, 604800); if (nx && data.has(key)) return false; data.set(key, value); return true; },
  }, async (url, options) => {
    calls.push({ url, options }); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal);
    const result = responses.shift();
    if (result instanceof Error) throw result;
    if (result instanceof Response) return result;
    return Response.json(result ?? { request_id: requestId, status: 'queued' });
  });
  return { engine, calls, data };
}

test('credentials are trimmed and remain server-formatted', () => assert.equal(parseCredentials(` ${credentials} `), credentials));
for (const value of ['', 'key', 'key:secret:extra', 'key:secret\r\nInjected:1', null]) {
  test(`reject malformed credentials ${JSON.stringify(value)}`, () => assert.throws(() => parseCredentials(value)));
}
test('generation requires affirmative cost consent', () => assert.throws(() => imageInput({ ...input, confirmPaidGeneration: false })));
test('unknown model, moderation and webhook overrides are never forwarded', () => {
  const result = imageInput({ ...input, model: 'evil', moderation: 'none', webhook_url: 'http://localhost', batch_size: 100 });
  assert.deepEqual(Object.keys(result), ['prompt', 'resolution', 'aspect_ratio', 'enhance_prompt']);
  assert.equal(result.enhance_prompt, false);
});
test('formats, resolution and brief length are validated', () => {
  for (const patch of [{ resolution: '16k' }, { aspect_ratio: 'bad' }, { prompt: '' }, { prompt: 'x'.repeat(4001) }]) assert.throws(() => imageInput({ ...input, ...patch }));
});
test('returned status URLs cannot exfiltrate credentials', () => {
  for (const url of ['https://evil.test/requests/' + requestId + '/status', 'http://api.higgsfield.ai/requests/' + requestId + '/status', 'https://api.higgsfield.ai/requests/other/status']) assert.throws(() => statusUrl(url, requestId));
  assert.equal(statusUrl(null, requestId), `https://api.higgsfield.ai/requests/${requestId}/status`);
});
test('connection verification is a GET, not a purchase', async () => {
  const { engine, calls } = setup([{ items: [] }]);
  const account = await engine.checkConnection(credentials);
  assert.equal(account.name, 'Higgsfield'); assert.equal(calls[0].options.method, 'GET');
  assert.ok(calls[0].url.includes('/presets?size=1')); assert.ok(!JSON.stringify(account).includes('test_key_secret'));
});
test('concurrent duplicate submission buys only once', async () => {
  const { engine, calls, data } = setup();
  await Promise.all([engine.start(credentials, 'org-A:conn-A', id, input), engine.start(credentials, 'org-A:conn-A', id, input)]);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
  assert.ok(!JSON.stringify([...data.values()]).includes(credentials));
});
test('same job id with a different brief is rejected without a second purchase', async () => {
  const { engine, calls } = setup(); await engine.start(credentials, 'org-A:conn-A', id, input);
  await assert.rejects(engine.start(credentials, 'org-A:conn-A', id, { ...input, prompt: 'autre' }), /autre brief/);
  assert.equal(calls.length, 1);
});
test('cross-organization lookup fails before calling provider', async () => {
  const { engine, calls } = setup(); await engine.start(credentials, 'org-A:conn-A', id, input);
  await assert.rejects(engine.status(credentials, 'org-B:conn-A', id), /introuvable/);
  assert.equal(calls.length, 1);
});
test('separate organizations can use identical client ids independently', async () => {
  const { engine, calls } = setup();
  await engine.start(credentials, 'org-A:conn-A', id, input); await engine.start(credentials, 'org-B:conn-B', id, input);
  assert.equal(calls.length, 2);
});
test('ambiguous transport failure is not retried or repurchased', async () => {
  const { engine, calls } = setup([new Error('network failure with sensitive internal detail')]);
  assert.equal((await engine.start(credentials, 'org-A:conn-A', id, input)).status, 'unknown');
  const result = await engine.start(credentials, 'org-A:conn-A', id, input);
  assert.equal(result.status, 'unknown'); assert.equal(calls.length, 1); assert.ok(!JSON.stringify(result).includes('sensitive'));
});
test('provider denial does not leak raw error or secrets', async () => {
  const { engine } = setup([new Response(credentials, { status: 401 })]);
  await assert.rejects(engine.checkConnection(credentials), e => !e.message.includes(credentials) && e.message.includes('refusé'));
});
test('completed image can be imported and re-used without a new purchase', async () => {
  const { engine, calls } = setup([{ request_id: requestId, status: 'queued' }, { request_id: requestId, status: 'completed', images: [{ url: 'https://cdn.example.test/result.png' }] }]);
  await engine.start(credentials, 'org-A:conn-A', id, input);
  assert.equal((await engine.status(credentials, 'org-A:conn-A', id)).status, 'completed');
  assert.equal(await engine.output('org-A:conn-A', id), 'https://cdn.example.test/result.png');
  await engine.imported('org-A:conn-A', id, { id: 'media-id', path: 'https://our-app.test/uploads/result.png' });
  assert.equal((await engine.status(credentials, 'org-A:conn-A', id)).media.id, 'media-id');
  assert.equal(calls.length, 2); assert.equal(calls[1].options.method, 'GET');
});
test('moderation remains terminal and no image is exposed', async () => {
  const { engine } = setup([{ request_id: requestId, status: 'nsfw' }]);
  assert.equal((await engine.start(credentials, 'org-A:conn-A', id, input)).status, 'nsfw');
  await assert.rejects(engine.output('org-A:conn-A', id));
});
test('missing or untrusted request identifiers fail closed', async () => {
  const { engine, calls } = setup();
  await assert.rejects(engine.start(credentials, 'org-A:conn-A', '../../keys', input)); assert.equal(calls.length, 0);
});
