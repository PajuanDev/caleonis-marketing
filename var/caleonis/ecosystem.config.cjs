'use strict';
const common = { autorestart: true, min_uptime: '30s', max_restarts: 5, restart_delay: 3000, kill_timeout: 10000, time: true };
module.exports = {
  apps: [
    { ...common, name: 'frontend', cwd: '/app/apps/frontend', script: 'pnpm', args: ['start'], interpreter: 'none', env: { PORT: '4200' } },
    { ...common, name: 'backend', cwd: '/app/apps/backend', script: 'pnpm', args: ['start'], interpreter: 'none', env: { PORT: '3000' } },
    { ...common, name: 'orchestrator', cwd: '/app/apps/orchestrator', script: 'pnpm', args: ['start'], interpreter: 'none', env: { ORCHESTRATOR_PORT: '3002' } },
    { ...common, name: 'readiness', script: '/app/var/caleonis/health.cjs' },
    { ...common, name: 'gateway', script: '/usr/sbin/nginx', args: ['-g', 'daemon off;'], interpreter: 'none' },
  ],
};
