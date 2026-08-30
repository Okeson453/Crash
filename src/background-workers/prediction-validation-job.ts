/**
 * Periodic statistical validation hook (issue 15).
 * Wire into composition start when VALIDATION_CRON_ENABLED=true.
 */

import { getLogger } from '../observability/logger.js';

const logger = getLogger();

export function startPredictionValidationJob(intervalMs = 24 * 60 * 60 * 1000): () => void {
  if (process.env.VALIDATION_CRON_ENABLED !== 'true') {
    return () => undefined;
  }
  const tick = async () => {
    try {
      const { runValidationProtocol } = await import('../prediction/index.js');
      if (typeof runValidationProtocol === 'function') {
        await runValidationProtocol();
        logger.info({ component: 'ValidationJob' }, 'Validation protocol completed');
      }
    } catch (err) {
      logger.warn(
        { component: 'ValidationJob', error: String(err) },
        'Validation protocol skipped or failed'
      );
    }
  };
  const id = setInterval(() => void tick(), intervalMs);
  void tick();
  return () => clearInterval(id);
}
