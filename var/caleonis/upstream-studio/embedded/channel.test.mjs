import { test } from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_CHANNEL,isStudioMessage,validateBrief,handleStudioOperation} from '../../../../apps/frontend/src/caleonis/studio-channel.mjs';
const projectId='11111111-1111-4111-8111-111111111111';
const otherId='22222222-2222-4222-8222-222222222222';
const origin='https://marketing.example.test'; const frame={};
const message={channel:STUDIO_CHANNEL,type:'request',id:projectId,operation:'project'};
function setup(options={}) {
 const calls=[];
 const project={id:projectId,kind:'project',title:'Lancement',revision:2,data:{mode:'image',prompt:'Avant',engine:'higgsfield',referenceIds:[otherId],campaignId:'',connectionId:'',...options.data},...options.project};
 const api=async(path,init={})=>{
  calls.push({path,init});
  if(options.failure)throw new Error('Access denied');
  if(path===`/workspace/documents/${projectId}`){if(init.method==='PUT')return {...project,...JSON.parse(init.body),revision:3};return project;}
  if(path===`/workspace/documents/${otherId}`)return {kind:'campaign',title:'Notre campagne',secret:'not-returned'};
  if(path==='/workspace/media')return [{id:otherId,name:'Produit',path:'/uploads/product.png',type:'image',secret:'not-returned'}];
  if(path===`/workspace/projects/${projectId}/runs`)return [{id:otherId,status:'completed',snapshot:{mode:'image',prompt:'Rendu',engine:'higgsfield'},media:{path:'/uploads/output.png'},createdAt:'2026-09-30T00:00:00Z'},{id:'unfinished',snapshot:{mode:'image'},status:'failed'}];
  throw new Error('Unexpected API route');
 };
 return {api,calls,project};
}
test('accept same-origin messages only from the active frame',()=>assert(isStudioMessage({source:frame,origin,data:message},frame,origin)));
for(const change of [{source:{}},{origin:'https://attacker.test'},{data:null},{data:{...message,id:'bad'}},{data:{...message,type:'response'}},{data:{...message,channel:'other'}},{data:{...message,operation:'generate'}},{data:{...message,operation:'/media/generate-image'}},{data:{...message,operation:'delete'}}])test('reject wrong frame, origin or envelope '+JSON.stringify(change),()=>assert.equal(isStudioMessage({source:frame,origin,data:message,...change},frame,origin),false));
test('refuse messages after frame is detached',()=>assert.equal(isStudioMessage({source:frame,origin,data:message},null,origin),false));
test('accept bounded brief',()=>assert.deepEqual(validateBrief({revision:2,prompt:'hello',mode:'video'}),{revision:2,prompt:'hello',mode:'video'}));
for(const payload of [null,[],{}, {revision:2,prompt:'a',mode:'image',organizationId:'other'},{revision:2,prompt:'a',mode:'image',projectId:otherId},{revision:2,prompt:'a',mode:'image',apiKey:'x'},{revision:0,prompt:'a',mode:'image'},{revision:'2',prompt:'a',mode:'image'},{revision:2,prompt:'x'.repeat(2001),mode:'image'},{revision:2,prompt:'a',mode:'other'}])test('reject invalid brief '+JSON.stringify(payload).slice(0,80),()=>assert.throws(()=>validateBrief(payload)));
test('read project through existing API without exposing any new identity',async()=>{const s=setup();const r=await handleStudioOperation(projectId,'project',null,s.api);assert.equal(r.project.id,projectId);assert.equal(r.generationEnabled,false);assert.equal(r.session,undefined);assert.deepEqual(s.calls.map(c=>c.path),[`/workspace/documents/${projectId}`]);});
test('backend denial is propagated, never replaced by fixture data',async()=>{const s=setup({failure:true});await assert.rejects(handleStudioOperation(projectId,'project',null,s.api));});
test('reject non-project object returned by API',async()=>{const s=setup({project:{kind:'brand'}});await assert.rejects(handleStudioOperation(projectId,'project',null,s.api));});
test('read only the campaign named by the authoritative project',async()=>{const s=setup({data:{campaignId:otherId}});const r=await handleStudioOperation(projectId,'project',null,s.api);assert.deepEqual(r.campaign,{title:'Notre campagne'});});
test('save brief preserves all existing references, campaign and engine metadata',async()=>{const s=setup();const r=await handleStudioOperation(projectId,'saveBrief',{revision:2,prompt:'Après',mode:'video'},s.api);const body=JSON.parse(s.calls[1].init.body);assert.equal(r.project.revision,3);assert.equal(body.data.prompt,'Après');assert.equal(body.data.mode,'video');assert.equal(body.data.engine,'higgsfield');assert.deepEqual(body.data.referenceIds,[otherId]);assert.equal(body.revision,2);assert.equal(body.kind,'project');assert.equal(body.title,'Lancement');});
test('stale revision never reaches the write endpoint',async()=>{const s=setup();await assert.rejects(handleStudioOperation(projectId,'saveBrief',{revision:1,prompt:'Old',mode:'image'},s.api));assert.equal(s.calls.length,1);});
test('injected payload never reaches any endpoint',async()=>{const s=setup();await assert.rejects(handleStudioOperation(projectId,'saveBrief',{revision:2,prompt:'a',mode:'image',route:'/generate'},s.api));assert.equal(s.calls.length,0);});
for(const operation of ['generate','delete','connection','POST /generate','__proto__'])test('unsupported operation is closed: '+operation,async()=>{const s=setup();await assert.rejects(handleStudioOperation(projectId,operation,null,s.api));assert.equal(s.calls.length,0);});
test('gallery returns only materialized image results',async()=>{const s=setup();const r=await handleStudioOperation(projectId,'images',null,s.api);assert.equal(r.length,1);assert.deepEqual(r[0].result_urls,['/uploads/output.png']);assert.equal(r[0].status,'COMPLETED');});
test('image output is absent from video gallery',async()=>{const s=setup();assert.deepEqual(await handleStudioOperation(projectId,'videos',null,s.api),[]);});
test('media response contains no unexpected metadata',async()=>{const s=setup();const r=await handleStudioOperation(projectId,'media',null,s.api);assert.equal(r.length,1);assert(!JSON.stringify(r).includes('not-returned'));});
