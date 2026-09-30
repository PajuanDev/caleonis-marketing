import { Body, Controller, Get, HttpException, Param, Post, Put, Query, Req } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { validateDocument, requireId, requireKind, requireRevision, referenceLinks, WorkspaceInputError } from '@gitroom/helpers/caleonis/workspace.domain';
import { createWorkspaceRepository, WorkspaceConflict, WorkspaceMissing } from '@gitroom/nestjs-libraries/caleonis/workspace.repository';
import { CaleonisStudioService } from '@gitroom/nestjs-libraries/caleonis/studio.service';
import { Organization } from '@prisma/client';
@Controller('/workspace')
export class WorkspaceController {
  constructor(private readonly db: PrismaService, private readonly studio: CaleonisStudioService) {}
  private repository() { return createWorkspaceRepository(this.db); }
  private async safe<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof WorkspaceInputError) throw new HttpException(err.message, 400);
      if (err instanceof WorkspaceMissing) throw new HttpException('Document introuvable.', 404);
      if (err instanceof WorkspaceConflict) throw new HttpException('Une version plus récente existe. Rechargez-la avant de sauvegarder.', 409);
      throw new HttpException('Espace marketing indisponible. Vos modifications ne sont pas confirmées comme enregistrées.', 503);
    }
  }
  private async authorizeWrite(req: any, org: Organization, adminOnly = false) {
    if (req.headers.origin && req.headers.origin !== new URL(process.env.FRONTEND_URL!).origin) throw new HttpException('Origine non autorisée.', 403);
    const member = await this.db.userOrganization.findFirst({ where: { userId: req.user?.id || '', organizationId: org.id, disabled: false }, select: { role: true } });
    const allowed = adminOnly ? ['SUPERADMIN', 'ADMIN'] : ['SUPERADMIN', 'ADMIN', 'USER'];
    if (!allowed.includes(String(member?.role || ''))) throw new HttpException('Droits insuffisants pour modifier cet espace.', 403);
  }
  private async validateLinks(org: string, input: ReturnType<typeof validateDocument>) {
    for (const link of referenceLinks(input)) {
      if (link.kind === 'media') {
        const media = await this.db.media.findFirst({ where: { id: link.id, organizationId: org, deletedAt: null }, select: { id: true } });
        if (!media) throw new HttpException('Référence média indisponible dans cette entreprise.', 404);
      } else if (link.kind === 'connection') {
        const connection = await this.db.thirdParty.findFirst({ where: { id: link.id, organizationId: org, deletedAt: null, identifier: 'higgsfield' }, select: { id: true } });
        if (!connection) throw new HttpException('Connexion indisponible dans cette entreprise.', 404);
      } else {
        const document = await this.repository().get(org, link.id);
        if (document.kind !== link.kind) throw new WorkspaceInputError('Type de référence incorrect.');
      }
    }
  }
  @Get('/documents')
  list(@GetOrgFromRequest() org: Organization, @Query('kind') kind: string) { return this.safe(() => this.repository().list(org.id, requireKind(kind))); }
  @Get('/documents/:id')
  get(@GetOrgFromRequest() org: Organization, @Param('id') id: string) { return this.safe(() => this.repository().get(org.id, requireId(id))); }
  @Get('/documents/:id/versions')
  versions(@GetOrgFromRequest() org: Organization, @Param('id') id: string) { return this.safe(async () => { await this.repository().get(org.id, requireId(id)); return this.repository().versions(org.id, id); }); }
  @Post('/documents')
  create(@GetOrgFromRequest() org: Organization, @Req() req: any, @Body() body: unknown) {
    return this.safe(async () => { const input = validateDocument(body); await this.authorizeWrite(req, org, input.kind === 'brand'); await this.validateLinks(org.id, input); return this.repository().create(org.id, input); });
  }
  @Put('/documents/:id')
  save(@GetOrgFromRequest() org: Organization, @Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.safe(async () => { const input = validateDocument(body); const revision = requireRevision(body.revision); requireId(id); await this.authorizeWrite(req, org, input.kind === 'brand'); await this.validateLinks(org.id, input); return this.repository().save(org.id, id, revision, input); });
  }
  @Get('/media')
  media(@GetOrgFromRequest() org: Organization, @Query('search') search = '') {
    return this.safe(async () => {
      if (typeof search !== 'string' || search.length > 120) throw new WorkspaceInputError('Recherche invalide.');
      return this.db.media.findMany({ where: { organizationId: org.id, deletedAt: null, status: 'ready', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) }, select: { id: true, name: true, path: true, type: true }, take: 40, orderBy: { createdAt: 'desc' } });
    });
  }
  @Get('/studio-capabilities')
  capabilities() { return this.studio.capabilities(); }
  @Get('/projects/:id/runs')
  runs(@GetOrgFromRequest() org: Organization, @Param('id') id: string) { return this.safe(() => this.studio.list(org.id, id)); }
  @Post('/projects/:id/runs')
  start(@GetOrgFromRequest() org: Organization, @Req() req: any, @Param('id') id: string, @Body() body: any) { return this.safe(async () => { await this.authorizeWrite(req, org, true); return this.studio.start(org.id, id, body); }); }
  @Post('/projects/:id/runs/:run/sync')
  sync(@GetOrgFromRequest() org: Organization, @Param('id') id: string, @Param('run') run: string) { return this.safe(() => this.studio.sync(org.id, id, run)); }
  @Post('/projects/:id/runs/:run/import')
  import(@GetOrgFromRequest() org: Organization, @Req() req: any, @Param('id') id: string, @Param('run') run: string) { return this.safe(async () => { await this.authorizeWrite(req, org); return this.studio.import(org.id, id, run); }); }
}
