/**
 * TenantResolver — Telegram identity → tenant.
 * New Telegram accounts get an isolated tenant on first contact (/start).
 */

import { TenantManager } from './tenant-manager';
import type { Tenant } from './types';
import { getLogger } from '../observability/logger';

const logger = () => getLogger().child({ component: 'TenantResolver' });

export interface ResolvedTenantContext {
  tenantId: string;
  telegramUserId: number;
  chatId: number;
  tenant: Tenant;
  created: boolean;
}

export class TenantResolver {
  constructor(private readonly tenants: TenantManager = new TenantManager()) {}

  /**
   * Load existing tenant or create one bound to this Telegram user.
   */
  async resolveOrCreateByTelegramId(
    telegramUserId: number | bigint,
    opts?: { username?: string; chatId?: number }
  ): Promise<ResolvedTenantContext> {
    const tgId = typeof telegramUserId === 'bigint' ? telegramUserId : BigInt(telegramUserId);
    const chatId = opts?.chatId ?? Number(tgId);

    let tenant = await this.tenants.getUserByTelegramId(tgId);
    let created = false;

    if (!tenant) {
      tenant = await this.tenants.createUser({
        telegramId: tgId,
        telegramUsername: opts?.username,
      });
      created = true;
      logger().info(
        { tenantId: tenant.id, telegramUserId: String(tgId) },
        'Created tenant from Telegram identity'
      );
      await this.tenants.audit({
        actorType: 'user',
        actorId: tenant.id,
        action: 'tenant.created',
        targetUserId: tenant.id,
        payload: { telegramId: String(tgId), username: opts?.username ?? null },
      });
    } else if (opts?.username && tenant.telegramUsername !== opts.username) {
      // Best-effort username sync (ignore errors)
      try {
        await this.tenants.audit({
          actorType: 'user',
          actorId: tenant.id,
          action: 'tenant.seen',
          targetUserId: tenant.id,
          payload: { username: opts.username },
        });
      } catch {
        /* ignore */
      }
    }

    return {
      tenantId: tenant.id,
      telegramUserId: Number(tgId),
      chatId,
      tenant,
      created,
    };
  }

  async resolveOnly(telegramUserId: number | bigint): Promise<Tenant | null> {
    const tgId = typeof telegramUserId === 'bigint' ? telegramUserId : BigInt(telegramUserId);
    return this.tenants.getUserByTelegramId(tgId);
  }

  async resolve(telegramUserId: number | bigint): Promise<Tenant | null> {
    return this.resolveOnly(telegramUserId);
  }
}
