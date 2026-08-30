import { CalibrationState } from '@/prediction/calibration/calibration-state';
import { CURRENT_FEATURE_VERSION, FEATURE_VERSION_V2 } from '@/prediction/features/feature-meta';
import { resolveDatabasePoolSize } from '@/persistence/pool-size';

describe('integration contracts 18-25', () => {
  it('calibration ring stays bounded and refits infrequently', () => {
    const cal = new CalibrationState({ maxPairs: 100, refitEvery: 500, maxRegimes: 8 });
    for (let i = 0; i < 250; i++) {
      cal.observe(0.6 + (i % 10) * 0.01, i % 2 === 0 ? 1 : 0, `regime-${i % 40}`);
    }
    // After refit, n is windowed to pairCount max 100
    expect(cal.metrics().n).toBeLessThanOrEqual(100);
    expect(cal.version).toBe('cal-v2');
    expect(cal.isWarm()).toBe(true);
  });

  it('feature version is single source fv-2.0.0', () => {
    expect(CURRENT_FEATURE_VERSION).toBe('fv-2.0.0');
    expect(FEATURE_VERSION_V2).toBe(CURRENT_FEATURE_VERSION);
  });

  it('pool size env override works', () => {
    process.env.DATABASE_POOL_SIZE = '33';
    expect(resolveDatabasePoolSize()).toBe(33);
    delete process.env.DATABASE_POOL_SIZE;
  });
});
