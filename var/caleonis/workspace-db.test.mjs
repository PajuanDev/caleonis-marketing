import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { applyWorkspaceSchema } from './workspace-schema.mjs';
import { createWorkspaceRepository, WorkspaceConflict, WorkspaceMissing } from '../../libraries/nestjs-libraries/src/caleonis/workspace.repository.ts';
import { createStudioRepository, StudioReservationError } from '../../libraries/nestjs-libraries/src/caleonis/studio.repository.ts';
// This suite must never run against the pilot or a customer database.
const target = new URL(process.env.DATABASE_URL || 'postgresql://localhost/absent');
if (process.env.CALEONIS_TEST_DB !== 'isolated' || !['localhost','127.0.0.1'].includes(target.hostname) || target.pathname !== '/caleonis_workspace_test') throw new Error('Refusing tests outside the isolated local test database.');
const db = new PrismaClient(); const docs = createWorkspaceRepository(db); const jobs = createStudioRepository(db);
const a=randomUUID(), b=randomUUID(), connection=randomUUID(); let doc;
test.before(async()=>{ await applyWorkspaceSchema(db); await applyWorkspaceSchema(db); await db.organization.create({data:{id:a,name:'CI isolated A'}}); await db.organization.create({data:{id:b,name:'CI isolated B'}}); });
test.after(async()=>{ await db.organization.deleteMany({where:{id:{in:[a,b]}}}); await db.$disconnect(); });
test('documents persist in PostgreSQL and do not leak across organizations',async()=>{
  doc=await docs.create(a,{kind:'project',title:'Original',data:{prompt:'An authorized test brief'}});
  assert.equal((await docs.get(a,doc.id)).title,'Original'); assert.equal((await docs.list(b,'project')).length,0); await assert.rejects(()=>docs.get(b,doc.id),WorkspaceMissing);
});
test('saving creates immutable versions and rejects stale edits',async()=>{
  const updated=await docs.save(a,doc.id,1,{kind:'project',title:'Version two',data:{prompt:'Updated'}});
  assert.equal(updated.revision,2); await assert.rejects(()=>docs.save(a,doc.id,1,{kind:'project',title:'Stale',data:{}}),WorkspaceConflict);
  const versions=await docs.versions(a,doc.id); assert.equal(versions.length,2); assert.equal(versions[1].title,'Original'); assert.equal((await docs.versions(b,doc.id)).length,0);
});
test('foreign organization cannot update document',async()=>{await assert.rejects(()=>docs.save(b,doc.id,2,{kind:'project',title:'Attack',data:{}}),WorkspaceMissing);});
test('simultaneous same-revision updates cannot overwrite each other',async()=>{
  const result=await Promise.allSettled([docs.save(a,doc.id,2,{kind:'project',title:'Concurrent A',data:{}}),docs.save(a,doc.id,2,{kind:'project',title:'Concurrent B',data:{}})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1); assert.equal((await docs.get(a,doc.id)).revision,3);
});
test('generation is disabled without an explicit quota',async()=>{await assert.rejects(()=>jobs.reserve(a,randomUUID(),doc.id,3,connection,{prompt:'x'},0),StudioReservationError);});
test('concurrent duplicate reservation authorizes a single upstream submission',async()=>{
  const id=randomUUID();const result=await Promise.all([jobs.reserve(a,id,doc.id,3,connection,{prompt:'x'},2),jobs.reserve(a,id,doc.id,3,connection,{prompt:'x'},2)]);
  assert.equal(result.filter(x=>x.created).length,1);assert.equal((await jobs.list(a,doc.id)).length,1);assert.equal(await jobs.get(b,id),undefined);
  await jobs.update(a,id,'unknown'); const retry=await jobs.reserve(a,id,doc.id,3,connection,{prompt:'x'},2); assert.equal(retry.created,false);assert.equal(retry.run.status,'unknown');
});
test('quota reservations are atomic across distinct request ids',async()=>{
  const result=await Promise.allSettled([jobs.reserve(a,randomUUID(),doc.id,3,connection,{},2),jobs.reserve(a,randomUUID(),doc.id,3,connection,{},2)]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal((await jobs.list(a,doc.id)).length,2);
});
test('cross-organization project reference cannot reserve a generation',async()=>{await assert.rejects(()=>jobs.reserve(b,randomUUID(),doc.id,3,connection,{},2),StudioReservationError);});
test('reapplying the additive migration preserves saved data and job ids',async()=>{await applyWorkspaceSchema(db);assert.equal((await docs.get(a,doc.id)).revision,3);assert.equal((await jobs.list(a,doc.id)).length,2);});
test('native jobs are queued atomically and claimed once across competing workers',async()=>{
  const id=randomUUID();await jobs.reserve(a,id,doc.id,3,'native:openai',{engine:'native',prompt:'fixture'},10,'queued');
  assert.equal(await jobs.claimNative(b,id),undefined);
  const claims=await Promise.all([jobs.claimNative(a,id),jobs.claimNative(a,id)]);assert.equal(claims.filter(Boolean).length,1);
  await jobs.nativeFailure(a,id,'unknown');assert.equal(await jobs.claimNative(a,id),undefined);
  const replay=await jobs.reserve(a,id,doc.id,3,'native:openai',{},0,'queued');assert.equal(replay.created,false);assert.equal(replay.run.status,'unknown');
});
test('native completion stores output and usage, and cannot be overwritten by late failure',async()=>{
  const id=randomUUID();await jobs.reserve(a,id,doc.id,3,'native:openai',{},10,'queued');await jobs.claimNative(a,id);
  await jobs.finishNative(a,id,'test-media-id','req_test',{total_tokens:42});await jobs.nativeFailure(a,id,'unknown');
  const run=await jobs.get(a,id);assert.equal(run.status,'completed');assert.equal(run.mediaId,'test-media-id');assert.deepEqual(run.usage,{total_tokens:42});
});
test('native claimant cannot execute a Higgsfield reservation',async()=>{
  const id=randomUUID();await jobs.reserve(a,id,doc.id,3,connection,{},10,'queued');assert.equal(await jobs.claimNative(a,id),undefined);
});
