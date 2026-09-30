import { Readable } from 'node:stream';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';
import { ssrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
const { fileTypeFromBuffer } = require('file-type');
/** A provider-returned URL is not trusted. Pinned DNS, no redirects, bounded stream, sniffed bytes. */
export async function storeProviderAsset(url: string, kind: 'image' | 'video') {
  if (typeof url !== 'string' || url.length > 4096 || !(await isSafePublicHttpsUrl(url))) throw new Error('Adresse de résultat refusée.');
  const cap = kind === 'image' ? 30 * 1024 * 1024 : 200 * 1024 * 1024;
  const response = await fetch(url, {
    // @ts-ignore undici's DNS-pinning dispatcher is a Node fetch extension.
    dispatcher: ssrfSafeDispatcher,
    redirect: 'error', signal: AbortSignal.timeout(120000),
  });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > cap) {
    await response.body?.cancel(); throw new Error('Résultat indisponible ou trop volumineux.');
  }
  const reader = response.body.getReader(); const initial: Uint8Array[] = []; let total = 0;
  try {
    while (total < 4100) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > cap) throw new Error('Résultat trop volumineux.');
      initial.push(chunk.value);
    }
    const detected = await fileTypeFromBuffer(Buffer.concat(initial));
    const allowed = kind === 'image' ? ['image/png','image/jpeg','image/webp'] : ['video/mp4'];
    if (!detected || !allowed.includes(detected.mime)) throw new Error('Format de résultat non pris en charge.');
    async function* stream() {
      for (const chunk of initial) yield chunk;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) return;
        total += chunk.value.byteLength;
        if (total > cap) throw new Error('Résultat trop volumineux.');
        yield chunk.value;
      }
    }
    return await UploadFactory.createStorage().uploadStream(Readable.from(stream()), detected.mime, detected.ext);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
