/**
 * Role-based access control middleware
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

export function requireRole(...allowedRoles: string[]) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.auth) {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!allowedRoles.includes(request.auth.role)) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `This action requires one of: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }
  };
}
