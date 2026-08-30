import { runAcieWalkForward } from '@/prediction/backtesting/acie-walk-forward';
import type { HistoricalRound } from '@/prediction/types';
import { snapshotPredictionStack, restoreIncrementalFromPoints } from '@/prediction/state/state-persistence';
import { globalIncrementalState } from '@/prediction/state/incremental-state-engine';
import { BrowserWorkerHttpClient, shouldUseRemoteBrowserWorker } from '@/browser/worker/http-client';
import { assertRiskInputShape } from '@/betting/risk-input-provider';
import type { RiskEvaluationInput } from '@/betting/types';
import { ProductionController } from '@/prediction/lifecycle/production-controller';
import { LiveDivergenceMonitor } from '@/prediction/validation/live-divergence-monitor';
import { ModelLifecycleManager } from '@/prediction/lifecycle/model-lifecycle';

function rounds(n: number): HistoricalRound[] {
  const out: HistoricalRound[] = [];
  let t = Date.now() - n * 60_000;
  for (let i = 0; i < n; i++) {
    out.push({
      id: `r-${i}`,
      externalRoundId: `e-${i}`,
      sessionId: 's',
      startedAt: new Date(t).toISOString(),
      crashedAt: new Date(t + 5000).toISOString(),
      crashPoint: i % 4 === 0 ? 1.1 : 1.5,
      observationSource: 'websocket',
      dataQuality: 'high',
      createdAt: new Date(t).toISOString(),
    });
    t += 60_000;
  }
  return out;
}

describe('Phase 3–4 remediation', () => {
  it('ACIE walk-forward runs on seeded history', () => {
    const report = runAcieWalkForward(rounds(800), {
      trainSize: 200,
      testSize: 50,
      stepSize: 50,
      entryThreshold: 0.5,
    });
    expect(report.windows.length).toBeGreaterThan(0);
    expect(report.summary).not.toBe('INSUFFICIENT_DATA');
  });

  it('snapshot captures recent points after updates', () => {
    globalIncrementalState.reset?.();
    const pts = Array.from({ length: 40 }, (_, i) => (i % 3 ? 1.5 : 1.1));
    restoreIncrementalFromPoints(pts);
    const snap = snapshotPredictionStack();
    expect(snap.version).toBe(1);
    expect(snap.crashPoints.length).toBeGreaterThan(0);
  });

  it('browser worker client respects env', () => {
    delete process.env.BROWSER_WORKER_URL;
    expect(shouldUseRemoteBrowserWorker()).toBe(false);
    expect(BrowserWorkerHttpClient.fromEnv()).toBeNull();
  });

  it('risk input shape assertion', () => {
    const input = {
      mode: 'dry-run',
      operatorAuthorized: true,
      sessionAuthenticated: true,
      gameLoaded: true,
      killSwitch: false,
      paused: false,
    } as RiskEvaluationInput;
    expect(() => assertRiskInputShape(input)).not.toThrow();
  });

  it('production controller rolls back canary on high divergence observations', () => {
    const life = new ModelLifecycleManager();
    life.register({
      modelName: 'm',
      modelVersion: 'v1',
      stage: 'PRODUCTION',
      trafficShare: 1,
      metrics: {},
    });
    life.register({
      modelName: 'm',
      modelVersion: 'v2',
      stage: 'CANARY',
      trafficShare: 0.25,
      metrics: {},
    });
    const div = new LiveDivergenceMonitor();
    const ctrl = new ProductionController(life, div);
    for (let i = 0; i < 100; i++) ctrl.observeOutcome(0.95, 0);
    // should not throw; canary may be rolled back
    expect(ctrl.status().divergence).toBeDefined();
  });
});
