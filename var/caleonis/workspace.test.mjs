import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, referenceLinks, requireId, requireRevision } from '../../libraries/helpers/src/caleonis/workspace.domain.ts';
const id = '11111111-1111-4111-8111-111111111111';
for (const kind of ['brand','campaign','project']) test(`valid document: ${kind}`, () => {
  const value = validateDocument({ kind, title: '  Projet  ', data: {} }); assert.equal(value.title, 'Projet'); assert.equal(value.kind, kind);
});
for (const body of [null, [], {}, {kind:'other',title:'a',data:{}}, {kind:'brand',title:'',data:{}}, {kind:'brand',title:'x'.repeat(121),data:{}}, {kind:'brand',title:'a',data:[]}]) test(`invalid document ${JSON.stringify(body)}`, () => assert.throws(() => validateDocument(body)));
for (const key of ['apiKey','organizationId','__scope','constructor','__proto__','status','approved']) test(`reject injected ${key}`, () => assert.throws(() => validateDocument(JSON.parse(`{"kind":"project","title":"p","data":{"${key}":"x"}}`))));
test('stored project defaults are deterministic', () => { const {data} = validateDocument({kind:'project',title:'p',data:{}}); assert.equal(data.mode,'image'); assert.equal(data.aspectRatio,'1:1'); assert.deepEqual(data.referenceIds,[]); });
test('links are explicit and deduplicated', () => { const p=validateDocument({kind:'project',title:'p',data:{campaignId:id,connectionId:id,referenceIds:[id,id]}}); assert.equal(referenceLinks(p).length,3); });
for (const data of [{mode:'executable'},{aspectRatio:'100:1'},{resolution:'unlimited'},{prompt:'x'.repeat(4001)},{referenceIds:['x']},{referenceIds:Array(9).fill(id)}]) test(`invalid project controls ${Object.keys(data)[0]}`,()=>assert.throws(()=>validateDocument({kind:'project',title:'p',data})));
for (const website of ['javascript:alert(1)','http://example.test','https://user:password@example.test']) test(`reject unsafe website ${website}`,()=>assert.throws(()=>validateDocument({kind:'brand',title:'b',data:{website}})));
test('https website accepted without fetching it',()=>assert.equal(validateDocument({kind:'brand',title:'b',data:{website:'https://example.test'}}).data.website,'https://example.test'));
for (const value of [undefined,0,-1,'1',1.5,Infinity]) test(`invalid revision ${value}`,()=>assert.throws(()=>requireRevision(value)));
test('revision and document identifiers accepted',()=>{assert.equal(requireRevision(2),2);assert.equal(requireId(id),id);});
