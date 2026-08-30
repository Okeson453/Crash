/**
 * Standard API error envelope: { error: { code, message, details?, requestId? } }
 */

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function errorEnvelope(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };
}

export function sendApiError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): void {
  reply.status(status).send(errorEnvelope(code, message, details, requestId));
}
