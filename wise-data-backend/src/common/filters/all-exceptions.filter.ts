import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody, ApiErrorDetail } from '@wisedata/shared';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { Prisma } from '../../generated/prisma/client';

const PRISMA_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Resource already exists' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
};

interface HttpExceptionResponse {
  message?: string | string[];
  details?: ApiErrorDetail[];
}

/**
 * Normalizes every error into ApiErrorBody and hides internal details
 * (stack traces, SQL errors) from clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = this.toErrorBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.statusCode)
      .json(body);
  }

  private toErrorBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Express middleware (body-parser) rejects bad requests with these, e.g.
    // a body over the size limit (413) or malformed JSON (400).
    if (isClientHttpError(exception)) {
      return buildBody(
        exception.status,
        STATUS_CODES[exception.status] ?? 'Bad request',
      );
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known = PRISMA_ERRORS[exception.code];
      if (known) {
        return buildBody(known.status, known.message);
      }
    }

    return buildBody(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error');
  }

  private fromHttpException(exception: HttpException): ApiErrorBody {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return buildBody(statusCode, response);
    }

    const { message, details } = response as HttpExceptionResponse;
    const text = Array.isArray(message) ? message.join('; ') : message;
    return buildBody(statusCode, text ?? exception.message, details);
  }
}

/** An http-errors 4xx error marked safe to show (`expose`), with its own status. */
function isClientHttpError(
  exception: unknown,
): exception is { status: number } {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const { status, expose } = exception as {
    status?: unknown;
    expose?: unknown;
  };
  return (
    expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  );
}

function buildBody(
  statusCode: number,
  message: string,
  details?: ApiErrorDetail[],
): ApiErrorBody {
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    ...(details && { details }),
  };
}
