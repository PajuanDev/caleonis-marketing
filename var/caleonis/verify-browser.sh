#!/usr/bin/env bash
# One-shot checks for our own public pilot. No account creation, credentials or publication.
# Run in mcr.microsoft.com/playwright:v1.63.0-noble. Do not attach data volumes or secrets.
set -euo pipefail
readonly TARGET='https://caleonis-marketing-production.up.railway.app'
export TARGET
node <<'NODE'
(async () => {
  for (const path of ['/healthz', '/auth/login', '/api/auth/can-register']) {
    const response = await fetch(process.env.TARGET + path, { signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    console.log('CALEONIS_HTTP', JSON.stringify({ path, status: response.status, json: path.includes('healthz') || path.includes('can-register') ? text.slice(0, 200) : undefined }));
    if (response.status !== 200) throw new Error(`Unexpected HTTP status for ${path}`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
npm install --prefix /tmp/caleonis-browser --no-audit --no-fund agent-browser@0.38.1
export AGENT_BROWSER_EXECUTABLE_PATH="$(find /ms-playwright -type f -name chrome -print -quit)"
test -x "$AGENT_BROWSER_EXECUTABLE_PATH"
export AGENT_BROWSER_SESSION=caleonis-smoke
AB=/tmp/caleonis-browser/node_modules/.bin/agent-browser
cleanup() { "$AB" close >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$AB" --args '--no-sandbox,--disable-dev-shm-usage' open "$TARGET/auth/login"
"$AB" wait 'input[name="email"]'
"$AB" snapshot -i
"$AB" eval 'JSON.stringify({title:document.title,url:location.href,ready:document.readyState,brand:document.body.innerText.includes("Caléonis"),email:!!document.querySelector("input[name=email]"),password:!!document.querySelector("input[type=password]"),overflow:document.documentElement.scrollWidth>innerWidth+2})'
"$AB" errors
"$AB" screenshot /tmp/caleonis-login.png
"$AB" set viewport 390 844
"$AB" eval 'JSON.stringify({viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,email:!!document.querySelector("input[name=email]")})'
"$AB" open "$TARGET/auth"
"$AB" snapshot -i
"$AB" eval 'JSON.stringify({title:document.title,url:location.href,brand:document.body.innerText.includes("Caléonis"),formCount:document.forms.length,buttons:Array.from(document.querySelectorAll("button")).map(b=>b.innerText).slice(0,10)})'
"$AB" errors
printf 'CALEONIS_BROWSER_SMOKE_COMPLETED\n'
