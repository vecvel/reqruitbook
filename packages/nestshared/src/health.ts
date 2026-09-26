/**
 * Liveness and readiness, matching `httpx.Health` in the Go services.
 *
 * They answer different questions: liveness says the process is alive and
 * should not be restarted; readiness says its dependencies answer and it should
 * receive traffic. Collapsing them into one endpoint makes an orchestrator kill
 * a healthy service because a database blipped.
 */
import { Controller, Get, Res } from '@nestjs/common';

import { Public } from './guards';
import type { Response } from 'express';

export type DependencyCheck = () => Promise<void>;

export class HealthRegistry {
  private readonly checks = new Map<string, DependencyCheck>();

  register(name: string, check: DependencyCheck): this {
    this.checks.set(name, check);
    return this;
  }

  async run(): Promise<{ healthy: boolean; results: Record<string, string> }> {
    const results: Record<string, string> = {};
    let healthy = true;

    await Promise.all(
      [...this.checks].map(async ([name, check]) => {
        try {
          await withTimeout(check(), 3_000);
          results[name] = 'ok';
        } catch (error) {
          results[name] = `error: ${(error as Error).message}`;
          healthy = false;
        }
      }),
    );

    return { healthy, results };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('check timed out')), ms).unref()),
  ]);
}

/**
 * Builds the health controller for a service.
 *
 * Marked `@Public()` on the class: services register `AuthorizationGuard`
 * globally and it denies by default, so without this an orchestrator's probes —
 * which carry no token, and never will — would answer 401 and the service would
 * never be marked ready. A liveness endpoint that requires credentials is not a
 * liveness endpoint.
 */
export function healthController(registry: HealthRegistry): new () => unknown {
  @Public()
  @Controller()
  class HealthController {
    @Get('healthz')
    live(@Res() res: Response): void {
      res.status(200).json({ status: 'ok' });
    }

    @Get('readyz')
    async ready(@Res() res: Response): Promise<void> {
      const { healthy, results } = await registry.run();
      res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks: results });
    }
  }
  return HealthController;
}
