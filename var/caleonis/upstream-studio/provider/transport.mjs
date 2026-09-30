/** Scoped transport for the pinned upstream Freepik provider.
 * Current API documentation uses Magnific. No mutable process-wide credential,
 * user-selected URL, redirect or retry is used by a paid submission.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
const scope = new AsyncLocalStorage();
const paths = ['/v1/ai/text-to-image/flux-2-pro', '/v1/ai/text-to-video/ltx-2-pro', '/v1/ai/image-to-video/ltx-2-pro'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ProviderTransportError extends Error {
  constructor(message, state = 'unknown') { super(message); this.state = state; }
}
export function withProviderKey(key, operation, transport = fetch) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 512 || /\s/.test(key)) throw new ProviderTransportError('Fournisseur non configuré.', 'failed');
  return scope.run({ key, transport }, operation);
}
export function validateProviderPath(path, method) {
  if (typeof path !== 'string') throw new ProviderTransportError('Route fournisseur refusée.', 'failed');
  if (method === 'POST' && paths.includes(path)) return;
  if (method === 'GET' && paths.some(base => path.startsWith(base + '/') && uuid.test(path.slice(base.length + 1)))) return;
  throw new ProviderTransportError('Route fournisseur refusée.', 'failed');
}
function cleanPayload(path, body) {
  const video = path.includes('-to-video/');
  const allow = video ? ['prompt','duration','resolution','generate_audio','fps','seed','image','image_url'] : ['prompt','width','height','seed','prompt_upsampling','input_image','input_image_2','input_image_3','input_image_4'];
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !allow.includes(k))) throw new ProviderTransportError('Paramètres fournisseur refusés.', 'failed');
  const clean = {...body};
  // Upstream LtxAdapter currently uses `image`; the documented API uses image_url.
  if (Object.hasOwn(clean, 'image')) { clean.image_url = clean.image; delete clean.image; }
  return clean;
}
async function request(path, method, body) {
  validateProviderPath(path, method);
  const current = scope.getStore();
  if (!current) throw new ProviderTransportError('Contexte fournisseur absent.', 'failed');
  const encoded = method === 'POST' ? JSON.stringify(cleanPayload(path, body)) : undefined;
  if (encoded && Buffer.byteLength(encoded) > 29 * 1024 * 1024) throw new ProviderTransportError('Références trop volumineuses.', 'failed');
  try {
    const res = await current.transport('https://api.magnific.com' + path, {
      method, headers: {'x-magnific-api-key':current.key, ...(encoded ? {'Content-Type':'application/json'} : {})},
      body:encoded, redirect:'error', signal:AbortSignal.timeout(45000), cache:'no-store',
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new ProviderTransportError('Demande fournisseur non confirmée.', method === 'POST' && [400,401,403,404,413,422,429].includes(res.status) ? 'failed' : 'unknown');
    }
    if (!res.body) throw new Error('empty');
    const reader=res.body.getReader(); const chunks=[]; let size=0;
    try { while(true) { const next=await reader.read(); if(next.done) break; size+=next.value.byteLength; if(size>1024*1024) {await reader.cancel();throw new Error('large');} chunks.push(next.value); } }
    finally {reader.releaseLock();}
    const decoded=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const root=decoded?.data ?? decoded;
    if (!root || typeof root!=='object' || Array.isArray(root)) throw new Error('shape');
    const status=String(root.status ?? root.task_status ?? '').toUpperCase();
    if (!['CREATED','IN_PROGRESS','COMPLETED','FAILED','ERROR','CANCELLED'].includes(status)) throw new Error('status');
    if (method==='POST' && (!uuid.test(root.task_id || '') || !['CREATED','IN_PROGRESS'].includes(status))) throw new Error('id');
    if (method==='GET' && root.task_id && root.task_id !== path.split('/').pop()) throw new Error('wrong id');
    const generated=typeof root.generated==='string' ? [root.generated] : root.generated || [];
    if (!Array.isArray(generated) || generated.length>4 || generated.some(url=>typeof url!=='string'||url.length>4096)) throw new Error('assets');
    // Drop raw errors and any vendor fields that could echo a prompt or a secret.
    return {data:{status,task_id:root.task_id,generated}};
  } catch(error) {
    if(error instanceof ProviderTransportError)throw error;
    throw new ProviderTransportError('Réponse fournisseur incertaine. Aucun nouvel achat automatique.');
  }
}
export const freepikPost=(path,body)=>request(path,'POST',body);
export const freepikGet=path=>request(path,'GET');
export const normaliseAsyncPayload=payload=>({status:payload.data.status,urls:payload.data.generated});
export const extractErrorMessage=()=> 'Le fournisseur a refusé ou interrompu cette création.';
