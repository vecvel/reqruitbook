import { Module } from '@nestjs/common';

import { PlansModule } from '../plans/plans.module';
import {
  BillingController,
  InternalSubscriptionsController,
  SubscriptionsController,
} from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { ExpirySweep } from './sweep';

@Module({
  imports: [PlansModule],
  controllers: [SubscriptionsController, BillingController, InternalSubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsRepository, ExpirySweep],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
