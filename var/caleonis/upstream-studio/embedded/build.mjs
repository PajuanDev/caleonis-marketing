import { cp, mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || 'vendor/open-higgsfield');
const output = path.resolve(process.argv[3] || 'apps/frontend/public/caleonis-studio');
const work = path.join(here, '.stage');
const requireUpstream = createRequire(path.join(source, 'package.json'));
const requireTools = createRequire(path.join(here, 'package.json'));
const { build } = requireTools('esbuild');
const postcss = requireUpstream('postcss');
const tailwind = requireUpstream('@tailwindcss/postcss');
const pin = '1df1148e46d1b47d29e117b7bb1971a65c4286ee';

// Assert critical source blobs, not simply a misleading version label.
const expected = {
  'src/components/studio/StudioShell.tsx': 'e1a96627e5bcef529376832deb39691abb913278',
  'src/components/command-bar/CommandBar.tsx': '17f5cf42b0fec40ad23e7e3b95a74e0dd26439d7',
  'src/components/tasks/ResultsGrid.tsx': '98e4f8d87f9a385ab87f4b710c48f2b04d2fcd6d',
};
for (const [name, sha] of Object.entries(expected)) {
  const data = await readFile(path.join(source, name));
  const actual = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if (actual !== sha) throw new Error(`Pinned upstream differs: ${name}. Review the integration before updating.`);
}
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
await cp(path.join(source, 'src'), path.join(work, 'src'), { recursive: true });
await mkdir(path.join(work, 'src/caleonis'), { recursive: true });
for (const file of ['client.ts', 'entry.tsx', 'GenerationControls.tsx']) await cp(path.join(here, file), path.join(work, 'src/caleonis', file));
await cp(path.join(here, 'StudioShell.tsx'), path.join(work, 'src/components/studio/StudioShell.tsx'));
const english = JSON.parse(await readFile(path.join(source, 'src/messages/en.json'), 'utf8'));
const french = JSON.parse(await readFile(path.join(here, 'fr.json'), 'utf8'));
function merge(a,b) { for (const [k,v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v; return a; }
await writeFile(path.join(work, 'src/messages/fr.json'), JSON.stringify(merge(english, french)));

function once(text, needle, replacement) {
  if (text.split(needle).length !== 2) throw new Error(`Upstream patch mismatch: ${needle.slice(0, 80)}`);
  return text.replace(needle, replacement);
}
const commandPath = path.join(work, 'src/components/command-bar/CommandBar.tsx');
let command = await readFile(commandPath, 'utf8');
command = once(command, 'interface CommandBarProps {', `import type { StudioDraft } from '@/caleonis/client';\n\ninterface CommandBarProps {\n    initialDraft?: StudioDraft;\n    initialPrompt?: string;\n    onDraftChange?: (draft: StudioDraft, localFiles: boolean) => void;\n    generationEnabled?: boolean;\n    onGenerate?: () => void;`);
command = once(command, 'export function CommandBar({ mode, onModeChange }: CommandBarProps)', 'export function CommandBar({ mode, onModeChange, initialDraft, initialPrompt, onDraftChange, generationEnabled = false, onGenerate }: CommandBarProps)');
command = once(command, 'Object.keys(VIDEO_CAPABILITIES)[0]', '(initialDraft?.videoModelId && VIDEO_CAPABILITIES[initialDraft.videoModelId] ? initialDraft.videoModelId : Object.keys(VIDEO_CAPABILITIES)[0])');
command = once(command, 'Object.keys(IMAGE_CAPABILITIES)[0]', '(initialDraft?.imageModelId && IMAGE_CAPABILITIES[initialDraft.imageModelId] ? initialDraft.imageModelId : Object.keys(IMAGE_CAPABILITIES)[0])');
command = once(command, 'useState("");\n    const [videoSettings', 'useState(initialDraft?.videoVariantId || "");\n    const [videoSettings');
command = once(command, 'defaultSettings(VIDEO_CAPABILITIES[firstVideoId])', '(initialDraft?.videoSettings ? { ...defaultSettings(VIDEO_CAPABILITIES[firstVideoId]), ...initialDraft.videoSettings } : defaultSettings(VIDEO_CAPABILITIES[firstVideoId])) as SettingsValues');
command = once(command, 'const [sizeAspect, setSizeAspect] = useState(() => {', 'const [sizeAspect, setSizeAspect] = useState(() => {\n        if (initialDraft?.sizeAspect) return initialDraft.sizeAspect;');
command = once(command, 'const [sizeResolution, setSizeResolution] = useState(() => {', 'const [sizeResolution, setSizeResolution] = useState(() => {\n        if (initialDraft?.sizeResolution) return initialDraft.sizeResolution;');
command = once(command, 'useState<Record<string, unknown>>({})', 'useState<Record<string, unknown>>(initialDraft?.imageFieldValues || {})');
command = once(command, 'defaultValues: { prompt: "" }', 'defaultValues: { prompt: initialDraft?.prompt ?? initialPrompt ?? "" }');
command = once(command, 'const textareaRef = useRef<HTMLTextAreaElement>(null);', `useEffect(() => {\n        onDraftChange?.({schemaVersion: 1, mode, prompt, imageModelId, videoModelId, videoVariantId, sizeAspect, sizeResolution, imageFieldValues, videoSettings: {...videoSettings}}, attachments.length > 0 || Object.values(slotFiles).some(files => files.length > 0));\n    }, [mode, prompt, imageModelId, videoModelId, videoVariantId, sizeAspect, sizeResolution, imageFieldValues, videoSettings, attachments, slotFiles, onDraftChange]);\n    const textareaRef = useRef<HTMLTextAreaElement>(null);`);
command = once(command, 'const onSubmit = async (data: FormData) => {', 'const onSubmit = async (data: FormData) => {\n        if (!generationEnabled) { setApiError("CALEONIS_NOT_READY"); return; }\n        if (onGenerate) { onGenerate(); return; }');
command = once(command, 'type="submit"', 'type="submit" disabled={!generationEnabled} title={generationEnabled ? "Vérifier et confirmer la création" : "Vérifiez le modèle, la configuration et la sauvegarde du projet"}');
command = once(command, 'className="shrink-0 self-center border-none', 'className="disabled:opacity-40 disabled:cursor-not-allowed shrink-0 self-center border-none');
await writeFile(commandPath, command);
const imageCapsPath=path.join(work,'src/models/capabilities/image.ts');
const imageCaps=await readFile(imageCapsPath,'utf8');
await writeFile(imageCapsPath,imageCaps.split('\n').filter(line=>!line.includes('id: "enable_safety_checker"')).join('\n'));

// Keep the original gallery; destructive controls are not exposed until semantics match.
const resultsPath = path.join(work, 'src/components/tasks/ResultsGrid.tsx');
let results = await readFile(resultsPath, 'utf8');
results = results.replaceAll('<button onClick={(e) => { e.stopPropagation(); onDelete(task.task_id); }}', '<button disabled title="Gérer ce fichier dans Médias" onClick={(e) => { e.stopPropagation(); onDelete(task.task_id); }}');
results = results.replaceAll('href={`/api/download/${task.task_id}?index=${idx}`}', 'href={url}');
results = results.replaceAll('href={`/api/download/${task.task_id}`}', 'href={videoUrls[0]}');
results = results.replace('Generate a video to see results here', 'Les vidéos de ce projet apparaîtront ici').replace('Generate an image to see results here', 'Les images de ce projet apparaîtront ici');
await writeFile(resultsPath, results);

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
// Only existing host API operations are used; no imported backend, new sessions or credentials.
for (const folder of ['src/components', 'src/hooks']) for (const file of await walk(path.join(work, folder))) {
  if (!/\.(tsx?|jsx?)$/.test(file)) continue;
  let text = await readFile(file, 'utf8');
  if (!text.includes('fetch(')) continue;
  text = text.replaceAll('fetch(', 'studioFetch(');
  const patched = text.replace(/(["'])use client\1;/, match => `${match}\nimport { studioFetch } from '@/caleonis/client';`);
  if (patched === text) throw new Error(`Client directive missing in ${file}`);
  text = patched.replace('studioFetch(url).then((r) => r.json())', 'studioFetch(url).then(async r => { if (!r.ok) throw new Error("Historique indisponible"); const body = await r.json(); if (!Array.isArray(body)) throw new Error("Historique invalide"); return body; })');
  await writeFile(file, text);
}
await symlink(path.join(source, 'node_modules'), path.join(work, 'node_modules'), 'dir');
const typeConfig = JSON.parse(await readFile(path.join(source, 'tsconfig.json'), 'utf8'));
typeConfig.include = ['src/caleonis/entry.tsx'];
typeConfig.compilerOptions.incremental = false;
await writeFile(path.join(work, 'tsconfig.json'), JSON.stringify(typeConfig));
execFileSync(process.execPath, [path.join(source, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', path.join(work, 'tsconfig.json')], {stdio:'inherit'});
await mkdir(output, { recursive: true });
const compile = await build({
  absWorkingDir: work, entryPoints: [path.join(work, 'src/caleonis/entry.tsx')], outfile: path.join(output, 'studio.js'),
  bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', target: ['es2020'],
  minify: true, sourcemap: false, metafile: true,
  alias: { '@': path.join(work, 'src') }, nodePaths: [path.join(source, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const serverCode = Object.keys(compile.metafile.inputs).filter(file => /src\/(providers|app\/api)\/|src\/lib\/(task-store|database|generation-service|poller)/.test(file));
if (serverCode.length) throw new Error(`Server-only upstream code reached the client bundle: ${serverCode.join(', ')}`);
if (process.env.CALEONIS_STUDIO_BUILD_FIXTURE === 'isolated') {
  const repo = path.resolve(here, '../../../..');
  const host = path.join(work, 'src/caleonis/host');
  await mkdir(host, { recursive: true });
  for (const file of ['embedded-studio.component.tsx', 'studio-channel.mjs']) await cp(path.join(repo, 'apps/frontend/src/caleonis', file), path.join(host, file));
  await cp(path.join(here, 'host-entry.tsx'), path.join(work, 'src/caleonis/host-entry.tsx'));
  await cp(path.join(here, 'host-mocks.tsx'), path.join(work, 'src/caleonis/host-mocks.tsx'));
  const mocks = path.join(work, 'src/caleonis/host-mocks.tsx');
  await build({ absWorkingDir: work, entryPoints:[path.join(work,'src/caleonis/host-entry.tsx')], outfile:path.join(output,'fixture-host.js'), bundle:true, platform:'browser',format:'esm',jsx:'automatic',target:['es2020'],minify:true,sourcemap:false,nodePaths:[path.join(source,'node_modules')],define:{'process.env.NODE_ENV':'"production"'},alias:{'@':path.join(work,'src'),'next/link':mocks,'@gitroom/helpers/utils/custom.fetch':mocks,'@gitroom/frontend/components/layout/user.context':mocks} });
  await writeFile(path.join(output,'fixture-host.html'), '<!doctype html><html lang="fr" class="dark"><head><meta charset="utf-8"><title>Caléonis — intégration technique isolée</title><link rel="stylesheet" href="/caleonis-studio/studio.css"><style>body{margin:0;background:#141414;color:#fff}#host-root{height:100vh;display:flex}iframe{width:100%;min-height:650px}nav{min-height:45px}</style></head><body><div id="host-root"></div><script type="module" src="/fixture-host.js"></script></body></html>');
}
const css = await readFile(path.join(work, 'src/app/globals.css'), 'utf8');
const compiledCSS = await postcss([tailwind({ base: work, optimize: { minify: true } })]).process(css, { from: path.join(source, 'src/app/globals.css'), to: path.join(output, 'studio.css') });
await writeFile(path.join(output, 'studio.css'), compiledCSS.css);
await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="fr" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="same-origin"><title>Studio créatif — Caléonis Marketing</title><link rel="stylesheet" href="./studio.css"></head><body><div id="studio-root"></div><script type="module" src="./studio.js"></script></body></html>`);
await cp(path.join(source, 'LICENSE'), path.join(output, 'UPSTREAM_LICENSE.txt'));
await writeFile(path.join(output, 'build-info.json'), JSON.stringify({ upstream: pin, clientOnly: true, originalCommandBar: true, originalResultsGrid: true, isolatedStyles: true, providerCodeBundled: false, generationEnabled: false }, null, 2));
console.log(JSON.stringify({ output, upstream: pin, browserModules: Object.keys(compile.metafile.inputs).length, providerCodeBundled: false }));
