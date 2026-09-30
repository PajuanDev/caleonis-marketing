import { readFile, access, mkdir, cp } from 'node:fs/promises';
import { resolve, relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Next's standalone entry is nested when output tracing spans a monorepo.
export async function runtimeDirectory(root) {
  const manifest = JSON.parse(await readFile(join(root, '.next/required-server-files.json'), 'utf8'));
  const base = resolve(root, '.next/standalone');
  const candidate = resolve(base, manifest.relativeAppDir || '');
  const rel = relative(base, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || !candidate.startsWith(base)) {
    throw new Error('Standalone entry must remain inside the generated build.');
  }
  await access(join(candidate, 'server.js'));
  return candidate;
}

async function startPreview() {
  if (process.env.CALEONIS_UPSTREAM_PREVIEW !== '1') throw new Error('Preview-only launcher; application integration is not configured.');
  const forbidden = ['OPENAI_API_KEY', 'FREEPIK_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CLOUD_PROJECT', 'AI_GATEWAY_API_KEY', 'DATABASE_URL', 'CLOUDINARY_URL'];
  if (forbidden.some(name => process.env[name])) throw new Error('This isolated preview must not receive provider credentials or production data.');
  const root = resolve(process.argv[2] || 'vendor/open-higgsfield');
  const runtime = await runtimeDirectory(root);
  await mkdir(join(runtime, '.next'), { recursive: true });
  await cp(join(root, 'public'), join(runtime, 'public'), { recursive: true });
  await cp(join(root, '.next/static'), join(runtime, '.next/static'), { recursive: true });
  const child = spawn(process.execPath, [join(runtime, 'server.js')], {
    cwd: runtime,
    stdio: 'inherit',
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '4318', NODE_ENV: 'production' },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  child.once('error', () => { console.error('Preview process could not start.'); process.exitCode = 1; });
  child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startPreview().catch(error => { console.error(error.message); process.exitCode = 1; });
}
