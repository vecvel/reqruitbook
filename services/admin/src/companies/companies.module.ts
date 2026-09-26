import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { AdminCompaniesController } from './companies.controller';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';

@Module({
  // The tenant page shows recent history, which is the audit feed filtered to
  // one company — the same reader, not a second copy of it.
  imports: [ActivityModule],
  controllers: [AdminCompaniesController],
  providers: [CompaniesService, CompaniesRepository],
})
export class AdminCompaniesModule {}
