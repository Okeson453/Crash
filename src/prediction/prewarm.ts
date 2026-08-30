/**
 * Pre-warm ACIE + incremental state + calibration + feature engine.
 * Blocks live mode until warm (caller enforces).
 */

import { getLogger } from '../observability/logger.js';
import type { EntryDecisionService } from './entry-decision-service.js';
import { globalIncrementalFeatures } from './features/incremental-features.js';
import { globalIncrementalState } from './state/incremental-state-engine.js';
import { globalCalibrationState } from './calibration/calibration-state.js';
import { featureHotCache } from '../observability/performance/hot-cache.js';
import { globalFeatureEngineV2 } from './features/feature-engine-v2.js';

export interface PrewarmResult {
  historyRounds: number;
  featuresSeeded: boolean;
  acieHistorySize: number;
  stateWarm: boolean;
  calibrationWarm: boolean;
  durationMs: number;
}

export async function prewarmPredictionStack(
  entryDecisionService: EntryDecisionService,
  historyLimit = 500
): Promise<PrewarmResult> {
  const logger = getLogger();
  const t0 = performance.now();

  const hist = entryDecisionService.getHistoricalDataService();
  await hist.ensureWarmed(historyLimit);

  const rounds = hist.getRecentRoundsSync(historyLimit);
  if (rounds.length > 0) {
    globalIncrementalState.seed(rounds.map((r) => r.crashPoint));
    globalIncrementalFeatures.seed(rounds);
    featureHotCache.set('latest', globalIncrementalFeatures.toFeatures(), 60_000);
    // Snapshot feature vector once so caches are hot
    globalFeatureEngineV2.snapshotFromState('prewarm', new Date().toISOString());
  }

  let acieSize = 0;
  try {
    const acie = entryDecisionService.getACIE();
    acieSize = acie.historySize();
    if (acieSize < 20 && rounds.length >= 20) {
      acie.seedHistory(
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
  const result: PrewarmResult = {
    historyRounds: rounds.length,
    featuresSeeded: rounds.length > 0,
    acieHistorySize: acieSize,
    stateWarm: globalIncrementalState.isWarm(Math.min(50, Math.floor(historyLimit / 4))),
    calibrationWarm: globalCalibrationState.isWarm(),
    durationMs,
  };
  logger.info({ component: 'Prewarm', ...result }, 'Prediction stack pre-warmed');
  return result;
}

export function assertPredictionWarmForLive(minHistory = 50): void {
  if (!globalIncrementalState.isWarm(minHistory)) {
    throw new Error(
      `LIVE MODE BLOCKED: incremental state cold (count=${globalIncrementalState.snapshot().count}, need≥${minHistory})`
    );
  }
}
