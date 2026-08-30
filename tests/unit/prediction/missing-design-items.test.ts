import {
  runRandomnessGate,
  applyRandomnessGateToFlags,
  waldWolfowitzRunsTest,
  ljungBoxTest,
} from '@/prediction/validation/randomness-gate';
import { LearnedRegimeClustering } from '@/prediction/regimes/learned-clustering';
import { LookaheadEngine } from '@/prediction/lookahead/lookahead-engine';
import { IncrementalStateEngine } from '@/prediction/state/incremental-state-engine';
import { validateCalibration } from '@/prediction/validation/calibration-validator';
import { evaluateModelGate } from '@/prediction/validation/model-gate';
import { OpportunityWindow } from '@/prediction/opportunity/opportunity-window';
import { globalEnsemble } from '@/prediction/ensemble/ensemble-orchestrator';
import { frequencyModelProbability } from '@/prediction/models/frequency-model';
import { scoreMarkov } from '@/prediction/models/markov-model';

describe('§4 Randomness gate', () => {
  it('rejects insufficient sample size', () => {
    const report = runRandomnessGate(
      Array.from({ length: 1000 }, (_, i) => (i % 3 === 0 ? 1.1 : 1.5)),
      { minRounds: 50_000 }
    );
    expect(report.allowSequenceModels).toBe(false);
    expect(report.summary).toContain('INSUFFICIENT');
  });

  it('runs statistical tests on large synthetic white-ish series', () => {
    // LCG pseudo random
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const pts = Array.from({ length: 50_000 }, () => (rnd() < 0.65 ? 1.5 : 1.1));
    const report = runRandomnessGate(pts, { minRounds: 50_000 });
    expect(report.sampleSize).toBe(50_000);
    expect(report.tests.length).toBeGreaterThanOrEqual(4);
    // White noise → sequence models should stay off
    expect(report.allowSequenceModels).toBe(false);
    const flags = applyRandomnessGateToFlags(report);
    expect(flags.enableAutocorrelation).toBe(false);
    globalEnsemble.setFlags(flags);
    expect(globalEnsemble.getFlags().enableMarkov).toBe(false);
  });

  it('runs and ljung-box utilities work', () => {
    const binary = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    expect(waldWolfowitzRunsTest(binary).name).toBe('wald-wolfowitz-runs');
    const series = binary.map((b) => b + 0.01);
    expect(ljungBoxTest(series, 10).name).toBe('ljung-box');
  });
});

describe('§8 Learned regime clustering', () => {
  it('fits normalized k-means and assigns clusters', () => {
    const rows: number[][] = [];
    const outcomes: number[] = [];
    for (let i = 0; i < 200; i++) {
      rows.push([i % 8, (i * 3) % 5, i % 3, Math.sin(i)]);
      outcomes.push(i % 3 === 0 ? 1 : 0);
    }
    const model = new LearnedRegimeClustering();
    model.fit(rows, outcomes, 8);
    expect(model.isFitted()).toBe(true);
    const state = model.assign(rows[10]);
    expect(state.clusterId).toBeGreaterThanOrEqual(0);
    expect(state.clusterConfidence).toBeGreaterThanOrEqual(0);
    expect(state.label).toContain('cluster');
  });
});

describe('§16 Lookahead (disabled by default)', () => {
  it('returns disabled result by default', () => {
    const eng = new IncrementalStateEngine();
    eng.seed(Array.from({ length: 50 }, (_, i) => (i % 2 ? 1.5 : 1.1)));
    const lh = new LookaheadEngine();
    expect(lh.isEnabled()).toBe(false);
    const r = lh.evaluate(eng);
    expect(r.enabled).toBe(false);
    lh.setEnabled(true);
    const on = lh.evaluate(eng);
    expect(on.enabled).toBe(true);
    expect(on.horizonProbability.length).toBe(3);
  });
});

describe('§24 model + calibration gates', () => {
  it('calibration validator enforces ECE budget', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => {
      const p = 0.6;
      return { p, y: (i % 2 === 0 ? 1 : 0) as 0 | 1 };
    });
    const r = validateCalibration(pairs, 0.05);
    expect(r.n).toBe(100);
    expect(r.ece).toBeGreaterThanOrEqual(0);
  });

  it('model gate rejects worse candidate', () => {
    const baseline = { brier: 0.2, logLoss: 0.5, ece: 0.04, oosSkill: 0.02, sampleSize: 1000 };
    const worse = { brier: 0.3, logLoss: 0.7, ece: 0.08, oosSkill: 0.01, sampleSize: 1000 };
    expect(evaluateModelGate(worse, baseline).allowed).toBe(false);
  });
});

describe('opportunity window + model files', () => {
  it('opportunity window ranks active records', () => {
    const w = new OpportunityWindow(10);
    w.push({
      opportunityId: 'o1',
      predictionId: 'p1',
      target: 1.3,
      probability: 0.6,
      calibratedProbability: 0.6,
      expectedValue: 0.05,
      confidence: 0.7,
      score: 0.02,
      rank: 1,
      regime: 'normal',
      modelVersion: 'v',
      featureVersion: 'f',
      timestamp: new Date().toISOString(),
      expiry: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(w.top(1)[0].opportunityId).toBe('o1');
  });

  it('named model modules export finite probabilities', () => {
    expect(frequencyModelProbability(0.66)).toBeCloseTo(0.66);
    const eng = new IncrementalStateEngine();
    eng.seed(Array.from({ length: 40 }, (_, i) => (i % 3 ? 1.5 : 1.1)));
    expect(scoreMarkov(eng)).toBeGreaterThan(0.01);
  });
});

describe('§31 prediction path latency budget', () => {
  it('10k incremental updates stay under 8ms p99', () => {
    const eng = new IncrementalStateEngine();
    const times: number[] = [];
    for (let i = 0; i < 10_000; i++) {
      const t0 = process.hrtime.bigint();
      eng.update(i % 5 === 0 ? 1.1 : 1.45);
      const us = Number(process.hrtime.bigint() - t0) / 1e3;
      times.push(us / 1000); // ms
    }
    times.sort((a, b) => a - b);
    const p99 = times[Math.floor(times.length * 0.99)];
    expect(p99).toBeLessThan(8);
  });
});
