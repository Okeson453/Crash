import {
  resolveJwtSecretString,
} from '@/config/jwt-secret';
import { assertNoMockAdapterInProduction } from '@/betting/adapters/browser';
import { MockBetPlacementAdapter } from '@/betting/adapters/mock';
import { getPredictionRuntime, snapshotKeyForScope } from '@/prediction/runtime/prediction-runtime';
import { RiskEngine } from '@/betting/risk-engine';
import { CalibrationState } from '@/prediction/calibration/calibration-state';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-meta';
import { errorEnvelope } from '@/api/errors/envelope';
import { resolveDatabasePoolSize } from '@/persistence/pool-size';

describe('Issues 1–30 reaudit', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('1 secrets production strict', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-secret-change-in-production';
    expect(() => resolveJwtSecretString()).toThrow();
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.REFRESH_SECRET = 'y'.repeat(32);
    expect(resolveJwtSecretString()).toHaveLength(32);
  });

  it('2 mock banned in prod', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertNoMockAdapterInProduction(new MockBetPlacementAdapter())).toThrow();
  });

  it('8 runtime scoped + RiskEngine constructible', () => {
    expect(new RiskEngine()).toBeInstanceOf(RiskEngine);
    expect(getPredictionRuntime('a')).not.toBe(getPredictionRuntime('b'));
    expect(snapshotKeyForScope('t1')).toContain('t1');
  });

  it('18 calibration bounded', () => {
    const c = new CalibrationState({ maxPairs: 50, refitEvery: 500, maxRegimes: 4 });
    for (let i = 0; i < 100; i++) c.observe(0.5, i % 2 === 0 ? 1 : 0, `r${i % 10}`);
    expect(c.metrics().n).toBeLessThanOrEqual(50);
    expect(c.version).toBe('cal-v2');
  });

  it('19 feature version', () => {
    expect(CURRENT_FEATURE_VERSION).toBe('fv-2.0.0');
  });

  it('25 pool env', () => {
    process.env.DATABASE_POOL_SIZE = '17';
    expect(resolveDatabasePoolSize()).toBe(17);
  });

  it('29 error envelope', () => {
    expect(errorEnvelope('X', 'y').error.code).toBe('X');
  });

  it('24 closeWebSocketServer source exists', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync('src/api/websocket/server.ts', 'utf8');
    expect(src).toContain('export async function closeWebSocketServer');
  });
});
