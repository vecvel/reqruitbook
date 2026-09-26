/**
 * The companies feature: registration, profile, careers portal, platform
 * administration and the internal lookup.
 *
 * One module rather than five because they are one aggregate — every route
 * reads or writes the same row, and splitting them would mean five modules
 * sharing one repository and one service. The separation that matters is the
 * one between *audiences*, and that lives in the controllers and the views.
 */
import { Module } from '@nestjs/common';

import { ServiceTokenGuard } from '../common/internal-guard';
import { RegistrationRateLimitGuard, SlugCheckRateLimitGuard } from '../common/rate-limit.guard';
import type { CompaniesConfig } from '../config';
import { IdentityClient } from '../identity/identity.client';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService, SERVICE_CONFIG } from './companies.service';
import { CompanyController } from './company.controller';
import { InternalCompaniesController } from './internal.controller';
import { PlatformCompaniesController } from './platform.controller';
import { PublicCompanyController } from './public.controller';
import { RegisterController } from './register.controller';

@Module({
  controllers: [
    RegisterController,
    CompanyController,
    PublicCompanyController,
    PlatformCompaniesController,
    InternalCompaniesController,
  ],
  providers: [
    CompaniesService,
    CompaniesRepository,
    SlugCheckRateLimitGuard,
    RegistrationRateLimitGuard,
    ServiceTokenGuard,
    // Built by hand because it takes a plain configuration object rather than
    // an injectable class: an interface has no runtime token for Nest to
    // resolve a constructor parameter against.
    {
      provide: IdentityClient,
      inject: [SERVICE_CONFIG],
      useFactory: (config: CompaniesConfig): IdentityClient => new IdentityClient(config),
    },
  ],
  exports: [CompaniesService, CompaniesRepository],
})
export class CompaniesModule {}
