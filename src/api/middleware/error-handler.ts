/**
 * Global error handler for Fastify
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId =
    (typeof request.headers['x-request-id'] === 'string' && request.headers['x-request-id']) ||
    (request.id as string);

  request.log.error({
    err: error,
    requestId,
    path: request.url,
    method: request.method,
  }, 'Request error');

  // Validation errors (Zod/Fastify)
  if (error.validation) {
    reply.status(422).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: (error as { details?: unknown }).details,
        requestId,
      },
    });
    return;
  }

  // Rate limit errors (@fastify/rate-limit and nested shapes)
  const nested = (error as FastifyError & { error?: { code?: string } }).error;
  const isRateLimit =
    error.statusCode === 429 ||
    error.code === 'RATE_LIMIT' ||
    error.code === 'FST_ERR_RATE_LIMIT' ||
    nested?.code === 'RATE_LIMIT';
  if (isRateLimit) {
    const retryAfter = (error as FastifyError & { after?: string | number }).after;
    if (retryAfter !== undefined) {
      reply.header('Retry-After', String(retryAfter));
    }
    reply.status(429).send({
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests. Please try again later.',
        requestId,
      },
    });
    return;
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const response: ApiError = {
    error: {
      code: String(error.code || 'INTERNAL_ERROR').toUpperCase().replace(/\s+/g, '_'),
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      details: statusCode >= 500 ? undefined : (error as { details?: unknown }).details,
      requestId,
    },
  };

  reply.status(statusCode).send(response);
}
