/**
 * Company profile and careers-portal request shapes.
 *
 * Every field is optional: a PATCH carries only what changed, and an absent
 * field must not be confused with a cleared one. `forbidNonWhitelisted` on the
 * global pipe turns an unknown field into a 422 rather than a silent no-op,
 * which is what stops a client from discovering that `state` is spelled
 * `state`.
 */
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ALLOWED_IMAGE_TYPES, COMPANY_SIZES, MAX_ASSET_BYTES } from '../domain';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

const URL_OPTIONS = { require_protocol: true, protocols: ['http', 'https'] };

export class LocationDto {
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  city!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  country!: string;

  @IsOptional()
  @IsBoolean()
  isHeadquarters?: boolean;
}

export class SocialLinksDto {
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  linkedin?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  twitter?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  facebook?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  instagram?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  github?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  youtube?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5_000)
  description?: string;

  /**
   * The object key returned by an upload-url call, not a URL.
   *
   * Constrained to this company's own prefix by the service, because a client
   * that could set an arbitrary key could point its logo at another tenant's
   * object and learn whether it exists.
   */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(400)
  logoKey?: string;

  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsIn(COMPANY_SIZES, { message: `size must be one of: ${COMPANY_SIZES.join(', ')}.` })
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2200)
  foundedYear?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  headquarters?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  locations?: LocationDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialLinksDto)
  socialLinks?: SocialLinksDto;

  @IsOptional()
  @IsEmail({}, { message: 'contactEmail must be a valid email address.' })
  @MaxLength(320)
  contactEmail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  /* ------------------------------ careers portal ------------------------- */

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^#[0-9a-f]{6}$/, { message: 'brandColor must be a hex colour such as #1f6feb.' })
  brandColor?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(400)
  heroImageKey?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20_000)
  aboutMarkdown?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  benefits?: string[];

  /**
   * Stored, never acted on.
   *
   * Nothing in this platform verifies domain ownership or issues a certificate
   * for a custom domain, and the gateway routes on `{slug}.{hostname}` alone.
   * The value is kept so the work is not lost when verification is built; until
   * then it is a note, and `customDomainVerified` stays false.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^$|^(?=.{4,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, {
    message: 'customDomain must be a valid domain name.',
  })
  customDomain?: string;

  @IsOptional()
  @IsBoolean()
  portalPublished?: boolean;
}

export class UploadUrlDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(ALLOWED_IMAGE_TYPES, { message: `contentType must be one of: ${ALLOWED_IMAGE_TYPES.join(', ')}.` })
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_ASSET_BYTES, { message: `sizeBytes must be ${MAX_ASSET_BYTES / (1024 * 1024)} MB or smaller.` })
  sizeBytes!: number;
}
