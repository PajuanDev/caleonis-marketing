'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function getStatus(route = '/healthz') {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:5001${route}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ code: res.statusCode, body }));
    });
    req.setTimeout(6000, () => req.destroy(new Error('test timeout')));
    req.on('error', reject);
  });
}
test('readiness gate with simulated local services', { timeout: 15000 }, async (t) => {
  const child = spawn(process.execPath, [path.join(__dirname, 'health.cjs')], { stdio: 'pipe' });
  const servers = [];
  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try { await getStatus(); connected = true; break; } catch { await pause(50); }
    }
    assert.ok(connected, 'health server starts');
    await t.test('returns 503 when dependencies are absent', async () => {
      assert.equal((await getStatus()).code, 503);
    });
    let temporalStatus = 200;
    for (const [port, status] of [[4200, 200], [3000, 404], [3002, 200]]) {
      const server = http.createServer((_req, res) => { res.writeHead(port === 3002 ? temporalStatus : status); res.end('fixture'); });
      server.listen(port, '127.0.0.1');
      await once(server, 'listening');
      servers.push(server);
    }
    await t.test('returns 200 when all expected services respond', async () => {
      assert.deepEqual(await getStatus(), { code: 200, body: '{"status":"ready"}' });
    });
    temporalStatus = 500;
    await t.test('returns 503 when Temporal health fails', async () => {
      assert.equal((await getStatus()).code, 503);
    });
    await t.test('does not expose other routes', async () => {
      assert.equal((await getStatus('/private')).code, 404);
    });
  } finally {
    for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
  }
});
