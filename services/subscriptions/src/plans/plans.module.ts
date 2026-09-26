import { Module } from '@nestjs/common';

import { PlansController, PublicPlansController } from './plans.controller';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansController, PublicPlansController],
  providers: [PlansService, PlansRepository],
  exports: [PlansService, PlansRepository],
})
export class PlansModule {}
