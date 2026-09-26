/**
 * Registration request shapes.
 *
 * The DTO layer only asserts that a field is present and plausibly shaped. The
 * two rules that actually matter — is the slug claimable, is the owner's email
 * free — are decided by the slug constraint and by identity respectively, since
 * only they can decide them without a race.
 */
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { COMPANY_SIZES, SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from '../domain';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterCompanyDto {
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  companyName!: string;

  @Transform(lower)
  @IsString()
  @Length(SLUG_MIN_LENGTH, SLUG_MAX_LENGTH)
  slug!: string;

  @Transform(lower)
  @IsEmail({}, { message: 'ownerEmail must be a valid email address.' })
  @MaxLength(320)
  ownerEmail!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 200)
  ownerName!: string;

  /**
   * Length only.
   *
   * Identity owns the password policy — composition rules, hashing parameters,
   * the lot — and duplicating it here would mean two places to change and one
   * of them silently stale. Its 422 is forwarded verbatim. The bounds below
   * exist to refuse an obvious mistake before a network call, and to cap what
   * gets hashed.
   */
  @IsString()
  @Length(12, 200, { message: 'ownerPassword must be between 12 and 200 characters.' })
  ownerPassword!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  industry!: string;

  @IsIn(COMPANY_SIZES, { message: `size must be one of: ${COMPANY_SIZES.join(', ')}.` })
  size!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 100)
  country!: string;
}

export class SlugAvailableQueryDto {
  @Transform(lower)
  @IsString()
  @IsOptional()
  @MaxLength(SLUG_MAX_LENGTH)
  slug?: string;
}
