import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { CaleonisNativeImageService } from '@gitroom/nestjs-libraries/caleonis/native-image.service';
@Injectable()
@Activity()
export class CaleonisStudioActivity {
  constructor(private native: CaleonisNativeImageService) {}
  @ActivityMethod()
  async caleonisRenderImage(org: string, runId: string) { await this.native.execute(org, runId); }
  @ActivityMethod()
  async caleonisImageInterrupted(org: string, runId: string) { await this.native.interrupted(org, runId); }
}
