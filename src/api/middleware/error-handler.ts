/**
 * Global error handler for Fastify
 */

import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id as string;

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
        requestId,
      },
    });
    return;
  }

  // Rate limit errors
  if (error.statusCode === 429) {
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
      code: error.code || 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      requestId,
    },
  };

  reply.status(statusCode).send(response);
}
