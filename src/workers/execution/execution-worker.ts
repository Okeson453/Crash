/** Production execution worker. Risk authorization is mandatory. */
import { randomUUID } from 'crypto';
import { BaseWorker } from '../framework/base-worker';
import type { WorkerContext } from '../framework/types';
import type { LiveBetExecutor } from '../../betting/live-executor';
import type { LiveCashOutExecutor } from '../../betting/live-cashout';
import type { PlaceBetRequest } from '../../betting/types';
import { getEventBus } from '../../core/event-bus/bus';
import type { SheathMode } from '../../core/sheath-mode/sheath-mode';

export interface ExecutionWorkerDeps {
  liveBetExecutor?: LiveBetExecutor | null;
  liveCashOutExecutor?: LiveCashOutExecutor | null;
  sessionId?: () => string | null;
  stake?: () => number;
  target?: () => number;
  sheathMode?: SheathMode;
}

export class ExecutionWorker extends BaseWorker {
  private deps: ExecutionWorkerDeps;
  constructor(deps: ExecutionWorkerDeps = {}, name = 'execution-1') {
    super({ type: 'execution', name, priority: 'critical', concurrency: 1, heartbeatIntervalMs: 5_000, maxConsecutiveErrors: 3 });
    this.deps = deps;
  }
  bind(deps: ExecutionWorkerDeps): void { this.deps = { ...this.deps, ...deps }; }

  protected async handle(payload: unknown, ctx: WorkerContext): Promise<void> {
    const p = (payload ?? {}) as Record<string, unknown>;
    const expiresAt = typeof p.expiresAt === 'string' ? Date.parse(p.expiresAt) : NaN;
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) throw new Error('execution_authorization_expired');
    if (p.expiresAt == null) throw new Error('execution_authorization_expiry_missing');
    const action = String(p.action ?? 'place');
    if (p.riskApproved !== true && p.authorized !== true) throw new Error('execution_requires_risk_authorization');
    if (this.deps.sheathMode?.isBettingSuspended()) throw new Error('execution_blocked_sheath_mode');

    if (action === 'cashout') {
      const multiplier = Number(p.multiplier);
      if (!this.deps.liveCashOutExecutor || !Number.isFinite(multiplier)) throw new Error('cashout_executor_or_multiplier_missing');
      const result = await this.deps.liveCashOutExecutor.executeCashOut(multiplier);
      await getEventBus().emitTyped(result.success ? 'CashOutConfirmed' : 'CashOutFailed', {
        betId: String(p.betId ?? ''), roundId: String(p.roundId ?? ''), ...(result.success ? { multiplier: result.cashOutMultiplier ?? multiplier, pnl: result.pnl ?? 0 } : { reason: result.error ?? 'cashout_failed' })
      }, ctx.correlationId, this.name);
      if (!result.success) throw new Error(result.error ?? 'cashout_failed');
      return;
    }

    if (!this.deps.liveBetExecutor) throw new Error('live_bet_executor_not_bound');
    const betId = String(p.betId ?? randomUUID());
    const roundId = String(p.roundId ?? '');
    const sessionId = String(p.sessionId ?? this.deps.sessionId?.() ?? '');
    const stake = Number(p.stake ?? this.deps.stake?.() ?? 0);
    const target = Number(p.target ?? this.deps.target?.() ?? 1.3);
    if (!roundId || !sessionId || !Number.isFinite(stake) || stake <= 0 || !Number.isFinite(target) || target <= 1) throw new Error('invalid_execution_request');

    const request: PlaceBetRequest = { betId, roundId, sessionId, stake, target, idempotencyKey: String(p.idempotencyKey ?? `${sessionId}:${roundId}:${betId}`), dryRun: p.dryRun === true };
    const result = await this.deps.liveBetExecutor.placeLiveBet(request);
    const bus = getEventBus();
    if (!result.placed) {
      await bus.emitTyped('BetFailed', { roundId, sessionId, reason: result.error ?? 'placement_failed' }, ctx.correlationId, this.name);
      throw new Error(result.error ?? 'placement_failed');
    }
    this.deps.liveCashOutExecutor?.arm(betId, roundId, target);
    // LiveBetExecutor emits the authoritative BetPlaced event after confirmation.
  }
}
