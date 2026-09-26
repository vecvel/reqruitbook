/**
 * Platform administration request shapes.
 *
 * These reach a platform principal only — the guard decides that, not the DTO —
 * so they may carry fields a company must never set about itself, such as the
 * lifecycle state and the internal notes support staff keep.
 */
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { COMPANY_STATES } from '../domain';
import { UpdateProfileDto } from './profile.dto';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ListCompaniesQueryDto {
  @IsOptional()
  @IsIn(COMPANY_STATES, { message: `state must be one of: ${COMPANY_STATES.join(', ')}.` })
  state?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Parsed by `parsePageRequest`, which owns the default and the ceiling. */
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  /** Platform staff investigating a closed account need to see it. */
  @IsOptional()
  @IsIn(['true', 'false'])
  includeDeleted?: string;
}

export class SuspendCompanyDto {
  /**
   * Required, and stored.
   *
   * Suspension locks every user of a tenant out of their portal; support has to
   * be able to answer "why" without reading a changelog.
   */
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}

export class PlatformUpdateCompanyDto extends UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5_000)
  internalNotes?: string;
}
