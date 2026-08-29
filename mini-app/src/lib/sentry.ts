import { logger } from '@/utils/logger';
export interface ErrorReporter { captureException(error: unknown, context?: Record<string, unknown>): void; captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void; }
const reporter: ErrorReporter = {
  captureException(error, context) { logger.error('Reported exception', error, context); },
  captureMessage(message, level = 'info') { if (level === 'error') logger.error(message); else if (level === 'warning') logger.warn(message); else logger.info(message); },
};
export function initSentry(): void { /* External Sentry binding is intentionally deferred until its dependency is available. */ }
export function getErrorReporter(): ErrorReporter { return reporter; }
