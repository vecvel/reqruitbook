/**
 * RFC 9457 problem+json, matching `packages/goshared/httpx` byte for byte.
 *
 * A client that consumes this platform sees one error shape regardless of which
 * runtime answered. That is the whole point of duplicating the type: a caller
 * should never have to know that companies is Node and jobs is Go.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  errors?: Record<string, string[]>;
  requestId?: string;
}

export class Problem extends HttpException {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly fields?: Record<string, string[]>;

  constructor(status: number, code: string, title: string, detail: string, fields?: Record<string, string[]>) {
    super({ title, detail, code, status }, status);
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.fields = fields;
  }
}

export const badRequest = (detail: string) => new Problem(400, 'bad_request', 'Bad Request', detail);

export const unauthorized = (detail = 'The supplied credentials are not valid.') =>
  new Problem(401, 'unauthorized', 'Unauthorized', detail);

export const forbidden = (detail = 'You do not have permission to perform this action.') =>
  new Problem(403, 'forbidden', 'Forbidden', detail);

export const notFound = (detail = 'The requested resource does not exist.') =>
  new Problem(404, 'not_found', 'Not Found', detail);

export const conflict = (code: string, detail: string) => new Problem(409, code, 'Conflict', detail);

export const validationFailed = (fields: Record<string, string[]>) =>
  new Problem(422, 'validation_failed', 'Validation Failed', 'One or more fields are invalid.', fields);

export const tooManyRequests = (detail = 'Too many attempts. Please wait a moment and try again.') =>
  new Problem(429, 'rate_limited', 'Too Many Requests', detail);

export const paymentRequired = (detail: string) =>
  new Problem(402, 'subscription_required', 'Payment Required', detail);

export const internal = (detail = 'Something went wrong on our side.') =>
  new Problem(500, 'internal_error', 'Internal Server Error', detail);

/**
 * Turns every thrown error into a problem document.
 *
 * Anything that is not already a Problem becomes a bare 500: an unexpected
 * error's message often carries a connection string, a SQL fragment or a row of
 * customer data, and none of that belongs in a response body. The real error is
 * logged with the request id so it is still diagnosable.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || undefined;

    const body = this.toProblem(exception, request, requestId);

    if (body.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.status).type('application/problem+json').json(body);
  }

  private toProblem(exception: unknown, request: Request, requestId?: string): ProblemBody {
    if (exception instanceof Problem) {
      return {
        type: 'about:blank',
        title: exception.title,
        status: exception.getStatus(),
        detail: exception.detail,
        instance: request.url,
        code: exception.code,
        ...(exception.fields ? { errors: exception.fields } : {}),
        ...(requestId ? { requestId } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      // Nest's own ValidationPipe reports an array of messages; reshape it into
      // the field map the rest of the platform returns.
      const messages =
        typeof payload === 'object' && payload !== null && Array.isArray((payload as { message?: unknown }).message)
          ? ((payload as { message: string[] }).message)
          : undefined;

      if (status === HttpStatus.BAD_REQUEST && messages) {
        return {
          type: 'about:blank',
          title: 'Validation Failed',
          status: 422,
          detail: 'One or more fields are invalid.',
          instance: request.url,
          code: 'validation_failed',
          errors: groupByField(messages),
          ...(requestId ? { requestId } : {}),
        };
      }

      return {
        type: 'about:blank',
        title: statusTitle(status),
        status,
        detail: typeof payload === 'string' ? payload : exception.message,
        instance: request.url,
        code: statusCode(status),
        ...(requestId ? { requestId } : {}),
      };
    }

    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Something went wrong on our side.',
      instance: request.url,
      code: 'internal_error',
      ...(requestId ? { requestId } : {}),
    };
  }
}

/** class-validator emits "field must be a string"; recover the field name. */
function groupByField(messages: string[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const message of messages) {
    const field = message.split(' ')[0] ?? '_';
    (fields[field] ??= []).push(message);
  }
  return fields;
}

function statusTitle(status: number): string {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Failed',
    429: 'Too Many Requests',
  };
  return titles[status] ?? 'Error';
}

function statusCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'bad_request',
    401: 'unauthorized',
    402: 'subscription_required',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    422: 'validation_failed',
    429: 'rate_limited',
  };
  return codes[status] ?? 'internal_error';
}
