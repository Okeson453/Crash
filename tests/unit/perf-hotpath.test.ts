import { ACIEEngine } from '@/prediction/acie/engine';
import { resolveDatabasePoolSize } from '@/persistence/pool-size';
import { globalEntryLatencyWindow } from '@/observability/performance/latency';
import { checkEntryLatencySlo } from '@/observability/performance/entry-slo-guard';

describe('Performance hot-path fixes', () => {
  it('ACIE onCrash does not set heavyValidationRan synchronously when due', () => {
    const acie = new ACIEEngine({ heavyValidationEvery: 3 });
    for (let i = 0; i < 5; i++) {
      const r = acie.onCrash({
        roundId: `r-${i}`,
        crashPoint: i % 2 ? 1.5 : 1.1,
        timestamp: new Date().toISOString(),
      });
      // Heavy work is scheduled async — flag may be false on return
      expect(r.heavyValidationRan).toBe(false);
      expect(r.online).toBeDefined();
    }
  });

  it('pool size is role-aware', () => {
    process.env.PROCESS_ROLE = 'control-plane';
    delete process.env.DATABASE_POOL_SIZE;
    delete process.env.DB_POOL_SIZE;
    expect(resolveDatabasePoolSize()).toBe(30);
    process.env.PROCESS_ROLE = 'automation-worker';
    expect(resolveDatabasePoolSize()).toBe(12);
    process.env.DATABASE_POOL_SIZE = '40';
    expect(resolveDatabasePoolSize()).toBe(40);
    delete process.env.DATABASE_POOL_SIZE;
    delete process.env.PROCESS_ROLE;
  });

  it('entry SLO guard fires reportTriggers when p99 high', () => {
    for (let i = 0; i < 50; i++) globalEntryLatencyWindow.push(500);
    const triggers: unknown[] = [];
    checkEntryLatencySlo({
      reportTriggers: (t) => {
        triggers.push(...t);
      },
    });
    expect(triggers.length).toBeGreaterThan(0);
  });
});
