import { Page } from 'playwright';
import { BetRepository } from '../persistence/repositories/bet-repo';
import { EventBus, getEventBus } from '../core/event-bus/bus';
import { getLogger } from '../observability/logger';
import { withTimeout } from '../utils/async';
import { TimeoutError, LiveExecutionError } from '../utils/errors';
import { BetState } from '../types/betting';
import type { NativeSocketWorker } from '../network/tls/native-socket';
import type { AuthoritativeSettlementEngine } from '../settlement/authoritative-settlement-engine';
import { ConfirmationObserver } from './confirmation';
import { VelocityController } from '../risk/velocity-controller';
import { Humanizer } from '../browser/humanize';
import { HumanInput } from '../browser/human-input';
import { SelectorCanary } from '../game/selector-canary';

export interface LiveCashOutResult {
  success: boolean;
  betId: string;
  roundId: string;
  state: BetState;
  cashOutMultiplier: number | null;
  pnl: number | null;
  error: string | null;
  latencyMs: number;
}

export interface LiveCashOutConfig {
  cashOutButtonSelector: string;
  cashOutTimeoutMs: number;
  postClickObservationDelayMs: number;
  cashOutGraceMultiplier: number;
}

const DEFAULT_CASHOUT_CONFIG: LiveCashOutConfig = {
  cashOutButtonSelector: 'button[data-testid="cash-out-button"], button:has-text("Cash Out"), .cashout-btn',
  cashOutTimeoutMs: 5000,
  postClickObservationDelayMs: 200,
  cashOutGraceMultiplier: 0.02,
};

export class LiveCashOutExecutor {
  private readonly logger = getLogger();
  private readonly config: LiveCashOutConfig;
  private activeBetId: string | null = null;
  private targetMultiplier = 1.30;
  private stopped = false;
  private cashOutInProgress = false;
  private velocityController: VelocityController | null = null;
  private humanizer: Humanizer | null = null;
  private humanInput: HumanInput | null = null;
  private selectorCanary: SelectorCanary | null = null;
  private nativeSocket: NativeSocketWorker | null = null;
  private preSendEnabled = false;
  private safetyMarginMs = 15;
  private settlementEngine: AuthoritativeSettlementEngine | null = null;
  private clientOrderIdByBetId = new Map<string, string>();

  constructor(
    private readonly page: Page,
    private readonly betRepo: BetRepository,
    private readonly confirmationObserver: ConfirmationObserver,
    private readonly eventBus: EventBus = getEventBus(),
    config?: Partial<LiveCashOutConfig>
  ) {
    this.config = { ...DEFAULT_CASHOUT_CONFIG, ...config };
  }

  setVelocityController(vc: VelocityController): void {
    this.velocityController = vc;
  }

  attachHumanization(
    humanizer?: Humanizer,
    humanInput?: HumanInput,
    selectorCanary?: SelectorCanary
  ): void {
    this.humanizer = humanizer ?? null;
    this.humanInput = humanInput ?? null;
    this.selectorCanary = selectorCanary ?? null;
  }

  getCashOutJitterMs(): number {
    return this.velocityController?.getCashOutJitter() ?? 0;
  }

  arm(betId: string, roundId: string, targetMultiplier: number): void {
    if (this.stopped) {
      this.logger.warn({ component: 'LiveCashOutExecutor' }, 'Cannot arm — executor is stopped');
      return;
    }
    this.activeBetId = betId;
    this.targetMultiplier = targetMultiplier;
    this.logger.info(
      { component: 'LiveCashOutExecutor', betId, roundId, targetMultiplier },
      'Cash-out armed'
    );
  }

  disarm(): void {
    this.activeBetId = null;
    this.targetMultiplier = 1.30;
    this.cashOutInProgress = false;
    this.logger.debug({ component: 'LiveCashOutExecutor' }, 'Cash-out disarmed');
  }

  stop(): void {
    this.stopped = true;
    this.disarm();
    this.logger.warn({ component: 'LiveCashOutExecutor' }, 'Executor stopped');
  }

  setNativeSocket(socket: NativeSocketWorker | null, opts?: { preSendEnabled?: boolean; safetyMarginMs?: number }): void {
    this.nativeSocket = socket;
    if (opts?.preSendEnabled != null) this.preSendEnabled = opts.preSendEnabled;
    if (opts?.safetyMarginMs != null) this.safetyMarginMs = opts.safetyMarginMs;
  }

  isNativeSocketArmed(): boolean {
    return this.nativeSocket != null && this.preSendEnabled;
  }

  getPreSendSafetyMarginMs(): number {
    return this.safetyMarginMs;
  }

  setSettlementEngine(engine: AuthoritativeSettlementEngine | null): void {
    this.settlementEngine = engine;
  }

  registerClientOrderId(betId: string, clientOrderId: string): void {
    this.clientOrderIdByBetId.set(betId, clientOrderId);
  }

  async onMultiplierUpdate(multiplier: number): Promise<void> {
    if (this.stopped || !this.activeBetId || this.cashOutInProgress) {
      return;
    }
    const effectiveTarget = this.targetMultiplier * (1 - this.config.cashOutGraceMultiplier);
    if (multiplier >= effectiveTarget) {
      this.logger.info(
        {
          component: 'LiveCashOutExecutor',
          betId: this.activeBetId,
          currentMultiplier: multiplier,
          effectiveTarget,
        },
        'Target reached — triggering cash-out'
      );
      await this.executeCashOut(multiplier);
    }
  }

  async executeCashOut(observedMultiplier: number): Promise<LiveCashOutResult> {
    if (this.stopped) {
      return this.buildResult('FAILED', 'Executor is stopped', null, null);
    }

    const mode = (process.env.APP_SYSTEM__MODE ?? process.env.EXECUTION_MODE ?? '').toLowerCase();
    const dryRun =
      mode === 'dry-run' ||
      process.env.DRY_RUN === 'true' ||
      process.env.DRY_RUN === '1';
    const allowReal =
      process.env.ALLOW_REAL_EXECUTION === 'true' || process.env.ALLOW_REAL_EXECUTION === '1';
    if (dryRun || mode !== 'live' || !allowReal) {
      this.logger.warn(
        { component: 'LiveCashOutExecutor', mode, dryRun, allowReal },
        'Blocked real cash-out — dry-run or ALLOW_REAL_EXECUTION not enabled'
      );
      return this.buildResult(
        'FAILED',
        dryRun ? 'DRY_RUN: real cash-out disabled' : 'Real cash-out blocked',
        null,
        null
      );
    }

    if (!this.activeBetId) {
      return this.buildResult('FAILED', 'No active bet to cash out', null, null);
    }

    if (this.cashOutInProgress) {
      return this.buildResult('FAILED', 'Cash-out already in progress', null, null);
    }

    this.cashOutInProgress = true;
    const startTime = Date.now();
    const betId = this.activeBetId;
    const correlationId = betId;

    try {
      const bet = await this.betRepo.findByIdOrThrow(betId);
      const roundId = bet.roundId ?? 'unknown';

      this.logger.info(
        { component: 'LiveCashOutExecutor', betId, roundId, observedMultiplier },
        'Executing cash-out'
      );

      await this.betRepo.update(betId, {
        state: 'CASH_OUT_REQUESTED',
        cashOutRequestedAt: new Date().toISOString(),
        observedCashOutMultiplier: observedMultiplier,
      });

      await this.eventBus.emitTyped('CashOutRequested', {
        betId,
        roundId,
        targetMultiplier: this.targetMultiplier,
      }, correlationId, 'LiveCashOutExecutor');

      await this.clickCashOutButton();
      await this.delay(this.config.postClickObservationDelayMs);

      const confirmedMultiplier = await withTimeout(
        this.confirmationObserver.waitForCashOut(betId, roundId),
        this.config.cashOutTimeoutMs,
        `Cash-out confirmation timed out for bet ${betId}`
      );

      if (confirmedMultiplier === null) {
        throw new TimeoutError('Cash-out confirmation not observed');
      }

      const stake = bet.stake;
      const pnl = Math.round((stake * confirmedMultiplier - stake) * 100) / 100;
      const cashOutConfirmedAt = new Date().toISOString();
      const latencyMs = Date.now() - startTime;

      await this.betRepo.update(betId, {
        state: 'CASHED_OUT',
        cashOutConfirmedAt,
        confirmedCashOutMultiplier: confirmedMultiplier,
        pnl,
      });

      await this.eventBus.emitTyped('CashOutConfirmed', {
        betId,
        roundId,
        multiplier: confirmedMultiplier,
        pnl,
      }, correlationId, 'LiveCashOutExecutor');

      this.logger.info(
        {
          component: 'LiveCashOutExecutor',
          betId,
          roundId,
          confirmedMultiplier,
          pnl,
          latencyMs,
        },
        'Cash-out confirmed'
      );

      const grossPayout = Math.round(stake * confirmedMultiplier * 100) / 100;
      await this.settleAuthoritative(betId, 'WIN', grossPayout, confirmedMultiplier);

      this.disarm();

      return {
        success: true,
        betId,
        roundId,
        state: 'CASHED_OUT',
        cashOutMultiplier: confirmedMultiplier,
        pnl,
        error: null,
        latencyMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { component: 'LiveCashOutExecutor', betId, error: message },
        'Cash-out failed'
      );

      await this.markUnknown(betId, message);

      await this.eventBus.emitTyped('CashOutFailed', {
        betId,
        roundId: 'unknown',
        reason: message,
      }, correlationId, 'LiveCashOutExecutor');

      this.cashOutInProgress = false;
      return this.buildResult('UNKNOWN', message, null, null);
    }
  }

  async onRoundCrash(roundId: string, crashMultiplier: number): Promise<void> {
    if (!this.activeBetId || this.stopped) {
      return;
    }

    const betId = this.activeBetId;
    const bet = await this.betRepo.findById(betId);
    if (!bet) {
      this.logger.error({ component: 'LiveCashOutExecutor', betId, roundId }, 'Active bet disappeared during round crash');
      return;
    }

    if (bet.state === 'CASH_OUT_REQUESTED' || this.cashOutInProgress) {
      await this.markUnknown(betId, `Round ${roundId} crashed at ${crashMultiplier}x while cash-out confirmation was pending`);
      this.logger.error({ component: 'LiveCashOutExecutor', betId, roundId, crashMultiplier }, 'Cash-out/round race — bet remains UNKNOWN');
      this.cashOutInProgress = false;
      return;
    }

    const stake = bet.stake;
    const pnl = -stake;
    await this.betRepo.update(betId, {
      state: 'LOST',
      observedCashOutMultiplier: crashMultiplier,
      confirmedCashOutMultiplier: crashMultiplier,
      pnl,
    });

    await this.eventBus.emitTyped('CashOutFailed', {
      betId,
      roundId,
      reason: `Round crashed at ${crashMultiplier}x before cash-out request`,
    }, betId, 'LiveCashOutExecutor');

    this.logger.info({ component: 'LiveCashOutExecutor', betId, roundId, crashMultiplier, pnl }, 'Bet lost — round crashed before cash-out request');
    await this.settleAuthoritative(betId, 'LOSS', 0, Math.max(1, crashMultiplier));
    this.disarm();
  }

  private async clickCashOutButton(): Promise<void> {
    try {
      if (this.selectorCanary) {
        const report = await this.selectorCanary.runCheck?.() ?? this.selectorCanary.getLastReport?.();
        if (report && report.healthy === false && report.missingCritical?.length) {
          throw new LiveExecutionError(
            `Cash-out blocked: critical selectors missing (${report.missingCritical.join(', ')})`
          );
        }
      }

      const jitter = this.getCashOutJitterMs();
      if (jitter > 0) {
        await this.delay(jitter);
      }

      const button = this.page.locator(this.config.cashOutButtonSelector).first();
      await button.waitFor({ state: 'visible', timeout: 2000 });

      const isDisabled = await button.isDisabled().catch(() => true);
      if (isDisabled) {
        throw new LiveExecutionError('Cash-out button is disabled');
      }

      if (this.humanizer) {
        await this.humanizer.clickFast(this.page, this.config.cashOutButtonSelector);
      } else if (this.humanInput?.isEnabled()) {
        await this.humanInput.click(button);
      } else {
        await button.click();
      }
      this.velocityController?.record('cash_out');
      this.logger.debug({ component: 'LiveCashOutExecutor' }, 'Cash-out button clicked (humanized)');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LiveExecutionError(`Cash-out DOM interaction failed: ${message}`);
    }
  }

  private async markUnknown(betId: string, reason: string): Promise<void> {
    try {
      await this.betRepo.update(betId, {
        state: 'UNKNOWN',
        failureReason: reason,
      });
      this.logger.error(
        { component: 'LiveCashOutExecutor', betId, reason },
        'Bet marked UNKNOWN — reconciliation required'
      );
    } catch (dbError) {
      this.logger.fatal(
        { component: 'LiveCashOutExecutor', betId, error: String(dbError) },
        'Failed to mark bet UNKNOWN in database'
      );
    }
  }

  private async settleAuthoritative(
    betId: string,
    status: 'WIN' | 'LOSS' | 'VOID',
    grossPayout: number,
    multiplier: number,
    externalReference?: string
  ): Promise<void> {
    if (!this.settlementEngine) return;
    const clientOrderId = this.clientOrderIdByBetId.get(betId);
    if (!clientOrderId) {
      this.logger.warn({ component: 'LiveCashOutExecutor', betId }, 'No client_order_id for settlement');
      return;
    }
    try {
      await this.settlementEngine.settleOrder({
        clientOrderId,
        status,
        grossPayout,
        multiplier: Math.max(1, multiplier),
        settledAt: Date.now(),
        externalReference,
      });
      this.clientOrderIdByBetId.delete(betId);
    } catch (err) {
      this.logger.error(
        { component: 'LiveCashOutExecutor', betId, clientOrderId, error: String(err) },
        'Authoritative settleOrder failed'
      );
    }
  }

  private buildResult(
    state: BetState,
    error: string | null,
    multiplier: number | null,
    pnl: number | null
  ): LiveCashOutResult {
    return {
      success: state === 'CASHED_OUT',
      betId: this.activeBetId ?? 'unknown',
      roundId: 'unknown',
      state,
      cashOutMultiplier: multiplier,
      pnl,
      error,
      latencyMs: 0,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
