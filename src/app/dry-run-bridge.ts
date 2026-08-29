/**
 * Wires RoundObserver → EntryDecisionService → DryRunController.
 * Keeps composition.ts lean and type-safe.
 */
import type { AppConfig } from '../config/schema';
import type { SessionSupervisor } from '../core/session-supervisor';
import type { EntryDecisionService } from '../prediction/entry-decision-service';
import type { RiskStateProvider } from '../betting/risk-state-provider';
import { getLogger } from '../observability/logger';

const logger = getLogger();

export function wireDryRunSignalBridge(opts: {
  supervisor: SessionSupervisor;
  entryDecisionService: EntryDecisionService;
  riskStateProvider: RiskStateProvider;
  config: AppConfig;
}): void {
  const { supervisor, entryDecisionService, riskStateProvider, config } = opts;

  supervisor.setSignalEvaluator(async (roundId) => {
    try {
      const mode = String(config.system?.mode ?? process.env.APP_SYSTEM__MODE ?? '').toLowerCase();
      if (mode !== 'dry-run' && mode !== 'observe-only') return;
      const dry = supervisor.getDryRunController();
      if (!dry?.isRunning()) return;
      dry.recordPrediction();
      const riskInput = await riskStateProvider.buildFresh();
      const targetRaw = Number(config.betting?.cashOutTarget ?? 1.3);
      const target = (targetRaw === 2.0 || targetRaw === 5.0 || targetRaw === 10.0
        ? targetRaw
        : 1.3) as 1.3 | 2.0 | 5.0 | 10.0;
      const result = await entryDecisionService.evaluateEntry({
        roundId,
        sessionId: supervisor.getState()?.sessionId ?? null,
        decisionTimestamp: new Date().toISOString(),
        riskInput: {
          ...riskInput,
          sessionAuthenticated: true,
          currentBalance: riskInput.currentBalance ?? 10_000,
        },
        target,
      });
      const signal = result.signal;
      if (!signal) return;
      dry.evaluateAndSimulate({
        signalId: signal.predictionId ?? roundId,
        predictionId: signal.predictionId,
        roundId,
        probability: signal.probability,
        confidence: signal.confidence,
        target: signal.target,
        stake: Number(config.betting?.stakePerEntry ?? 700),
      });
    } catch (err) {
      logger.warn(
        { component: 'DryRunBridge', roundId, error: String(err) },
        'Dry-run signal evaluation failed'
      );
    }
  });
}

export function onRoundCrashedForDryRun(opts: {
  payload: Record<string, unknown>;
  entryDecisionService: EntryDecisionService;
  supervisor: SessionSupervisor;
}): void {
  try {
    const rid = String(opts.payload.roundId ?? '');
    const cp = Number(opts.payload.crashPoint ?? 0);
    if (rid && Number.isFinite(cp) && cp > 0) {
      opts.entryDecisionService.observeCrash(rid, cp);
      opts.supervisor.getDryRunController()?.onRoundCompleted(rid, cp);
    }
  } catch (e) {
    logger.warn({ component: 'DryRunBridge', error: String(e) }, 'Dry-run/ACIE onRoundComplete failed');
  }
}
