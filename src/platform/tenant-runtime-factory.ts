import { EventBus } from '../core/event-bus/bus';
import { SessionSupervisor } from '../core/session-supervisor';
import { AppConfig } from '../config/schema';

export interface TenantRuntime {
  tenantId: string;
  sessionSupervisor: SessionSupervisor;
  getStatus(): ReturnType<SessionSupervisor['getOrchestratorState']>;
  getHealth(): ReturnType<SessionSupervisor['getState']>;
  start(): Promise<void>;
  stop(): Promise<void>;
  authenticate(email: string, password: string): ReturnType<SessionSupervisor['loginWithCredentials']>;
}

/** Creates and caches one browser/session runtime per tenant. */
export class TenantRuntimeFactory {
  private readonly runtimes = new Map<string, TenantRuntime>();

  constructor(
    private readonly options: {
      config: AppConfig;
      eventBus: EventBus;
      createSupervisor?: (tenantId: string) => SessionSupervisor;
    }
  ) {}

  async getOrCreate(tenantId: string): Promise<TenantRuntime> {
    const existing = this.runtimes.get(tenantId);
    if (existing) return existing;

    const supervisor = this.options.createSupervisor?.(tenantId) ?? new SessionSupervisor({
      config: this.options.config,
      eventBus: this.options.eventBus,
      tenantId,
    });
    const runtime: TenantRuntime = {
      tenantId,
      sessionSupervisor: supervisor,
      getStatus: () => supervisor.getOrchestratorState(),
      getHealth: () => supervisor.getState(),
      start: () => supervisor.start(),
      stop: () => supervisor.stop(),
      authenticate: (email, password) => supervisor.loginWithCredentials(email, password),
    };
    this.runtimes.set(tenantId, runtime);
    return runtime;
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.runtimes.values()].map((runtime) => runtime.stop().catch(() => undefined)));
    this.runtimes.clear();
  }
}