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
import { TenantManager } from '../platform/tenant-manager';
import { TenantResolver } from '../platform/tenant-resolver';
import { TenantRuntimeFactory } from '../platform/tenant-runtime-factory';
import { WorkerFleet } from '../workers/fleet';
import { JobQueue } from '../workers/job-queue';
import { DecisionEngine } from '../decision/decision-engine';
import { FeatureStore } from '../prediction/feature-store';
import { Ensemble } from '../prediction/ensemble';
import { globalEnsemble } from '../prediction/ensemble-global';
import { RegimeWorker } from '../workers/regime-worker';
import { EntryOptimizationWorker } from '../workers/entry-optimization-worker';
import { RiskWorker } from '../workers/risk-worker';
import { ExecutionWorker } from '../workers/execution-worker';
import { SettlementWorker } from '../workers/settlement-worker';
import { LearningWorker } from '../workers/learning-worker';
import { ValidationWorker } from '../workers/validation-worker';
import { SentimentWorker } from '../workers/sentiment-worker';
import { AnalyticsWorker } from '../workers/analytics-worker';
import { OpportunityRanker } from '../prediction/opportunity-ranker';
import { RiskStateProvider } from '../betting/risk-state-provider';
import { SheathMode } from '../safety/sheath-mode';
import { SettlementReconciler } from '../ledger/settlement-reconciler';
import { onRoundCrashedForDryRun } from '../bridge/dry-run-bridge';
import { checkEntryLatencySlo } from '../observability/slo';
import {
  loadPredictionStackOnBoot,
  prewarmPredictionStack,
  setPrewarmResult,
  saveSnapshotToFile,
  saveSnapshotToRedis,
  loadApprovedEnsembleFlags,
} from '../prediction/boot-helpers';

const logger = getLogger();

const CRITICAL_WORKERS = new Set(['prediction-1']);

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
  mutex: DistributedMutex | null;
  instanceLock: InstanceLock | null;
  supervisor: SessionSupervisor;
  entryDecisionService: EntryDecisionService;
  predictionEngine: PredictionEngine;
  riskEngine: RiskEngine;
  bettingCoordinator: null;
  telegram: TelegramGateway | null;
  notificationQueue: NotificationQueue | null;
  notificationRouter: NotificationRouter | null;
  dailyReportScheduler: DailyReportScheduler | null;
  durableLog: InMemoryPersistentLog | PostgresPersistentLog;
  halted: boolean;
  haltReason: string | null;
  sheathMode: SheathMode;
  decisionEngine: DecisionEngine;
  workerFleet: WorkerFleet;
  featureStore: FeatureStore;
  ensemble: Ensemble;
  jobQueue: JobQueue;
  regimeWorker: RegimeWorker;
  tenantManager: TenantManager;
}

export interface CompositionHandle {
  ctx: CompositionContext;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function composeApplication(config: AppConfig): CompositionHandle {
  const eventBus = getEventBus();
  let durableLog: InMemoryPersistentLog | PostgresPersistentLog;
  try {
    durableLog = new PostgresPersistentLog(getPool());
  } catch {
    durableLog = new InMemoryPersistentLog();
  }

  const outboxPublisher = new OutboxPublisher(getPool(), eventBus);
  try {
    outboxPublisher.start();
  } catch (e) {
    logger.warn({ component: 'Composition', error: String(e) }, 'Outbox publisher start failed');
  }

  const betRepo = new BetRepository();
  const roundRepo = new RoundRepository();
  const sessionRepo = new SessionRepository();
  const tickRepo = new TickRepository();
  const auditRepo = new AuditRepository();
  const dailyStatsRepo = new DailyStatsRepository();
  const balanceTracker = new BalanceTracker();
  const unknownRecovery = new UnknownStateRecovery(betRepo);
  const balanceReconciliation = new BalanceReconciliation(balanceTracker, betRepo);
  const recoveryManager = new RecoveryManager({
    unknownRecovery,
    balanceReconciliation,
    sessionRepo,
  });

  let mutex: DistributedMutex | null = null;
  let instanceLock: InstanceLock | null = null;
  try {
    const redis = getRedisClient();
    mutex = new DistributedMutex(redis);
    instanceLock = new InstanceLock(redis);
  } catch {
    /* redis optional */
  }

  const sheathMode = new SheathMode();
  const featureStore = new FeatureStore();
  const ensemble = new Ensemble();
  const predictionRepo = new PredictionRepository();
  const provenanceRepo = new PredictionProvenanceRepository();
  const historicalData = new HistoricalDataService();
  const predictionEngine = new PredictionEngine({
    featureStore,
    ensemble,
    historicalData,
    predictionRepo,
  });
  const entryDecisionService = new EntryDecisionService({
    predictionEngine,
    provenanceRepo,
    featureStore,
  });
  const riskEngine = new RiskEngine();
  const riskStateProvider = new RiskStateProvider({ balanceTracker, dailyStatsRepo });
  const opportunityRanker = new OpportunityRanker();

  const supervisor = new SessionSupervisor({
    sessionRepo,
    eventBus,
    recoveryManager,
    entryDecisionService,
    config,
  });

  const tenantManager = new TenantManager();
  const tenantResolver = new TenantResolver(tenantManager);
  const tenantRuntimeFactory = new TenantRuntimeFactory({ tenantManager, config });

  let telegram: TelegramGateway | null = null;
  const tokenValue = process.env.TELEGRAM_BOT_TOKEN;
  if (tokenValue) {
    const tgConfig: TelegramBotConfig = {
      botToken: String(tokenValue),
      allowedUserIds: (config.telegram.allowedUserIds || [])
        .map((id) => Number(id))
        .filter((n) => !Number.isNaN(n)),
      verbosity: config.telegram.verbosity,
      webhookUrl: config.telegram.webhookUrl,
      rateLimitMessagesPerMinute: config.telegram.rateLimitMessagesPerMinute ?? 30,
      sendRoundStart: config.telegram.sendRoundStart ?? false,
      sendRoundResult: config.telegram.sendRoundResult ?? true,
      sendHealthWarnings: config.telegram.sendHealthWarnings ?? true,
    };
    telegram = new TelegramGateway({ config: tgConfig, tenantResolver, tenantRuntimeFactory });
  }

  const notificationQueue = new NotificationQueue();
  const notificationRouter = new NotificationRouter({
    queue: notificationQueue,
    telegram,
  });
  const dailyReportScheduler = new DailyReportScheduler({
    dailyStatsRepo,
    notificationRouter,
  });

  const jobQueue = new JobQueue();
  const workerFleet = new WorkerFleet();
  const regimeWorker = new RegimeWorker();
  workerFleet.register(regimeWorker);
  workerFleet.register(new EntryOptimizationWorker({ ranker: opportunityRanker }));
  workerFleet.register(new RiskWorker({ riskEngine, buildRiskInput: () => riskStateProvider.buildFresh() }));
  workerFleet.register(new ExecutionWorker({ sheathMode }));
  workerFleet.register(new SettlementWorker());
  workerFleet.register(
    new LearningWorker({
      sheathMode,
      publishState: () => {
        void entryDecisionService.publishLearningState();
      },
    })
  );
  workerFleet.register(new ValidationWorker({ sheathMode }));
  workerFleet.register(new SentimentWorker());
  workerFleet.register(new AnalyticsWorker());

  const decisionEngine = new DecisionEngine({
    entryDecisionService,
    riskEngine,
    sheathMode,
  });

  let settlementReconciler: SettlementReconciler | null = null;
  try {
    settlementReconciler = new SettlementReconciler(getPool());
  } catch {
    /* optional */
  }

  const ctx: CompositionContext = {
    config,
    eventBus,
    betRepo,
    roundRepo,
    sessionRepo,
    tickRepo,
    auditRepo,
    dailyStatsRepo,
    balanceTracker,
    recoveryManager,
    mutex,
    instanceLock,
    supervisor,
    entryDecisionService,
    predictionEngine,
    riskEngine,
    bettingCoordinator: null,
    telegram,
    notificationQueue,
    notificationRouter,
    dailyReportScheduler,
    durableLog,
    halted: false,
    haltReason: null,
    sheathMode,
    decisionEngine,
    workerFleet,
    featureStore,
    ensemble,
    jobQueue,
    regimeWorker,
    tenantManager,
  };

  async function start(): Promise<void> {
    const role = process.env.PROCESS_ROLE ?? config.system.processRole ?? 'all';
    const runAutomation = role === 'automation-worker' || role === 'all';

    if (!runAutomation) {
      logger.info(
        { component: 'Composition', role },
        'Skipping automation subsystems (workers/supervisor/prewarm)'
      );
      // control-plane / mini-app-game: still start Telegram operator bot
      // (previously returned early → zero command responses in production)
      if (telegram) {
        try {
          telegram.setRouterDependencies({
            getOrchestratorState: () => supervisor.getOrchestratorState(),
            getHealthStatus: () => supervisor.getState(),
            loginWithCredentials: (email, password) =>
              supervisor.loginWithCredentials(email, password),
            tenantRuntimeFactory,
          });
        } catch (e) {
          logger.warn(
            { component: 'Composition', error: String(e) },
            'Telegram router deps partial (supervisor may be idle on this role)'
          );
        }
        await telegram.start().catch((e) =>
          logger.warn(
            { component: 'Composition', error: String(e) },
            'Telegram start failed on control-plane'
          )
        );
        logger.info(
          { component: 'Composition', role },
          'Telegram operator bot started (non-automation role)'
        );
      } else {
        logger.warn(
          { component: 'Composition', role },
          'TELEGRAM_BOT_TOKEN missing — operator bot not started'
        );
      }
      if (notificationRouter) notificationRouter.start();
      if (dailyReportScheduler) dailyReportScheduler.start();
      return;
    }

    logger.info(
      { component: 'Composition', mode: config.system.mode, host: hostname() },
      'Starting composition root'
    );

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

    try {
      await ctx.workerFleet.startAll();
    } catch (e) {
      logger.warn({ component: 'Composition', error: String(e) }, 'Worker fleet start partial failure');
    }

    if (telegram) {
      telegram.setRouterDependencies({
        getOrchestratorState: () => supervisor.getOrchestratorState(),
        getHealthStatus: () => supervisor.getState(),
        loginWithCredentials: (email, password) => supervisor.loginWithCredentials(email, password),
        tenantRuntimeFactory,
      });
      await telegram
        .start()
        .catch((e) =>
          logger.warn({ component: 'Composition', error: String(e) }, 'Telegram start failed')
        );
    }
    if (notificationRouter) notificationRouter.start();
    if (dailyReportScheduler) dailyReportScheduler.start();

    if (config.system.mode === 'maintenance') return;

    try {
      try {
        let redis: {
          get(k: string): Promise<string | null>;
          set(k: string, v: string, ...a: unknown[]): Promise<unknown>;
        } | null = null;
        try {
          redis = getRedisClient() as never;
        } catch {
          /* redis optional at boot */
        }
        await loadPredictionStackOnBoot(redis, entryDecisionService.getACIE());
      } catch {
        /* snapshot optional */
      }
      const warm = await prewarmPredictionStack(entryDecisionService, 500);
      setPrewarmResult(warm);
      try {
        const flags = await loadApprovedEnsembleFlags();
        globalEnsemble.setFlags(flags);
      } catch {
        /* */
      }
      try {
        await saveSnapshotToFile(undefined, entryDecisionService.getACIE());
        try {
          await saveSnapshotToRedis(getRedisClient() as never, entryDecisionService.getACIE());
        } catch {
          /* redis optional */
        }
      } catch {
        /* */
      }
    } catch (e) {
      logger.warn({ component: 'Composition', error: String(e) }, 'Prediction prewarm partial failure');
    }

    try {
      await supervisor.start();
      const dispatchHot = (
        name: string,
        payload: Record<string, unknown>,
        event: { id?: string; correlationId?: string }
      ) => {
        void workerFleet.dispatch(name, payload, event).catch((err) =>
          logger.warn({ component: 'Composition', worker: name, error: String(err) }, 'hot dispatch failed')
        );
      };
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
      const onEvent = (
        type: string,
        fn: (payload: Record<string, unknown>, event: { id?: string; correlationId?: string }) => void
      ) => {
        eventBus.on(type as never, (event) =>
          fn((event.payload ?? {}) as Record<string, unknown>, event)
        );
      };

      onEvent('RoundStarted', (payload, event) => {
        dispatchHot('prediction-1', { ...payload, evaluate: true }, event);
        dispatchCold('discovery-1', payload, event, 'low');
      });
      onEvent('RoundCrashed', (payload, event) => {
        onRoundCrashedForDryRun({ payload, entryDecisionService, supervisor });
        dispatchHot('prediction-1', { ...payload, completedCrash: true, evaluate: false }, event);
        ctx.sheathMode.onRoundTick();
        checkEntryLatencySlo(ctx.sheathMode);
        dispatchCold('signal-scanner-1', payload, event, 'low');
        dispatchCold('regime-1', payload, event, 'low');
        dispatchCold('learning-1', payload, event, 'low');
        dispatchCold('analytics-1', payload, event, 'low');
        dispatchCold('validation-1', payload, event, 'low');
      });

      settlementReconciler?.start();
      logger.info(
        { component: 'Composition', phase: supervisor.getState?.()?.phase },
        'SessionSupervisor started'
      );
    } catch (e) {
      logger.error({ component: 'Composition', error: String(e) }, 'Supervisor start failed');
    }

    logger.info({ component: 'Composition' }, 'Composition root start complete');
  }

  async function stop(): Promise<void> {
    try {
      settlementReconciler?.stop();
    } catch {
      /* */
    }
    try {
      await saveSnapshotToFile(undefined, entryDecisionService.getACIE());
    } catch {
      /* */
    }
    notificationRouter?.stop();
    dailyReportScheduler?.stop();
    try {
      await ctx.workerFleet.stopAll();
    } catch {
      /* */
    }
    try {
      outboxPublisher.stop();
      await supervisor.stop();
    } catch {
      /* */
    }
    if (telegram)
      try {
        await telegram.stop?.();
      } catch {
        /* */
      }
    if (instanceLock) await instanceLock.release();
  }

  return { ctx, start, stop };
}
