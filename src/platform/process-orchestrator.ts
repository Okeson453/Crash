/**
 * In-process ProcessOrchestrator — real Playwright login when Docker is unavailable.
 */
import { getLogger } from '../observability/logger.js';
import { getPool } from '../persistence/client.js';
import { TenantManager } from './tenant-manager.js';
import { TenantRuntimeFactory, TenantRuntime } from './tenant-runtime-factory.js';
import { getEventBus } from '../core/event-bus/bus.js';
import { validateConfig } from '../config/validator.js';
import type { ContainerOrchestrator, ContainerInfo, ProvisionOptions } from './container-orchestrator.js';
import { unlink } from 'fs/promises';
import { join } from 'path';

function envFlag(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export class ProcessOrchestrator implements ContainerOrchestrator {
  private readonly logger = getLogger();
  private readonly tenants = new TenantManager();
  private readonly lifecycleLocks = new Map<string, Promise<void>>();
  private runtimeFactory: TenantRuntimeFactory | null = null;
  private readonly activeRuntimes = new Map<string, TenantRuntime>();

  private getFactory(): TenantRuntimeFactory {
    if (this.runtimeFactory) return this.runtimeFactory;
    try {
      const config = validateConfig();
      const eventBus = getEventBus();
      this.runtimeFactory = new TenantRuntimeFactory({ config, eventBus });
      this.logger.info(
        { component: 'ProcessOrchestrator' },
        'In-process TenantRuntimeFactory ready (Docker unavailable fallback)'
      );
    } catch (err) {
      this.logger.error(
        { component: 'ProcessOrchestrator', error: String(err) },
        'Failed to init TenantRuntimeFactory'
      );
      throw err;
    }
    return this.runtimeFactory;
  }

  private async withTenantLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.lifecycleLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const chained = prev.then(() => gate);
    this.lifecycleLocks.set(userId, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.lifecycleLocks.get(userId) === chained) {
        this.lifecycleLocks.delete(userId);
      }
    }
  }

  async provision(userId: string, opts?: ProvisionOptions): Promise<ContainerInfo> {
    return this.withTenantLock(userId, () => this.provisionUnlocked(userId, opts));
  }

  private async provisionUnlocked(userId: string, opts?: ProvisionOptions): Promise<ContainerInfo> {
    let instance = await this.tenants.getInstance(userId);
    if (!instance) {
      instance = await this.tenants.createInstance(userId);
    }
    const containerId = `proc-${userId.slice(0, 8)}-${Date.now()}`;

    try {
      const factory = this.getFactory();
      const runtime = await factory.getOrCreate(userId);
      this.activeRuntimes.set(userId, runtime);
      this.logger.info(
        { component: 'ProcessOrchestrator', userId },
        'In-process tenant runtime created'
      );
    } catch (err) {
      this.logger.warn(
        { component: 'ProcessOrchestrator', userId, error: String(err) },
        'Runtime create failed — status still marked running for status UI'
      );
    }

    await this.tenants.updateInstance(userId, {
      containerId,
      containerHost: 'process',
      status: 'running',
      mode: opts?.MODE ?? 'observe-only',
      lastHeartbeat: new Date(),
    });
    await this.tenants.audit({
      actorType: 'system',
      action: 'instance.provisioned',
      targetUserId: userId,
      payload: { containerId, backend: 'process-inproc' },
    });
    this.logger.info(
      { component: 'ProcessOrchestrator', userId, containerId },
      'Tenant instance marked running (in-process backend)'
    );
    return { containerId, host: 'process', status: 'running' };
  }

  async pause(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.pauseUnlocked(userId));
  }

  private async pauseUnlocked(userId: string): Promise<void> {
    const runtime = this.activeRuntimes.get(userId);
    if (runtime) {
      try {
        await runtime.sessionSupervisor.pause();
      } catch {
        /* ignore */
      }
    }
    await this.tenants.updateInstance(userId, { status: 'paused' });
    await this.tenants.audit({
      actorType: 'system',
      action: 'instance.paused',
      targetUserId: userId,
    });
  }

  async resume(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.resumeUnlocked(userId));
  }

  private async resumeUnlocked(userId: string): Promise<void> {
    const runtime = this.activeRuntimes.get(userId);
    if (runtime) {
      try {
        await runtime.sessionSupervisor.resume();
      } catch {
        /* ignore */
      }
    }
    await this.tenants.updateInstance(userId, {
      status: 'running',
      lastHeartbeat: new Date(),
    });
    await this.tenants.audit({
      actorType: 'system',
      action: 'instance.resumed',
      targetUserId: userId,
    });
  }

  async destroy(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.destroyUnlocked(userId));
  }

  private async destroyUnlocked(userId: string): Promise<void> {
    const runtime = this.activeRuntimes.get(userId);
    if (runtime) {
      try {
        await runtime.stop();
      } catch {
        /* ignore */
      }
      this.activeRuntimes.delete(userId);
    }
    try {
      await unlink(join(envFlag('TENANT_SECRET_DIR', '/run/crashwave/secrets'), `${userId}.json`));
    } catch {
      /* already absent */
    }
    await this.tenants.updateInstance(userId, {
      status: 'destroyed',
      containerId: null,
      containerHost: null,
    });
    await getPool().query(
      `UPDATE users SET
         bc_game_username_encrypted = NULL,
         bc_game_password_encrypted = NULL,
         bc_game_2fa_secret_encrypted = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    await this.tenants.audit({
      actorType: 'system',
      action: 'instance.destroyed',
      targetUserId: userId,
    });
  }

  async getStatus(userId: string): Promise<ContainerInfo | null> {
    const instance = await this.tenants.getInstance(userId);
    if (!instance) {
      return null;
    }
    return {
      containerId: instance.containerId ?? '',
      host: instance.containerHost ?? '',
      status: instance.status,
    };
  }

  async globalPause(): Promise<void> {
    const result = await getPool().query(
      `SELECT user_id FROM tenant_instances WHERE status = 'running'`
    );
    for (const row of result.rows) {
      await this.pause(String(row.user_id));
    }
  }

  async globalResume(): Promise<void> {
    const result = await getPool().query(
      `SELECT user_id FROM tenant_instances WHERE status = 'paused'`
    );
    for (const row of result.rows) {
      await this.resume(String(row.user_id));
    }
  }

  async healthSweep(): Promise<void> {
    const result = await getPool().query(
      `SELECT user_id FROM tenant_instances
       WHERE status = 'running'
         AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '5 minutes')`
    );
    for (const row of result.rows) {
      this.logger.warn(
        { component: 'ProcessOrchestrator', userId: row.user_id },
        'Stale heartbeat'
      );
      await this.tenants.updateInstance(String(row.user_id), { status: 'error' });
    }
  }

  async pushLoginCredentials(
    userId: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; detail?: string }> {
    try {
      const factory = this.getFactory();
      let runtime = this.activeRuntimes.get(userId);
      if (!runtime) {
        runtime = await factory.getOrCreate(userId);
        this.activeRuntimes.set(userId, runtime);
      }

      let instance = await this.tenants.getInstance(userId);
      if (!instance) {
        await this.provisionUnlocked(userId, { MODE: 'observe-only' });
      } else if (instance.status !== 'running') {
        await this.tenants.updateInstance(userId, {
          status: 'running',
          lastHeartbeat: new Date(),
        });
      }

      this.logger.info(
        { component: 'ProcessOrchestrator', userId },
        'Starting in-process BC.Game login via SessionSupervisor'
      );

      const result = await runtime.authenticate(email, password);
      password = '';

      if (result.ok && result.authenticated) {
        await this.tenants.updateInstance(userId, {
          status: 'running',
          lastHeartbeat: new Date(),
        });
        try {
          await this.tenants.updateUserStatus(userId, 'active');
        } catch {
          /* non-fatal */
        }
        this.logger.info(
          { component: 'ProcessOrchestrator', userId, detail: result.detail },
          'In-process login succeeded'
        );
        return { ok: true, detail: result.detail ?? 'AUTHENTICATED' };
      }

      this.logger.warn(
        {
          component: 'ProcessOrchestrator',
          userId,
          detail: result.detail,
          code: result.code,
        },
        'In-process login failed'
      );
      return {
        ok: false,
        detail: result.detail ?? result.code ?? 'AUTH_FAILED',
      };
    } catch (err) {
      password = '';
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        { component: 'ProcessOrchestrator', userId, error: message },
        'pushLoginCredentials (in-process) failed'
      );
      return { ok: false, detail: message };
    }
  }
}
