import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

// ── Error Codes ────────────────────────────────────────────────────────

export const ErrorCode = {
  // 400
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PREFIX: 'INVALID_PREFIX',
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  BATCH_SIZE_EXCEEDED: 'BATCH_SIZE_EXCEEDED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_BLOCKED: 'FILE_TYPE_BLOCKED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',

  // 401
  UNAUTHORIZED: 'UNAUTHORIZED',

  // 403
  FORBIDDEN: 'FORBIDDEN',

  // 404
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',

  // 409
  PREFIX_ALREADY_EXISTS: 'PREFIX_ALREADY_EXISTS',
  ACTIVE_CYCLE_EXISTS: 'ACTIVE_CYCLE_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  ALREADY_A_MEMBER: 'ALREADY_A_MEMBER',
  INVITATION_ALREADY_SENT: 'INVITATION_ALREADY_SENT',

  // 410
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',

  // 429
  RATE_LIMITED: 'RATE_LIMITED',

  // 500
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ── AppError ───────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  // ── Convenience factories ──────────────────────────────────────────

  static badRequest(code: ErrorCodeType, message: string, details?: Record<string, unknown>) {
    return new AppError(code, 400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(ErrorCode.UNAUTHORIZED, 401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(ErrorCode.FORBIDDEN, 403, message);
  }

  static notFound(resource: string) {
    const code = `${resource.toUpperCase()}_NOT_FOUND` as ErrorCodeType;
    return new AppError(code, 404, `${resource} not found`);
  }

  static conflict(code: ErrorCodeType, message: string) {
    return new AppError(code, 409, message);
  }

  static rateLimited(message = 'Too many requests') {
    return new AppError(ErrorCode.RATE_LIMITED, 429, message);
  }

  static internal(message = 'Internal server error') {
    return new AppError(ErrorCode.INTERNAL_ERROR, 500, message);
  }
}

// ── Fastify Error Handler ──────────────────────────────────────────────

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  // Known application error
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  // Zod validation error
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          fields: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    });
  }

  // Fastify built-in error (validation, JSON parsing, etc.)
  if ('statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;
    return reply.status(statusCode).send({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
      },
    });
  }

  // Unknown error — log and return generic 500
  request.log.error(error, 'Unhandled error');
  return reply.status(500).send({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    },
  });
}
