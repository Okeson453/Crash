/**
 * Pre-warm ACIE + incremental feature tracker at session start.
 * Moves O(N) seed work off the first-entry critical path.
 */

import { getLogger } from '../observability/logger.js';
import type { EntryDecisionService } from './entry-decision-service.js';
import { globalIncrementalFeatures } from './features/incremental-features.js';
import { featureHotCache } from '../observability/performance/hot-cache.js';

export interface PrewarmResult {
  historyRounds: number;
  featuresSeeded: boolean;
  acieHistorySize: number;
  durationMs: number;
}

/**
 * Warm historical buffer, seed ACIE (via ensure path), seed incremental features.
 * Safe to call multiple times; subsequent calls are cheap if already warm.
 */
export async function prewarmPredictionStack(
  entryDecisionService: EntryDecisionService,
  historyLimit = 200
): Promise<PrewarmResult> {
  const logger = getLogger();
  const t0 = performance.now();

  const hist = entryDecisionService.getHistoricalDataService();
  await hist.ensureWarmed(historyLimit);

  const rounds = hist.getRecentRoundsSync(historyLimit);
  if (rounds.length > 0) {
    globalIncrementalFeatures.seed(
      rounds.map((r) => ({
        ...r,
        crashPoint: r.crashPoint,
      }))
    );
    featureHotCache.set('latest', globalIncrementalFeatures.toFeatures(), 60_000);
  }

  // Force ACIE seed via a no-op observe path: evaluateEntry seed happens on first call;
  // trigger ensure by reading ACIE history size after a lightweight evaluateNext if possible.
  let acieSize = 0;
  try {
    const acie = entryDecisionService.getACIE();
    acieSize = acie.historySize();
    // If ACIE still empty but we have rounds, seed explicitly
    if (acieSize < 20 && rounds.length >= 20 && typeof (acie as any).seedHistory === 'function') {
      (acie as any).seedHistory(
        rounds.map((r) => ({
          roundId: r.id || r.externalRoundId || `prewarm-${r.crashPoint}`,
          crashPoint: r.crashPoint,
          timestamp: r.crashedAt ?? r.createdAt ?? new Date().toISOString(),
        }))
      );
      acieSize = acie.historySize();
    }
  } catch (err) {
    logger.warn(
      { component: 'Prewarm', error: err instanceof Error ? err.message : String(err) },
      'ACIE prewarm partial'
    );
  }

  const durationMs = performance.now() - t0;
  logger.info(
    {
      component: 'Prewarm',
      historyRounds: rounds.length,
      featuresSeeded: rounds.length > 0,
      acieHistorySize: acieSize,
      durationMs: Math.round(durationMs),
    },
    'Prediction stack pre-warmed'
  );

  return {
    historyRounds: rounds.length,
    featuresSeeded: rounds.length > 0,
    acieHistorySize: acieSize,
    durationMs,
  };
}
