import type { PrismaClient } from '@prisma/client';
export type StudioRun = { id: string; organizationId: string; projectId: string; projectRevision: number; connectionId: string; status: string; snapshot: Record<string, any>; requestId: string | null; mediaId: string | null; createdAt: Date; updatedAt: Date; usage?: Record<string, number> };
export class StudioReservationError extends Error {}
export function createStudioRepository(db: PrismaClient) {
  return {
    async list(org: string, project: string) {
      return db.$queryRaw<StudioRun[]>`SELECT * FROM caleonis.studio_runs WHERE "organizationId"=${org} AND "projectId"=${project} ORDER BY "createdAt" DESC LIMIT 30`;
    },
    async get(org: string, id: string) {
      const rows = await db.$queryRaw<StudioRun[]>`SELECT * FROM caleonis.studio_runs WHERE "organizationId"=${org} AND id=${id}`;
      return rows[0];
    },
    async reserve(org: string, id: string, project: string, revision: number, connection: string, snapshot: unknown, limit: number, initialStatus: 'submitting' | 'queued' = 'submitting') {
      return db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${org}))`;
        const previous = await tx.$queryRaw<StudioRun[]>`SELECT * FROM caleonis.studio_runs WHERE "organizationId"=${org} AND id=${id}`;
        if (previous.length) {
          if (previous[0].projectId !== project || previous[0].projectRevision !== revision || previous[0].connectionId !== connection) throw new StudioReservationError('Cette demande appartient à une autre version du projet.');
          return { run: previous[0], created: false };
        }
        const current = await tx.$queryRaw<Array<{ revision: number }>>`SELECT revision FROM caleonis.documents WHERE "organizationId"=${org} AND id=${project} AND kind='project' FOR UPDATE`;
        if (!current.length || current[0].revision !== revision) throw new StudioReservationError('Sauvegardez puis rechargez la version courante avant de générer.');
        const count = await tx.$queryRaw<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM caleonis.studio_runs WHERE "organizationId"=${org} AND "createdAt">NOW()-INTERVAL '24 hours'`;
        if (limit < 1 || count[0].total >= limit) throw new StudioReservationError('Plafond de créations atteint ou non configuré.');
        const rows = await tx.$queryRaw<StudioRun[]>`INSERT INTO caleonis.studio_runs (id,"organizationId","projectId","projectRevision","connectionId",snapshot,status) VALUES (${id},${org},${project},${revision},${connection},${JSON.stringify(snapshot)}::jsonb,${initialStatus}) RETURNING *`;
        return { run: rows[0], created: true };
      });
    },
    async update(org: string, id: string, status: string, requestId: string | null = null) {
      await db.$executeRaw`UPDATE caleonis.studio_runs SET status=${status},"requestId"=COALESCE(${requestId},"requestId"),"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id} AND "mediaId" IS NULL`;
    },
    async claimNative(org: string, id: string) {
      const rows = await db.$queryRaw<StudioRun[]>`UPDATE caleonis.studio_runs SET status='in_progress',"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id} AND "connectionId"='native:openai' AND status='queued' RETURNING *`;
      return rows[0];
    },
    async finishNative(org: string, id: string, mediaId: string, requestId: string | null, usage: Record<string, number>) {
      await db.$executeRaw`UPDATE caleonis.studio_runs SET status='completed',"mediaId"=${mediaId},"requestId"=${requestId},usage=${JSON.stringify(usage)}::jsonb,"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id} AND status='in_progress' AND "connectionId"='native:openai'`;
    },
    async nativeFailure(org: string, id: string, status: 'failed' | 'unknown') {
      await db.$executeRaw`UPDATE caleonis.studio_runs SET status=${status},"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id} AND "connectionId"='native:openai' AND status IN ('queued','in_progress') AND "mediaId" IS NULL`;
    },
    async imported(org: string, id: string, mediaId: string) {
      await db.$executeRaw`UPDATE caleonis.studio_runs SET status='completed',"mediaId"=${mediaId},"updatedAt"=NOW() WHERE "organizationId"=${org} AND id=${id}`;
    },
  };
}
