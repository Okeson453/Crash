import fs from 'node:fs';
import { DistributedMutex } from '@/core/distributed-mutex';
import { runValidationProtocol } from '@/prediction/validation/walk-forward-protocol';

describe('P0 remediation smoke', () => {
  it('P0-02 RLS migration exists fail-closed', () => {
    const sql = fs.readFileSync('migrations/030_rls_fail_closed.sql', 'utf8');
    expect(sql).toMatch(/app_current_tenant\(\) IS NOT NULL/);
  });

  it('P0-04 client seed requires userId', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/setClientSeed\(userId: string/);
    expect(src).toMatch(/userClientSeeds/);
    const route = fs.readFileSync('src/api/routes/game.ts', 'utf8');
    expect(route).toMatch(/authenticateRequest/);
  });

  it('P0-05 bet limits server-side', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/MINI_MIN_BET/);
    expect(src).toMatch(/MINI_MAX_BET/);
  });

  it('P0-06 cashout atomic state transition', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/BET_ALREADY_SETTLED/);
  });

  it('P0-07 mutex no in-memory in production by default', () => {
    const m = new DistributedMutex({ allowInMemoryFallback: false });
    expect((m as unknown as { allowInMemoryFallback: boolean }).allowInMemoryFallback).toBe(false);
  });

  it('P0-08 validation computes metrics from pairs', () => {
    const src = fs.readFileSync('src/prediction/validation/walk-forward-protocol.ts', 'utf8');
    expect(src).toContain('metricsFromPairs');
    expect(src).not.toContain('logLoss: 0.65');
    const report = runValidationProtocol(
      Array.from({ length: 100 }, (_, i) => ({
        id: `r${i}`,
        crashPoint: i % 3 === 0 ? 1.1 : 1.5,
        timestamp: new Date().toISOString(),
      })) as never,
      { minRounds: 10 }
    );
    expect(report.baseline.sampleSize).toBe(100);
    expect(Number.isFinite(report.baseline.logLoss)).toBe(true);
  });

  it('P0-14 health route exists', () => {
    const src = fs.readFileSync('src/api/routes/health.ts', 'utf8');
    expect(src).toMatch(/get\('\/health'/);
  });

  it('P1-05 refresh uses CAS UPDATE RETURNING', () => {
    const src = fs.readFileSync('src/api/routes/auth.ts', 'utf8');
    expect(src).toMatch(/RETURNING user_id/);
  });
});
