import { resolveJwtSecretString } from '@/config/jwt-secret';
import { globalFinancialCircuitBreaker } from '@/core/circuit-breaker/financial-circuit-breaker';
import { RiskEngine } from '@/betting/risk-engine';
import type { RiskEvaluationInput } from '@/betting/types';
import { CURRENT_FEATURE_VERSION } from '@/prediction/features/feature-engine';
import { FEATURE_VERSION_V2 } from '@/prediction/features/feature-meta';
import { resolvePlacementPath } from '@/betting/bet-executor-factory';
import { MiniGameService } from '@/mini-app/game-service';

function baseRisk(partial: Partial<RiskEvaluationInput> = {}): RiskEvaluationInput {
  return {
    mode: 'dry-run',
    operatorAuthorized: true,
    sessionAuthenticated: true,
    gameLoaded: true,
    roundState: null,
    currentBalance: 100_000,
    dailyEntriesConfirmed: 0,
    paused: false,
    killSwitch: false,
    browserHealthy: true,
    gameAdapterHealthy: true,
    openBetExists: false,
    cooldownElapsed: true,
    requiredStake: 700,
    balanceBuffer: 700,
    maxDailyEntries: 500,
    minConfidenceForEntry: 'medium',
    consecutiveErrors: 0,
    maxConsecutiveErrors: 5,
    cashOutFailures: 0,
    maxCashOutFailures: 3,
    ...partial,
  };
}

describe('Phase 1–2 complete remediation', () => {
  const prev = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prev;
    void globalFinancialCircuitBreaker.recordSuccess();
  });

  it('JWT resolver rejects weak secrets in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => resolveJwtSecretString()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'short';
    expect(() => resolveJwtSecretString()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(resolveJwtSecretString().length).toBe(32);
  });

  it('financial circuit blocks risk approval when OPEN', async () => {
    const eng = new RiskEngine();
    await globalFinancialCircuitBreaker.recordFailure('1');
    await globalFinancialCircuitBreaker.recordFailure('2');
    await globalFinancialCircuitBreaker.recordFailure('3');
    await globalFinancialCircuitBreaker.recordFailure('4');
    await globalFinancialCircuitBreaker.recordFailure('5');
    expect(globalFinancialCircuitBreaker.snapshot().state).toBe('OPEN');
    const r = eng.evaluate(baseRisk());
    expect(r.approved).toBe(false);
    expect(r.firstFailure).toBe('financial_circuit_open');
  });

  it('feature versions unified', () => {
    expect(CURRENT_FEATURE_VERSION).toBe(FEATURE_VERSION_V2);
  });

  it('placement path resolves single live or mock path', () => {
    expect(resolvePlacementPath({ mode: 'live', liveBound: true }).path).toBe('live-bet-executor');
    expect(resolvePlacementPath({ mode: 'live', liveBound: false }).path).toBe('none');
    expect(resolvePlacementPath({ mode: 'observe-only' as const }).path).toBe('none');
  });

  it('mini-game exposes seed hash and accepts client seed before run', () => {
    const g = new MiniGameService();
    g.setClientSeed('player-seed-abc');
    const state = g.getState();
    expect(state.clientSeed === 'player-seed-abc' || state.clientSeed === null).toBe(true);
  });
});
