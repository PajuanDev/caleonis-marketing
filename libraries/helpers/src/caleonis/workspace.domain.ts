// Shared validation for Caléonis documents. No credentials or side effects.
export const documentKinds = ['brand', 'campaign', 'project'] as const;
export type DocumentKind = typeof documentKinds[number];
export type DocumentInput = { kind: DocumentKind; title: string; data: Record<string, string | string[]> };
export const aspectRatios = ['1:1', '9:16', '16:9', '4:3', '3:4', '3:2', '2:3', '21:9'] as const;
export class WorkspaceInputError extends Error {}
const fields: Record<DocumentKind, Record<string, number>> = {
  brand: { activity: 2000, audience: 2000, tone: 1000, offers: 4000, guidelines: 4000, website: 500 },
  campaign: { objective: 2000, audience: 2000, offer: 2000, brief: 4000, cta: 500, brandId: 36 },
  project: { prompt: 4000, mode: 10, aspectRatio: 10, resolution: 5, campaignId: 36, connectionId: 36 },
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
