import { Global, Module } from '@nestjs/common';
import { HeygenProvider } from '@gitroom/nestjs-libraries/3rdparties/heygen/heygen.provider';
import { ReelFarmProvider } from '@gitroom/nestjs-libraries/3rdparties/reelfarm/reelfarm.provider';
import { HiggsfieldProvider } from '@gitroom/nestjs-libraries/3rdparties/higgsfield/higgsfield.provider';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';

@Global()
@Module({
  providers: [HeygenProvider, ReelFarmProvider, HiggsfieldProvider, ThirdPartyManager],
  get exports() {
    return this.providers;
  },
})
export class ThirdPartyModule {}
