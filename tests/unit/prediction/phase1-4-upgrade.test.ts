import { IncrementalStateEngine } from '@/prediction/state/incremental-state-engine';
import { FeatureEngineV2 } from '@/prediction/features/feature-engine-v2';
import { computeLagFeatures } from '@/prediction/features/lag-features';
import { computeRunFeatures } from '@/prediction/features/run-features';
import { computeMarkovFeatures } from '@/prediction/features/markov-features';
import { computeSpectralFeatures } from '@/prediction/features/spectral-features';
import { computeEntropyFeatures } from '@/prediction/features/entropy-features';
import { computeTimeFeatures } from '@/prediction/features/time-features';
import { computeCrossTargetFeatures } from '@/prediction/features/cross-target-features';
import { EnsembleOrchestrator } from '@/prediction/ensemble/ensemble-orchestrator';
import { ModelPerformanceTracker } from '@/prediction/ensemble/model-performance';
import { IsotonicCalibrator } from '@/prediction/calibration/isotonic-calibrator';
import { PlattCalibrator } from '@/prediction/calibration/platt-calibrator';
import { CalibrationState } from '@/prediction/calibration/calibration-state';
import { expectedCalibrationError, emptyBins, updateBin } from '@/prediction/calibration/calibration-metrics';
import { scoreCandidates } from '@/prediction/models/candidate-models';

function synthPoints(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i % 5 === 0 ? 1.12 : i % 3 === 0 ? 2.1 : 1.45);
  }
  return out;
}

describe('Phase 1 — IncrementalStateEngine', () => {
  it('updates in O(1) and tracks hits/runs/markov', () => {
    const eng = new IncrementalStateEngine();
    eng.seed(synthPoints(100));
    expect(eng.snapshot().count).toBe(100);
    expect(eng.hitRate(1.3)).toBeGreaterThan(0.4);
    expect(eng.isWarm(50)).toBe(true);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 1000; i++) eng.update(1.4);
    const us = Number(process.hrtime.bigint() - t0) / 1e3 / 1000;
    expect(us).toBeLessThan(100); // <100µs avg
  });

  it('markov probability is in (0,1)', () => {
    const eng = new IncrementalStateEngine();
    eng.seed(synthPoints(200));
    const p = eng.markovPNextAbove13();
    expect(p).toBeGreaterThan(0.01);
    expect(p).toBeLessThan(0.99);
  });
});

describe('Phase 2 — Feature Engine v2 families', () => {
  it('produces lag/run/markov/spectral/entropy/time/cross-target features', () => {
    const eng = new IncrementalStateEngine();
    eng.seed(synthPoints(80));
    const lag = computeLagFeatures(eng);
    const run = computeRunFeatures(eng);
    const mk = computeMarkovFeatures(eng);
    const sp = computeSpectralFeatures(eng);
    const en = computeEntropyFeatures(eng);
    const tm = computeTimeFeatures();
    const ct = computeCrossTargetFeatures(eng);
    expect(Object.keys(lag).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(run).length).toBeGreaterThanOrEqual(4);
    expect(mk.markov_p_above_13).toBeGreaterThan(0);
    expect(sp.spec_flatness).toBeGreaterThanOrEqual(0);
    expect(en.entropy_binary_13).toBeGreaterThan(0);
    expect(tm.hour_sin).toBeGreaterThanOrEqual(-1);
    expect(ct.hit_13).toBeGreaterThan(0);

    const fe = new FeatureEngineV2(eng);
    const vec = fe.snapshotFromState('r1');
    expect(vec.featureVersion).toBe('fv-2.0.0');
    expect(Object.keys(vec.values).length).toBeGreaterThan(30);
    expect(fe.featureHash(vec.values).length).toBe(16);
  });
});

describe('Phase 3 — Ensemble v2', () => {
  it('performance-weights models and respects candidate flags', () => {
    const perf = new ModelPerformanceTracker();
    const ens = new EnsembleOrchestrator(perf);
    const scores = [
      { modelName: 'FrequencyModel', modelVersion: '1', probability: 0.66, confidence: 0.7, weight: 1 },
      { modelName: 'ConditionalFrequencyModel', modelVersion: '1', probability: 0.64, confidence: 0.65, weight: 1 },
      { modelName: 'AutocorrelationModel', modelVersion: '1', probability: 0.9, confidence: 0.5, weight: 1 },
    ];
    const off = ens.combine(scores);
    expect(off.weights.AutocorrelationModel ?? 0).toBe(0);

    ens.setFlags({ enableAutocorrelation: true });
    const on = ens.combine(scores);
    expect(on.probability).toBeGreaterThan(0.5);
    expect(on.agreement).toBeGreaterThanOrEqual(0);
  });

  it('candidate models use empirical state only', () => {
    const eng = new IncrementalStateEngine();
    eng.seed(synthPoints(100));
    const c = scoreCandidates(eng);
    expect(c).toHaveLength(4);
    for (const m of c) {
      expect(m.probability).toBeGreaterThanOrEqual(0.01);
      expect(m.probability).toBeLessThanOrEqual(0.99);
      // No hard-coded fantasy edge
      expect(m.probability).not.toBe(0.82);
      expect(m.probability).not.toBe(0.85);
    }
  });
});

describe('Phase 4 — Calibration', () => {
  it('isotonic and platt fit and calibrate', () => {
    const pairs = Array.from({ length: 120 }, (_, i) => {
      const p = 0.3 + (i % 50) / 100;
      const y: 0 | 1 = Math.random() < p ? 1 : 0;
      return { p, y };
    });
    const iso = new IsotonicCalibrator();
    iso.fit(pairs);
    expect(iso.fitted).toBe(true);
    const c = iso.calibrate(0.6);
    expect(c).toBeGreaterThan(0.01);
    expect(c).toBeLessThan(0.99);

    const platt = new PlattCalibrator();
    platt.fit(pairs);
    expect(platt.fitted).toBe(true);
    expect(platt.calibrate(0.55)).toBeGreaterThan(0.01);
  });

  it('CalibrationState tracks ECE and applies shrinkage', () => {
    const cal = new CalibrationState();
    for (let i = 0; i < 100; i++) {
      const p = 0.55 + (i % 10) * 0.02;
      cal.observe(p, Math.random() < p ? 1 : 0, 'normal');
    }
    cal.refit();
    const m = cal.metrics();
    expect(m.n).toBe(100);
    expect(m.ece).toBeGreaterThanOrEqual(0);
    const shrunk = cal.calibrateWithShrinkage(0.7, 'normal', 0.65, 50);
    expect(shrunk).toBeGreaterThan(0.01);
    expect(shrunk).toBeLessThan(0.99);
  });

  it('ECE helper works on bins', () => {
    const bins = emptyBins(5);
    updateBin(bins, 0.6, 1);
    updateBin(bins, 0.6, 0);
    expect(expectedCalibrationError(bins)).toBeGreaterThanOrEqual(0);
  });
});
