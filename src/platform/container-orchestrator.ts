/**
 * ContainerOrchestrator — provision / pause / resume / destroy tenant engines.
 *
 * Backends:
 *   - docker (default when docker binary available or ORCHESTRATOR_BACKEND=docker)
 *   - process (in-process Playwright when Docker unavailable)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

import { getLogger } from '../observability/logger.js';
import { getPool } from '../persistence/client.js';

import { TenantManager } from './tenant-manager.js';
import { TenantSecretVault } from './secret-vault.js';
import { Plan } from './types.js';
import { mkdir, writeFile, chmod, unlink } from 'fs/promises';
import { join } from 'path';
import { ProcessOrchestrator } from './process-orchestrator.js';

const execFileAsync = promisify(execFile);

export interface ContainerInfo {
  containerId: string;
  host: string;
  status: 'provisioning' | 'running' | 'paused' | 'error' | 'stopped' | 'destroyed';
}

export interface ProvisionOptions {
  FIXED_STAKE?: string;
  FIXED_TARGET?: string;
  MAX_DAILY_ENTRIES?: string;
  MODE?: string;
}

export interface ContainerOrchestrator {
  provision(userId: string, opts?: ProvisionOptions): Promise<ContainerInfo>;
  pause(userId: string): Promise<void>;
  resume(userId: string): Promise<void>;
  destroy(userId: string): Promise<void>;
  getStatus(userId: string): Promise<ContainerInfo | null>;
  globalPause(): Promise<void>;
  globalResume(): Promise<void>;
  healthSweep(): Promise<void>;
  pushLoginCredentials(userId: string, email: string, password: string): Promise<{ ok: boolean; detail?: string }>;
}

function envFlag(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}'], {
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function buildTenantEnv(
  userId: string,
  opts?: ProvisionOptions
): Promise<Record<string, string>> {
  const tenants = new TenantManager();
  const user = await tenants.getUserById(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  let plan: Plan | null = null;
  if (user.planId) {
    plan = await tenants.getPlan(user.planId);
  }

  let customStake: number | null = null;
  try {
    const stakeRow = await getPool().query('SELECT custom_stake FROM users WHERE id = $1', [userId]);
    if (stakeRow.rows[0]?.custom_stake != null) {
      customStake = parseFloat(String(stakeRow.rows[0].custom_stake));
    }
  } catch {
    customStake = null;
  }

  return {
    TENANT_ID: userId,
    MODE: opts?.MODE ?? 'observe-only',
    FIXED_STAKE: opts?.FIXED_STAKE ?? String(customStake ?? plan?.fixedStake ?? 700),
    CUSTOM_STAKE: String(customStake ?? plan?.fixedStake ?? 700),
    FIXED_TARGET: opts?.FIXED_TARGET ?? String(plan?.fixedTarget ?? 1.3),
    MAX_DAILY_ENTRIES: opts?.MAX_DAILY_ENTRIES ?? String(plan?.maxDailyEntries ?? 100),
    TELEGRAM_CHAT_ID: user.telegramId.toString(),
    REDIS_KEY_PREFIX: `tenant:${userId}:`,
    DATABASE_URL: envFlag('DATABASE_URL'),
    REDIS_URL: envFlag('REDIS_URL'),
    TELEGRAM_BOT_TOKEN: envFlag('TENANT_TELEGRAM_BOT_TOKEN', envFlag('TELEGRAM_BOT_TOKEN')),
    NODE_ENV: envFlag('NODE_ENV', 'production'),
  };
}

async function prepareCredentialFile(userId: string): Promise<string | null> {
  const vault = new TenantSecretVault();
  try {
    const creds = await vault.decryptForContainer(userId);
    const dir = envFlag('TENANT_SECRET_DIR', '/run/crashwave/secrets');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, `${userId}.json`);
    await writeFile(path, JSON.stringify(creds), { encoding: 'utf8', mode: 0o600 });
    await chmod(path, 0o600);
    return path;
  } catch {
    return null;
  }
}

/** Docker-backed orchestrator using the Docker CLI. */
export class DockerContainerOrchestrator implements ContainerOrchestrator {
  private readonly logger = getLogger();
  private readonly tenants = new TenantManager();
  private readonly lifecycleLocks = new Map<string, Promise<void>>();
  private readonly image: string;
  private readonly network: string;
  private readonly namePrefix: string;

  constructor() {
    this.image = envFlag('TENANT_ENGINE_IMAGE', 'bc-crash-automation:latest');
    this.network = envFlag('TENANT_DOCKER_NETWORK', 'crashwave_tenants');
    this.namePrefix = envFlag('TENANT_CONTAINER_PREFIX', 'tenant-engine');
  }

  private containerName(userId: string): string {
    return `${this.namePrefix}-${userId.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40)}`;
  }

  private async docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync('docker', args, {
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      return { stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      throw new Error(`docker ${args[0]} failed: ${e.stderr || e.message || String(err)}`);
    }
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
    await this.tenants.updateInstance(userId, { status: 'provisioning' });
    const name = this.containerName(userId);
    try {
      await this.docker(['rm', '-f', name]);
    } catch {
      /* none */
    }
    const env = await buildTenantEnv(userId, opts);
    const credentialFile = await prepareCredentialFile(userId);
    const envArgs = Object.entries(env)
      .filter(([, v]) => v != null && v !== '')
      .flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const volume = `tenant-profile-${userId}`;
    try {
      await this.docker(['network', 'inspect', this.network]);
    } catch {
      await this.docker([
        'network',
        'create',
        '--driver',
        'bridge',
        '--opt',
        'com.docker.network.bridge.enable_icc=false',
        this.network,
      ]);
    }
    const args = [
      'run',
      '-d',
      '--name',
      name,
      '--restart',
      'unless-stopped',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges:true',
      '--memory',
      envFlag('TENANT_MEMORY_LIMIT', '1g'),
      '--cpus',
      envFlag('TENANT_CPU_LIMIT', '0.5'),
      '--network',
      this.network,
      '-v',
      `${volume}:/data/browser-profile`,
      ...(credentialFile
        ? ['--mount', `type=bind,src=${credentialFile},dst=/run/secrets/bcgame.json,readonly`]
        : []),
      ...(credentialFile ? ['-e', 'BCGAME_CREDENTIALS_FILE=/run/secrets/bcgame.json'] : []),
      ...envArgs,
      this.image,
    ];
    try {
      const { stdout } = await this.docker(args);
      const containerId = stdout.trim().slice(0, 64);
      await this.tenants.updateInstance(userId, {
        containerId,
        containerHost: name,
        status: 'running',
        mode: opts?.MODE ?? 'observe-only',
        lastHeartbeat: new Date(),
      });
      await this.tenants.audit({
        actorType: 'system',
        action: 'instance.provisioned',
        targetUserId: userId,
        payload: { containerId, name, backend: 'docker' },
      });
      this.logger.info(
        { component: 'DockerContainerOrchestrator', userId, containerId, name },
        'Tenant container provisioned'
      );
      return { containerId, host: name, status: 'running' };
    } catch (err) {
      await this.tenants.updateInstance(userId, { status: 'error' });
      await this.tenants.audit({
        actorType: 'system',
        action: 'instance.provision_failed',
        targetUserId: userId,
        payload: { error: String(err) },
      });
      throw err;
    }
  }

  async pause(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.pauseUnlocked(userId));
  }

  private async pauseUnlocked(userId: string): Promise<void> {
    const instance = await this.tenants.getInstance(userId);
    if (!instance?.containerId && !instance?.containerHost) {
      await this.tenants.updateInstance(userId, { status: 'paused' });
      return;
    }
    const name = instance.containerHost || this.containerName(userId);
    try {
      await this.docker(['pause', name]);
      await this.tenants.updateInstance(userId, { status: 'paused' });
      await this.tenants.audit({ actorType: 'system', action: 'instance.paused', targetUserId: userId });
    } catch (err) {
      await this.tenants.updateInstance(userId, { status: 'error' });
      throw err;
    }
  }

  async resume(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.resumeUnlocked(userId));
  }

  private async resumeUnlocked(userId: string): Promise<void> {
    const instance = await this.tenants.getInstance(userId);
    const name = instance?.containerHost || this.containerName(userId);
    try {
      try {
        await this.docker(['unpause', name]);
      } catch {
        await this.docker(['start', name]);
      }
    } catch (err) {
      throw err;
    }
    await this.tenants.updateInstance(userId, { status: 'running', lastHeartbeat: new Date() });
    await this.tenants.audit({ actorType: 'system', action: 'instance.resumed', targetUserId: userId });
  }

  async destroy(userId: string): Promise<void> {
    return this.withTenantLock(userId, () => this.destroyUnlocked(userId));
  }

  private async destroyUnlocked(userId: string): Promise<void> {
    const instance = await this.tenants.getInstance(userId);
    const name = instance?.containerHost || this.containerName(userId);
    try {
      await this.docker(['rm', '-f', name]);
    } catch {
      /* already gone */
    }
    await this.tenants.updateInstance(userId, {
      status: 'destroyed',
      containerId: null,
      containerHost: null,
    });
    try {
      await unlink(join(envFlag('TENANT_SECRET_DIR', '/run/crashwave/secrets'), `${userId}.json`));
    } catch {
      /* already absent */
    }
    await getPool().query(
      `UPDATE users SET bc_game_username_encrypted = NULL, bc_game_password_encrypted = NULL,
         bc_game_2fa_secret_encrypted = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    await this.tenants.audit({ actorType: 'system', action: 'instance.destroyed', targetUserId: userId });
  }

  async getStatus(userId: string): Promise<ContainerInfo | null> {
    const instance = await this.tenants.getInstance(userId);
    if (!instance) return null;
    return {
      containerId: instance.containerId ?? '',
      host: instance.containerHost ?? '',
      status: instance.status,
    };
  }

  async globalPause(): Promise<void> {
    const result = await getPool().query(`SELECT user_id FROM tenant_instances WHERE status = 'running'`);
    for (const row of result.rows) await this.pause(String(row.user_id));
  }

  async globalResume(): Promise<void> {
    const result = await getPool().query(`SELECT user_id FROM tenant_instances WHERE status = 'paused'`);
    for (const row of result.rows) await this.resume(String(row.user_id));
  }

  async healthSweep(): Promise<void> {
    const result = await getPool().query(
      `SELECT user_id, container_host, status FROM tenant_instances
       WHERE status = 'running'
         AND (last_heartbeat IS NULL OR last_heartbeat < NOW() - INTERVAL '5 minutes')`
    );
    for (const row of result.rows) {
      const userId = String(row.user_id);
      if (String(row.status) !== 'running') continue;
      const name = String(row.container_host || this.containerName(userId));
      try {
        const { stdout } = await this.docker(['inspect', '-f', '{{.State.Status}}', name]);
        const dockerStatus = stdout.trim();
        if (dockerStatus === 'paused' || dockerStatus === 'exited') {
          await this.tenants.updateInstance(userId, { status: 'error' });
          continue;
        }
        await this.docker(['restart', name]);
        await this.tenants.updateInstance(userId, { lastHeartbeat: new Date() });
      } catch {
        await this.tenants.updateInstance(userId, { status: 'error' });
      }
    }
  }

  async pushLoginCredentials(
    userId: string,
    email: string,
    password: string
  ): Promise<{ ok: boolean; detail?: string }> {
    const name = this.containerName(userId);
    const payload = JSON.stringify({
      email,
      password,
      createdAt: new Date().toISOString(),
      once: true,
    });
    try {
      await execFileAsync(
        'docker',
        ['exec', '-i', name, 'sh', '-c', 'cat > /tmp/crashwave-login-once.json && chmod 600 /tmp/crashwave-login-once.json'],
        { timeout: 15_000, maxBuffer: 64 * 1024, input: payload } as any
      );
      try {
        await this.docker(['exec', name, 'sh', '-c', 'echo 1 > /tmp/crashwave-login-once.flag']);
      } catch {
        /* ignore */
      }
      this.logger.info({ component: 'DockerOrchestrator', userId }, 'One-shot login credentials pushed');
      return { ok: true };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    } finally {
      password = '';
    }
  }
}

export { ProcessOrchestrator } from './process-orchestrator.js';

export async function createContainerOrchestrator(): Promise<ContainerOrchestrator> {
  const backend = (process.env.ORCHESTRATOR_BACKEND ?? 'auto').toLowerCase();
  if (backend === 'process') {
    getLogger().warn(
      { component: 'ContainerOrchestrator' },
      'ORCHESTRATOR_BACKEND=process — in-process Playwright engines (no Docker isolation)'
    );
    return new ProcessOrchestrator();
  }
  if (backend === 'docker') {
    return new DockerContainerOrchestrator();
  }
  if (await dockerAvailable()) {
    return new DockerContainerOrchestrator();
  }
  getLogger().warn(
    { component: 'ContainerOrchestrator' },
    'Docker unavailable — using in-process ProcessOrchestrator (real browser login in control-plane)'
  );
  return new ProcessOrchestrator();
}

/** @deprecated use createContainerOrchestrator */
export const LocalStubOrchestrator = ProcessOrchestrator;
