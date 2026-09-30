import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
export type WorkspaceDocument = { id: string; organizationId: string; kind: string; title: string; data: Record<string, any>; revision: number; createdAt: Date; updatedAt: Date };
export class WorkspaceConflict extends Error {}
export class WorkspaceMissing extends Error {}
export function createWorkspaceRepository(db: PrismaClient) {
  return {
    async list(org: string, kind: string) {
      return db.$queryRaw<WorkspaceDocument[]>`SELECT * FROM caleonis.documents WHERE "organizationId"=${org} AND kind=${kind} ORDER BY "updatedAt" DESC LIMIT 100`;
    },
    async get(org: string, id: string) {
      const rows = await db.$queryRaw<WorkspaceDocument[]>`SELECT * FROM caleonis.documents WHERE "organizationId"=${org} AND id=${id}`;
      if (!rows.length) throw new WorkspaceMissing();
      return rows[0];
    },
    async create(org: string, input: { kind: string; title: string; data: unknown }) {
      const id = randomUUID();
      return db.$transaction(async tx => {
        const rows = await tx.$queryRaw<WorkspaceDocument[]>`INSERT INTO caleonis.documents (id,"organizationId",kind,title,data) VALUES (${id},${org},${input.kind},${input.title},${JSON.stringify(input.data)}::jsonb) RETURNING *`;
        await tx.$executeRaw`INSERT INTO caleonis.document_versions ("documentId","organizationId",revision,title,data) VALUES (${id},${org},1,${input.title},${JSON.stringify(input.data)}::jsonb)`;
        return rows[0];
      });
    },
    async save(org: string, id: string, expectedRevision: number, input: { kind: string; title: string; data: unknown }) {
      return db.$transaction(async tx => {
        const previous = await tx.$queryRaw<WorkspaceDocument[]>`SELECT * FROM caleonis.documents WHERE "organizationId"=${org} AND id=${id} FOR UPDATE`;
        if (!previous.length) throw new WorkspaceMissing();
        if (previous[0].revision !== expectedRevision || previous[0].kind !== input.kind) throw new WorkspaceConflict();
        const rows = await tx.$queryRaw<WorkspaceDocument[]>`UPDATE caleonis.documents SET title=${input.title},data=${JSON.stringify(input.data)}::jsonb,revision=revision+1,"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id} RETURNING *`;
        await tx.$executeRaw`INSERT INTO caleonis.document_versions ("documentId","organizationId",revision,title,data) VALUES (${id},${org},${rows[0].revision},${input.title},${JSON.stringify(input.data)}::jsonb)`;
        return rows[0];
      });
    },
    async versions(org: string, id: string) {
      return db.$queryRaw<Array<{ revision: number; title: string; data: Record<string, any>; createdAt: Date }>>`SELECT revision,title,data,"createdAt" FROM caleonis.document_versions WHERE "organizationId"=${org} AND "documentId"=${id} ORDER BY revision DESC LIMIT 30`;
    },
  };
}
