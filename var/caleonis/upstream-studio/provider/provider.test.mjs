import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const runtime=createRequire(import.meta.url)(path.resolve(process.env.CALEONIS_PROVIDER_TEST_BUNDLE||'var/caleonis/provider-runtime/upstream.cjs'));
const key='test-only-not-a-real-provider-key', id='11111111-1111-4111-8111-111111111111';
const imageId='v1__ai__text_to_image__flux_2_pro';
const json=(value,status=200)=>Response.json(value,{status});
const image=(extra={})=>({mode:'image',prompt:'Une photo produit fidèle.',referenceIds:[],studioSettings:JSON.stringify({schemaVersion:1,imageModelId:imageId,sizeAspect:'16:9',sizeResolution:'1.5k',imageFieldValues:{enable_safety_checker:false,prompt_upsampling:false},...extra})});
const video=(extra={})=>({mode:'video',prompt:'Un travelling lent.',referenceIds:[],studioSettings:JSON.stringify({schemaVersion:1,videoModelId:'ltx-2-pro',videoVariantId:'1080p',videoSettings:{duration:'6',fieldValues:{fps:'25',generate_audio:false}},...extra})});
const accepted=()=>json({data:{task_id:id,status:'CREATED'}});
const previous=globalThis.fetch;
test.before(()=>{globalThis.fetch=()=>{throw new Error('Unexpected live network forbidden in test suite');};});
test.after(()=>{globalThis.fetch=previous;});
test('catalogue exposes only two explicitly reviewed original adapters',()=>assert.deepEqual(runtime.catalog.map(m=>m.id),[imageId,'ltx-2-pro']));
test('real Flux adapter maps aspect and resolution to documented pixels',async()=>{
 const plan=runtime.prepare(image());let request;
 const result=await runtime.submit(key,plan,[],async(url,init)=>{request={url,...init};return accepted();});
 assert.equal(result.providerTaskId,id);assert.equal(request.url,'https://api.magnific.com/v1/ai/text-to-image/flux-2-pro');
 assert.equal(request.headers['x-magnific-api-key'],key);assert.equal(request.redirect,'error');
 assert.deepEqual(JSON.parse(request.body),{prompt:'Une photo produit fidèle.',prompt_upsampling:false,width:1440,height:810});
 assert(!request.body.includes('safety'));assert(!request.body.includes(key));
});
test('real Flux adapter receives saved reference images in original slot order',async()=>{
 const doc=image();doc.referenceIds=[id];const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
 await runtime.submit(key,runtime.prepare(doc),[{id,path:'https://example.test/uploads/ref.png',bytes,mime:'image/png'}],async(_,init)=>{assert.equal(JSON.parse(init.body).input_image,Buffer.from(bytes).toString('base64'));return accepted();});
});
test('real LTX adapter maps text video, duration, audio and fps',async()=>{
 await runtime.submit(key,runtime.prepare(video()),[],async(url,init)=>{assert.equal(url,'https://api.magnific.com/v1/ai/text-to-video/ltx-2-pro');assert.deepEqual(JSON.parse(init.body),{prompt:'Un travelling lent.',duration:6,resolution:'1080p',generate_audio:false,fps:25});return accepted();});
});
test('image-to-video preserves upstream routing and corrects the documented image_url field',async()=>{
 const doc=video();doc.referenceIds=[id];
 await runtime.submit(key,runtime.prepare(doc),[{id,path:'https://example.test/uploads/ref.png',bytes:new Uint8Array([1]),mime:'image/png'}],async(url,init)=>{assert(url.includes('/image-to-video/'));const data=JSON.parse(init.body);assert.equal(data.image_url,'https://example.test/uploads/ref.png');assert.equal(data.image,undefined);return accepted();});
});
for(const [name,doc] of [
 ['empty prompt',{...image(),prompt:''}],['long prompt',{...image(),prompt:'x'.repeat(2001)}],['invalid mode',{...image(),mode:'html'}],
 ['unknown model',image({imageModelId:'unreviewed-model'})],['unknown resolution',image({sizeResolution:'4k'})],['unknown aspect',image({sizeAspect:'custom'})],
 ['unknown field',image({imageFieldValues:{webhook_url:'https://attacker.test'}})],['invalid seed',image({imageFieldValues:{seed:-3}})],
 ['invalid boolean',image({imageFieldValues:{prompt_upsampling:'true'}})],['unsupported video model',video({videoModelId:'kling'})],
 ['unsupported duration',video({videoSettings:{duration:'20'}})],['unsupported resolution',video({videoVariantId:'8k'})],
 ['unsupported fps',video({videoSettings:{duration:'6',fieldValues:{fps:'120'}}})],['unsupported video field',video({videoSettings:{duration:'6',fieldValues:{url:'https://attacker.test'}}})],
 ['too many video references',{...video(),referenceIds:[id,'22222222-2222-4222-8222-222222222222']}],
 ['duplicate references',{...image(),referenceIds:[id,id]}],['broken settings',{...image(),studioSettings:'{'}],
])test('rejects '+name+' before transport',()=>assert.throws(()=>runtime.prepare(doc)));
test('reference mismatch is refused before invoking upstream submit',async()=>{let calls=0;await assert.rejects(runtime.submit(key,runtime.prepare(image()),[{id}],async()=>{calls++;return accepted();}));assert.equal(calls,0);});
for(const code of [400,401,403,422,429])test('definite rejection '+code+' is sanitized without retry',async()=>{let calls=0;await assert.rejects(runtime.submit(key,runtime.prepare(image()),[],async()=>{calls++;return json({error:key},code);}),e=>e.state==='failed'&&!e.message.includes(key));assert.equal(calls,1);});
for(const code of [302,408,500,503])test('uncertain response '+code+' is not retried',async()=>{let calls=0;await assert.rejects(runtime.submit(key,runtime.prepare(image()),[],async()=>{calls++;return new Response('',{status:code});}),e=>e.state==='unknown');assert.equal(calls,1);});
test('network error cannot expose a key or trigger a second purchase',async()=>{let calls=0;await assert.rejects(runtime.submit(key,runtime.prepare(image()),[],async()=>{calls++;throw new Error(key);}),e=>e.state==='unknown'&&!e.message.includes(key));assert.equal(calls,1);});
test('malformed accepted task id never becomes a polling path',async()=>{await assert.rejects(runtime.submit(key,runtime.prepare(image()),[],async()=>json({data:{task_id:'../../keys',status:'CREATED'}})));});
test('oversized JSON response is rejected and cancelled',async()=>{await assert.rejects(runtime.submit(key,runtime.prepare(image()),[],async()=>new Response('x'.repeat(1024*1024+1))));});
test('concurrent tenants keep credentials in separate async contexts',async()=>{
 const seen=[];await Promise.all(['tenant-a-key-not-real','tenant-b-key-not-real'].map(async(k,index)=>runtime.submit(k,runtime.prepare(image()),[],async(_,init)=>{await new Promise(r=>setTimeout(r,index?1:5));seen.push(init.headers['x-magnific-api-key']);return accepted();})));
 assert.deepEqual(seen.sort(),['tenant-a-key-not-real','tenant-b-key-not-real']);
});
test('original polling adapter restores completed assets using GET only',async()=>{
 const result=await runtime.poll(key,runtime.prepare(image()),{pollUrl:'/v1/ai/text-to-image/flux-2-pro/'+id},async(_,init)=>{assert.equal(init.method,'GET');assert.equal(init.body,undefined);return json({data:{task_id:id,status:'COMPLETED',generated:['https://cdn.example.test/out.png']}});});
 assert.equal(result.status,'COMPLETED');assert.equal(result.assets[0].url,'https://cdn.example.test/out.png');
});
for(const pollUrl of ['https://attacker.test/x','/v1/ai/text-to-image/flux-2-pro/../../keys','/v1/ai/text-to-image/flux-2-pro/'+id+'?key=x','/v1/ai/text-to-video/ltx-2-pro/'+id])test('poll refuses unexpected route '+pollUrl,async()=>{let calls=0;await assert.rejects(runtime.poll(key,runtime.prepare(image()),{pollUrl},async()=>{calls++;return accepted();}));assert.equal(calls,0);});
test('poll rejects asset with credentials or non-HTTPS scheme',async()=>{await assert.rejects(runtime.poll(key,runtime.prepare(image()),{pollUrl:'/v1/ai/text-to-image/flux-2-pro/'+id},async()=>json({data:{task_id:id,status:'COMPLETED',generated:['http://127.0.0.1/secret']}})));});
test('poll rejects mismatched task id',async()=>{await assert.rejects(runtime.poll(key,runtime.prepare(image()),{pollUrl:'/v1/ai/text-to-image/flux-2-pro/'+id},async()=>json({data:{task_id:'22222222-2222-4222-8222-222222222222',status:'IN_PROGRESS'}})));});
