/**
 * Request shapes.
 *
 * Note what is *not* here: no DTO carries a company id. The tenant comes from
 * the verified principal, so a field for it would be a field an attacker can
 * set. The one identifier a client does supply — an attachment's object key — is
 * checked against the principal's own prefix before it is stored.
 */
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATES } from './domain';

/** A ticket body is a support request, not a document; 16k is generous. */
const MAX_BODY = 16_000;
const MAX_ATTACHMENTS = 10;

export class AttachmentRefDto {
  @IsString()
  @MaxLength(1024)
  objectKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(255)
  contentType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY)
  body!: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}

export class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_BODY)
  body!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}

export class PlatformReplyDto extends ReplyDto {
  /**
   * An internal note is desk-only triage chatter. It is stored on the ticket so
   * the next agent has the context, and it is never readable by the company.
   */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class UploadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(255)
  contentType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

export class AssignTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  agentId!: string;
}

export class PatchTicketDto {
  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsIn(TICKET_STATES as unknown as string[])
  state?: string;
}

/**
 * Shared list filters.
 *
 * `limit` and `cursor` stay strings: `parsePageRequest` owns the bounds and the
 * cursor format for every service on the platform, and a second parser here
 * would be a second place for the max to drift.
 */
export class ListTicketsQueryDto {
  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsIn(TICKET_STATES as unknown as string[])
  state?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priority?: string;

  @IsOptional()
  @IsIn(TICKET_CATEGORIES as unknown as string[])
  category?: string;
}

export class PlatformListTicketsQueryDto extends ListTicketsQueryDto {
  /**
   * Narrows the desk's queue to one agent's workload.
   *
   * There is deliberately no tenant filter on this endpoint. A company id
   * accepted from a query string is the shape of the bug this platform's
   * tenancy rules exist to prevent, and letting one exist here — even on a
   * route where the scope is legitimately cross-tenant — is the precedent that
   * makes the next one look reasonable.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedAgentId?: string;
}
