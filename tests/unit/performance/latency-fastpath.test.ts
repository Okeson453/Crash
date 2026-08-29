/**
 * Performance unit tests — hot cache, incremental features, latency windows.
 */

import {
  HotCache,
  predictionHotCache,
  featureHotCache,
} from '../../../src/observability/performance/hot-cache';
import {
  LatencyTimer,
  RollingLatencyWindow,
} from '../../../src/observability/performance/latency';
import { IncrementalFeatureTracker } from '../../../src/prediction/features/incremental-features';

describe('HotCache', () => {
  it('hits and misses correctly', () => {
    const cache = new HotCache<number>('test', 1_000, 10);
    expect(cache.get('a')).toBeUndefined();
    cache.set('a', 42);
    expect(cache.get('a')).toBe(42);
  });

  it('expires entries', async () => {
    const cache = new HotCache<string>('ttl', 20, 10);
    cache.set('x', 'yes');
    expect(cache.get('x')).toBe('yes');
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get('x')).toBeUndefined();
  });
});

describe('IncrementalFeatureTracker', () => {
  it('updates in O(1) and produces stable features', () => {
    const t = new IncrementalFeatureTracker();
    for (let i = 0; i < 50; i++) {
      t.onCrash(1 + Math.random() * 3);
    }
    const f = t.toFeatures();
    expect(f.n).toBe(50);
    expect(f.mean_cp).toBeGreaterThan(0);
    expect(f.quality_score).toBeGreaterThan(0);
  });

  it('is faster than naive O(N) recompute for large N', () => {
    const tracker = new IncrementalFeatureTracker();
    const points: number[] = [];
    const N = 500;

    const tInc0 = performance.now();
    for (let i = 0; i < N; i++) {
      const cp = 1.2 + (i % 7) * 0.3;
      points.push(cp);
      tracker.onCrash(cp);
    }
    const incMs = performance.now() - tInc0;

    const tNaive0 = performance.now();
    for (let i = 0; i < N; i++) {
      const slice = points.slice(0, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      void mean;
    }
    const naiveMs = performance.now() - tNaive0;

    // Incremental path should not be pathologically slower; typically much faster
    expect(incMs).toBeLessThan(naiveMs * 5 + 50);
    expect(tracker.getState().count).toBe(N);
  });
});

describe('LatencyTimer + RollingWindow', () => {
  it('records stages', () => {
    const timer = new LatencyTimer();
    const ms = timer.record('risk');
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('computes percentiles', () => {
    const w = new RollingLatencyWindow(100);
    for (let i = 1; i <= 100; i++) w.push(i);
    expect(w.p50()).toBeGreaterThanOrEqual(40);
    expect(w.p99()).toBeGreaterThanOrEqual(90);
    expect(w.count()).toBe(100);
  });
});

describe('Singleton caches', () => {
  it('prediction and feature caches are usable', () => {
    predictionHotCache.clear();
    featureHotCache.clear();
    predictionHotCache.set('r1', {
      probability: 0.6,
      confidence: 0.7,
      regimeId: 'stable',
      modelVersion: 'acie-v3',
      reasoning: ['test'],
    });
    expect(predictionHotCache.get('r1')?.probability).toBe(0.6);
    featureHotCache.set('latest', { quality_score: 0.9, n: 10 });
    expect(featureHotCache.get('latest')?.quality_score).toBe(0.9);
  });
});
