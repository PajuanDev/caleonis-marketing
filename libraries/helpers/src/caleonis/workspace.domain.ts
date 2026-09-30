// Shared validation for Caléonis documents. No credentials or side effects.
export const documentKinds = ['brand', 'campaign', 'project'] as const;
export type DocumentKind = typeof documentKinds[number];
export type DocumentInput = { kind: DocumentKind; title: string; data: Record<string, string | string[]> };
export const aspectRatios = ['1:1', '9:16', '16:9', '4:3', '3:4', '3:2', '2:3', '21:9'] as const;
export class WorkspaceInputError extends Error {}
const fields: Record<DocumentKind, Record<string, number>> = {
  brand: { activity: 2000, audience: 2000, tone: 1000, offers: 4000, guidelines: 4000, website: 500 },
  campaign: { objective: 2000, audience: 2000, offer: 2000, brief: 4000, cta: 500, brandId: 36 },
  project: { prompt: 4000, mode: 10, aspectRatio: 10, resolution: 5, campaignId: 36, connectionId: 36, engine: 20, quality: 10, studioSettings: 16000 },
};
export function requireId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new WorkspaceInputError('Identifiant invalide.');
  return value;
}
export function requireKind(value: unknown): DocumentKind {
  if (!documentKinds.includes(value as DocumentKind)) throw new WorkspaceInputError('Type de document invalide.');
  return value as DocumentKind;
}
export function requireRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new WorkspaceInputError('Version de sauvegarde absente.');
  return Number(value);
}
export function validateDocument(body: unknown): DocumentInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WorkspaceInputError('Document invalide.');
  const input = body as Record<string, unknown>;
  const kind = requireKind(input.kind);
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120) throw new WorkspaceInputError('Le titre doit contenir de 1 à 120 caractères.');
  if (!input.data || typeof input.data !== 'object' || Array.isArray(input.data)) throw new WorkspaceInputError('Contenu du document invalide.');
  const raw = input.data as Record<string, unknown>;
  const data: Record<string, string | string[]> = {};
  for (const key of Object.keys(raw)) {
    // Preserve own-property checking without raising the frontend TypeScript target.
    if (!Object.prototype.hasOwnProperty.call(fields[kind], key) && !(kind === 'project' && key === 'referenceIds')) throw new WorkspaceInputError('Champ non pris en charge.');
  }
  for (const [key, limit] of Object.entries(fields[kind])) {
    const value = raw[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) throw new WorkspaceInputError(`Champ invalide : ${key}.`);
    data[key] = value.trim();
    if (key.endsWith('Id') && data[key]) requireId(data[key]);
  }
  if (kind === 'brand' && data.website) {
    let url: URL;
    try { url = new URL(data.website as string); } catch { throw new WorkspaceInputError('Adresse du site invalide.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new WorkspaceInputError('Utilisez une adresse HTTPS sans identifiants.');
  }
  if (kind === 'project') {
    data.engine ||= data.connectionId ? 'higgsfield' : 'native'; data.quality ||= 'medium';
    if (!['native', 'higgsfield'].includes(data.engine as string) || !['low', 'medium', 'high'].includes(data.quality as string)) throw new WorkspaceInputError('Moteur ou qualité invalide.');
    if (data.studioSettings) data.studioSettings = validateStudioSettings(data.studioSettings as string);
    data.mode ||= 'image'; data.aspectRatio ||= '1:1'; data.resolution ||= '1k';
    if (!['image', 'video'].includes(data.mode as string) || !aspectRatios.includes(data.aspectRatio as any) || !['1k', '2k', '4k'].includes(data.resolution as string)) throw new WorkspaceInputError('Paramètres créatifs invalides.');
    const ids = raw.referenceIds ?? [];
    if (!Array.isArray(ids) || ids.length > 8) throw new WorkspaceInputError('Huit références maximum.');
    data.referenceIds = [...new Set(ids.map(requireId))];
  }
  return { kind, title: input.title.trim(), data };
}
export function referenceLinks(input: DocumentInput): Array<{ id: string; kind: 'brand' | 'campaign' | 'media' | 'connection' }> {
  const links: Array<{ id: string; kind: 'brand' | 'campaign' | 'media' | 'connection' }> = [];
  if (input.data.brandId) links.push({ id: input.data.brandId as string, kind: 'brand' });
  if (input.data.campaignId) links.push({ id: input.data.campaignId as string, kind: 'campaign' });
  if (input.data.connectionId) links.push({ id: input.data.connectionId as string, kind: 'connection' });
  for (const id of (input.data.referenceIds || []) as string[]) links.push({ id, kind: 'media' });
  return links;
}

/** Persist UI choices, never credentials, URLs, authorization or executable provider payloads.
 * Before generation a provider adapter must independently validate model capabilities.
 */
export function validateStudioSettings(serialized: string): string {
  if (typeof serialized !== 'string' || serialized.length > 16000) throw new WorkspaceInputError('Réglages du studio trop volumineux.');
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new WorkspaceInputError('Réglages du studio illisibles.'); }
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  const fail = (): never => { throw new WorkspaceInputError('Réglages du studio invalides.'); };
  if (!record(value)) return fail();
  const allowed = ['schemaVersion', 'imageModelId', 'videoModelId', 'videoVariantId', 'sizeAspect', 'sizeResolution', 'imageFieldValues', 'videoSettings'];
  if (Object.keys(value).some(key => !allowed.includes(key)) || value.schemaVersion !== 1) return fail();
  const clean: Record<string, unknown> = { schemaVersion: 1 };
  for (const key of ['imageModelId', 'videoModelId', 'videoVariantId', 'sizeAspect', 'sizeResolution']) {
    const item = value[key];
    if (typeof item !== 'string' || item.length > 180 || /[\u0000-\u001f]/.test(item)) return fail();
    clean[key] = item;
  }
  const forbidden = /(?:__proto__|constructor|prototype|api.?key|secret|token|credential|endpoint|url|organization|authoriz|webhook|approved|spend|budget)/i;
  const primitive = (item: unknown): item is string | number | boolean =>
    (typeof item === 'string' && item.length <= 2000 && !item.includes('://') && !item.startsWith('data:')) ||
    (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e12) || typeof item === 'boolean';
  const map = (item: unknown): Record<string, unknown> => {
    if (!record(item) || Object.keys(item).length > 48) return fail();
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || forbidden.test(key) || !primitive(item[key])) return fail();
      result[key] = item[key];
    }
    return result;
  };
  clean.imageFieldValues = map(value.imageFieldValues);
  if (!record(value.videoSettings)) return fail();
  const video: Record<string, unknown> = {};
  const videoFields = ['duration', 'aspectRatio', 'size', 'cfgScale', 'negativePrompt', 'shotType', 'style', 'expandPrompt', 'seed', 'fieldValues'];
  if (Object.keys(value.videoSettings).some(key => !videoFields.includes(key))) return fail();
  for (const key of Object.keys(value.videoSettings).sort()) {
    const item = value.videoSettings[key];
    if (key === 'fieldValues') video[key] = map(item);
    else if (key === 'cfgScale') { if (typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > 100) return fail(); video[key] = item; }
    else if (key === 'expandPrompt') { if (typeof item !== 'boolean') return fail(); video[key] = item; }
    else { if (typeof item !== 'string' || item.length > 2000) return fail(); video[key] = item; }
  }
  clean.videoSettings = video;
  const result = JSON.stringify(clean);
  if (result.length > 16000) return fail();
  return result;
}
