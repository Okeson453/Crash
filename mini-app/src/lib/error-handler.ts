import { logger } from '@/utils/logger';
export function setupGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent) => logger.error('Uncaught browser error', event.error, { message: event.message, filename: event.filename, line: event.lineno });
  const onRejection = (event: PromiseRejectionEvent) => logger.error('Unhandled promise rejection', event.reason);
  window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
  return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
}
