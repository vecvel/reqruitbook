import { Module } from '@nestjs/common';

import { DownstreamProber } from './downstream.prober';
import { AdminHealthController } from './health.controller';

@Module({
  controllers: [AdminHealthController],
  providers: [DownstreamProber],
})
export class AdminHealthModule {}
