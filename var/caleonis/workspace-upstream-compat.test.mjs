import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { applyWorkspaceSchema } from './workspace-schema.mjs';
import { createWorkspaceRepository } from '../../libraries/nestjs-libraries/src/caleonis/workspace.repository.ts';
import { createStudioRepository } from '../../libraries/nestjs-libraries/src/caleonis/studio.repository.ts';
const target = new URL(process.env.DATABASE_URL || 'postgresql://localhost/absent');
if (process.env.CALEONIS_TEST_DB !== 'isolated' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/caleonis_workspace_test') throw new Error('Refusing compatibility test outside the isolated local database.');

test('existing documents, version history and an uncertain run survive upstream db push and process reconnection', async () => {
  const db = new PrismaClient();
  const org = randomUUID(), runId = randomUUID(), connection = randomUUID();
  let verifier;
  try {
    await applyWorkspaceSchema(db);
    await db.organization.create({ data: { id: org, name: 'CI preservation sentinel' } });
    const docs = createWorkspaceRepository(db);
    const brand = await docs.create(org, { kind: 'brand', title: 'Brand sentinel', data: { activity: 'Data must survive' } });
    const campaign = await docs.create(org, { kind: 'campaign', title: 'Campaign sentinel', data: { brandId: brand.id } });
    const project = await docs.create(org, { kind: 'project', title: 'Original title', data: { campaignId: campaign.id, prompt: 'First brief' } });
    const updated = await docs.save(org, project.id, 1, { kind: 'project', title: 'Preserved title', data: { campaignId: campaign.id, prompt: 'Saved version two' } });
    const jobs = createStudioRepository(db);
    await jobs.reserve(org, runId, project.id, updated.revision, connection, updated.data, 1);
    await jobs.update(org, runId, 'unknown', 'ci-provider-request-not-real');
    // Keep the seeded data in the database while running the exact upstream command.
    await db.$disconnect();
    execFileSync('./node_modules/.bin/prisma', ['db', 'push', '--skip-generate', '--schema', 'libraries/nestjs-libraries/src/database/prisma/schema.prisma'], { timeout: 60000, stdio: 'pipe' });
    verifier = new PrismaClient();
    await applyWorkspaceSchema(verifier);
    const persisted = createWorkspaceRepository(verifier);
    assert.equal((await persisted.get(org, brand.id)).title, 'Brand sentinel');
    assert.equal((await persisted.get(org, campaign.id)).data.brandId, brand.id);
    const actual = await persisted.get(org, project.id);
    assert.equal(actual.revision, 2);
    assert.equal(actual.title, 'Preserved title');
    assert.deepEqual(actual.data, updated.data);
    const versions = await persisted.versions(org, project.id);
    assert.equal(versions.length, 2);
    assert.equal(versions[1].title, 'Original title');
    const retainedJobs = createStudioRepository(verifier);
    const run = await retainedJobs.get(org, runId);
    assert.equal(run.status, 'unknown');
    assert.equal(run.requestId, 'ci-provider-request-not-real');
    assert.deepEqual(run.snapshot, updated.data);
    const replay = await retainedJobs.reserve(org, runId, project.id, 2, connection, updated.data, 1);
    assert.equal(replay.created, false);
    console.log('PRESERVATION_CHECK: brand, campaign, project, both versions and request reservation survived the upstream command.');
  } finally {
    const cleanup = verifier || db;
    await cleanup.organization.deleteMany({ where: { id: org } });
    await cleanup.$disconnect();
    if (cleanup !== db) await db.$disconnect();
  }
});
