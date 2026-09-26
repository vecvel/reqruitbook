/**
 * Request shapes for the plan endpoints.
 *
 * class-validator handles the field-level rules; the ValidationPipe is
 * configured with forbidNonWhitelisted so an unknown property is a 422 rather
 * than a silently ignored field — a misspelled `trialDay` must not look like it
 * worked. Rules that span fields (a lifetime plan's interval count, the
 * entitlement document) live in the service, where they can say why.
 */
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { MAX_MINOR_UNITS } from '../../common/money';
import { PLAN_INTERVALS } from '../../entitlements/duration';

export class CreatePlanDto {
  // Keys end up in URLs, metadata and support conversations, so they are
  // restricted to a shape that survives all three.
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/, {
    message: 'key must be 3-50 lowercase letters, digits, hyphens or underscores.',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Minor units — 4900 is £49.00. */
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR_UNITS)
  priceAmount!: number;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a three-letter ISO 4217 code.' })
  currency!: string;

  @IsIn(PLAN_INTERVALS as unknown as string[])
  interval!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @IsObject()
  entitlements!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/, {
    message: 'key must be 3-50 lowercase letters, digits, hyphens or underscores.',
  })
  key?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR_UNITS)
  priceAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a three-letter ISO 4217 code.' })
  currency?: string;

  @IsOptional()
  @IsIn(PLAN_INTERVALS as unknown as string[])
  interval?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  intervalCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @IsOptional()
  @IsObject()
  entitlements?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

/** Query string for the platform plan listing. */
export class ListPlansQueryDto {
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'retired'])
  state?: string;
}

export class RetirePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
