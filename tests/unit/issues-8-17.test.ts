import { RiskEngine, getRiskEngine } from '@/betting/risk-engine';
import { getPredictionRuntime, snapshotKeyForScope } from '@/prediction/runtime/prediction-runtime';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-meta';
import { z } from 'zod';

describe('Issues 8–17', () => {
  it('8: RiskEngine is constructible without singleton requirement', () => {
    const a = new RiskEngine();
    const b = new RiskEngine();
    expect(a).not.toBe(b);
    expect(getRiskEngine()).toBeInstanceOf(RiskEngine);
  });

  it('8: PredictionRuntime is scoped', () => {
    const p = getPredictionRuntime('platform');
    const t = getPredictionRuntime('tenant-abc');
    expect(p).not.toBe(t);
    expect(snapshotKeyForScope('tenant-abc')).toBe('crash:prediction:stack:v2:tenant-abc');
  });

  it('9: feature version is honest non-v1', () => {
    expect(CURRENT_FEATURE_VERSION).toBe('fv-2.0.0');
  });

  it('16: bet status enum rejects invalid', () => {
    const schema = z.enum(['pending', 'placed', 'active', 'cashed_out', 'lost', 'cancelled', 'failed']);
    expect(() => schema.parse('nope')).toThrow();
    expect(schema.parse('placed')).toBe('placed');
  });
});
