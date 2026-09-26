/**
 * The timer that turns "expiresAt has passed" into a closed portal.
 *
 * Without it a lapsed subscription would keep its tenant live until somebody
 * happened to touch the row — billing that only takes effect when observed is
 * not billing.
 */
import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';

import { CONFIG, type SubscriptionsConfig } from '../config';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class ExpirySweep implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ExpirySweep.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly subscriptions: SubscriptionsService,
    @Inject(CONFIG) private readonly config: SubscriptionsConfig,
  ) {}

  onModuleInit(): void {
    // unref so a pending timer never holds the process open during shutdown.
    this.timer = setInterval(() => void this.tick(), this.config.sweepIntervalMs);
    this.timer.unref();
    this.logger.log(`expiry sweep every ${this.config.sweepIntervalMs}ms`);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    // A sweep that overruns its interval must not start a second pass on top of
    // itself; the advisory lock would refuse it anyway, but not queueing work we
    // know will be rejected keeps the logs honest.
    if (this.running) return;
    this.running = true;

    try {
      await this.subscriptions.sweepExpired();
    } catch (error) {
      // A failed sweep is retried on the next tick. Throwing here would reach
      // an unhandled rejection handler and take the process down over something
      // transient, such as the database briefly refusing a connection.
      this.logger.error(`expiry sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
