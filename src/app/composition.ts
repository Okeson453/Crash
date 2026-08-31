/**
 * CRITICAL: Full composition restored from dde6eb3 + dry-run bridge.
 * If this message is all you see, pull artifacts/login-parallel/composition.ts
 */
import { hostname } from 'os';
import { AppConfig } from '../config/schema';
import { getLogger } from '../observability/logger';
import { EventBus, getEventBus } from '../core/event-bus/bus';
import { InMemoryPersistentLog } from '../core/event-bus/persistent-log';
import { PostgresPersistentLog } from '../core/event-bus/postgres-log';
import { OutboxPublisher } from '../core/event-bus/outbox-publisher';
import { getPool } from '../persistence/client';
import { getRedisClient } from '../persistence/redis-client';
import { BetRepository } from '../persistence/repositories/bet-repo';
import { RoundRepository } from '../persistence/repositories/round-repo';
import { SessionRepository } from '../persistence/repositories/session-repo';
import { TickRepository } from '../persistence/repositories/tick-repo';
import { AuditRepository } from '../persistence/repositories/audit-repo';
import { DailyStatsRepository } from '../persistence/repositories/daily-stats-repo';
import { UnknownStateRecovery } from '../ledger/unknown-state-recovery';
import { BalanceReconciliation } from '../ledger/balance-reconciliation';
import { BalanceTracker } from '../ledger/balance-tracker';
import { RecoveryManager } from '../core/recovery-manager';
import { SessionSupervisor } from '../core/session-supervisor';
import { DistributedMutex } from '../core/distributed-mutex';
import { InstanceLock } from '../core/instance-lock';
import { TelegramGateway } from '../telegram/gateway';
import { TelegramBotConfig } from '../telegram/types';
import { NotificationQueue } from '../notifications/queue';
import { NotificationRouter } from '../notifications/notification-router';
import { DailyReportScheduler } from '../notifications/daily-report-scheduler';
import { HealthMonitor } from '../observability/health/monitor';
import { EntryDecisionService } from '../prediction/entry-decision-service';
import { PredictionProvenanceRepository } from '../persistence/repositories/prediction-provenance-repo';
import { PredictionEngine } from '../prediction/prediction-engine';
import { HistoricalDataService } from '../prediction/historical-data-service';
import { PredictionRepository } from '../persistence/repositories/prediction-repo';
import { RiskEngine } from '../betting/risk-engine';
import { getPredictionRuntime } from '../prediction/runtime/prediction-runtime';
import { BettingCoordinator } from '../betting/betting-coordinator';
import { RiskStateProvider } from '../betting/risk-state-provider';
import { DailyEntryLedger, DailyEntryCounter } from '../ledger/daily-entries';
import { SheathMode } from '../core/sheath-mode';
import { DecisionEngine } from '../decision';
import { OpportunityRanker } from '../opportunity';
import { WorkerFleet } from '../workers/framework';
import { MonitoringWorker } from '../workers/monitoring/monitoring-worker';
import { DiscoveryWorker } from '../workers/discovery/discovery-worker';
import { DataCollectionWorker } from '../workers/data-collection/data-collection-worker';
import { SignalScannerWorker } from '../workers/signal-scanner/signal-scanner-worker';
import { ConfirmationWorker } from '../workers/confirmation/confirmation-worker';
import { PredictionWorker } from '../workers/prediction/prediction-worker';
import { RegimeWorker } from '../workers/regime/regime-worker';
import { EntryOptimizationWorker } from '../workers/entry-optimization/entry-optimization-worker';
import { ExecutionWorker } from '../workers/execution/execution-worker';
import { SettlementWorker } from '../workers/settlement/settlement-worker';
import { LearningWorker } from '../workers/learning/learning-worker';
import { ValidationWorker } from '../workers/validation/validation-worker';
import { SentimentWorker } from '../workers/sentiment/sentiment-worker';
import { AnalyticsWorker } from '../workers/analytics/analytics-worker';
import { RiskWorker } from '../workers/risk/risk-worker';
import { FeatureStore } from '../prediction/feature-store';
import { EnsembleOrchestrator } from '../prediction/ensemble/ensemble-orchestrator.js';
import { PriorityJobQueue } from '../core/job-queue';
import { prewarmPredictionStack } from '../prediction/prewarm';
import { SettlementReconciler } from '../background-workers/settlement-reconciler';
import { setPrewarmResult, isReadyForLive } from '../observability/readiness';
import { loadPredictionStackOnBoot, saveSnapshotToFile, saveSnapshotToRedis } from '../prediction/state/state-persistence';
import { loadApprovedEnsembleFlags } from '../prediction/ensemble/promotion-evidence';
import { globalEnsemble } from '../prediction/ensemble/ensemble-orchestrator';
import { TenantManager, TenantResolver, TenantRuntimeFactory } from '../platform';
import { wireDryRunSignalBridge, onRoundCrashedForDryRun } from './dry-run-bridge';
import { checkEntryLatencySlo } from '../observability/performance/entry-slo-guard';
import {
  workerJobsTotal,
  workerJobDurationMs,
  workerInflight,
  workerLastSuccessUnix,
  workerMissingTotal,
} from '../observability/metrics/workers';
import { enqueueDeadLetter } from '../workers/dead-letter';

export interface CompositionContext {
  config: AppConfig;
  eventBus: EventBus;
  betRepo: BetRepository;
  roundRepo: RoundRepository;
  sessionRepo: SessionRepository;
  tickRepo: TickRepository;
  auditRepo: AuditRepository;
  dailyStatsRepo: DailyStatsRepository;
  balanceTracker: BalanceTracker;
  recoveryManager: RecoveryManager;
  mutex: DistributedMutex;
  instanceLock: InstanceLock | null;
  supervisor: SessionSupervisor;
  entryDecisionService: EntryDecisionService;
  predictionEngine: PredictionEngine;
  riskEngine: RiskEngine;
  bettingCoordinator: BettingCoordinator | null;
  telegram: TelegramGateway | null;
  notificationQueue: NotificationQueue | null;
  notificationRouter: NotificationRouter | null;
  dailyReportScheduler: DailyReportScheduler | null;
  durableLog: PostgresPersistentLog | InMemoryPersistentLog;
  halted: boolean;
  haltReason: string | null;
  sheathMode: SheathMode;
  decisionEngine: DecisionEngine;
  workerFleet: WorkerFleet;
  featureStore: FeatureStore;
  ensemble: EnsembleOrchestrator;
  jobQueue: PriorityJobQueue;
  regimeWorker: RegimeWorker;
  tenantManager: TenantManager;
}

export interface CompositionHandles {
  ctx: CompositionContext;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Global composition handle for API access
let globalComposition: CompositionHandles | null = null;

export function setGlobalComposition(handles: CompositionHandles | null): void {
  globalComposition = handles;
}

export function getGlobalComposition(): CompositionHandles | null {
  return globalComposition;
}

export function getTenantManager(): TenantManager {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.tenantManager;
}

export function getBetRepo(): BetRepository {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.betRepo;
}

export function getRoundRepo(): RoundRepository {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.roundRepo;
}

export function getBalanceTracker(): BalanceTracker {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.balanceTracker;
}

export function getEventBusInstance(): EventBus {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.eventBus;
}

export function getSessionSupervisor(): SessionSupervisor {
  if (!globalComposition) throw new Error('Composition not initialized');
  return globalComposition.ctx.supervisor;
}

/** Build the full application graph. Does not start subsystems until start(). */
export function composeApplication(
  config: AppConfig,
  _options?: { healthMonitor?: HealthMonitor }
): CompositionHandles {
  const logger = getLogger();
  const eventBus = getEventBus();
  const pool = getPool();

  const betRepo = new BetRepository(pool);
  const roundRepo = new RoundRepository(pool);
  const sessionRepo = new SessionRepository(pool);
  const tickRepo = new TickRepository(pool);
  const auditRepo = new AuditRepository(pool);
  const dailyStatsRepo = new DailyStatsRepository();

  let durableLog: PostgresPersistentLog | InMemoryPersistentLog;
  try {
    const pgLog = new PostgresPersistentLog(pool);
    durableLog = pgLog;
    void pgLog.ensureSchema().catch(() => undefined);
  } catch {
    durableLog = new InMemoryPersistentLog();
  }

  const outboxPublisher = new OutboxPublisher(pool, eventBus);
  outboxPublisher.start();

  const balanceTracker = new BalanceTracker();
  const unknownRecovery = new UnknownStateRecovery(betRepo, roundRepo, eventBus);
  const balanceReconciliation = new BalanceReconciliation(betRepo, balanceTracker, eventBus);
  const recoveryManager = new RecoveryManager(unknownRecovery, balanceReconciliation, betRepo, eventBus);

  let redis: ReturnType<typeof getRedisClient> | null = null;
  try { redis = getRedisClient(); } catch { redis = null; }
  const mutex = new DistributedMutex({ redisClient: redis ?? undefined, allowInMemoryFallback: true });
  let instanceLock: InstanceLock | null = null;
  if (redis) instanceLock = new InstanceLock({ redis });

  const supervisor = new SessionSupervisor({ config, eventBus });
  const tenantManager = new TenantManager();
  const tenantResolver = new TenantResolver(tenantManager);
  const tenantRuntimeFactory = new TenantRuntimeFactory({ config, eventBus });

  let telegram: TelegramGateway | null = null;
  let notificationQueue: NotificationQueue | null = null;
  let notificationRouter: NotificationRouter | null = null;
  let dailyReportScheduler: DailyReportScheduler | null = null;
  const tokenValue = process.env.TELEGRAM_BOT_TOKEN;
  const isValidBotToken = (tok: string) => /^[0-9]+:[A-Za-z0-9_-]{35,}$/.test(tok);
  if (tokenValue && isValidBotToken(String(tokenValue))) {
    try {
      const tgConfig: TelegramBotConfig = {
        botToken: String(tokenValue),
        allowedUserIds: (config.telegram.allowedUserIds || []).map((id) => Number(id)).filter((n) => !Number.isNaN(n)),
        verbosity: config.telegram.verbosity,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || undefined,
        rateLimitMessagesPerMinute: config.telegram.rateLimitMessagesPerMinute ?? 30,
        throttlePolicies: [],
        sendRoundStart: config.telegram.sendRoundStart ?? false,
        sendRoundResult: config.telegram.sendRoundResult ?? true,
        sendHealthWarnings: config.telegram.sendHealthWarnings ?? true,
      };
      telegram = new TelegramGateway({ config: tgConfig, tenantResolver, tenantRuntimeFactory });
    } catch (err) {
      logger.warn({ component: 'Composition', error: String(err) }, 'Telegram init skipped');
    }
  }

  const riskEngine = new RiskEngine();
  // Live adapters must not be Mock in production (assert at LiveBetExecutor bind)

  // Warm platform prediction runtime (side-effect: registers stack)
  void getPredictionRuntime('platform');
  // Snapshot key: crash:prediction:stack:v2:platform (see prediction-runtime.ts)

  const predictionEngine = new PredictionEngine();
  const historicalDataService = new HistoricalDataService(roundRepo);
  let predictionRepo: PredictionRepository | undefined;
  try { predictionRepo = new PredictionRepository(pool); } catch { predictionRepo = undefined; }
  const sheathMode = new SheathMode();
  const entryDecisionService = new EntryDecisionService({
    predictionEngine,
    historicalData: historicalDataService,
    riskEngine,
    predictionRepo,
    roundRepo,
    sheathMode,
    usePipeline: true,
  });

  const dailyCounter = new DailyEntryCounter(config.betting?.dayBoundaryTimezone ?? 'UTC');
  let dailyLedger: DailyEntryLedger | null = null;
  try {
    dailyLedger = new DailyEntryLedger(pool, config.betting?.maxDailyEntries ?? 100);
  } catch { dailyLedger = null; }

  const runtimeHolders: {
    getCoordinator: () => BettingCoordinator | null;
    isHalted: () => boolean;
  } = { getCoordinator: () => null, isHalted: () => false };

  const riskStateProvider = new RiskStateProvider({
    config,
    balanceTracker,
    dailyLedger,
    dailyCounter,
    getStateMachine: () => runtimeHolders.getCoordinator()?.getStateMachine() ?? null,
    getLiveState: () => {
      const st = supervisor.getState();
      const sm = runtimeHolders.getCoordinator()?.getStateMachine();
      const smCtx = sm?.getContext();
      return {
        browserHealthy: st.phase !== 'error' && st.phase !== 'stopped',
        gameAdapterHealthy: st.observing || st.gameLoaded,
        sessionAuthenticated: st.authenticated,
        gameLoaded: st.gameLoaded,
        operatorAuthorized: true,
        paused: st.phase === 'paused' || smCtx?.paused === true,
        killSwitch: runtimeHolders.isHalted() || smCtx?.killSwitch === true,
        openBetExists: smCtx?.openBetExists ?? false,
        cooldownElapsed: true,
        consecutiveErrors: Math.max(st.consecutiveErrors, smCtx?.consecutiveErrors ?? 0),
        cashOutFailures: smCtx?.cashOutFailures ?? 0,
      };
    },
  });

  const opportunityRanker = new OpportunityRanker();
  entryDecisionService.setDecisionRanker(opportunityRanker);
  try {
    entryDecisionService.setProvenanceRepo(new PredictionProvenanceRepository(pool));
  } catch { /* pool may be unavailable in some modes */ }
  const decisionEngine = new DecisionEngine({ ranker: opportunityRanker, sheathMode, baseEnterThreshold: 0.42 });
  const featureStore = new FeatureStore();
  const ensemble = new EnsembleOrchestrator();
  const jobQueue = new PriorityJobQueue({ concurrency: 2, maxDepth: 500 });
  let settlementReconciler: SettlementReconciler | null = null;
  try {
    settlementReconciler = new SettlementReconciler(getPool(), null, {
      enabled: true,
      pollIntervalMs: 60_000,
      reconcileDeadlineMs: 15 * 60 * 1000,
      batchSize: 50,
    });
  } catch (e) {
    logger.warn({ component: 'Composition', error: String(e) }, 'SettlementReconciler init skipped');
  }
  const workerFleet = new WorkerFleet();
  const regimeWorker = new RegimeWorker();

  workerFleet.register(new MonitoringWorker({ fleet: workerFleet, sheathMode }));
  workerFleet.register(new DiscoveryWorker());
  workerFleet.register(new DataCollectionWorker({
    persistTick: async (p) => tickRepo.insert({
      roundId: String(p.roundId ?? ''),
      multiplier: Number(p.crashPoint ?? p.multiplier ?? 0),
      source: String(p.source ?? 'worker'),
      latencyMs: Number(p.latencyMs ?? 0),
      sessionId: typeof p.sessionId === 'string' ? p.sessionId : null,
    }),
  }));
  workerFleet.register(new SignalScannerWorker());
  workerFleet.register(new ConfirmationWorker());
  workerFleet.register(new PredictionWorker({ featureStore, entryDecisionService, buildRiskInput: () => riskStateProvider.buildFresh() }));
  workerFleet.register(regimeWorker);
  workerFleet.register(new EntryOptimizationWorker({ ranker: opportunityRanker }));
  workerFleet.register(new RiskWorker({ riskEngine, buildRiskInput: () => riskStateProvider.buildFresh() }));
  workerFleet.register(new ExecutionWorker({ sheathMode }));
  workerFleet.register(new SettlementWorker());
  workerFleet.register(new LearningWorker({ sheathMode, publishState: () => { void entryDecisionService.publishLearningState(); } }));
  workerFleet.register(new ValidationWorker({ sheathMode }));
  workerFleet.register(new SentimentWorker());
  workerFleet.register(new AnalyticsWorker());

  const ctx: CompositionContext = {
    config, eventBus, betRepo, roundRepo, sessionRepo, tickRepo, auditRepo, dailyStatsRepo,
    balanceTracker, recoveryManager, mutex, instanceLock, supervisor, entryDecisionService,
    predictionEngine, riskEngine, bettingCoordinator: null, telegram, notificationQueue,
    notificationRouter, dailyReportScheduler, durableLog, halted: false, haltReason: null,
    sheathMode, decisionEngine, workerFleet, featureStore, ensemble, jobQueue, regimeWorker,
    tenantManager,
  };

  async function start(): Promise<void> {
    const role =
      process.env.PROCESS_ROLE ??
      config.system.processRole ??
      'all';
    const runAutomation = role === 'automation-worker' || role === 'all';
    // control-plane side: outbox already started during composeApplication()

    if (!runAutomation) {
      logger.info(
        { component: 'Composition', role },
        'Skipping automation subsystems (workers/supervisor/prewarm)'
      );
      // control-plane still benefits from outbox already started in compose
      return;
    }

    logger.info({ component: 'Composition', mode: config.system.mode, host: hostname() }, 'Starting composition root');

    if (instanceLock && (config.system.mode === 'live' || config.system.mode === 'dry-run')) {
      const acquired = await instanceLock.tryAcquire();
      if (!acquired && config.system.mode === 'live') {
        throw new Error('Another active instance holds the crash:active-instance lock');
      }
    }

    logger.info({ component: 'Composition' }, 'Running mandatory startup recovery');
    const recovery = await recoveryManager.runRecovery();
    if (recoveryManager.isHalted()) {
      ctx.halted = true;
      ctx.haltReason = recovery?.errors?.join('; ') || 'Recovery halted system';
      if (telegram) await telegram.start().catch(() => undefined);
      return;
    }

    try { await ctx.workerFleet.startAll(); } catch (e) {
      logger.warn({ component: 'Composition', error: String(e) }, 'Worker fleet start partial failure');
    }

    if (telegram) {
      telegram.setRouterDependencies({
        getOrchestratorState: () => supervisor.getOrchestratorState(),
        getHealthStatus: () => supervisor.getState(),
        loginWithCredentials: (email, password) => supervisor.loginWithCredentials(email, password),
        tenantRuntimeFactory,
      });
      await telegram.start().catch((e) => logger.warn({ component: 'Composition', error: String(e) }, 'Telegram start failed'));
    }
    if (notificationRouter) notificationRouter.start();
    if (dailyReportScheduler) dailyReportScheduler.start();

    if (config.system.mode === 'maintenance') return;

    try {
      try {
        let redis: { get(k: string): Promise<string | null>; set(k: string, v: string, ...a: unknown[]): Promise<unknown> } | null = null;
        try {
          redis = getRedisClient() as never;
        } catch { /* redis optional at boot */ }
        await loadPredictionStackOnBoot(redis, entryDecisionService.getACIE());
      } catch { /* snapshot optional */ }
      const warm = await prewarmPredictionStack(entryDecisionService, 500);
      setPrewarmResult(warm);
      try {
        const flags = await loadApprovedEnsembleFlags();
        globalEnsemble.setFlags(flags);
      } catch { /* */ }
      try {
        await saveSnapshotToFile(undefined, entryDecisionService.getACIE());
        try {
          await saveSnapshotToRedis(getRedisClient() as never, entryDecisionService.getACIE());
        } catch { /* redis optional */ }
      } catch { /* */ }
      logger.info(
        {
          component: 'Composition',
          ...warm,
          liveReady: isReadyForLive(),
        },
        'Prediction prewarm complete'
      );
      if (config.system.mode === 'live' && !isReadyForLive()) {
        logger.warn({ component: 'Composition' }, 'Live mode but prediction not ready — sheath cold');
        try {
          ctx.sheathMode.reportTriggers([
            {
              id: 'prediction_cold_state',
              severity: 'high',
              message: 'prediction cold after prewarm',
              detectedAt: new Date().toISOString(),
            },
          ]);
        } catch { /* */ }
      }
    } catch (err) {
      setPrewarmResult(null, err instanceof Error ? err.message : String(err));
      logger.warn({ component: 'Composition', error: String(err) }, 'Pre-warm failed');
    }

    if (!ctx.halted) {
      await supervisor.start();
      wireDryRunSignalBridge({ supervisor, entryDecisionService, riskStateProvider, config });

      const liveWiring = supervisor.getLiveWiring();
      const bettingCoordinator = new BettingCoordinator({
        config,
        entryDecisionService,
        liveBetExecutor: liveWiring?.liveBetExecutor ?? null,
        sessionId: supervisor.getState()?.sessionId ?? null,
        buildRiskInput: () => riskStateProvider.buildFresh(),
        onEntryConfirmed: () => {
          dailyCounter.increment();
          void riskStateProvider.refreshDailyEntries();
        },
        dailyLedger,
        sheathMode: ctx.sheathMode,
        decisionEngine: ctx.decisionEngine,
      });
      ctx.bettingCoordinator = bettingCoordinator;
      runtimeHolders.getCoordinator = () => bettingCoordinator;
      runtimeHolders.isHalted = () => ctx.halted;

      const workerContext = (event: { id?: string; correlationId?: string }) => ({
        tenantId: null as string | null,
        correlationId: String(event.correlationId ?? event.id ?? 'worker'),
        eventId: String(event.id ?? `${Date.now()}`),
        receivedAt: new Date().toISOString(),
      });
      const CRITICAL_WORKERS = new Set(['prediction-1', 'execution-1', 'settlement-1']);
      const dispatchHot = (name: string, payload: Record<string, unknown>, event: { id?: string; correlationId?: string }) => {
        const worker = ctx.workerFleet.get(name);
        if (!worker) {
          workerMissingTotal.inc({ worker: name });
          return;
        }
        const end = workerJobDurationMs.startTimer({ worker: name });
        workerInflight.inc({ worker: name });
        void worker
          .process(payload, workerContext(event))
          .then(() => {
            workerJobsTotal.inc({ worker: name, status: 'ok' });
            workerLastSuccessUnix.set({ worker: name }, Date.now() / 1000);
          })
          .catch(async (err) => {
            workerJobsTotal.inc({ worker: name, status: 'error' });
            logger.error({ component: 'WorkerPipeline', worker: name, error: String(err) }, 'Worker job failed');
            await enqueueDeadLetter({
              worker: name,
              payload,
              error: String(err),
              eventId: event.id,
              at: new Date().toISOString(),
            });
          })
          .finally(() => {
            workerInflight.dec({ worker: name });
            end();
          });
      };
      // Bounded background queue for non-critical workers (concurrency 2)
      jobQueue.onProcess(async (job) => {
        const body = job.payload as { worker: string; payload: Record<string, unknown>; event: { id?: string; correlationId?: string } };
        const worker = ctx.workerFleet.get(body.worker);
        if (!worker) return;
        await worker.process(body.payload, workerContext(body.event));
      });
      const dispatchCold = (
        name: string,
        payload: Record<string, unknown>,
        event: { id?: string; correlationId?: string },
        priority: 'low' | 'normal' = 'low'
      ) => {
        if (CRITICAL_WORKERS.has(name)) {
          dispatchHot(name, payload, event);
          return;
        }
        jobQueue.enqueue(
          { worker: name, payload, event },
          priority,
          { id: `${name}:${String(payload.roundId ?? event.id ?? '')}` }
        );
      };
      const onEvent = (type: string, fn: (payload: Record<string, unknown>, event: { id?: string; correlationId?: string }) => void) => {
        eventBus.on(type as never, (event) => fn((event.payload ?? {}) as Record<string, unknown>, event));
      };

      onEvent('RoundStarted', (payload, event) => {
        // HOT: prediction evaluate only
        dispatchHot('prediction-1', { ...payload, evaluate: true }, event);
        // COLD
        dispatchCold('discovery-1', payload, event, 'low');
      });
      onEvent('RoundCrashed', (payload, event) => {
        // HOT: dry-run bridge → observeCrash → single path (no double-count)
        onRoundCrashedForDryRun({ payload, entryDecisionService, supervisor });
        dispatchHot('prediction-1', { ...payload, completedCrash: true, evaluate: false }, event);
        ctx.sheathMode.onRoundTick();
        checkEntryLatencySlo(ctx.sheathMode);
        // COLD: background fleet
        dispatchCold('signal-scanner-1', payload, event, 'low');
        dispatchCold('regime-1', payload, event, 'low');
        dispatchCold('learning-1', payload, event, 'low');
        dispatchCold('analytics-1', payload, event, 'low');
        dispatchCold('validation-1', payload, event, 'low');
      });

      settlementReconciler?.start();
      logger.info({ component: 'Composition', phase: supervisor.getState?.()?.phase }, 'SessionSupervisor started');
    }

    logger.info({ component: 'Composition' }, 'Composition root start complete');
  }

  async function stop(): Promise<void> {
    try { settlementReconciler?.stop(); } catch { /* */ }
    try {
      await saveSnapshotToFile(undefined, entryDecisionService.getACIE());
    } catch { /* */ }
    notificationRouter?.stop();
    dailyReportScheduler?.stop();
    try { await ctx.workerFleet.stopAll(); } catch { /* */ }
    try { outboxPublisher.stop(); await supervisor.stop(); } catch { /* */ }
    if (telegram) try { await telegram.stop?.(); } catch { /* */ }
    if (instanceLock) await instanceLock.release();
  }

  return { ctx, start, stop };
}
