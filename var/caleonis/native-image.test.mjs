import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageMime, readLocalReference, renderNativeImage, validateNativeImage } from '../../libraries/nestjs-libraries/src/caleonis/native-image.engine.ts';
import { nativeSizes, nativeSize, creativeEngine } from '../../libraries/helpers/src/caleonis/native-image.contract.ts';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const base = { model: 'gpt-image-2.5-sunburst', prompt: 'Photo produit', size: '1024x1024', quality: 'medium', references: [] };
const key = 'test-key-not-a-real-provider-key';
const success = () => new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }], usage: { input_tokens: 9, output_tokens: 13, total_tokens: 22, secret: 'not returned' } }), { headers: { 'x-request-id': 'req_native_test' } });
test('native image generation makes one official request with no automatic rewrite or retries', async () => {
 let calls=0;
 const result=await renderNativeImage({...base, webhook_url:'https://evil.test', moderation:'low'},key,async (url, options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(options.redirect,'error');const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body).sort(),['model','n','output_format','prompt','quality','size']);assert.equal(body.n,1);return success();});
 assert.equal(calls,1);assert.deepEqual(result.bytes,png);assert.deepEqual(result.usage,{input_tokens:9,output_tokens:13,total_tokens:22});
});
test('reference edits transmit actual bytes without public media URLs',async()=>{
 const result=await renderNativeImage({...base,references:[{bytes:png,mime:'image/png'}]},key,async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/images/edits');assert.ok(options.body instanceof FormData);assert.deepEqual(Buffer.from(await options.body.get('image[]').arrayBuffer()),png);assert.equal(options.body.get('input_fidelity'),null);assert.equal(options.headers['Content-Type'],undefined);return success();}); assert.deepEqual(result.bytes,png);
});
for(const status of [400,401,403,404,413,422,429,500,502])test(`HTTP ${status} is sanitized and never repurchased`,async()=>{
 let calls=0;await assert.rejects(()=>renderNativeImage(base,key,async()=>{calls++;return new Response(`secret ${key}`,{status});}),err=>{assert.ok(!err.message.includes(key));assert.equal(err.state,status>=500?'unknown':'failed');return true;});assert.equal(calls,1);
});
test('network ambiguity returns unknown without retry',async()=>{let calls=0;await assert.rejects(()=>renderNativeImage(base,key,async()=>{calls++;throw new Error(key);}),e=>e.state==='unknown'&&!e.message.includes(key));assert.equal(calls,1);});
for(const [name,patch] of Object.entries({model:{model:'unapproved'},quality:{quality:'max'},size:{size:'3840x3840'},small:{size:'16x16'},ratio:{size:'2048x128'},prompt:{prompt:''},refs:{references:Array(5).fill({bytes:png,mime:'image/png'})},mime:{references:[{bytes:png,mime:'image/jpeg'}]}}))test(`invalid ${name} fails before any request`,async()=>{let calls=0;await assert.rejects(()=>renderNativeImage({...base,...patch},key,async()=>{calls++;return success();}));assert.equal(calls,0);});
for(const [resolution,options] of Object.entries(nativeSizes))for(const [ratio,size]of Object.entries(options))test(`native dimensions ${resolution} ${ratio} are valid`,()=>{assert.equal(nativeSize(ratio,resolution),size);validateNativeImage({...base,size});});
test('capabilities never resolve inherited properties',()=>{assert.equal(nativeSize('constructor','1k'),undefined);assert.equal(nativeSize('1:1','__proto__'),undefined);});
test('existing connected projects retain Higgsfield and new projects choose native',()=>{assert.equal(creativeEngine({connectionId:'a'}),'higgsfield');assert.equal(creativeEngine({}),'native');assert.equal(creativeEngine({engine:'native',connectionId:'a'}),'native');});
test('unexpected image output is not trusted',async()=>{await assert.rejects(()=>renderNativeImage(base,key,async()=>new Response(JSON.stringify({data:[{b64_json:Buffer.from('<script>alert(1)</script>').toString('base64')}]}))),e=>e.state==='unknown');});
test('local references are bounded, owned-storage-only and cannot traverse symlinks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'caleonis-reference-'));const uploads=join(root,'uploads');await mkdir(uploads);await writeFile(join(uploads,'ok.png'),png);await writeFile(join(root,'private.png'),png);await symlink(join(root,'private.png'),join(uploads,'escape.png'));
 try{assert.deepEqual((await readLocalReference('https://app.test/uploads/ok.png','https://app.test',uploads)).bytes,png);for(const url of ['https://other.test/uploads/ok.png','https://app.test/uploads/escape.png','https://app.test/uploads/%2e%2e%2fprivate.png','https://app.test/uploads/ok.png?key=1','https://user:pass@app.test/uploads/ok.png'])await assert.rejects(()=>readLocalReference(url,'https://app.test',uploads));await writeFile(join(uploads,'bad.png'),'<script>alert(1)</script>');await assert.rejects(()=>readLocalReference('https://app.test/uploads/bad.png','https://app.test',uploads));}finally{await rm(root,{recursive:true,force:true});}
});
