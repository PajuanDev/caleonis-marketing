/** Reuses the actual pinned upstream provider and model adapters, not a reimplementation. */
import { FreepikProvider } from '@/providers/freepik';
import { IMAGE_CAPABILITIES } from '@/models/capabilities/image';
import { VIDEO_CAPABILITIES } from '@/models/capabilities/video';
import { withProviderKey, validateProviderPath } from './transport.mjs';
const imageId='v1__ai__text_to_image__flux_2_pro';
const videoId='ltx-2-pro';
const provider=new FreepikProvider();
export const catalog=[
  {id:imageId,kind:'image',label:'FLUX 2 Pro',maxReferences:4,referenceRole:'Images produit / style',provider:'Magnific'},
  {id:videoId,kind:'video',label:'LTX 2.0 Pro',maxReferences:1,referenceRole:'Première image',provider:'Magnific'},
];
function fail(message:string):never {throw new Error(message);}
function choice(value:unknown, values:string[], fallback:string) {
  const candidate=value === undefined || value === '' ? fallback : value;
  if(typeof candidate!=='string'||!values.includes(candidate))fail('Réglage non pris en charge par ce moteur.');
  return candidate as string;
}
function fields(raw:any, permitted:string[]) {
  if(!raw || typeof raw!=='object'||Array.isArray(raw))fail('Réglages invalides.');
  for(const [key,value] of Object.entries(raw)) if(!permitted.includes(key) && value!=='' && value!==undefined)fail('Réglage personnalisé non pris en charge.');
}
function seed(value:unknown) {
  if(value===undefined||value===''||value==='-1'||value===-1)return undefined;
  const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
  if(!Number.isSafeInteger(n)||Number(n)<0||Number(n)>4294967295)fail('Graine invalide.');
  return Number(n);
}
export function prepare(data:any) {
  if(!data||!['image','video'].includes(data.mode)||typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>2000)fail('Brief image ou vidéo requis (2 000 caractères maximum).');
  let settings:any;try{settings=JSON.parse(data.studioSettings);}catch{fail('Enregistrez les réglages du studio avant de générer.');}
  if(settings?.schemaVersion!==1)fail('Réglages de studio non reconnus.');
  const id=data.mode==='image'?settings.imageModelId:settings.videoModelId;
  if(id!==(data.mode==='image'?imageId:videoId))fail('Ce modèle du catalogue n’est pas encore raccordé.');
  const refs=data.referenceIds ?? [];
  if(!Array.isArray(refs)||new Set(refs).size!==refs.length||refs.length>(data.mode==='image'?4:1))fail('Trop de références pour le moteur choisi.');
  const params:any={model_id:id,prompt:data.prompt.trim()};
  if(data.mode==='image') {
    const caps=IMAGE_CAPABILITIES[imageId]; const size=caps.size_ui!;
    params.aspect_ratio=choice(settings.sizeAspect,size.aspect_ratios.map(a=>a.id),size.default_aspect);
    params.resolution=choice(settings.sizeResolution,size.resolutions.map(r=>r.id),size.default_resolution);
    const f=settings.imageFieldValues||{};
    fields(f,['seed','prompt_upsampling','enable_safety_checker']);
    if(f.prompt_upsampling!==undefined&&f.prompt_upsampling!==''&&typeof f.prompt_upsampling!=='boolean')fail('Amélioration du brief invalide.');
    params.field_values={prompt_upsampling:f.prompt_upsampling===true};
    // No safety override is sent. The original UI flag cannot disable provider protection.
    params.seed=seed(f.seed);
  } else {
    const v=settings.videoSettings||{}, f=v.fieldValues||{};
    fields(f,['generate_audio','fps']);
    if(v.negativePrompt||v.expandPrompt||v.style&&v.style!=='none'||v.shotType&&v.shotType!=='single'||v.size||v.aspectRatio)fail('Un réglage vidéo choisi n’est pas disponible pour LTX.');
    if(f.generate_audio!==undefined&&f.generate_audio!==''&&typeof f.generate_audio!=='boolean')fail('Option audio invalide.');
    params.duration=choice(v.duration,['6','8','10'],'6');
    params.resolution=choice(settings.videoVariantId,['1080p','1440p','2160p'],'1080p');
    params.field_values={generate_audio:f.generate_audio===true,fps:choice(String(f.fps||'25'),['25','50'],'25')};
    params.seed=seed(v.seed);
  }
  return {mediaType:data.mode,modelId:id,params,referenceIds:[...refs]};
}
export async function submit(key:string, plan:any, references:Array<{id:string;path:string;bytes:Uint8Array;mime:string}>, transport?:typeof fetch) {
  if(!catalog.some(m=>m.id===plan.modelId&&m.kind===plan.mediaType)||references.length!==plan.referenceIds.length||references.some((r,i)=>r.id!==plan.referenceIds[i]))fail('Références non autorisées.');
  const images:Record<string,string>={};
  references.forEach((ref,i)=>{
    if(plan.mediaType==='image')images[i?'input_image_'+(i+1):'input_image']=Buffer.from(ref.bytes).toString('base64');
    else images.image=ref.path;
  });
  const capabilities=plan.mediaType==='image'?IMAGE_CAPABILITIES[plan.modelId]:VIDEO_CAPABILITIES[plan.modelId];
  return withProviderKey(key,()=>provider.submit({mediaType:plan.mediaType,modelId:plan.modelId,providerModelId:plan.modelId,capabilities,params:plan.params,media:{images}}),transport);
}
export async function poll(key:string, plan:any, operation:any, transport?:typeof fetch) {
  if(!catalog.some(m=>m.id===plan.modelId&&m.kind===plan.mediaType))fail('Modèle inconnu.');
  validateProviderPath(operation?.pollUrl,'GET');
  const base=plan.mediaType==='image'?'/v1/ai/text-to-image/flux-2-pro/':plan.referenceIds.length?'/v1/ai/image-to-video/ltx-2-pro/':'/v1/ai/text-to-video/ltx-2-pro/';
  if(!operation.pollUrl.startsWith(base))fail('Suivi fournisseur incompatible avec la création.');
  const result=await withProviderKey(key,()=>provider.poll({mediaType:plan.mediaType,providerModelId:plan.modelId,operation}),transport);
  if(result.status==='COMPLETED') {
    if(result.assets.length!==1)fail('Nombre de résultats inattendu.');
    const url=new URL(result.assets[0].url!);
    if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')fail('Adresse de résultat refusée.');
  }
  return result;
}
