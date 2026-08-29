import { Page } from 'playwright';

import { BetRepository } from '../persistence/repositories/bet-repo';
import { EventBus, getEventBus } from '../core/event-bus/bus';
import { getLogger } from '../observability/logger';
import { withTimeout, Mutex } from '../utils/async';
import { TimeoutError, LiveExecutionError } from '../utils/errors';
import { BetState } from '../types/betting';
import { SelectorCanary } from '../game/selector-canary';
import { HumanInput } from '../browser/human-input';
import { Humanizer } from '../browser/humanize';
import { DOM_SELECTORS } from '../game/constants';
import { VelocityController } from '../risk/velocity-controller';

import { ExecutionSafeguards } from './execution-safeguards';
import { ConfirmationObserver } from './confirmation';
import { PlaceBetRequest } from './types';
import { TelemetryNoise } from './telemetry-noise';
import { IdempotencyKeyStore } from './idempotency';
import type { InMemoryCapitalGuard } from '../capital/in-memory-limits';
import type { ClientOrderIdRegistry } from '../core/reconciliation-service';
import { biomechanicalClick } from '../browser/biomechanical-input';
import type { AuthoritativeSettlementEngine } from '../settlement/authoritative-settlement-engine';
import { realExecutionBlockReason } from './execution-mode-gate';

export interface LiveBetResult {
  placed: boolean;
  betId: string;
  roundId: string;
  state: BetState;
  confirmedAt: string | null;
  error: string | null;
  retryCount: number;
  latencyMs: number;
}

export interface LiveExecutorConfig {
  betAmountSelector: string;
  placeBetButtonSelector: string;
  activeBetIndicatorSelector: string;
  placementTimeoutMs: number;
  maxPlacementRetries: number;
  placementRetryDelayMs: number;
  postClickObservationDelayMs: number;
}

const DEFAULT_CONFIG: LiveExecutorConfig = {
  betAmountSelector: DOM_SELECTORS.betAmountInput,
  placeBetButtonSelector: DOM_SELECTORS.placeBetButton,
  activeBetIndicatorSelector: DOM_SELECTORS.activeBetIndicator,
  placementTimeoutMs: 8000,
  maxPlacementRetries: 2,
  placementRetryDelayMs: 500,
  postClickObservationDelayMs: 300,
};

export class LiveBetExecutor {
  private readonly logger = getLogger();
  private readonly mutex = new Mutex();
  private readonly config: LiveExecutorConfig;
  private stopped = false;

  constructor(
    private readonly page: Page,
    private readonly betRepo: BetRepository,
    private readonly confirmationObserver: ConfirmationObserver,
    private readonly safeguards: ExecutionSafeguards,
    private readonly eventBus: EventBus = getEventBus(),
    config?: Partial<LiveExecutorConfig>,
    private readonly selectorCanary?: SelectorCanary,
    private readonly humanInput?: HumanInput,
    private readonly velocityController?: VelocityController,
    private readonly humanizer?: Humanizer,
    private readonly telemetryNoise?: TelemetryNoise,
    private readonly idempotency?: IdempotencyKeyStore,
    private readonly capitalGuard?: InMemoryCapitalGuard,
    private readonly orderRegistry?: ClientOrderIdRegistry,
    private readonly useBiomechanical?: boolean,
    private readonly settlementEngine?: AuthoritativeSettlementEngine
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isBusy(): boolean {
    return this.mutex.isLocked();
  }

  stop(): void {
    this.stopped = true;
    this.logger.warn({ component: 'LiveBetExecutor' }, 'Executor stopped');
  }

  async placeLiveBet(request: PlaceBetRequest): Promise<LiveBetResult> {
    if (this.stopped) {
      return this.buildResult(request, 'FAILED', 'Executor is stopped');
    }

    const blocked = realExecutionBlockReason(request.dryRun, 'LiveBetExecutor');
    if (blocked) {
      return this.buildResult(request, 'FAILED', blocked);
    }

    const startTime = Date.now();
    const correlationId = request.betId;

    if (this.selectorCanary) {
      const gate = await this.selectorCanary.assertCriticalPresent();
      if (!gate.ok) {
        const reason = `Critical selectors missing: ${gate.missing.join(', ')}`;
        this.logger.error(
          { component: 'LiveBetExecutor', correlationId: request.betId, missing: gate.missing },
          'Aborting placement — selector canary failed'
        );
        return this.buildResult(request, 'FAILED', reason);
      }
    }

    const preFlight = await this.safeguards.checkPreFlight(request);
    if (!preFlight.approved) {
      this.logger.warn(
        { component: 'LiveBetExecutor', correlationId, reason: preFlight.reason },
        'Pre-flight check failed'
      );
      return this.buildResult(request, 'FAILED', preFlight.reason ?? 'Pre-flight rejected', 0, Date.now() - startTime);
    }

    if (this.capitalGuard) {
      const cap = this.capitalGuard.canPlaceBet(request.stake);
      if (!cap.allowed) {
        return this.buildResult(request, 'FAILED', cap.reason ?? 'capital_guard_rejected', 0, Date.now() - startTime);
      }
    }

    let clientOrderId: string | undefined;
    if (this.orderRegistry) {
      clientOrderId = this.orderRegistry.generate(request.stake, request.target);
      (request as any).clientOrderId = clientOrderId;
      if (this.settlementEngine && clientOrderId) {
        try {
          await this.settlementEngine.createOrderIntent({
            clientOrderId,
            betId: request.betId,
            roundId: request.roundId,
            wagerAmount: request.stake,
            targetMultiplier: request.target,
          });
          await this.settlementEngine.markDispatched(clientOrderId);
        } catch (err) {
          this.orderRegistry?.release(clientOrderId);
          return this.buildResult(request, 'FAILED', 'settlement_intent_failed', 0, Date.now() - startTime);
        }
      }
    }

    if (this.idempotency) {
      const reserved = await this.idempotency.reserve(
        request.sessionId,
        request.roundId,
        request.betId
      );
      if (!reserved) {
        return this.buildResult(request, 'FAILED', 'idempotency_collision', 0, Date.now() - startTime);
      }
    }

    await this.mutex.acquire();
    let retryCount = 0;

    try {
      this.logger.info(
        {
          component: 'LiveBetExecutor',
          correlationId,
          roundId: request.roundId,
          stake: request.stake,
        },
        'Starting live bet placement'
      );

      const dailyKey = this.safeguards.getDailyKey();
      const balanceBefore = preFlight.currentBalance ?? null;

      try {
        await this.betRepo.create({
          sessionId: request.sessionId,
          roundId: request.roundId,
          dailyKey,
          stake: request.stake,
          cashOutTarget: request.target,
          state: 'PENDING',
          balanceBefore,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return this.buildResult(request, 'FAILED', `DB error: ${message}`, 0, Date.now() - startTime);
      }

      while (retryCount <= this.config.maxPlacementRetries) {
        try {
          return await this.attemptPlacement(request, startTime);
        } catch (error) {
          if (error instanceof TimeoutError) {
            return this.buildResult(request, 'UNKNOWN', error.message, retryCount, Date.now() - startTime);
          }
          if (error instanceof LiveExecutionError) {
            if (retryCount < this.config.maxPlacementRetries) {
              retryCount++;
              await this.delay(this.config.placementRetryDelayMs);
              continue;
            }
            return this.buildResult(request, 'FAILED', error.message, retryCount, Date.now() - startTime);
          }
          throw error;
        }
      }

      return this.buildResult(
        request,
        'FAILED',
        'All pre-click placement retries exhausted',
        retryCount,
        Date.now() - startTime
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markUnknown(request.betId, message, request.sessionId, request.roundId);
      await this.eventBus.emitTyped('BetFailed', {
        roundId: request.roundId,
        sessionId: request.sessionId,
        reason: message,
      }, correlationId, 'LiveBetExecutor');
      return this.buildResult(request, 'UNKNOWN', message, retryCount, Date.now() - startTime);
    } finally {
      this.mutex.release();
    }
  }

  private async attemptPlacement(
    request: PlaceBetRequest,
    startTime: number
  ): Promise<LiveBetResult> {
    if (this.velocityController) {
      const decision = await this.velocityController.waitUntilAllowed('bet_placement', 120_000);
      if (!decision.allowed) {
        throw new LiveExecutionError(`Velocity gate blocked placement: ${decision.reason}`);
      }
    }

    if (this.telemetryNoise?.shouldSkipEntry()) {
      return {
        placed: false,
        betId: request.betId,
        roundId: request.roundId,
        state: 'FAILED' as BetState,
        confirmedAt: null,
        error: 'telemetry_noise_skip',
        retryCount: 0,
        latencyMs: Date.now() - startTime,
      };
    }

    await this.betRepo.updateState(request.betId, 'RESERVED');
    await this.interactWithDom(request);
    await this.delay(this.config.postClickObservationDelayMs);

    let confirmed = false;
    try {
      confirmed = await withTimeout(
        this.confirmationObserver.waitForBetPlaced(request.roundId, request.sessionId),
        this.config.placementTimeoutMs,
        `Bet placement confirmation timed out for round ${request.roundId}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markUnknown(request.betId, message, request.sessionId, request.roundId);
      return this.buildResult(request, 'UNKNOWN', message, 0, Date.now() - startTime);
    }

    if (!confirmed) {
      await this.markUnknown(request.betId, 'Placement confirmation not observed', request.sessionId, request.roundId);
      return this.buildResult(request, 'UNKNOWN', 'Placement confirmation not observed', 0, Date.now() - startTime);
    }

    const confirmedAt = new Date().toISOString();
    const latencyMs = Date.now() - startTime;

    await this.betRepo.update(request.betId, {
      state: 'PLACED',
      placedAt: confirmedAt,
      confirmedAt,
    });

    if (this.idempotency) {
      await this.idempotency.complete(request.sessionId, request.roundId, {
        success: true,
        betId: request.betId,
      });
    }

    await this.eventBus.emitTyped('BetPlaced', {
      betId: request.betId,
      roundId: request.roundId,
      sessionId: request.sessionId,
      stake: request.stake,
      target: request.target,
    }, request.betId, 'LiveBetExecutor');

    await this.safeguards.checkPostFlight(request, 'PLACED');

    return {
      placed: true,
      betId: request.betId,
      roundId: request.roundId,
      state: 'PLACED',
      confirmedAt,
      error: null,
      retryCount: 0,
      latencyMs,
    };
  }

  private async interactWithDom(request: PlaceBetRequest): Promise<void> {
    try {
      const amountInput = this.page.locator(this.config.betAmountSelector).first();
      await amountInput.waitFor({ state: 'visible', timeout: 3000 });
      if (this.humanInput?.isEnabled()) {
        await this.humanInput.typeStake(amountInput, request.stake);
      } else {
        await amountInput.fill(String(request.stake));
        await this.delay(50);
      }

      const betButton = this.page.locator(this.config.placeBetButtonSelector).first();
      await betButton.waitFor({ state: 'visible', timeout: 3000 });

      const isDisabled = await betButton.isDisabled().catch(() => true);
      if (isDisabled) {
        throw new LiveExecutionError('Place-bet button is disabled');
      }

      if (this.humanizer) {
        if (this.useBiomechanical) {
          const box = await this.page.locator(this.config.placeBetButtonSelector).first().boundingBox();
          if (box) {
            await biomechanicalClick(this.page, box.x + box.width / 2, box.y + box.height / 2);
          } else {
            await this.humanizer.clickFast(this.page, this.config.placeBetButtonSelector);
          }
        } else {
          await this.humanizer.clickFast(this.page, this.config.placeBetButtonSelector);
        }
      } else if (this.humanInput?.isEnabled()) {
        await this.humanInput.click(betButton);
      } else {
        await betButton.click();
      }
      this.velocityController?.record('bet_placement');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new LiveExecutionError(`DOM interaction failed: ${message}`);
    }
  }

  private async markUnknown(
    betId: string,
    reason: string,
    sessionId?: string,
    roundId?: string
  ): Promise<void> {
    try {
      await this.betRepo.update(betId, {
        state: 'UNKNOWN',
        failureReason: reason,
      });
      if (this.idempotency && sessionId && roundId) {
        await this.idempotency.fail(sessionId, roundId, reason).catch(() => undefined);
      }
    } catch (dbError) {
      this.logger.fatal(
        { component: 'LiveBetExecutor', betId, error: String(dbError) },
        'Failed to mark bet UNKNOWN in database'
      );
    }
  }

  private buildResult(
    request: PlaceBetRequest,
    state: BetState,
    error: string | null,
    retryCount = 0,
    latencyMs = 0
  ): LiveBetResult {
    return {
      placed: state === 'PLACED',
      betId: request.betId,
      roundId: request.roundId,
      state,
      confirmedAt: state === 'PLACED' ? new Date().toISOString() : null,
      error,
      retryCount,
      latencyMs,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
