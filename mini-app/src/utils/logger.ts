const REDACT_KEYS = ['initdata', 'accesstoken', 'refreshtoken', 'password', 'token', 'authorization', 'payment', 'secret'];
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [name, item] of Object.entries(value)) result[name] = REDACT_KEYS.some((part) => name.toLowerCase().includes(part)) ? '[REDACTED]' : redact(item, depth + 1);
  return result;
}
export const logger = {
  debug(message: string, data?: Record<string, unknown>): void { if (import.meta.env.DEV) console.debug(`[DEBUG] ${message}`, redact(data)); },
  info(message: string, data?: Record<string, unknown>): void { if (import.meta.env.DEV) console.info(`[INFO] ${message}`, redact(data)); },
  warn(message: string, data?: Record<string, unknown>): void { console.warn(`[WARN] ${message}`, redact(data)); },
  error(message: string, error?: unknown, data?: Record<string, unknown>): void { console.error(`[ERROR] ${message}`, error instanceof Error ? error.message : undefined, redact(data)); },
};
