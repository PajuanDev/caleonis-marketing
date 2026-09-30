import path from 'node:path';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(process.argv[2]||'vendor/open-higgsfield');
const out=path.resolve(process.argv[3]||'var/caleonis/provider-runtime');
const {build}=createRequire(path.join(here,'../embedded/package.json'))('esbuild');
const hashes=JSON.parse(await readFile(path.join(here,'upstream-hashes.json'),'utf8'));
for(const [file,expected] of Object.entries(hashes)) {
  const data=await readFile(path.join(source,file));
  const hash=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  if(hash!==expected)throw new Error(`Upstream changed: ${file}`);
}
await mkdir(out,{recursive:true});
const result=await build({entryPoints:[path.join(here,'entry.ts')],outfile:path.join(out,'upstream.cjs'),platform:'node',format:'cjs',target:'node22',bundle:true,metafile:true,
  alias:{'@/lib/freepik-client':path.join(here,'transport.mjs'),'@':path.join(source,'src')},nodePaths:[path.join(source,'node_modules')],sourcemap:false});
if(Object.keys(result.metafile.inputs).some(p=>/task-store|generation-service|poller|\/app\/api\//.test(p)))throw new Error('Global upstream task management must not enter the SaaS runtime');
await cp(path.join(source,'LICENSE'),path.join(out,'UPSTREAM_LICENSE.txt'));
await writeFile(path.join(out,'build-info.json'),JSON.stringify({upstream:'1df1148e46d1b47d29e117b7bb1971a65c4286ee',actualProvider:'FreepikProvider',actualAdapters:['FluxAdapter','LtxAdapter'],apiOrigin:'https://api.magnific.com',clientBundle:false,modules:Object.keys(result.metafile.inputs)},null,2));
