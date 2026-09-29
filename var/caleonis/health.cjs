'use strict';
const http = require('node:http');

function probe(port, path, accept) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path, timeout: 4000 }, (response) => {
      response.resume();
      resolve(accept(response.statusCode || 0));
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

const server = http.createServer(async (request, response) => {
  if (request.url !== '/healthz') { response.writeHead(404); response.end(); return; }
  // HTTP liveness for web/API; orchestrator also checks the Temporal namespace.
  // This is not an end-to-end publication test or a substitute for backups.
  const checks = await Promise.all([
    probe(4200, '/auth/login', (status) => status >= 200 && status < 400),
    probe(3000, '/', (status) => status >= 200 && status < 500),
    probe(3002, '/health/status', (status) => status === 200),
  ]);
  const ready = checks.every(Boolean);
  response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify({ status: ready ? 'ready' : 'starting' }));
});
server.listen(5001, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
