import { open, realpath } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep } from 'node:path';

export type ImageReference = { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' | 'image/webp' };
export class NativeImageError extends Error {
  state: 'failed' | 'unknown';
  constructor(message: string, state: 'failed' | 'unknown' = 'failed') { super(message); this.state = state; }
}
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_BYTES = 20 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;
const models = new Set(['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2']);
export function imageMime(bytes: Uint8Array): ImageReference['mime'] | null {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
/** Read a previously authorized Media row, never a user-supplied arbitrary path. */
export async function readLocalReference(mediaUrl: string, frontendUrl: string, uploadRoot: string): Promise<ImageReference> {
  let url: URL; let rootUrl: URL;
  try { url = new URL(mediaUrl); rootUrl = new URL(frontendUrl); } catch { throw new NativeImageError('Adresse de référence invalide.'); }
  if (url.origin !== rootUrl.origin || url.username || url.password || url.hash || url.search || !url.pathname.startsWith('/uploads/')) throw new NativeImageError('Référence hors du stockage autorisé.');
  let suffix: string;
  try { suffix = decodeURIComponent(url.pathname.slice('/uploads/'.length)); } catch { throw new NativeImageError('Chemin de référence invalide.'); }
  if (!suffix || suffix.includes('\\') || suffix.includes('\0') || suffix.split('/').some(v => v === '.' || v === '..' || !v)) throw new NativeImageError('Chemin de référence invalide.');
  const root = await realpath(uploadRoot);
  const file = await realpath(resolve(root, suffix));
  const rel = relative(root, file);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new NativeImageError('Référence hors du stockage autorisé.');
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 8 || stat.size > MAX_REFERENCE_BYTES) throw new NativeImageError('Référence vide ou supérieure à 10 Mo.');
    // Bound the read even if another process grows the file after stat().
    const buffer = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const chunk = await handle.read(buffer, count, buffer.length - count, count);
      if (!chunk.bytesRead) break;
      count += chunk.bytesRead;
    }
    if (count !== stat.size) throw new NativeImageError('La référence a changé pendant sa lecture.');
    const bytes = buffer.subarray(0, count); const mime = imageMime(bytes);
    if (!mime) throw new NativeImageError('Référence non prise en charge. Utilisez PNG, JPEG ou WebP.');
    return { bytes, mime };
  } finally { await handle.close(); }
}
export type NativeImageInput = { model: string; prompt: string; size: string; quality: string; references: ImageReference[] };
export function validateNativeImage(input: NativeImageInput) {
  if (!models.has(input.model) || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 20000) throw new NativeImageError('Modèle ou brief invalide.');
  if (!['low', 'medium', 'high'].includes(input.quality)) throw new NativeImageError('Qualité invalide.');
  const dimensions = /^(\d{3,4})x(\d{3,4})$/.exec(input.size);
  if (!dimensions) throw new NativeImageError('Dimensions invalides.');
  const [w, h] = dimensions.slice(1).map(Number);
  if (w % 16 || h % 16 || Math.max(w,h) > 2048 || Math.max(w,h) / Math.min(w,h) > 3 || w*h < 655360 || w*h > 4194304) throw new NativeImageError('Dimensions non prises en charge par ce studio.');
  if (!Array.isArray(input.references) || input.references.length > 4) throw new NativeImageError('Quatre images de référence maximum.');
  let total = 0;
  for (const ref of input.references) {
    if (!ref.bytes || ref.bytes.byteLength > MAX_REFERENCE_BYTES || imageMime(ref.bytes) !== ref.mime) throw new NativeImageError('Référence image invalide.');
    total += ref.bytes.byteLength;
  }
  if (total > MAX_TOTAL_REFERENCE_BYTES) throw new NativeImageError('Les références dépassent 20 Mo au total.');
}
async function boundedJson(response: Response) {
  if (!response.body) throw new NativeImageError('Réponse fournisseur vide.', 'unknown');
  const reader = response.body.getReader(); const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new NativeImageError('Réponse fournisseur trop volumineuse.', 'unknown'); }
      parts.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } finally { reader.releaseLock(); }
}
/** Exactly one outbound request. No SDK retries, redirects, automatic prompt rewrite or moderation overrides. */
export async function renderNativeImage(input: NativeImageInput, apiKey: string, transport: typeof fetch = fetch) {
  validateNativeImage(input);
  if (!apiKey || apiKey.length < 20 || /\s/.test(apiKey)) throw new NativeImageError('Moteur natif non configuré.');
  const params = { model: input.model, prompt: input.prompt, size: input.size, quality: input.quality, n: 1, output_format: 'png' };
  let body: FormData | string;
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  const editing = input.references.length > 0;
  if (editing) {
    body = new FormData();
    Object.entries(params).forEach(([key,value]) => (body as FormData).append(key, String(value)));
    input.references.forEach((ref,index) => (body as FormData).append('image[]', new Blob([new Uint8Array(ref.bytes)], { type: ref.mime }), `reference-${index + 1}.${ref.mime === 'image/jpeg' ? 'jpg' : ref.mime.split('/')[1]}`));
  } else { body = JSON.stringify(params); headers['Content-Type'] = 'application/json'; }
  try {
    const response = await transport(`https://api.openai.com/v1/images/${editing ? 'edits' : 'generations'}`, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(150000) });
    if (!response.ok) {
      const state = [400,401,403,404,413,422,429].includes(response.status) ? 'failed' : 'unknown';
      // Never put provider bodies, prompts, credentials or headers into logs/errors.
      await response.body?.cancel();
      throw new NativeImageError(state === 'failed' ? 'Demande refusée par le fournisseur. Vérifiez les droits, le solde et le contenu.' : 'Réponse fournisseur incertaine. Aucun nouvel achat automatique.', state);
    }
    const result = await boundedJson(response);
    const encoded = result?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || !encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new NativeImageError('Image fournisseur non exploitable.', 'unknown');
    const bytes = Buffer.from(encoded, 'base64');
    if (imageMime(bytes) !== 'image/png') throw new NativeImageError('Format fournisseur inattendu.', 'unknown');
    const usage: Record<string, number> = {};
    for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) if (Number.isSafeInteger(result.usage?.[key]) && result.usage[key] >= 0) usage[key] = result.usage[key];
    const request = response.headers.get('x-request-id') || '';
    return { bytes, mime: 'image/png' as const, usage, requestId: /^[a-zA-Z0-9_-]{1,180}$/.test(request) ? request : null };
  } catch (error) {
    if (error instanceof NativeImageError) throw error;
    throw new NativeImageError('État fournisseur incertain. Aucun nouvel achat automatique.', 'unknown');
  }
}
