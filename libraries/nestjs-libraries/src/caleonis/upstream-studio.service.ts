import { HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { createStudioRepository, StudioReservationError, StudioRun } from './studio.repository';
import { createWorkspaceRepository } from './workspace.repository';
import { readLocalReference } from './native-image.engine';
import { storeProviderAsset } from './provider-asset';
import { requireId, requireRevision } from '@gitroom/helpers/caleonis/workspace.domain';
import type { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
const nativeRequire = createRequire(__filename);
export function upstreamRuntime() {
  const file = resolve(process.env.CALEONIS_APP_ROOT || '/app', 'var/caleonis/provider-runtime/upstream.cjs');
  return existsSync(file) ? nativeRequire(file) : null;
}
export function upstreamConfiguration(limit: number) {
  const runtime = upstreamRuntime(); const key = process.env.MAGNIFIC_API_KEY || '';
  const configured = key.length >= 16 && key.length <= 512 && !/\s/.test(key);
  return { enabled: !!runtime && configured && process.env.CALEONIS_UPSTREAM_STUDIO_ENABLED === 'true' && limit > 0,
    configured, runtimeReady: !!runtime, provider: 'Magnific', billing: 'server-account',
    dailyLimit: limit, models: runtime?.catalog || [], monetaryLimit: false };
}
/** Called only from the existing authenticated, admin-guarded Studio start route. */
export class UpstreamStudioService {
  constructor(private db: PrismaClient, private media: MediaService, private limit: number) {}
  private account() {
    const key = process.env.MAGNIFIC_API_KEY || '';
    return {key, id:'native:magnific:'+createHash('sha256').update(key).digest('hex').slice(0,24)};
  }
  async visible(run: StudioRun) {
    const media = run.mediaId ? await this.db.media.findFirst({where:{id:run.mediaId,organizationId:run.organizationId,deletedAt:null},select:{id:true,path:true,name:true,type:true}}) : null;
    return {id:run.id,status:run.status,projectRevision:run.projectRevision,requestId:run.requestId,createdAt:run.createdAt,media,
      importState:run.providerState?.importState || null, provider:'Magnific',
      snapshot:{mode:run.snapshot.mode,prompt:run.snapshot.prompt,engine:'upstream',modelId:run.snapshot._providerPlan?.modelId}};
  }
  async start(org: string, project: string, body: any) {
    if (!body || Object.keys(body).some(k=>!['source','revision','clientRequestId','confirmPaidGeneration'].includes(k)) || body.source!=='open-higgsfield-v1' || body.confirmPaidGeneration!==true) throw new HttpException('Confirmez la génération et l’envoi des références au fournisseur.',400);
    const id=requireId(body.clientRequestId), revision=requireRevision(body.revision);
    const document=await createWorkspaceRepository(this.db).get(org,requireId(project));
    if(document.kind!=='project')throw new HttpException('Projet créatif introuvable.',404);
    const repository=createStudioRepository(this.db); const previous=await repository.get(org,id);
    if(previous) {
      if(previous.projectId!==project||previous.projectRevision!==revision||!previous.connectionId.startsWith('native:magnific:'))throw new HttpException('Identifiant de demande déjà utilisé.',409);
      return this.visible(previous);
    }
    if(document.revision!==revision)throw new HttpException('Enregistrez et rechargez la version courante du projet.',409);
    const config=upstreamConfiguration(this.limit);
    if(!config.enabled)throw new HttpException('Moteur non configuré, désactivé ou plafond nul.',409);
    const runtime=upstreamRuntime(); let plan:any;
    try{plan=runtime.prepare(document.data);}catch(error){throw new HttpException(error instanceof Error?error.message:'Paramètres invalides.',422);}
    const references=[];
    for(const id of plan.referenceIds) {
      requireId(id);
      const row=await this.db.media.findFirst({where:{id,organizationId:org,deletedAt:null,status:'ready',type:'image'},select:{id:true,path:true}});
      if(!row)throw new HttpException('Une référence n’est pas disponible dans cette entreprise.',404);
      if((process.env.STORAGE_PROVIDER||'local')!=='local')throw new HttpException('Les références de ce lot nécessitent le stockage local.',422);
      const ref=await readLocalReference(row.path,process.env.FRONTEND_URL!,process.env.UPLOAD_DIRECTORY!);
      if(plan.mediaType==='video'&&new URL(row.path).protocol!=='https:')throw new HttpException('La première image vidéo nécessite une URL HTTPS accessible au fournisseur.',422);
      references.push({id:row.id,path:row.path,...ref});
    }
    if(references.reduce((n,r)=>n+r.bytes.byteLength,0)>20*1024*1024)throw new HttpException('Références supérieures à 20 Mo.',422);
    const account=this.account(); let reserved:Awaited<ReturnType<typeof repository.reserve>>;
    try { reserved=await repository.reserve(org,id,project,revision,account.id,{...document.data,_providerPlan:plan},this.limit); }
    catch(error){if(error instanceof StudioReservationError)throw new HttpException(error.message,409);throw error;}
    if(!reserved.created)return this.visible(reserved.run);
    try {
      const result=await runtime.submit(account.key,plan,references);
      await repository.providerAccepted(org,id,result.providerTaskId,result.operation);
    } catch(error) {
      // Unknown includes process/network errors; never issue a second submission.
      await repository.update(org,id,(error as any)?.state==='failed'?'failed':'unknown');
    }
    return this.visible((await repository.get(org,id))!);
  }
  async sync(org: string, project: string, id: string) {
    const repository=createStudioRepository(this.db); const run=await repository.get(org,requireId(id));
    if(!run||run.projectId!==requireId(project)||!run.connectionId.startsWith('native:magnific:'))throw new HttpException('Création introuvable.',404);
    if(!['queued','in_progress'].includes(run.status))return this.visible(run);
    const account=this.account();
    if(run.connectionId!==account.id)throw new HttpException('Le compte fournisseur a changé. Aucune nouvelle génération.',409);
    const runtime=upstreamRuntime();
    if(!runtime)throw new HttpException('Adaptateur indisponible.',503);
    try {
      const result=await runtime.poll(account.key,run.snapshot._providerPlan,run.providerState?.operation);
      const status=result.status==='COMPLETED'?'completed':['FAILED','ERROR','CANCELLED'].includes(result.status)?'failed':'in_progress';
      await repository.providerResult(org,id,status,result.status==='COMPLETED'?{assets:result.assets}:{});
    } catch { throw new HttpException('Suivi momentanément indisponible. Le dernier état est conservé ; aucune nouvelle génération.',503); }
    return this.visible((await repository.get(org,id))!);
  }
  async import(org: string, project: string, id: string) {
    const repository=createStudioRepository(this.db); const run=await repository.get(org,requireId(id));
    if(!run||run.projectId!==requireId(project)||!run.connectionId.startsWith('native:magnific:'))throw new HttpException('Création introuvable.',404);
    if(run.mediaId)return this.visible(run);
    if(run.status!=='completed'||run.providerState?.assets?.length!==1)throw new HttpException('Actualisez le suivi avant d’importer un résultat terminé.',409);
    const claim=await repository.claimProviderImport(org,id);
    if(!claim)throw new HttpException('Import déjà commencé ou à vérifier. Aucun import supplémentaire.',409);
    try {
      const file=await storeProviderAsset(claim.providerState!.assets[0].url,claim.snapshot.mode);
      const saved=await this.media.saveFile(org,file.filename,file.path);
      await repository.imported(org,id,saved.id);
    } catch {
      await repository.providerImportUncertain(org,id);
      throw new HttpException('Import non confirmé. La demande reste bloquée pour éviter un doublon ; vérifiez la médiathèque.',503);
    }
    return this.visible((await repository.get(org,id))!);
  }
}
