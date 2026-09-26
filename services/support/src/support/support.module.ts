/**
 * Both sides of the desk in one module, with two of everything above the
 * repositories.
 *
 * The company controller is given `CompanySupportService`, which holds
 * `CompanyThreadRepository` and nothing else; the platform controller is given
 * `PlatformSupportService`, which holds `PlatformThreadRepository`. Neither
 * service can reach the other's thread repository, so "which audience is this
 * request?" is answered by what was injected rather than by a flag someone has
 * to pass correctly.
 */
import { Module } from '@nestjs/common';

import { CompanySupportController } from './company-support.controller';
import { CompanySupportService } from './company-support.service';
import { CompanyThreadRepository } from './company-thread.repository';
import { SupportEventPublisher } from './events.publisher';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';
import { PlatformThreadRepository } from './platform-thread.repository';
import { TicketRepository } from './tickets.repository';

@Module({
  controllers: [CompanySupportController, PlatformSupportController],
  providers: [
    CompanySupportService,
    PlatformSupportService,
    TicketRepository,
    CompanyThreadRepository,
    PlatformThreadRepository,
    SupportEventPublisher,
  ],
})
export class SupportModule {}
