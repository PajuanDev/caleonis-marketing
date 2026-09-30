import { HttpException } from '@nestjs/common';
import Redis from 'ioredis';
import { ThirdParty, ThirdPartyAbstract } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { CreativeError, HiggsfieldEngine } from './higgsfield.engine';

let redis: Redis | undefined;
function client() {
  if (!process.env.REDIS_URL) throw new CreativeError('Le suivi des créations est indisponible.', 503);
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 5000, retryStrategy: () => null });
    // Avoid leaking connection strings from library error output.
    redis.on('error', () => {});
  }
  return redis;
}
const engine = new HiggsfieldEngine({
  async get(key) { return client().get(key); },
  async put(key, value, ttl, onlyIfAbsent) {
    const result = onlyIfAbsent
      ? await client().set(key, value, 'EX', ttl, 'NX')
      : await client().set(key, value, 'EX', ttl);
    return result === 'OK';
  },
});
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof CreativeError) throw new HttpException(error.message, error.httpStatus);
    throw new HttpException('Le service créatif est momentanément indisponible. Aucun réessai payant automatique.', 503);
  }
}
function scope(data: any) {
  if (typeof data?.__scope !== 'string' || !data.__scope) throw new CreativeError('Contexte de création absent.', 403);
  return data.__scope;
}

@ThirdParty({
  identifier: 'higgsfield',
  title: 'Higgsfield',
  description: 'Images de campagne via votre compte API Higgsfield. Facturation externe ; connexion facultative. Vidéo non incluse dans ce premier connecteur.',
  // The dedicated Apps UI owns this workflow. Do not inject an unsupported form in the native media picker.
  position: 'webhook',
  fields: [],
})
export class HiggsfieldProvider extends ThirdPartyAbstract {
  async checkConnection(apiKey: string) { return safe(() => engine.checkConnection(apiKey)); }
  async startImage(apiKey: string, data: any) {
    return safe(() => engine.start(apiKey, scope(data), data.clientRequestId, data));
  }
  async generationStatus(apiKey: string, data: any) {
    return safe(() => engine.status(apiKey, scope(data), data.jobId));
  }
  async sendData(_apiKey: string, data: any): Promise<string> {
    return safe(() => engine.output(scope(data), data.jobId));
  }
  async markImported(_apiKey: string, data: any) {
    return safe(() => engine.imported(scope(data), data.jobId, data.media));
  }
}
