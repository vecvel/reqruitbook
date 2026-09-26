import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { WebhookEventsRepository } from './webhook-events.repository';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PaymentsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookEventsRepository],
  exports: [WebhooksService],
})
export class WebhooksModule {}
