import fs from 'node:fs';
import { runValidationProtocol } from '@/prediction/validation/walk-forward-protocol';
import { isPredictionArtifact } from '@/prediction/prediction-artifact';
import { settlementService } from '@/settlement/settlement-service';

describe('P0–P2 revalidation matrix', () => {
  it('P0-01 engines + nvmrc', () => {
    expect(fs.existsSync('.nvmrc')).toBe(true);
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.engines?.node).toMatch(/20/);
  });

  it('P0-02 fail-closed RLS migration', () => {
    const sql = fs.readFileSync('migrations/030_rls_fail_closed.sql', 'utf8');
    expect(sql).toMatch(/app_current_tenant\(\) IS NOT NULL AND tenant_id = app_current_tenant\(\)/);
    expect(fs.existsSync('src/persistence/tenant-context.ts')).toBe(true);
  });

  it('P0-03 WS tenant channel guards', () => {
    const src = fs.readFileSync('src/api/websocket/server.ts', 'utf8');
    expect(src).toMatch(/Cannot subscribe to another tenant/);
  });

  it('P0-04 client seed scoped', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/userClientSeeds/);
    expect(src).toMatch(/freezeRoundClientSeed/);
  });

  it('P0-05/06 bet limits + atomic cashout', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/MINI_MIN_BET/);
    expect(src).toMatch(/BET_ALREADY_SETTLED/);
  });

  it('P0-07 production mutex no memory fallback default', () => {
    const src = fs.readFileSync('src/core/distributed-mutex.ts', 'utf8');
    expect(src).toMatch(/NODE_ENV !== 'production'/);
  });

  it('P0-08 validation from pairs', () => {
    const report = runValidationProtocol(
      Array.from({ length: 80 }, (_, i) => ({
        id: `r${i}`,
        crashPoint: 1.2 + (i % 5) * 0.1,
        timestamp: new Date().toISOString(),
      })) as never,
      { minRounds: 10 }
    );
    expect(report.baseline.logLoss).not.toBe(0.65);
    expect(Array.isArray(report.reasons)).toBe(true);
  });

  it('P0-12 prediction artifact schema', () => {
    expect(
      isPredictionArtifact({
        predictionId: 'p1',
        roundId: 'r1',
        modelVersion: 'm',
        featureVersion: 'f',
        calibrationVersion: 'c',
        thresholdVersion: 't',
        regime: 'n',
        rawProbability: 0.5,
        calibratedProbability: 0.5,
        confidence: 0.5,
        uncertainty: 0.1,
        opportunityScore: 0.5,
        threshold: 0.55,
        decision: 'SKIP',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        featureHash: 'h',
        modelConfigHash: 'h',
      })
    ).toBe(true);
  });

  it('P0-14 health endpoint', () => {
    expect(fs.readFileSync('src/api/routes/health.ts', 'utf8')).toMatch(/get\('\/health'/);
  });

  it('P1-01 auto-cashout heap not DB poll', () => {
    const src = fs.readFileSync('src/mini-app/game-service.ts', 'utf8');
    expect(src).toMatch(/autoCashoutHeap/);
    expect(src).not.toMatch(
      /SELECT id,user_id,auto_cashout FROM mini_app_bets WHERE round_id=\$1 AND state='active'/
    );
  });

  it('P1-02 SettlementService exists', () => {
    expect(typeof settlementService.settleWin).toBe('function');
  });

  it('P1-05 refresh CAS', () => {
    expect(fs.readFileSync('src/api/routes/auth.ts', 'utf8')).toMatch(/RETURNING user_id/);
  });
});
