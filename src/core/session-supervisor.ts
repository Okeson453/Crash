import { BrowserManager } from '../browser/manager';
import { BrowserSession } from '../browser/session';
import { ProfileManager } from '../browser/profile';
import { BrowserHealthMonitor } from '../browser/health';
import { toLaunchOptions } from '../browser/types';
import type { Orchestrator } from './orchestrator';
import { GameAdapter } from '../game/adapter';
import { RoundObserver } from '../game/observer';
import { EventBus } from './event-bus/bus';
import { createEvent } from './event-bus/events';
import { AppConfig } from '../config/schema';
import { getLogger } from '../observability/logger';
import { CriticalError } from '../utils/errors';
import type { SelectorCanary } from '../game/selector-canary';
import type { LiveWiring } from './live-session-wiring';
import { BC_GAME_URLS } from '../game/constants';
import {
  runLoginTestPipeline,
  type LoginStatus,
  type LoginTestReport,
} from '../browser/login-test-pipeline';
import { DryRunController } from './dry-run/dry-run-controller';
import { maskEmail, takeTenantLogin } from '../security/ephemeral-login';
import path from 'path';
import { runNetworkPreflight } from '../browser/preflight';
import { SessionHealthTracker } from './session-health';
import { normalizeProxyPool, parseProxyEndpoint } from '../network/proxy-manager';
import { EventEmitter } from 'events';

export type SupervisorPhase =
  | 'idle' | 'initializing' | 'launching-browser' | 'restoring-session'
  | 'authenticating' | 'auth-required' | 'browser-failed' | 'region-blocked'
  | 'navigating' | 'loading-game' | 'observing' | 'paused' | 'recovering' | 'error' | 'stopped' | 'preflight-failed';

export interface SessionSupervisorOptions {
  config: AppConfig;
  eventBus: EventBus;
  tenantId?: string;
}

export interface SupervisorState {
  phase: SupervisorPhase;
  sessionId: string | null;
  browserLaunched: boolean;
  authenticated: boolean;
  gameLoaded: boolean;
  observing: boolean;
  errorCount: number;
  consecutiveErrors: number;
  lastError: string | null;
  startedAt: string | null;
  loginStatus: LoginStatus;
  lastLoginReport: LoginTestReport | null;
  lastProxyIndex?: number;
}

/**
 * SessionSupervisor — dry-run ACIE and LOGIN TEST are independent.
 * Login failures do not stop dry-run observation.
 */
export class SessionSupervisor {
  private readonly options: SessionSupervisorOptions;
  private readonly logger = getLogger();
  private state: SupervisorState;
  private browserManager: BrowserManager | null = null;
  private browserSession: BrowserSession | null = null;
  private profileManager: ProfileManager | null = null;
  private healthMonitor: BrowserHealthMonitor | null = null;
  private gameAdapter: GameAdapter | null = null;
  private roundObserver: RoundObserver | null = null;
  private _orchestrator: Orchestrator | null = null;
  private _selectorCanary: SelectorCanary | null = null;
  private liveWiring: LiveWiring | null = null;
  private dryRunController: DryRunController | null = null;
  private signalEvaluator: ((roundId: string) => void | Promise<void>) | null = null;
  private onDegradedUnsub: (() => void) | null = null;
  private readonly healthTracker = new SessionHealthTracker();
  private readonly phaseEmitter = new EventEmitter();

  constructor(options: SessionSupervisorOptions) {
    this.options = options;
    this.state = {
      phase: 'idle', sessionId: null, browserLaunched: false, authenticated: false,
      gameLoaded: false, observing: false, errorCount: 0, consecutiveErrors: 0,
      lastError: null, startedAt: null, loginStatus: 'NOT_TESTED', lastLoginReport: null,
    };
    void this._orchestrator;
    void this._selectorCanary;
  }

  async start(): Promise<void> {
    if (this.state.phase !== 'idle' && this.state.phase !== 'stopped') return;
    this.state.phase = 'initializing';
    this.state.startedAt = new Date().toISOString();
    const mode = String(this.options.config.system.mode ?? '').toLowerCase();
    try {
      await this.initializeProfile();
      await this.launchBrowser();
      await this.restoreSessionState();
      if (mode === 'dry-run' || mode === 'observe-only') {
        if (mode === 'dry-run') {
          this.dryRunController = new DryRunController({
            stake: this.options.config.betting?.stakePerEntry ?? 700,
            target: this.options.config.betting?.cashOutTarget ?? 1.3,
            initialVirtualBalance: Number(process.env.DRY_RUN_VIRTUAL_BALANCE ?? 10000),
            maxDailyVirtualTrades: this.options.config.betting?.maxDailyEntries ?? 100,
          } as never);
          this.dryRunController.start(this.state.sessionId ?? 'dry-run', this.options.tenantId);
        }
        await this.navigateToGame();
      } else {
        await this.authenticateViaLoginPage();
        await this.navigateToGame();
      }
      await this.initializeObservation();
      this.startHealthMonitoring();
      this.state.phase = 'observing';
      this.state.observing = true;
      this.logger.info({ component: 'SessionSupervisor', mode, loginStatus: this.state.loginStatus }, 'observing');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.state.lastError = message;
      this.state.phase = /BROWSER|chromium|playwright/i.test(message) ? 'browser-failed' : 'error';
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.state.phase = 'stopped';
    this.state.observing = false;
    this.dryRunController?.stop();
    this.stopHealthMonitoring();
    try { await this.roundObserver?.stop(); } catch { /* */ }
    try { await this.gameAdapter?.stop(); } catch { /* */ }
    try { await this.browserManager?.close(); } catch { /* */ }
  }

  async pause(): Promise<void> {
    this.state.phase = 'paused';
    this.state.observing = false;
    try { await this.roundObserver?.stop(); } catch { /* */ }
  }

  async resume(): Promise<void> {
    if (this.state.phase !== 'paused') return;
    await this.initializeObservation();
    this.state.phase = 'observing';
    this.state.observing = true;
  }

  setSignalEvaluator(fn: ((roundId: string) => void | Promise<void>) | null): void {
    this.signalEvaluator = fn;
  }

  async loginWithCredentials(email: string, password: string): Promise<{
    ok: boolean; authenticated: boolean; regionBlocked?: boolean; gameLoaded?: boolean;
    observing?: boolean; detail?: string; code?: string; maskedEmail?: string; loginReport?: LoginTestReport;
  }> {
    const masked = maskEmail(email);
    this.state.loginStatus = 'TESTING';
    const wasObserving = this.state.observing;
    const mode = String(this.options.config.system.mode ?? '').toLowerCase();
    try {
      const proxyServer =
        this.options.config.proxy?.server ??
        this.options.config.browser?.network?.proxyServer ??
        null;
      const preflight = await runNetworkPreflight(
        process.env.BC_GAME_LOGIN_URL?.trim() || 'https://bc.game',
        proxyServer
      );
      if (!preflight.ok) {
        this.setPhase('preflight-failed', 'NETWORK_PREFLIGHT_FAILED');
        this.healthTracker.recordFailure('NETWORK_PREFLIGHT_FAILED');
        return {
          ok: false,
          authenticated: false,
          detail: 'NETWORK_PREFLIGHT_FAILED',
          code: 'NETWORK_PREFLIGHT_FAILED',
          maskedEmail: masked,
          observing: this.state.observing,
        };
      }

      if (!this.browserManager?.getPage?.()) {
        await this.initializeProfile();
        await this.launchBrowser();
        await this.restoreSessionState();
      }
      const page = this.browserManager?.getPage();
      if (!page) {
        this.state.loginStatus = 'AUTH_FAILED';
        return { ok: false, authenticated: false, detail: 'BROWSER_NOT_READY', code: 'BROWSER_FAILED', maskedEmail: masked };
      }
      if (!this.browserSession) {
        const profiles = this.profileManager?.listProfiles?.() ?? [];
        if (profiles[0]) this.browserSession = new BrowserSession({ profileDirectory: profiles[0].directory });
      }
      const report = await runLoginTestPipeline(page, {
        loginUrl: process.env.BC_GAME_LOGIN_URL?.trim() || BC_GAME_URLS.login,
        email, password, tenantId: this.options.tenantId,
        browserSession: this.browserSession,
        context: this.browserManager?.getContext?.() ?? null,
      });
      this.state.lastLoginReport = report;
      this.state.loginStatus = report.status;
      if (report.regionBlocked || report.status === 'REGION_BLOCKED') {
        if (!(mode === 'dry-run' && wasObserving)) this.setPhase('region-blocked', 'REGION_BLOCKED');
        this.state.authenticated = false;
        this.healthTracker.recordFailure('REGION_BLOCKED');

        const pool = normalizeProxyPool(this.options.config.proxy?.pool);
        const alreadyTriedProxy = this.state.lastProxyIndex ?? -1;
        const nextProxyIndex = alreadyTriedProxy + 1;

        if (pool.length > 0 && nextProxyIndex < pool.length) {
          this.logger.warn(
            { component: 'SessionSupervisor', proxyIndex: nextProxyIndex, poolSize: pool.length },
            'Region blocked — retrying via next proxy in pool'
          );
          this.state.lastProxyIndex = nextProxyIndex;
          await this.notifyOperator(
            `⚠️ BC.Game blocked the current egress region. Retrying with proxy ${nextProxyIndex + 1}/${pool.length}.`
          );
          const resolved = parseProxyEndpoint(pool[nextProxyIndex]);
          if (resolved) {
            await this.reinitializeBrowserWithProxy(resolved);
            // Retry login once with the new egress (credentials already validated shape)
            return this.loginWithCredentials(email, password);
          }
        }

        password = '';
        await this.notifyOperator(
          `🛑 BC.Game region-blocked and no working proxy is configured/remaining (tried ${pool.length}). ` +
            `Betting is paused until PROXY_POOL is updated or the deployment region changes.`
        );
        return {
          ok: false,
          authenticated: false,
          regionBlocked: true,
          detail: 'REGION_BLOCKED',
          maskedEmail: masked,
          loginReport: report,
          observing: this.state.observing,
        };
      }
      if (report.status !== 'AUTHENTICATED') {
        password = '';
        if (!(mode === 'dry-run' && wasObserving)) this.setPhase('auth-required', report.classification);
        return { ok: false, authenticated: false, detail: report.classification, maskedEmail: masked, loginReport: report, observing: this.state.observing };
      }
      password = '';
      this.state.authenticated = true;
      this.state.loginStatus = 'AUTHENTICATED';
      this.healthTracker.recordSuccess();
      if (!this.state.observing) {
        try {
          await this.navigateToGame();
          await this.initializeObservation();
        } catch { /* */ }
      } else if (mode === 'dry-run') {
        try { await this.navigateToGame(); } catch { /* */ }
      }
      return { ok: true, authenticated: true, gameLoaded: this.state.gameLoaded, observing: this.state.observing, maskedEmail: masked, loginReport: report };
    } catch (err) {
      password = '';
      this.state.loginStatus = 'AUTH_FAILED';
      return { ok: false, authenticated: false, detail: err instanceof Error ? err.message : String(err), maskedEmail: masked, observing: this.state.observing };
    }
  }

  getOrchestratorState() {
    const dry = this.dryRunController?.getStatus();
    return {
      mode: this.options.config.system.mode,
      running: this.state.observing,
      sessionId: this.state.sessionId,
      currentRoundId: null as string | null,
      roundsObserved: dry?.roundsObserved ?? 0,
      ticksRecorded: 0,
      errors: this.state.errorCount,
      startedAt: this.state.startedAt,
      phase: this.state.phase,
      authenticated: this.state.authenticated,
      gameLoaded: this.state.gameLoaded,
      observing: this.state.observing,
      loginStatus: this.state.loginStatus,
      lastLoginClassification: this.state.lastLoginReport?.classification ?? null,
      lastLoginStage: this.state.lastLoginReport?.failedStage ?? null,
      dryRun: dry ? {
        authRequired: false, liveExecution: false,
        predictions: dry.predictions, signals: dry.signals, signalsAccepted: dry.signalsAccepted,
        virtualBalance: dry.ledger.virtualBalance, netPnl: dry.ledger.netPnl,
        wins: dry.ledger.wins, losses: dry.ledger.losses,
      } : undefined,
    };
  }

  getDryRunController() { return this.dryRunController; }
  getLastLoginReport() { return this.state.lastLoginReport; }
  getLoginStatus() { return this.state.loginStatus; }
  getLiveWiring() { return this.liveWiring; }
  getState() { return { ...this.state }; }
  isObserving() { return this.state.phase === 'observing'; }
  getPhase() { return this.state.phase; }
  getBrowserManager() { return this.browserManager; }
  getGameAdapter() { return this.gameAdapter; }
  getRoundObserver() { return this.roundObserver; }
  getHealthMonitor() { return this.healthMonitor; }


  private setPhase(phase: SupervisorPhase, detail?: string): void {
    const previous = this.state.phase;
    this.state.phase = phase;
    this.logger.info(
      { component: 'SessionSupervisor', previousPhase: previous, newPhase: phase, detail },
      'Session phase transition'
    );
    this.phaseEmitter.emit('phase:changed', {
      previous,
      current: phase,
      detail,
      at: new Date().toISOString(),
    });
  }

  onPhaseChange(
    listener: (ev: { previous: SupervisorPhase; current: SupervisorPhase; detail?: string; at: string }) => void
  ): () => void {
    this.phaseEmitter.on('phase:changed', listener);
    return () => this.phaseEmitter.off('phase:changed', listener);
  }

  getSessionHealth() {
    return this.healthTracker.snapshot(
      this.state.authenticated,
      this.state.phase,
      this.state.browserLaunched
    );
  }

  private async notifyOperator(message: string): Promise<void> {
    this.logger.warn({ component: 'SessionSupervisor', operatorAlert: true }, message);
    try {
      const chatId = process.env.TELEGRAM_OPERATOR_CHAT_ID;
      if (chatId) {
        // Best-effort: gateway may not be constructed in this process role
        const { getLogger } = await import('../observability/logger');
        getLogger().info({ component: 'SessionSupervisor', chatId }, message);
      }
    } catch {
      /* ignore */
    }
  }

  private async reinitializeBrowserWithProxy(proxy: {
    server: string;
    username?: string;
    password?: string;
  }): Promise<void> {
    this.setPhase('recovering', 'proxy-rotate');
    if (this.browserManager) {
      try {
        this.browserManager.setRecoveryEnabled(false);
        await this.browserManager.close();
      } catch {
        /* ignore */
      }
      this.browserManager = null;
      this.state.browserLaunched = false;
    }
    // Mutate proxy config for subsequent toLaunchOptions
    const cfg = this.options.config;
    if (cfg.proxy) {
      (cfg.proxy as { server?: string; username?: string; password?: string; enabled?: boolean }).enabled = true;
      (cfg.proxy as { server?: string }).server = proxy.server;
      if (proxy.username) (cfg.proxy as { username?: string }).username = proxy.username;
      if (proxy.password) (cfg.proxy as { password?: string }).password = proxy.password;
    }
    await this.initializeProfile();
    await this.launchBrowser();
    await this.restoreSessionState();
  }

  private async initializeProfile(): Promise<void> {
    const baseDir = process.env.BROWSER_PROFILE_DIR || path.join(process.cwd(), '.browser-profiles');
    this.profileManager = new ProfileManager({ baseDirectory: baseDir } as never);
    const profile = await (this.profileManager as unknown as { getOrCreateProfile: () => Promise<{ directory: string }> }).getOrCreateProfile();
    this.browserSession = new BrowserSession({ profileDirectory: profile.directory });
    this.state.sessionId = this.options.tenantId ?? 'default';
  }

  private async launchBrowser(): Promise<void> {
    this.state.phase = 'launching-browser';
    const launchOptions = toLaunchOptions(this.options.config.browser, this.options.config.proxy, this.options.config.system.mode);
    this.browserManager = new BrowserManager(launchOptions);
    await this.browserManager.launch();
    this.state.browserLaunched = true;
  }

  private async restoreSessionState(): Promise<void> {
    this.state.phase = 'restoring-session';
    const ctx = this.browserManager?.getContext();
    if (ctx && this.browserSession) await this.browserSession.restoreIfAvailable(ctx);
  }

  private async authenticateViaLoginPage(): Promise<void> {
    this.state.phase = 'authenticating';
    const pending = this.options.tenantId ? takeTenantLogin(this.options.tenantId) : null;
    if (pending?.email && pending.password) {
      const r = await this.loginWithCredentials(pending.email, pending.password);
      if (r.ok && r.authenticated) return;
    }
    this.state.phase = 'auth-required';
    this.state.loginStatus = 'AUTH_FAILED';
    throw new CriticalError('Authentication required', 'AUTHENTICATION_REQUIRED');
  }

  private async navigateToGame(): Promise<void> {
    this.state.phase = 'navigating';
    const gameUrl = process.env.BC_GAME_CRASH_URL?.trim() || BC_GAME_URLS.crash;
    await this.browserManager!.navigate(gameUrl, 'domcontentloaded');
    this.state.gameLoaded = true;
  }

  private async initializeObservation(): Promise<void> {
    this.state.phase = 'observing';
    this.gameAdapter = new GameAdapter({
      page: this.browserManager!.getPage(),
      enableDomAdapter: true,
      enableWsAdapter: true,
      enableApiAdapter: true,
      pollIntervalMs: 100,
    } as never);
    this.roundObserver = new RoundObserver({
      adapter: this.gameAdapter,
      minConfidenceForEntry: this.options.config.observation.minConfidenceForEntry,
      maxLatencyMs: this.options.config.observation.maxTickLatencyMs,
    } as never);
    await this.gameAdapter.start();
    await this.roundObserver.start();

    this.roundObserver.onRoundStart((roundId) => {
      void this.options.eventBus
        .emit(
          createEvent(
            'RoundStarted',
            {
              roundId,
              sessionId: this.state.sessionId ?? 'unknown',
              startedAt: new Date().toISOString(),
            },
            { correlationId: roundId, source: 'SessionSupervisor' }
          )
        )
        .catch(() => undefined);
      void this.signalEvaluator?.(roundId);
    });

    this.roundObserver.onRoundComplete((roundId, crashPoint) => {
      this.dryRunController?.onRoundCompleted(roundId, crashPoint);
      void this.options.eventBus
        .emit(
          createEvent(
            'RoundCrashed',
            { roundId, crashPoint, crashedAt: new Date().toISOString() },
            { correlationId: roundId, source: 'SessionSupervisor' }
          )
        )
        .catch(() => undefined);
    });

    this.state.observing = true;
    this.logger.info(
      { component: 'SessionSupervisor', dryRun: !!this.dryRunController },
      'Observation initialized — round events wired to dry-run + EventBus'
    );
  }

  private startHealthMonitoring(): void {
    this.healthMonitor = new BrowserHealthMonitor({
      frozenThresholdMs: 5000, memoryThresholdMB: 512, tickTimeoutMs: 3000,
    } as never);
    if (this.browserManager?.getPage()) {
      this.healthMonitor.start(this.browserManager.getPage(), 5000);
    }
  }

  private stopHealthMonitoring(): void {
    this.healthMonitor?.stop();
    this.healthMonitor = null;
    this.onDegradedUnsub?.();
    this.onDegradedUnsub = null;
  }

  async consumeLoginOnceFile(): Promise<boolean> { return false; }
}
