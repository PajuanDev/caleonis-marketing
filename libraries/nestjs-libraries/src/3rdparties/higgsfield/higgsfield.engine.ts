import { createHash } from 'node:crypto';

// Server-only integration. No SDK, model weights or credentials enter the browser.
const ORIGIN = 'https://api.higgsfield.ai';
const TTL = 7 * 24 * 60 * 60;
const RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export interface CreativeStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttl: number, onlyIfAbsent?: boolean): Promise<boolean>;
}
export class CreativeError extends Error {
  httpStatus: number;
  constructor(message: string, httpStatus = 400) {
    super(message);
    this.name = 'CreativeError';
    this.httpStatus = httpStatus;
  }
}
export function parseCredentials(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new CreativeError('Clé Higgsfield invalide.');
  const key = value.trim();
  if (!/^[A-Za-z0-9._~-]+:[A-Za-z0-9._~-]+$/.test(key)) throw new CreativeError('Utilisez le format KEY_ID:KEY_SECRET.');
  return key;
}
export function imageInput(value: any) {
  if (!value || value.confirmPaidGeneration !== true) throw new CreativeError('Confirmez la facturation Higgsfield avant de générer.');
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt || prompt.length > 4000) throw new CreativeError('Le brief doit contenir entre 1 et 4 000 caractères.');
  if (!['1k', '2k', '4k'].includes(value.resolution)) throw new CreativeError('Résolution non prise en charge.');
  if (!RATIOS.includes(value.aspect_ratio)) throw new CreativeError('Format non pris en charge.');
  // Explicit allow-list: clients cannot supply a model URL, webhook, preset, batch or moderation override.
  return { prompt, resolution: value.resolution as string, aspect_ratio: value.aspect_ratio as string, enhance_prompt: false };
}
export function statusUrl(value: unknown, requestId: string) {
  const fallback = `${ORIGIN}/requests/${requestId}/status`;
  if (!value) return fallback;
  if (typeof value !== 'string') throw new CreativeError('Réponse Higgsfield invalide.', 502);
  const url = new URL(value);
  if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash || url.pathname !== `/requests/${requestId}/status`) {
    throw new CreativeError('Adresse de suivi Higgsfield refusée.', 502);
  }
  return url.href;
}
type State = 'submitting' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw' | 'cancelled' | 'unknown';
type Job = {
  id: string; fingerprint: string; createdAt: string; state: State;
  requestId?: string; statusUrl?: string; outputUrl?: string; message?: string;
  media?: { id: string; path: string; name?: string };
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class HiggsfieldEngine {
  store: CreativeStore;
  fetcher: typeof fetch;
  constructor(store: CreativeStore, fetcher: typeof fetch = fetch) { this.store = store; this.fetcher = fetcher; }
  private key(scope: string, id: string) {
    if (!scope || scope.length > 200 || !UUID.test(id || '')) throw new CreativeError('Identifiant de création invalide.');
    return `caleonis:creative:higgsfield:${hash(scope)}:${id}`;
  }
  private async request(credentials: string, path: string, input?: unknown) {
    const response = await this.fetcher(path.startsWith(ORIGIN + '/') ? path : ORIGIN + path, {
      method: input === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Key ${parseCredentials(credentials)}`, Accept: 'application/json', ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      // Never return raw upstream bodies, headers, credentials or signed URLs in errors.
      const message = response.status === 401 || response.status === 403 ? 'Higgsfield a refusé cette clé API.'
        : response.status === 402 ? 'Le solde API Higgsfield est insuffisant.'
        : response.status === 429 ? 'Limite Higgsfield atteinte. Réessayez plus tard.'
        : response.status === 400 || response.status === 422 ? 'Higgsfield a refusé les paramètres de cette création.'
        : 'Higgsfield est momentanément indisponible.';
      throw new CreativeError(message, response.status === 429 ? 429 : 502);
    }
    return response.json();
  }
  async checkConnection(credentials: string) {
    const key = parseCredentials(credentials);
    // Catalog GET only: connecting does not purchase a generation.
    const result = await this.request(key, '/marketing-studio/image/presets?size=1');
    if (!result || !Array.isArray(result.items)) throw new CreativeError('Catalogue Higgsfield inattendu.', 502);
    return { name: 'Higgsfield', username: 'Compte API connecté', id: `higgsfield:${hash(key.split(':')[0])}` };
  }
  private summary(job: Job) {
    return { id: job.id, status: job.state, createdAt: job.createdAt, requestId: job.requestId, message: job.message, media: job.media };
  }
  private async load(scope: string, id: string): Promise<Job> {
    const value = await this.store.get(this.key(scope, id));
    if (!value) throw new CreativeError('Création introuvable ou suivi expiré (7 jours).', 404);
    return JSON.parse(value);
  }
  async start(credentials: string, scope: string, id: string, value: unknown) {
    const key = this.key(scope, id);
    const input = imageInput(value);
    parseCredentials(credentials);
    const fingerprint = hash(JSON.stringify(input));
    const job: Job = { id, fingerprint, createdAt: new Date().toISOString(), state: 'submitting' };
    // Reserve before the chargeable call. Concurrent or repeated submissions reuse this exact record.
    const reserved = await this.store.put(key, JSON.stringify(job), TTL, true);
    if (!reserved) {
      const existing = await this.load(scope, id);
      if (existing.fingerprint !== fingerprint) throw new CreativeError('Cette demande existe avec un autre brief.', 409);
      return this.summary(existing);
    }
    try {
      const result = await this.request(credentials, '/marketing-studio/image', input);
      if (!result || !UUID.test(result.request_id || '')) throw new CreativeError('Identifiant Higgsfield inattendu.', 502);
      job.requestId = result.request_id;
      job.statusUrl = statusUrl(result.status_url, result.request_id);
      job.state = 'queued';
      this.applyResult(job, result);
    } catch (error) {
      // No automatic POST retry: a timeout may hide an accepted/charged upstream request.
      job.state = 'unknown';
      job.message = error instanceof CreativeError ? error.message : 'Réponse non confirmée. Vérifiez vos demandes dans Higgsfield avant toute nouvelle génération.';
    }
    await this.store.put(key, JSON.stringify(job), TTL);
    return this.summary(job);
  }
  private applyResult(job: Job, result: any) {
    const allowed: State[] = ['queued', 'in_progress', 'completed', 'failed', 'nsfw', 'cancelled'];
    const state = result.status === 'canceled' ? 'cancelled' : result.status;
    if (!allowed.includes(state)) throw new CreativeError('État Higgsfield inattendu.', 502);
    job.state = state;
    if (state === 'completed') {
      const raw = result.images?.[0]?.url;
      if (typeof raw !== 'string' || raw.length > 8192) throw new CreativeError('Aucune image exploitable dans le résultat.', 502);
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password) throw new CreativeError('Adresse du média refusée.', 502);
      job.outputUrl = raw;
    }
    if (state === 'nsfw') job.message = 'Création refusée par la modération Higgsfield. Modifiez le brief.';
    if (state === 'failed') job.message = 'La génération a échoué chez Higgsfield. Consultez sa console pour le détail.';
  }
  async status(credentials: string, scope: string, id: string) {
    const job = await this.load(scope, id);
    if (job.state === 'queued' || job.state === 'in_progress') {
      const result = await this.request(credentials, statusUrl(job.statusUrl, job.requestId!));
      if (result.request_id && result.request_id !== job.requestId) throw new CreativeError('Résultat de création incohérent.', 502);
      this.applyResult(job, result);
      await this.store.put(this.key(scope, id), JSON.stringify(job), TTL);
    }
    if (job.state === 'submitting' && Date.now() - Date.parse(job.createdAt) > 60000) {
      // Report uncertainty without unlocking/replaying an accepted request after a server restart.
      return { ...this.summary(job), status: 'unknown', message: 'Envoi non confirmé. Vérifiez la console Higgsfield avant de recréer.' };
    }
    return this.summary(job);
  }
  async output(scope: string, id: string) {
    const job = await this.load(scope, id);
    if (job.state !== 'completed' || !job.outputUrl) throw new CreativeError('Cette image n’est pas encore prête.', 409);
    return job.outputUrl;
  }
  async imported(scope: string, id: string, media: Job['media']) {
    const job = await this.load(scope, id);
    job.media = media;
    await this.store.put(this.key(scope, id), JSON.stringify(job), TTL);
  }
}
