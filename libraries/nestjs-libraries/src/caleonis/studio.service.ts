import { UpstreamStudioService, upstreamConfiguration } from './upstream-studio.service';
import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';
import { HiggsfieldProvider } from '@gitroom/nestjs-libraries/3rdparties/higgsfield/higgsfield.provider';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { createWorkspaceRepository } from './workspace.repository';
import { createStudioRepository, StudioReservationError, StudioRun } from './studio.repository';
import { requireId, requireRevision } from '@gitroom/helpers/caleonis/workspace.domain';
const terminal = ['failed', 'nsfw', 'cancelled'];
@Injectable()
export class CaleonisStudioService {
  constructor(private db: PrismaService, private thirdParties: ThirdPartyManager, private media: MediaService) {}
  dailyLimit() {
    const raw = process.env.CALEONIS_CREATIVE_DAILY_LIMIT || '0';
    return /^\d{1,3}$/.test(raw) ? Math.min(100, Number(raw)) : 0;
  }
  private upstream() { return new UpstreamStudioService(this.db, this.media, this.dailyLimit()); }
  capabilities() { return { dailyLimit:this.dailyLimit(), imageAdapter:'higgsfield', videoGeneration:false, referenceGeneration:false, upstream:upstreamConfiguration(this.dailyLimit()) }; }
  private async connection(org: string, id: string) {
    const saved = await this.thirdParties.getIntegrationById(org, id);
    const provider = saved?.identifier === 'higgsfield' ? this.thirdParties.getThirdPartyByName('higgsfield') : undefined;
    if (!saved || !provider) throw new HttpException('Connectez Higgsfield dans Intégrations pour utiliser ce moteur.', 409);
    return { apiKey: AuthService.fixedDecryption(saved.apiKey), provider: provider.instance as HiggsfieldProvider, __scope: `${org}:${id}` };
  }
  private async visible(run: StudioRun) {
    if(run.connectionId.startsWith('native:magnific:'))return this.upstream().visible(run);
    const media = run.mediaId ? await this.db.media.findFirst({ where: { id: run.mediaId, organizationId: run.organizationId, deletedAt: null }, select: { id: true, path: true, name: true } }) : null;
    return { id: run.id, status: run.status, projectRevision: run.projectRevision, requestId: run.requestId, createdAt: run.createdAt, media, snapshot: run.snapshot };
  }
  async list(org: string, project: string) {
    await createWorkspaceRepository(this.db).get(org, requireId(project));
    return Promise.all((await createStudioRepository(this.db).list(org, project)).map(run => this.visible(run)));
  }
  async start(org: string, project: string, body: any) {
    if(body?.source==='open-higgsfield-v1')return this.upstream().start(org,project,body);
    if(body?.source)throw new HttpException('Source de génération inconnue.',400);
    const id = requireId(body?.clientRequestId); const revision = requireRevision(body?.revision);
    if (body?.confirmPaidGeneration !== true) throw new HttpException('Confirmez explicitement la génération payante.', 400);
    const document = await createWorkspaceRepository(this.db).get(org, requireId(project));
    if (document.kind !== 'project' || document.revision !== revision) throw new HttpException('Sauvegardez la version courante du projet.', 409);
    const data = document.data;
    if (data.mode !== 'image' || data.referenceIds?.length) throw new HttpException('Ce premier adaptateur accepte uniquement un brief image sans références. La vidéo et les références ne sont pas encore reliées.', 422);
    if (!data.prompt?.trim()) throw new HttpException('Le brief est vide.', 400);
    const connectionId = requireId(data.connectionId);
    const connection = await this.connection(org, connectionId);
    const repository = createStudioRepository(this.db);
    let reservation: Awaited<ReturnType<typeof repository.reserve>>;
    try { reservation = await repository.reserve(org, id, project, revision, connectionId, data, this.dailyLimit()); }
    catch (error) { if (error instanceof StudioReservationError) throw new HttpException(error.message, 409); throw error; }
    if (!reservation.created) return this.visible(reservation.run);
    try {
      const result = await connection.provider.startImage(connection.apiKey, {
        __scope: connection.__scope, clientRequestId: id, prompt: data.prompt,
        aspect_ratio: data.aspectRatio, resolution: data.resolution, confirmPaidGeneration: true,
      });
      await repository.update(org, id, result.status, result.requestId || null);
    } catch {
      // The provider may have accepted the billable request. Never resubmit automatically.
      await repository.update(org, id, 'unknown');
    }
    return this.visible((await repository.get(org, id))!);
  }
  async sync(org: string, project: string, id: string) {
    const repository = createStudioRepository(this.db);
    const run = await repository.get(org, requireId(id));
    if (!run || run.projectId !== requireId(project)) throw new HttpException('Création introuvable.', 404);
    if(run.connectionId.startsWith('native:magnific:'))return this.upstream().sync(org,project,id);
    if (run.mediaId || terminal.includes(run.status)) return this.visible(run);
    const connection = await this.connection(org, run.connectionId);
    try {
      const result = await connection.provider.generationStatus(connection.apiKey, { __scope: connection.__scope, jobId: id });
      await repository.update(org, id, result.status, result.requestId || null);
    } catch { await repository.update(org, id, 'unknown'); }
    return this.visible((await repository.get(org, id))!);
  }
  async import(org: string, project: string, id: string) {
    const existing=await createStudioRepository(this.db).get(org,requireId(id));
    if(existing?.connectionId.startsWith('native:magnific:'))return this.upstream().import(org,project,id);
    await this.sync(org, project, id);
    const repository = createStudioRepository(this.db); const run = (await repository.get(org, id))!;
    if (run.mediaId) return this.visible(run);
    if (run.status !== 'completed') throw new HttpException('Le résultat n’est pas disponible. Aucune nouvelle génération n’a été demandée.', 409);
    const connection = await this.connection(org, run.connectionId);
    const url = await connection.provider.sendData(connection.apiKey, { __scope: connection.__scope, jobId: id });
    const path = await UploadFactory.createStorage().uploadSimple(url);
    const saved = await this.media.saveFile(org, path.split('/').pop()!, path);
    await repository.imported(org, id, saved.id);
    await connection.provider.markImported(connection.apiKey, { __scope: connection.__scope, jobId: id, media: saved });
    return this.visible((await repository.get(org, id))!);
  }
}
