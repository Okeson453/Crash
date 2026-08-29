/**
 * TenantRouterBot — multi-tenant Telegram control surface (role-aware menus).
 * Login + status paths use plain text to avoid Telegram 400 entity parse errors.
 * Auto-provisions engine when Not provisioned (Start + login password path).
 * Login guard: if session already running + account active → "Already logged in".
 */
import { Telegraf, Context } from 'telegraf';
import { getLogger } from '../observability/logger.js';
import { TenantManager } from './tenant-manager.js';
import { TenantResolver } from './tenant-resolver.js';
import {
  buildBotCommands,
  entitlementsFrom,
  roleControlKeyboard,
  helpText,
  menuHeaderText,
  settingsKeyboard,
  modeKeyboard,
  persistentReplyKeyboard,
  replyKeyboardAction,
} from './telegram-menu.js';
import { TenantSecretVault } from './secret-vault.js';
import { ContainerOrchestrator } from './container-orchestrator.js';
import { VirtualAccountService } from './payments/virtual-account-service.js';
import { TermsAndConditionsService } from './terms/terms-service.js';
import { GUIDELINES_CONTENT, GUIDELINES_VERSION } from './terms/guidelines.js';
import { StakeConfigurationService } from './stake/stake-config-service.js';
import { DailyBillingService } from './billing/daily-billing-service.js';
import { Tenant } from './types.js';
import { PerformanceMonitor } from './admin/performance-monitor.js';
import {
  beginLoginConversation,
  endLoginConversation,
  getLoginConversation,
  setLoginEmail,
  markAuthenticating,
  maskEmail,
} from '../security/ephemeral-login.js';
import { setupAdminCommands } from './telegram-router-admin.js';

interface TenantBotContext extends Context {
  state: { user?: Tenant | null; isAdmin?: boolean };
}

/** Plain-text login prompt — never use Markdown here (avoids 400 parse entities). */
const LOGIN_PROMPT =
  'BC.Game Login\n\n' +
  'Your password is used once inside your private engine browser.\n' +
  'It is never stored.\n\n' +
  'Enter your BC.Game email or phone:\n\n' +
  'Send /login_cancel to abort.';

const ALREADY_LOGGED_IN =
  '✅ Already logged in\n\n' +
  'Your session is running and active.\n' +
  'Use /status for details or /logout then /login to switch accounts.';

export class TenantRouterBot {
  private readonly bot: Telegraf<TenantBotContext>;
  private readonly logger = getLogger();
  private readonly tenants = new TenantManager();
  private readonly resolver = new TenantResolver(this.tenants);
  private readonly vault = new TenantSecretVault();
  private readonly orchestrator: ContainerOrchestrator;
  private readonly adminTelegramId: bigint;
  private readonly vaService: VirtualAccountService;
  private readonly termsService = new TermsAndConditionsService();
  private readonly stakeService = new StakeConfigurationService();
  private readonly dailyBilling = new DailyBillingService();
  private readonly performance = new PerformanceMonitor();

  constructor(botToken: string, orchestrator: ContainerOrchestrator) {
    this.bot = new Telegraf<TenantBotContext>(botToken);
    this.orchestrator = orchestrator;
    this.adminTelegramId = BigInt(process.env.ADMIN_TELEGRAM_ID ?? '0');
    this.vaService = new VirtualAccountService();
    const notify = async (telegramId: bigint, message: string) => {
      await this.bot.telegram.sendMessage(Number(telegramId), message);
    };
    this.vaService.setNotify(notify);
    this.dailyBilling.setNotify(notify);
    this.setupMiddleware();
    this.setupUserCommands();
    this.setupLoginFlow();
    this.setupMenuUiActions();
    this.setupAdminCommands();
  }

  /** Try Markdown; on parse error fall back to stripped plain text so the bot never FATALs. */
  private async safeReply(
    ctx: TenantBotContext,
    text: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    try {
      await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/parse entities|can't parse|Bad Request/i.test(msg)) {
        this.logger.warn({ error: msg }, 'Markdown parse failed — plain-text fallback');
        const plain = text.replace(/[*_`\\]/g, '');
        const opts = extra && (extra as { reply_markup?: unknown }).reply_markup
          ? { reply_markup: (extra as { reply_markup: unknown }).reply_markup }
          : undefined;
        await ctx.reply(plain, opts as any);
      } else {
        throw err;
      }
    }
  }

  /**
   * True when tenant account is active and the engine container is running.
   * Used by /login to avoid restarting an already-authenticated session.
   */
  private async isAlreadyLoggedIn(user: Tenant): Promise<boolean> {
    if (user.status !== 'active') return false;
    try {
      const inst = await this.tenants.getInstance(user.id).catch(() => null);
      const st = await this.orchestrator.getStatus(user.id).catch(() => null);
      const status = inst?.status ?? st?.status ?? 'none';
      return status === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Start login conversation, or reply "Already logged in" if session is active.
   * Shared by /login command, reply keyboard, and UI action.
   */
  private async startLoginOrNotify(ctx: TenantBotContext, user: Tenant): Promise<void> {
    const chatId = ctx.chat?.id;
    if (chatId == null) return;

    if (await this.isAlreadyLoggedIn(user)) {
      await ctx.reply(ALREADY_LOGGED_IN);
      return;
    }

    endLoginConversation(chatId);
    beginLoginConversation(chatId, user.id);
    await ctx.reply(LOGIN_PROMPT);
  }

  /**
   * Ensure tenant engine exists and is running.
   * Provisions a new container when status is missing / not provisioned / destroyed / error.
   */
  private async ensureEngineRunning(userId: string): Promise<{ ok: boolean; detail?: string; provisioned?: boolean }> {
    try {
      const st = await this.orchestrator.getStatus(userId).catch(() => null);
      const status = st?.status ?? 'none';
      const needsProvision =
        !st ||
        status === 'none' ||
        status === 'destroyed' ||
        status === 'error' ||
        !st.containerId;

      if (needsProvision) {
        this.logger.info({ component: 'TenantRouterBot', userId, prevStatus: status }, 'Provisioning tenant engine');
        await this.orchestrator.provision(userId, { MODE: 'observe-only' });
        return { ok: true, provisioned: true, detail: 'provisioned' };
      }

      if (status === 'paused' || status === 'stopped') {
        await this.orchestrator.resume(userId);
        return { ok: true, provisioned: false, detail: 'resumed' };
      }

      if (status === 'running' || status === 'provisioning') {
        return { ok: true, provisioned: false, detail: status };
      }

      try {
        await this.orchestrator.resume(userId);
        return { ok: true, provisioned: false, detail: 'resumed' };
      } catch {
        await this.orchestrator.provision(userId, { MODE: 'observe-only' });
        return { ok: true, provisioned: true, detail: 'provisioned-fallback' };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ component: 'TenantRouterBot', userId, error: message }, 'ensureEngineRunning failed');
      return { ok: false, detail: message };
    }
  }

  private async entitlementsFor(user: Tenant | null | undefined, isAdmin = false) {
    let plan = null;
    let instance = null;
    if (user?.planId) {
      try { plan = await this.tenants.getPlan(user.planId); } catch { plan = null; }
    }
    if (user?.id) {
      try { instance = await this.tenants.getInstance(user.id); } catch { instance = null; }
    }
    return entitlementsFrom(user, plan, instance, isAdmin);
  }

  private setupAdminCommands(): void {
    setupAdminCommands({
      bot: this.bot,
      tenants: this.tenants,
      orchestrator: this.orchestrator,
      vault: this.vault,
      stakeService: this.stakeService,
      performance: this.performance,
      adminTelegramId: this.adminTelegramId,
    });
  }

  private setupLoginFlow(): void {
    this.bot.command('login', async (ctx) => {
      const user = ctx.state.user;
      if (!user) {
        await ctx.reply("You don't have an account. Use /start to register.");
        return;
      }
      await this.startLoginOrNotify(ctx, user);
    });

    this.bot.command('login_cancel', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (chatId != null) endLoginConversation(chatId);
      await ctx.reply('Login cancelled. No credentials retained.');
    });

    this.bot.on('text', async (ctx, next) => {
      const chatId = ctx.chat?.id;
      if (chatId == null) return next();
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return next();
      const conv = getLoginConversation(chatId);
      const inLogin = !!(conv && conv.step !== 'idle' && conv.step !== 'authenticating');
      if (!inLogin) {
        const action = replyKeyboardAction(text);
        if (action) {
          const user = ctx.state.user ?? (await this.tenants.getUserByTelegramId(BigInt(chatId)));
          if (!user) {
            await ctx.reply('Use /start first.');
            return;
          }
          if (action === 'login') {
            await this.startLoginOrNotify(ctx, user);
            return;
          }
          if (action === 'menu' || action === 'admin_menu') {
            const isAdminAction = action === 'admin_menu' || !!ctx.state.isAdmin;
            const ent = await this.entitlementsFor(user, isAdminAction);
            await this.safeReply(ctx, menuHeaderText(user, ent), {
              reply_markup: persistentReplyKeyboard(ent),
            });
            await this.safeReply(ctx, '_Detail panel_', {
              reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
            });
            return;
          }
          if (action === 'status') {
            const inst = await this.tenants.getInstance(user.id).catch(() => null);
            const st = await this.orchestrator.getStatus(user.id).catch(() => null);
            await ctx.reply(
              [
                'Dashboard',
                `Tenant: ${user.id.slice(0, 8)}…`,
                `Status: ${user.status}`,
                `Engine: ${inst?.status ?? st?.status ?? 'none'}`,
                `Mode: ${inst?.mode ?? 'n/a'}`,
                `P&L today: ${inst?.pnlToday ?? 0}`,
                `Balance: —`,
                '',
                'Buttons stay at the bottom.',
              ].join('\n')
            );
            return;
          }
          if (action === 'help') {
            const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
            await this.safeReply(ctx, helpText(ent));
            return;
          }
          if (action === 'startengine') {
            try {
              const eng = await this.ensureEngineRunning(user.id);
              if (!eng.ok) {
                await ctx.reply(`Could not start engine: ${eng.detail ?? 'unknown'}`);
              } else if (eng.provisioned) {
                await ctx.reply('Engine provisioned and starting. Wait ~20s then /status or /login.');
              } else {
                await ctx.reply('Engine start/resume requested.');
              }
            } catch (err) { await ctx.reply(String(err)); }
            return;
          }
          if (action === 'pause' || action === 'stop') {
            try { await this.orchestrator.pause(user.id); await ctx.reply(action === 'stop' ? 'Stop requested.' : 'Pause requested.'); }
            catch (err) { await ctx.reply(String(err)); }
            return;
          }
          if (action === 'resume') {
            try { await this.orchestrator.resume(user.id); await ctx.reply('Resume requested.'); }
            catch (err) { await ctx.reply(String(err)); }
            return;
          }
          if (action === 'settings') {
            const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
            await this.safeReply(ctx, '⚙️ *Settings*', {
              reply_markup: { inline_keyboard: settingsKeyboard(ent) },
            });
            return;
          }
          await ctx.reply(`Use /${action} for details.`);
          return;
        }
        return next();
      }
      try { await ctx.deleteMessage(); } catch { /* ignore */ }
      const user = ctx.state.user ?? (await this.tenants.getUserByTelegramId(BigInt(chatId)));
      if (!user) {
        endLoginConversation(chatId);
        await ctx.reply('Session expired. /start again.');
        return;
      }
      if (conv!.step === 'awaiting_email') {
        if (text.length < 3) {
          await ctx.reply('Please enter a valid email or phone.');
          return;
        }
        setLoginEmail(chatId, text);
        await ctx.reply('Enter your BC.Game password:\n\n(Message will be deleted when possible.)');
        return;
      }
      if (conv!.step === 'awaiting_password') {
        const email = conv!.email ?? '';
        let password = text;
        markAuthenticating(chatId);
        await ctx.reply('Preparing engine and authenticating with BC.Game…');
        try {
          const eng = await this.ensureEngineRunning(user.id);
          if (!eng.ok) {
            password = '';
            endLoginConversation(chatId);
            await ctx.reply(
              `Could not start engine: ${eng.detail ?? 'unknown'}.\nTap Start, wait ~30s, then /login again.`
            );
            return;
          }
          if (eng.provisioned) {
            await ctx.reply('Engine provisioned. Submitting credentials…');
            await new Promise((r) => setTimeout(r, 4000));
          }
          const pushed = await this.orchestrator.pushLoginCredentials(user.id, email, password);
          password = '';
          endLoginConversation(chatId);
          if (!pushed.ok) {
            await ctx.reply(
              `Could not deliver login${pushed.detail ? `: ${pushed.detail}` : ''}.\nTap Start, wait for Engine: running, then /login again.`
            );
            return;
          }
          await ctx.reply(
            `Login credentials submitted securely.\nAccount: ${maskEmail(email)}\nEngine: ${eng.provisioned ? 'just started' : 'running'}\nUse /status in 10–20 seconds to verify.`
          );
        } catch (err) {
          password = '';
          endLoginConversation(chatId);
          await ctx.reply(`Login failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  }

  private setupMenuUiActions(): void {
    this.bot.action(/^ui:(.+)$/, async (ctx) => {
      const action = ctx.match[1];
      const user = ctx.state.user;
      await ctx.answerCbQuery().catch(() => undefined);
      if (!user) {
        await ctx.reply('Use /start first.');
        return;
      }
      if (action === 'menu') {
        const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
        await this.safeReply(ctx, menuHeaderText(user, ent), {
          reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
        });
        return;
      }
      if (action === 'settings') {
        const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
        await this.safeReply(ctx, '⚙️ *Settings*', {
          reply_markup: { inline_keyboard: settingsKeyboard(ent) },
        });
        return;
      }
      if (action === 'mode' || action.startsWith('mode_set:')) {
        if (action.startsWith('mode_set:')) {
          const mode = action.slice('mode_set:'.length);
          await this.tenants.updateInstance(user.id, { mode });
          await ctx.reply(`Mode set to ${mode}`);
          return;
        }
        const plan = user.planId ? await this.tenants.getPlan(user.planId).catch(() => null) : null;
        const modes = plan?.allowedModes ?? ['observe-only', 'dry-run', 'live'];
        await this.safeReply(ctx, '🛠 *Operating mode*', {
          reply_markup: { inline_keyboard: modeKeyboard(modes) },
        });
        return;
      }
      if (action.startsWith('admin_')) {
        if (!ctx.state.isAdmin) {
          await ctx.reply('Admin only.');
          return;
        }
        if (action === 'admin_menu' || action === 'admin_platform') {
          const ent = await this.entitlementsFor(user, true);
          await this.safeReply(ctx, menuHeaderText(user, ent), {
            reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
          });
          return;
        }
        if (action === 'admin_pause_all') {
          await this.orchestrator.globalPause();
          await ctx.reply('Global pause issued.');
          return;
        }
        if (action === 'admin_resume_all') {
          await this.orchestrator.globalResume();
          await ctx.reply('Global resume issued.');
          return;
        }
        if (action === 'admin_users') {
          await ctx.reply('Use /admin_users for the full list.');
          return;
        }
        if (action === 'admin_broadcast_hint') {
          await ctx.reply('Usage: /admin_broadcast <message>');
          return;
        }
        if (action === 'admin_ban_hint') {
          await ctx.reply('Usage: /admin_ban <telegram_id>');
          return;
        }
      }
      if (action === 'login') {
        await this.startLoginOrNotify(ctx, user);
        return;
      }
      if (action === 'help') {
        const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
        await this.safeReply(ctx, helpText(ent));
        return;
      }
      if (action === 'startengine') {
        try {
          const eng = await this.ensureEngineRunning(user.id);
          if (!eng.ok) {
            await ctx.reply(`Could not start engine: ${eng.detail ?? 'unknown'}`);
          } else if (eng.provisioned) {
            await ctx.reply('Engine provisioned and starting. Wait ~20s then /status or /login.');
          } else {
            await ctx.reply('Engine start/resume requested.');
          }
        } catch (err) {
          await ctx.reply(String(err));
        }
        return;
      }
      if (action === 'pause' || action === 'stop') {
        try {
          await this.orchestrator.pause(user.id);
          await ctx.reply(action === 'stop' ? 'Stop requested.' : 'Pause requested.');
        } catch (err) {
          await ctx.reply(String(err));
        }
        return;
      }
      if (action === 'resume') {
        try {
          await this.orchestrator.resume(user.id);
          await ctx.reply('Resume requested.');
        } catch (err) {
          await ctx.reply(String(err));
        }
        return;
      }
      if (action === 'status') {
        const inst = await this.tenants.getInstance(user.id).catch(() => null);
        const st = await this.orchestrator.getStatus(user.id).catch(() => null);
        await ctx.reply(
          [
            'Dashboard',
            `Tenant: ${user.id.slice(0, 8)}…`,
            `Status: ${user.status}`,
            `Engine: ${inst?.status ?? st?.status ?? 'none'}`,
            `Mode: ${inst?.mode ?? 'n/a'}`,
            `P&L today: ${inst?.pnlToday ?? 0}`,
            `Balance: —`,
            '',
            'Open /menu for controls.',
          ].join('\n')
        );
        return;
      }
      if (action === 'pnl') {
        const inst = await this.tenants.getInstance(user.id).catch(() => null);
        await ctx.reply(`P&L today: ${inst?.pnlToday ?? 0} | total: ${inst?.pnlTotal ?? 0}`);
        return;
      }
      if (action === 'entries') {
        const inst = await this.tenants.getInstance(user.id).catch(() => null);
        await ctx.reply(`Entries today: ${inst?.dailyEntriesUsed ?? 0}`);
        return;
      }
      if (['balance', 'analytics', 'session', 'health', 'subscribe', 'stake', 'logout', 'sheath'].includes(action)) {
        await ctx.reply(`Use /${action === 'sheath' ? 'sheath' : action} for details.`);
        return;
      }
      await ctx.reply('Unknown action.');
    });
  }

  private setupMiddleware(): void {
    this.bot.use(async (ctx, next) => {
      const chatId = ctx.chat?.id;
      if (chatId == null) return;
      if (ctx.chat?.type && ctx.chat.type !== 'private') {
        await ctx.reply('Commands are only accepted in private chats.');
        return;
      }
      const telegramUserId = ctx.from?.id ?? chatId;
      const isPlatformAdmin =
        this.adminTelegramId !== 0n && BigInt(chatId) === this.adminTelegramId;
      const resolved = await this.resolver.resolveOrCreateByTelegramId(telegramUserId, {
        username: ctx.from?.username,
        chatId,
      });
      const user = resolved.tenant;
      ctx.state.isAdmin = isPlatformAdmin;
      ctx.state.user = user;
      if (user.status === 'suspended' || user.status === 'banned') {
        await ctx.reply('Your account is suspended. Contact support.');
        return;
      }
      await next();
    });
  }

  private setupUserCommands(): void {
    this.bot.command('start', async (ctx) => {
      const user = ctx.state.user;
      if (!user) {
        await ctx.reply('Unable to resolve your account. Try again.');
        return;
      }
      const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
      try {
        await this.bot.telegram.setMyCommands(buildBotCommands(ent), {
          scope: { type: 'chat', chat_id: ctx.chat!.id },
        });
      } catch { /* ignore */ }
      const termsOk = await this.termsService.hasUserAcceptedTerms(user.id);
      if (!termsOk) {
        const active = await this.termsService.getActiveTerms();
        if (active) {
          await this.safeReply(
            ctx,
            `📜 *Terms & Conditions*\n\nVersion: \`${active.version}\`\n\n${active.content.slice(0, 3000)}\n\n_You must accept before continuing._`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✅ I Accept Terms & Conditions', callback_data: `accept_terms:${active.version}` }],
                  [{ text: '❌ Decline', callback_data: 'decline_terms' }],
                ],
              },
            }
          );
          return;
        }
      }
      const guidelinesOk = await this.termsService.hasUserAcceptedGuidelines(user.id);
      if (!guidelinesOk) {
        await this.safeReply(ctx, GUIDELINES_CONTENT, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ I Understand Guidelines', callback_data: `accept_guidelines:${GUIDELINES_VERSION}` }],
              [{ text: '❌ Decline', callback_data: 'decline_guidelines' }],
            ],
          },
        });
        return;
      }
      await this.safeReply(ctx, menuHeaderText(user, ent), {
        reply_markup: persistentReplyKeyboard(ent),
      });
      await this.safeReply(ctx, '_Tap a tile below or use the permanent buttons._', {
        reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
      });
    });

    this.bot.command('menu', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
      await this.safeReply(ctx, menuHeaderText(user, ent), {
        reply_markup: persistentReplyKeyboard(ent),
      });
      await this.safeReply(ctx, '_Detail panel_', {
        reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
      });
    });

    this.bot.command('admin_menu', async (ctx) => {
      if (!ctx.state.isAdmin) return;
      const user = ctx.state.user;
      const ent = await this.entitlementsFor(user, true);
      await this.safeReply(ctx, menuHeaderText(user ?? null, ent), {
        reply_markup: persistentReplyKeyboard(ent),
      });
      await this.safeReply(ctx, '_Admin panel_', {
        reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
      });
    });

    this.bot.command('help', async (ctx) => {
      const ent = await this.entitlementsFor(ctx.state.user, !!ctx.state.isAdmin);
      await this.safeReply(ctx, helpText(ent));
    });

    this.bot.command('logout', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (chatId != null) endLoginConversation(chatId);
      await ctx.reply('Local login conversation cleared. Use /login to reconnect.');
    });

    this.bot.command('dashboard', async (ctx) => {
      const user = ctx.state.user;
      if (!user) {
        await ctx.reply('Not registered. Use /start.');
        return;
      }
      try {
        const instance = await this.tenants.getInstance(user.id);
        const plan = user.planId ? await this.tenants.getPlan(user.planId) : null;
        await ctx.reply(
          [
            'Dashboard',
            `Plan: ${plan?.name ?? 'None'}`,
            `Account: ${user.status}`,
            `Engine: ${instance?.status ?? 'Not provisioned'}`,
            `Mode: ${instance?.mode ?? '-'}`,
            `Daily: ${instance?.dailyEntriesUsed ?? 0}/${plan?.maxDailyEntries ?? 0}`,
            `P&L today: ${instance?.pnlToday ?? 0}`,
            `Balance: —`,
            '',
            'Open /menu for controls.',
          ].join('\n')
        );
      } catch (err) {
        await ctx.reply(`Dashboard error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    this.bot.command('status', async (ctx) => {
      const user = ctx.state.user;
      if (!user) {
        await ctx.reply('Not registered. Use /start.');
        return;
      }
      const instance = await this.tenants.getInstance(user.id);
      const plan = user.planId ? await this.tenants.getPlan(user.planId) : null;
      await ctx.reply(
        [
          'Engine Status',
          `Plan: ${plan?.name ?? 'None'}`,
          `Account: ${user.status}`,
          `Engine: ${instance?.status ?? 'Not provisioned'}`,
          `Mode: ${instance?.mode ?? '-'}`,
          `Daily: ${instance?.dailyEntriesUsed ?? 0}/${plan?.maxDailyEntries ?? 0}`,
          `P&L today: ${instance?.pnlToday ?? 0}`,
          `Balance: —`,
        ].join('\n')
      );
    });

    this.bot.command('startengine', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      try {
        const eng = await this.ensureEngineRunning(user.id);
        if (!eng.ok) {
          await ctx.reply(`Could not start: ${eng.detail ?? 'unknown'}`);
        } else if (eng.provisioned) {
          await ctx.reply('Engine provisioned and starting. Wait ~20s then /status or /login.');
        } else {
          await ctx.reply('Engine start/resume requested.');
        }
      } catch (err) {
        await ctx.reply(`Could not start: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    this.bot.command('pause', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      await this.orchestrator.pause(user.id);
      await ctx.reply('Engine paused. /resume to continue.');
    });

    this.bot.command('resume', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      await this.orchestrator.resume(user.id);
      await ctx.reply('Engine resumed.');
    });

    this.bot.command('stop', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      try {
        await this.orchestrator.pause(user.id);
        await ctx.reply('Engine stop/pause requested.');
      } catch (err) {
        await ctx.reply(String(err));
      }
    });

    this.bot.command('mode', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const plan = user.planId ? await this.tenants.getPlan(user.planId) : null;
      const text = 'text' in ctx.message! ? ctx.message.text : '';
      const requested = text.split(/\s+/)[1];
      if (!requested) {
        const instance = await this.tenants.getInstance(user.id);
        await ctx.reply(`Current: ${instance?.mode ?? '—'}\nUsage: /mode <observe-only|dry-run|live>`);
        return;
      }
      if (plan && !plan.allowedModes.includes(requested) && !ctx.state.isAdmin) {
        await ctx.reply(`Mode '${requested}' not allowed on ${plan.name} plan.`);
        return;
      }
      await this.tenants.updateInstance(user.id, { mode: requested });
      await ctx.reply(`Mode set to ${requested}`);
    });

    this.bot.command('subscribe', async (ctx) => {
      const plans = await this.tenants.listActivePlans();
      const lines = plans.map((p) => {
        const cycle = p.billingCycle === 'daily' ? '/day' : '/mo';
        return `• ${p.name} — ₦${p.priceMonthly.toLocaleString()}${cycle}`;
      });
      await ctx.reply(`Plans\n\n${lines.join('\n')}`);
    });

    this.bot.command('balance', async (ctx) => {
      const user = ctx.state.user;
      if (!user) { await ctx.reply('Not registered. Use /start.'); return; }
      const inst = await this.tenants.getInstance(user.id).catch(() => null);
      await ctx.reply(
        ['Balance', `Current: —`, `P&L today: ${inst?.pnlToday ?? 0}`, `P&L total: ${inst?.pnlTotal ?? 0}`, '', 'Balance fills in when the engine is live on BC.Game.'].join('\n')
      );
    });
    this.bot.command('pnl', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const inst = await this.tenants.getInstance(user.id).catch(() => null);
      await ctx.reply(`P&L\nToday: ${inst?.pnlToday ?? 0}\nTotal: ${inst?.pnlTotal ?? 0}`);
    });
    this.bot.command('daily', async (ctx) => {
      await ctx.reply('Daily summary: use /status or /analytics.');
    });
    this.bot.command('entries', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const inst = await this.tenants.getInstance(user.id).catch(() => null);
      await ctx.reply(`Entries today: ${inst?.dailyEntriesUsed ?? 0}`);
    });
    this.bot.command('session', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const inst = await this.tenants.getInstance(user.id).catch(() => null);
      await ctx.reply(
        `Session\nTenant: ${user.id.slice(0, 8)}…\nEngine: ${inst?.status ?? 'none'}\nMode: ${inst?.mode ?? 'n/a'}`
      );
    });
    this.bot.command('health', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const st = await this.orchestrator.getStatus(user.id).catch(() => null);
      await ctx.reply(`Health\nContainer: ${st?.status ?? 'unknown'}\nHost: ${st?.host ?? 'n/a'}`);
    });
    this.bot.command('analytics', async (ctx) => {
      const user = ctx.state.user;
      if (!user) return;
      const plan = user.planId ? await this.tenants.getPlan(user.planId) : null;
      const perf = await this.performance.getUserPerformance(user.id, plan?.maxDailyEntries ?? 100);
      if (!perf) {
        await ctx.reply('No performance data yet.');
        return;
      }
      await ctx.reply(
        `Analytics\nP&L Today: ${perf.pnlToday}\nWin Rate: ${perf.winRate.toFixed(1)}%\nEntries: ${perf.entriesUsed}/${perf.entriesLimit}`
      );
    });

    this.bot.action(/accept_terms:(.+)/, async (ctx) => {
      const version = ctx.match[1];
      const user = ctx.state.user;
      if (!user) return;
      await this.termsService.acceptTerms({ userId: user.id, version, userAgent: 'Telegram Bot' });
      await ctx.answerCbQuery('Terms accepted');
      await this.safeReply(ctx, GUIDELINES_CONTENT, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ I Understand Guidelines', callback_data: `accept_guidelines:${GUIDELINES_VERSION}` }],
          ],
        },
      });
    });
    this.bot.action('decline_terms', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('You must accept the Terms to use CrashWave. Send /start when ready.');
    });
    this.bot.action(/accept_guidelines:(.+)/, async (ctx) => {
      const version = ctx.match[1];
      const user = ctx.state.user;
      if (!user) return;
      await this.termsService.acceptGuidelines({ userId: user.id, version, userAgent: 'Telegram Bot' });
      await ctx.answerCbQuery('Guidelines accepted');
      const ent = await this.entitlementsFor(user, !!ctx.state.isAdmin);
      await this.safeReply(ctx, menuHeaderText(user, ent), {
        reply_markup: { inline_keyboard: roleControlKeyboard(ent) },
      });
    });
    this.bot.action('decline_guidelines', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('You must accept the guidelines. Send /start when ready.');
    });

    this.bot.action(/plan:(.+)/, async (ctx) => {
      const planId = ctx.match[1];
      const chatId = BigInt(ctx.chat!.id);
      let user = await this.tenants.getUserByTelegramId(chatId);
      if (!user) {
        user = await this.tenants.createUser({ telegramId: chatId, telegramUsername: ctx.from?.username });
      }
      await this.tenants.assignPlan(user.id, planId);
      await this.tenants.updateUserStatus(user.id, 'onboarding');
      const plan = await this.tenants.getPlan(planId);
      await ctx.reply(`Plan ${plan?.name ?? planId} selected. Use /subscribe for payment options.`);
      await ctx.answerCbQuery();
    });
  }

  async start(): Promise<void> {
    const defaultEnt = entitlementsFrom(null, null, null, false);
    const cmds = buildBotCommands({
      ...defaultEnt,
      canLogin: true,
      canControlEngine: true,
      canViewAnalytics: true,
    });
    try {
      await this.bot.telegram.setMyCommands(cmds);
    } catch (err) {
      this.logger.warn({ error: String(err) }, 'Failed to register bot commands');
    }
    await this.bot.launch();
    this.logger.info({ component: 'TenantRouterBot' }, 'Multi-tenant bot started');
  }

  async stop(): Promise<void> {
    this.bot.stop('shutdown');
  }

  getBot(): Telegraf<TenantBotContext> {
    return this.bot;
  }

  async sendMessage(chatId: number | bigint, text: string): Promise<void> {
    await this.bot.telegram.sendMessage(Number(chatId), text);
  }
}
