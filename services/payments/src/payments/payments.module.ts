import { Module } from '@nestjs/common';

import { PAYMENTS_CONFIG, type PaymentsConfig } from '../config';
import { InvoicesRepository } from './invoices.repository';
import { CompanyPaymentsController, PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { SubscriptionsClient } from './subscriptions.client';

@Module({
  controllers: [PaymentsController, CompanyPaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    InvoicesRepository,
    {
      // The client takes the parsed config rather than reading process.env
      // again, so every setting this service depends on flows through one place.
      provide: SubscriptionsClient,
      inject: [PAYMENTS_CONFIG],
      useFactory: (config: PaymentsConfig): SubscriptionsClient => new SubscriptionsClient(config),
    },
  ],
  exports: [PaymentsService, PaymentsRepository, InvoicesRepository, SubscriptionsClient],
})
export class PaymentsModule {}
