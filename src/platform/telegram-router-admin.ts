import type { Telegraf, Context } from 'telegraf';
import type { TenantManager } from './tenant-manager.js';
import type { ContainerOrchestrator } from './container-orchestrator.js';
import type { TenantSecretVault } from './secret-vault.js';
import type { StakeConfigurationService } from './stake/stake-config-service.js';
import type { PerformanceMonitor } from './admin/performance-monitor.js';
import type { Tenant } from './types.js';

interface TenantBotContext extends Context {
  state: {
    user?: Tenant | null;
    isAdmin?: boolean;
  };
}

export function setupAdminCommands(ctx: {
  bot: Telegraf<TenantBotContext>;
  tenants: TenantManager;
  orchestrator: ContainerOrchestrator;
  vault: TenantSecretVault;
  stakeService: StakeConfigurationService;
  performance: PerformanceMonitor;
  adminTelegramId: bigint;
}): void {
  // vault / stakeService / adminTelegramId kept on the API for future admin tools;
  // destructure only what this module uses to satisfy noUnusedLocals.
  const { bot, tenants, orchestrator, performance } = ctx;

  const requireAdmin = async (c: TenantBotContext): Promise<boolean> => {
    if (!c.state.isAdmin) return false;
    return true;
  };

  bot.command('admin_users', async (c) => {
    if (!(await requireAdmin(c))) return;
    const { getPool } = await import('../persistence/client.js');
    const q = await getPool().query(
      `SELECT u.id, u.telegram_id, u.telegram_username, u.status, p.name AS plan_name,
              i.status AS engine_status, i.pnl_total
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       LEFT JOIN tenant_instances i ON u.id = i.user_id
       ORDER BY u.created_at DESC LIMIT 50`
    );
    if (q.rows.length === 0) {
      await c.reply('No users yet.');
      return;
    }
    const lines = q.rows.map((r: Record<string, unknown>) => {
      const un = r.telegram_username ? `@${r.telegram_username}` : r.telegram_id;
      return `• ${un} | ${r.plan_name ?? '—'} | ${r.status} | Engine: ${r.engine_status ?? 'none'}`;
    });
    await c.reply(`👥 *Users (${q.rows.length})*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('admin_pause_all', async (c) => {
    if (!(await requireAdmin(c))) return;
    await orchestrator.globalPause();
    await c.reply('⏸ Global pause issued — all engines paused.');
  });

  bot.command('admin_resume_all', async (c) => {
    if (!(await requireAdmin(c))) return;
    await orchestrator.globalResume();
    await c.reply('▶️ Global resume issued.');
  });

  bot.command('admin_ban', async (c) => {
    if (!(await requireAdmin(c))) return;
    const text = 'text' in c.message! ? c.message.text : '';
    const targetId = text.split(/\s+/)[1];
    if (!targetId) {
      await c.reply('Usage: /admin_ban <telegram_id>');
      return;
    }
    const user = await tenants.getUserByTelegramId(BigInt(targetId));
    if (!user) {
      await c.reply('User not found.');
      return;
    }
    await tenants.updateUserStatus(user.id, 'banned');
    try {
      await orchestrator.destroy(user.id);
    } catch {
      /* ignore */
    }
    await c.reply(`🚫 Banned ${targetId}.`);
  });

  bot.command('admin_broadcast', async (c) => {
    if (!(await requireAdmin(c))) return;
    const text = 'text' in c.message! ? c.message.text : '';
    const msg = text.replace(/^\/admin_broadcast\s*/, '');
    if (!msg) {
      await c.reply('Usage: /admin_broadcast <message>');
      return;
    }
    const { getPool } = await import('../persistence/client.js');
    const result = await getPool().query(`SELECT telegram_id FROM users WHERE status = 'active'`);
    let sent = 0;
    for (const row of result.rows) {
      try {
        await c.telegram.sendMessage(Number(row.telegram_id), `📢 *Platform Notice*\n\n${msg}`, {
          parse_mode: 'Markdown',
        });
        sent++;
      } catch {
        /* ignore */
      }
    }
    await c.reply(`📨 Sent to ${sent}/${result.rows.length} users.`);
  });

  bot.command('admin_stats', async (c) => {
    if (!(await requireAdmin(c))) return;
    const s = await performance.getPlatformStats();
    await c.reply(
      `📊 *Platform Statistics*\n\n` +
        `👥 Users: ${s.activeUsers} active / ${s.totalUsers} total\n` +
        `🚀 Engines: ${s.activeEngines} running\n` +
        `📈 P&L Today: ${s.totalPnlToday}`,
      { parse_mode: 'Markdown' }
    );
  });
}
