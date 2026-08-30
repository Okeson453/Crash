
/**
 * Minimal snapshot/restore for prediction singletons (Phase 3.1).
 * Redis or file — process memory remains primary hot path.
 */

import { globalIncrementalState } from './incremental-state-engine.js';
import { globalCalibrationState } from '../calibration/calibration-state.js';
import { getLogger } from '../../observability/logger.js';

const logger = getLogger();

export interface PredictionStackSnapshot {
  incremental: ReturnType<typeof globalIncrementalState.snapshot>;
  calibrationVersion: string;
  savedAt: string;
}

export function snapshotPredictionStack(): PredictionStackSnapshot {
  return {
    incremental: globalIncrementalState.snapshot(),
    calibrationVersion: globalCalibrationState.version,
    savedAt: new Date().toISOString(),
  };
}

/** Restore crash points into incremental engine from external history */
export function restoreIncrementalFromPoints(points: number[]): void {
  globalIncrementalState.seed(points);
  logger.info(
    { component: 'StatePersistence', n: points.length },
    'Incremental state restored from points'
  );
}
