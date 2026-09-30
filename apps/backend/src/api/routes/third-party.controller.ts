import { Body, Controller, Get, HttpException, Param, Post, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { ImportMediaDto } from '@gitroom/nestjs-libraries/dtos/third-party/import-media.dto';
import { HiggsfieldProvider } from '@gitroom/nestjs-libraries/3rdparties/higgsfield/higgsfield.provider';
@ApiTags('Third Party')
@Controller('/third-party')
export class ThirdPartyController {
  private storage = UploadFactory.createStorage();
  constructor(private _thirdPartyManager: ThirdPartyManager, private _mediaService: MediaService) {}
  @Get('/list')
  async getThirdPartyList() { return this._thirdPartyManager.getAllThirdParties(); }
  @Get('/')
  async getSavedThirdParty(@GetOrgFromRequest() organization: Organization) {
    const connections = await this._thirdPartyManager.getAllThirdPartiesByOrganization(organization.id);
    return connections.flatMap((connection) => {
      const provider = this._thirdPartyManager.getThirdPartyByName(connection.identifier);
      if (!provider) return [];
      const { description, fields, position, title } = provider;
      return [{ ...connection, title, position, fields, description }];
    });
  }
  @Delete('/:id')
  deleteById(@GetOrgFromRequest() organization: Organization, @Param('id') id: string) {
    return this._thirdPartyManager.deleteIntegration(organization.id, id);
  }
  @Post('/:id/submit')
  async generate(@GetOrgFromRequest() organization: Organization, @Param('id') id: string, @Body() data: any) {
    const connection = await this._thirdPartyManager.getIntegrationById(organization.id, id);
    if (!connection) throw new HttpException('Integration not found', 404);
    const provider = this._thirdPartyManager.getThirdPartyByName(connection.identifier);
    if (!provider) throw new HttpException('Invalid identifier', 400);
    const apiKey = AuthService.fixedDecryption(connection.apiKey);
    const scoped = { ...data, __scope: `${organization.id}:${id}` };
    const higgsfield = connection.identifier === 'higgsfield' ? provider.instance as HiggsfieldProvider : undefined;
    if (higgsfield) {
      const status = await higgsfield.generationStatus(apiKey, scoped);
      if (status.media) return status.media;
    }
    const loadedData = await provider.instance.sendData(apiKey, higgsfield ? scoped : data);
    const file = await this.storage.uploadSimple(loadedData);
    const saved = await this._mediaService.saveFile(organization.id, file.split('/').pop(), file);
    if (higgsfield) await higgsfield.markImported(apiKey, { ...scoped, media: saved });
    return saved;
  }
  @Post('/function/:id/:functionName')
  async callFunction(@GetOrgFromRequest() organization: Organization, @Param('id') id: string, @Param('functionName') functionName: string, @Body() data: any) {
    const connection = await this._thirdPartyManager.getIntegrationById(organization.id, id);
    if (!connection) throw new HttpException('Integration not found', 404);
    const provider = this._thirdPartyManager.getThirdPartyByName(connection.identifier);
    if (!provider) throw new HttpException('Invalid identifier', 400);
    if (connection.identifier === 'higgsfield' && functionName !== 'generationStatus') {
      throw new HttpException('Les nouvelles créations Higgsfield passent par un projet du Studio. Cette route ne permet plus de commander une génération.', 409);
    }
    if (['constructor', '__proto__', 'prototype', 'checkConnection', 'markImported'].includes(functionName) || typeof provider.instance[functionName] !== 'function') throw new HttpException('Invalid function', 400);
    return provider.instance[functionName](AuthService.fixedDecryption(connection.apiKey), { ...data, __scope: `${organization.id}:${id}` });
  }
  @Post('/:id/import')
  async importMedia(@GetOrgFromRequest() organization: Organization, @Param('id') id: string, @Body() body: ImportMediaDto) {
    const connection = await this._thirdPartyManager.getIntegrationById(organization.id, id);
    if (!connection) throw new HttpException('Integration not found', 404);
    const provider = this._thirdPartyManager.getThirdPartyByName(connection.identifier);
    if (!provider) throw new HttpException('Invalid identifier', 400);
    const downloadUrls = await provider.instance['importMedia']?.(AuthService.fixedDecryption(connection.apiKey), body.items);
    if (!downloadUrls || !Array.isArray(downloadUrls)) throw new HttpException('Import not supported', 400);
    const results = [];
    for (const item of downloadUrls) {
      const file = await this.storage.uploadSimple(item.url);
      results.push(await this._mediaService.saveFile(organization.id, item.name || file.split('/').pop(), file));
    }
    return results;
  }
  @Post('/:identifier')
  async addApiKey(@GetOrgFromRequest() organization: Organization, @Param('identifier') identifier: string, @Body('api') api: string) {
    const provider = this._thirdPartyManager.getThirdPartyByName(identifier);
    if (!provider) throw new HttpException('Invalid identifier', 400);
    const connect = await provider.instance.checkConnection(api);
    if (!connect) throw new HttpException('Invalid API key', 400);
    try {
      const saved = await this._thirdPartyManager.saveIntegration(organization.id, identifier, api, { name: connect.name, username: connect.username, id: connect.id });
      return { id: saved.id };
    } catch { throw new HttpException('Impossible d’enregistrer cette connexion.', 400); }
  }
}
