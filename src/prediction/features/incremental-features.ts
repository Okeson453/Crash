/**
 * Incremental feature updates — O(1) amortized vs O(N) recompute.
 * Design §1.4 / §2.15
 */

import type { HistoricalRound } from '../types.js';
import { featureHotCache } from '../../observability/performance/hot-cache.js';
import { featureLatencyMs } from '../../observability/performance/latency.js';

export interface IncrementalState {
  count: number;
  sum: number;
  sumSq: number;
  last10: number[];
  lastCrash: number | null;
  streakBelow15: number;
  streakAbove20: number;
  hits13: number;
  updatedAt: number;
}

export class IncrementalFeatureTracker {
  private state: IncrementalState = {
    count: 0,
    sum: 0,
    sumSq: 0,
    last10: [],
    lastCrash: null,
    streakBelow15: 0,
    streakAbove20: 0,
    hits13: 0,
    updatedAt: 0,
  };

  /** Seed from historical rounds once (warm path, not critical path) */
  seed(rounds: HistoricalRound[]): void {
    this.state = {
      count: 0,
      sum: 0,
      sumSq: 0,
      last10: [],
      lastCrash: null,
      streakBelow15: 0,
      streakAbove20: 0,
      hits13: 0,
      updatedAt: Date.now(),
    };
    for (const r of rounds) {
      this.onCrash(r.crashPoint);
    }
  }

  /** Call on every crash — O(1) */
  onCrash(crashPoint: number): Record<string, number> {
    const t0 = performance.now();
    const s = this.state;
    s.count += 1;
    s.sum += crashPoint;
    s.sumSq += crashPoint * crashPoint;
    s.lastCrash = crashPoint;
    s.last10.push(crashPoint);
    if (s.last10.length > 10) s.last10.shift();

    if (crashPoint < 1.5) s.streakBelow15 += 1;
    else s.streakBelow15 = 0;
    if (crashPoint >= 2.0) s.streakAbove20 += 1;
    else s.streakAbove20 = 0;
    if (crashPoint >= 1.3) s.hits13 += 1;

    s.updatedAt = Date.now();
    const features = this.toFeatures();
    featureHotCache.set('latest', features, 15_000);
    featureLatencyMs.observe(performance.now() - t0);
    return features;
  }

  toFeatures(): Record<string, number> {
    const s = this.state;
    const mean = s.count > 0 ? s.sum / s.count : 0;
    const variance =
      s.count > 1 ? Math.max(0, s.sumSq / s.count - mean * mean) : 0;
    const last10Mean =
      s.last10.length > 0
        ? s.last10.reduce((a, b) => a + b, 0) / s.last10.length
        : 0;
    return {
      n: s.count,
      mean_cp: mean,
      var_cp: variance,
      std_cp: Math.sqrt(variance),
      last_cp: s.lastCrash ?? 0,
      last10_mean: last10Mean,
      streak_below_15: s.streakBelow15,
      streak_above_20: s.streakAbove20,
      hit_rate_13: s.count > 0 ? s.hits13 / s.count : 0,
      quality_score: Math.min(1, s.count / 100),
    };
  }

  getState(): Readonly<IncrementalState> {
    return this.state;
  }
}

export const globalIncrementalFeatures = new IncrementalFeatureTracker();
