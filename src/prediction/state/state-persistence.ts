/**
 * Phase 3.1 — Prediction stack snapshot/restore for multi-instance safety.
 * Hot path stays in process memory; snapshots go to Redis (preferred) or file.
 */

import { globalIncrementalState } from './incremental-state-engine.js';
import { globalCalibrationState } from '../calibration/calibration-state.js';
import { getLogger } from '../../observability/logger.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const logger = getLogger();
const SNAPSHOT_KEY = process.env.PREDICTION_SNAPSHOT_REDIS_KEY ?? 'crash:prediction:stack:v1';

export interface PredictionStackSnapshot {
  crashPoints: number[];
  calibrationVersion: string;
  savedAt: string;
  version: 1;
}

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
};

export function snapshotPredictionStack(maxPoints = 2000): PredictionStackSnapshot {
  const points =
    typeof (globalIncrementalState as unknown as { getRecentPoints?: (n: number) => number[] }).getRecentPoints ===
    'function'
      ? (globalIncrementalState as unknown as { getRecentPoints: (n: number) => number[] }).getRecentPoints(maxPoints)
      : [];
  return {
    crashPoints: points,
    calibrationVersion: globalCalibrationState.version,
    savedAt: new Date().toISOString(),
    version: 1,
  };
}

export function restoreIncrementalFromPoints(points: number[]): void {
  if (!points.length) return;
  globalIncrementalState.seed(points);
  logger.info(
    { component: 'StatePersistence', n: points.length },
    'Incremental state restored from points'
  );
}

export async function saveSnapshotToRedis(redis: RedisLike): Promise<void> {
  const snap = snapshotPredictionStack();
  // If no points extracted, still save metadata
  await redis.set(SNAPSHOT_KEY, JSON.stringify(snap), 'EX', 86400);
  logger.info({ component: 'StatePersistence', points: snap.crashPoints.length }, 'Snapshot saved to Redis');
}

export async function loadSnapshotFromRedis(redis: RedisLike): Promise<boolean> {
  try {
    const raw = await redis.get(SNAPSHOT_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as PredictionStackSnapshot;
    if (snap.crashPoints?.length) restoreIncrementalFromPoints(snap.crashPoints);
    return true;
  } catch (err) {
    logger.warn(
      { component: 'StatePersistence', error: String(err) },
      'Redis snapshot load failed'
    );
    return false;
  }
}

export async function saveSnapshotToFile(filePath?: string): Promise<string> {
  const dest =
    filePath ??
    path.join(process.env.PREDICTION_SNAPSHOT_DIR ?? '/tmp/crash-snapshots', 'prediction-stack.json');
  await mkdir(path.dirname(dest), { recursive: true });
  const snap = snapshotPredictionStack();
  await writeFile(dest, JSON.stringify(snap), 'utf8');
  return dest;
}

export async function loadSnapshotFromFile(filePath?: string): Promise<boolean> {
  const dest =
    filePath ??
    path.join(process.env.PREDICTION_SNAPSHOT_DIR ?? '/tmp/crash-snapshots', 'prediction-stack.json');
  try {
    const raw = await readFile(dest, 'utf8');
    const snap = JSON.parse(raw) as PredictionStackSnapshot;
    if (snap.crashPoints?.length) restoreIncrementalFromPoints(snap.crashPoints);
    return true;
  } catch {
    return false;
  }
}

/** Boot helper: try Redis then file */
export async function loadPredictionStackOnBoot(redis?: RedisLike | null): Promise<void> {
  if (redis) {
    const ok = await loadSnapshotFromRedis(redis);
    if (ok) return;
  }
  await loadSnapshotFromFile();
}
