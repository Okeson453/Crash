import { resolveProcessRole } from '@/config/loader';
import { ACIEEngine } from '@/prediction/acie/engine';
import { resolveDatabasePoolSize } from '@/persistence/pool-size';
import { isReadyForLive, setPrewarmResult, getReadiness } from '@/observability/readiness';
import { snapshotPredictionStack, applySnapshot } from '@/prediction/state/state-persistence';
import { DEFAULT_ENSEMBLE_FLAGS } from '@/prediction/ensemble/ensemble-orchestrator';

describe('Three-fixes reaudit', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('resolves all four process roles', () => {
    for (const role of ['control-plane', 'automation-worker', 'mini-app-game', 'all'] as const) {
      process.env.PROCESS_ROLE = role;
      expect(resolveProcessRole()).toBe(role);
    }
  });

  it('pool size role-aware and overridable', () => {
    process.env.PROCESS_ROLE = 'control-plane';
    delete process.env.DATABASE_POOL_SIZE;
    delete process.env.DB_POOL_SIZE;
    expect(resolveDatabasePoolSize()).toBeGreaterThanOrEqual(20);
    process.env.DATABASE_POOL_SIZE = '42';
    expect(resolveDatabasePoolSize()).toBe(42);
  });

  it('ACIE heavy path does not run sync evaluate on due schedule', () => {
    const eng = new ACIEEngine({ heavyValidationEvery: 2 });
    for (let i = 0; i < 4; i++) {
      const r = eng.onCrash({
        roundId: `h-${i}`,
        crashPoint: 1.4,
        timestamp: new Date().toISOString(),
      });
      expect(r.heavyValidationRan).toBe(false);
    }
  });

  it('readiness blocks live until warm', () => {
    setPrewarmResult(null, 'x');
    expect(isReadyForLive()).toBe(false);
    setPrewarmResult({
      stateWarm: true,
      historyRounds: 80,
      acieHistorySize: 40,
      calibrationWarm: true,
    });
    expect(isReadyForLive()).toBe(true);
    expect(getReadiness().modelScope).toBe('global');
  });

  it('snapshot v2 carries ACIE online', () => {
    const eng = new ACIEEngine();
    eng.onCrash({
      roundId: 'snap-1',
      crashPoint: 1.6,
      timestamp: new Date().toISOString(),
    });
    const snap = snapshotPredictionStack(100, eng);
    expect(snap.version).toBe(2);
    expect(snap.acieOnline).toBeDefined();
    const eng2 = new ACIEEngine();
    applySnapshot(snap, eng2);
    expect(eng2.getOnlineState().observationCount).toBe(snap.acieOnline!.observationCount);
  });

  it('ensemble advanced flags default off', () => {
    expect(DEFAULT_ENSEMBLE_FLAGS.enableMarkov).toBe(false);
  });
});
