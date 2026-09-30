import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
// Fixed additive DDL in a schema separate from the upstream Prisma public schema.
export const statements = [
  'CREATE SCHEMA IF NOT EXISTS caleonis',
  `CREATE TABLE IF NOT EXISTS caleonis.documents (
    id TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL REFERENCES public."Organization"(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('brand','campaign','project')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data)='object'),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("organizationId",id)
  )`,
  `CREATE INDEX IF NOT EXISTS documents_org_kind ON caleonis.documents ("organizationId",kind,"updatedAt" DESC)`,
  `CREATE TABLE IF NOT EXISTS caleonis.document_versions (
    "documentId" TEXT NOT NULL, "organizationId" TEXT NOT NULL, revision INTEGER NOT NULL,
    title TEXT NOT NULL, data JSONB NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("documentId",revision),
    FOREIGN KEY ("organizationId","documentId") REFERENCES caleonis.documents ("organizationId",id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS caleonis.studio_runs (
    id TEXT NOT NULL, "organizationId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
    "projectRevision" INTEGER NOT NULL, "connectionId" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitting', snapshot JSONB NOT NULL,
    "requestId" TEXT, "mediaId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("organizationId",id),
    FOREIGN KEY ("organizationId","projectId") REFERENCES caleonis.documents ("organizationId",id) ON DELETE CASCADE,
    FOREIGN KEY ("projectId","projectRevision") REFERENCES caleonis.document_versions ("documentId",revision)
  )`,
  `CREATE INDEX IF NOT EXISTS studio_runs_project ON caleonis.studio_runs ("organizationId","projectId","createdAt" DESC)`,
  `CREATE TABLE IF NOT EXISTS caleonis.schema_migrations (version TEXT PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
  `INSERT INTO caleonis.schema_migrations(version) VALUES ('001-workspace-documents-and-runs') ON CONFLICT DO NOTHING`,
];
export async function applyWorkspaceSchema(db) {
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(73601521)');
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new PrismaClient();
  try { await applyWorkspaceSchema(db); console.log('Caléonis workspace schema ready (001).'); }
  catch { console.error('Caléonis workspace migration failed. Startup stopped; no destructive migration attempted.'); process.exitCode = 1; }
  finally { await db.$disconnect(); }
}
