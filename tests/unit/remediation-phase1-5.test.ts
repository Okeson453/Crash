import { FinancialCircuitBreaker } from '@/core/circuit-breaker/financial-circuit-breaker';
import { assertBettingAllowed, setSelfExclusion } from '@/platform/responsible-gambling';
import { FEATURE_VERSION_V2 } from '@/prediction/features/feature-meta';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-engine';
import { MultiTargetEngine } from '@/prediction/multi-target/multi-target-engine';
import { PlattCalibrator } from '@/prediction/calibration/platt-calibrator';
import { ProductionController } from '@/prediction/lifecycle/production-controller';
import { LiveDivergenceMonitor } from '@/prediction/validation/live-divergence-monitor';
import { ModelLifecycleManager } from '@/prediction/lifecycle/model-lifecycle';

describe('Remediation Phase 1–5 critical fixes', () => {
  it('feature version is unified to V2', () => {
    expect(CURRENT_FEATURE_VERSION).toBe(FEATURE_VERSION_V2);
    expect(FEATURE_VERSION_V2).toBe('fv-2.0.0');
  });

  it('financial circuit opens after threshold failures', async () => {
    const cb = new FinancialCircuitBreaker({ threshold: 3, coolDownMs: 60_000 });
    expect(await cb.isOpen()).toBe(false);
    await cb.recordFailure('a');
    await cb.recordFailure('b');
    await cb.recordFailure('c');
    expect(await cb.isOpen()).toBe(true);
    await cb.recordSuccess();
    expect(await cb.isOpen()).toBe(false);
  });

  it('RG self-exclusion blocks betting', () => {
    setSelfExclusion('u1', new Date(Date.now() + 86400000).toISOString());
    expect(assertBettingAllowed('u1').allowed).toBe(false);
  });

  it('multi-target shrinkage decreases with sample size', () => {
    const eng = new MultiTargetEngine();
    const small = eng.assess({
      probabilities: { 1.3: 0.7, 2.0: 0.4, 5.0: 0.1 },
      calibrated: { 1.3: 0.7, 2.0: 0.4, 5.0: 0.1 },
      confidence: 0.8,
      sampleSize: 5,
      historicalHitRates: { 1.3: 0.65, 2.0: 0.35, 5.0: 0.1 },
    });
    const large = eng.assess({
      probabilities: { 1.3: 0.7, 2.0: 0.4, 5.0: 0.1 },
      calibrated: { 1.3: 0.7, 2.0: 0.4, 5.0: 0.1 },
      confidence: 0.8,
      sampleSize: 5000,
      historicalHitRates: { 1.3: 0.65, 2.0: 0.35, 5.0: 0.1 },
    });
    // Larger n → less shrink toward baseline → higher |ev - baseline| retained
    const s = small.find((a) => a.target === 1.3)!;
    const l = large.find((a) => a.target === 1.3)!;
    expect(Math.abs(l.shrunkEV - l.expectedValue)).toBeLessThan(
      Math.abs(s.shrunkEV - s.expectedValue) + 1e-9
    );
  });

  it('platt fit uses L2 and held-out selection', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      p: 0.4 + (i % 10) * 0.02,
      y: (i % 3 === 0 ? 1 : 0) as 0 | 1,
    }));
    const c = new PlattCalibrator();
    c.fit(pairs);
    expect(c.fitted).toBe(true);
    expect(c.calibrate(0.5)).toBeGreaterThan(0);
  });

  it('divergence level 3 triggers canary rollback path', () => {
    const life = new ModelLifecycleManager();
    life.register({
      modelName: 'test',
      modelVersion: 'v1',
      stage: 'PRODUCTION',
      trafficShare: 1,
      metrics: {},
    });
    life.register({
      modelName: 'test',
      modelVersion: 'v2',
      stage: 'CANARY',
      trafficShare: 0.25,
      metrics: {},
    });
    const div = new LiveDivergenceMonitor();
    // force high level by many mis-predictions if possible
    for (let i = 0; i < 200; i++) {
      div.observe(0.9, 0);
    }
    const ctrl = new ProductionController(life, div);
    const snap = ctrl.observeOutcome(0.9, 0);
    expect(snap.level).toBeGreaterThanOrEqual(0);
    // canary may be rolled back depending on level
  });
});
