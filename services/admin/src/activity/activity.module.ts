import { Module } from '@nestjs/common';

import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityRepository],
  // The company detail page shows a tenant's recent history, so it reads the
  // same feed rather than growing a second one.
  exports: [ActivityService],
})
export class ActivityModule {}
