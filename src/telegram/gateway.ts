/**
 * Telegram Operator Interface — Bot Gateway
 *
 * Telegraf bot initialization, webhook/polling setup, error handling,
 * and graceful shutdown. This is the entry point for all Telegram
 * operator interactions.
 */

import { Telegraf } from 'telegraf';
import { getLogger } from '../observability/logger';
import { TelegramBotConfig, OperatorContext, BotHealthStatus } from './types';
import { createAuthMiddleware } from './auth';
import { createRouter, CommandRouter, RouterDependencies } from './router';
import { TenantResolver } from '../platform/tenant-resolver';
import type { TenantRuntimeFactory } from '../platform/tenant-runtime-factory';

const logger = getLogger();

export interface TelegramGatewayOptions {
  config: TelegramBotConfig;
  tenantResolver?: TenantResolver;
  tenantRuntimeFactory?: TenantRuntimeFactory;
}

export class TelegramGateway {
  private bot: Telegraf<OperatorContext> | null = null;
  private readonly config: TelegramBotConfig;
  private readonly tenantResolver?: TenantResolver;
  private readonly tenantRuntimeFactory?: TenantRuntimeFactory;
  private health: BotHealthStatus;
  private startedAt: number = 0;
  private isRunning: boolean = false;
  private shutdownCallbacks: (() => Promise<void>)[] = [];
  private router: CommandRouter | null = null;
  private pendingDeps: RouterDependencies = {};

  constructor(options: TelegramGatewayOptions) {
    this.config = options.config;
    this.tenantResolver = options.tenantResolver;
    this.tenantRuntimeFactory = options.tenantRuntimeFactory;
    this.health = {
      connected: false,
      lastPingAt: null,
      messagesSent: 0,
      messagesDropped: 0,
      errors: 0,
      uptimeSeconds: 0,
    };
  }

  /** Inject runtime command dependencies (pause, sheath, etc.) */
  setRouterDependencies(deps: RouterDependencies): void {
    this.pendingDeps = { ...this.pendingDeps, ...deps };
    this.router?.setDependencies(this.pendingDeps);
  }

  /**
   * Initialize and start the bot (webhook or polling).
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn({ component: 'TelegramGateway' }, 'Bot already running');
      return;
    }

    logger.info({ component: 'TelegramGateway' }, 'Starting Telegram bot gateway');

    try {
      this.bot = new Telegraf<OperatorContext>(this.config.botToken);

      this.bot.use(
        createAuthMiddleware({
          adminUserIds: this.config.allowedUserIds ?? [],
          allowedUserIds: this.config.allowedUserIds,
          enforcePrivateChat: true,
        })
      );

      const tenantResolver = this.tenantResolver;
      if (tenantResolver) {
        this.bot.use(async (ctx, next) => {
          const telegramUserId = ctx.from?.id;
          if (!telegramUserId) return next();
          const resolved = await tenantResolver.resolveOrCreateByTelegramId(telegramUserId, {
            username: ctx.from?.username,
            chatId: ctx.chat?.id,
          });
          ctx.tenantId = resolved.tenantId;
          ctx.telegramUserId = resolved.telegramUserId;
          ctx.chatId = resolved.chatId;
          return next();
        });
      }

      const router = createRouter({
        verbosity: this.config.verbosity,
      });
      this.router = router;
      if (Object.keys(this.pendingDeps).length > 0) {
        router.setDependencies(this.pendingDeps);
      }
      if (this.tenantRuntimeFactory) {
        router.setDependencies({ tenantRuntimeFactory: this.tenantRuntimeFactory });
      }
      this.bot.use(router.middleware());

      this.bot.catch((err: unknown, ctx: OperatorContext) => {
        this.health.errors++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          {
            component: 'TelegramGateway',
            error: errorMsg,
            userId: ctx.from?.id,
            updateType: ctx.updateType,
          },
          'Bot error handler triggered'
        );

        if (ctx.chat?.id) {
          ctx.reply('Internal Error. An unexpected error occurred. Try /status or /menu.').catch(() => {
            /* ignore */
          });
        }
      });

      this.bot.use((_ctx, next) => {
        this.health.lastPingAt = new Date().toISOString();
        return next();
      });

      if (this.config.webhookUrl) {
        const webhookPath = new URL(this.config.webhookUrl).pathname;
        await this.bot.launch({
          webhook: {
            domain: new URL(this.config.webhookUrl).hostname,
            port: parseInt(new URL(this.config.webhookUrl).port || '443', 10),
            hookPath: webhookPath,
          },
        });
        logger.info(
          { component: 'TelegramGateway', mode: 'webhook', url: this.config.webhookUrl },
          'Bot started in webhook mode'
        );
      } else {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
        await this.bot.launch();
        logger.info({ component: 'TelegramGateway', mode: 'polling' }, 'Bot started in polling mode');
      }

      this.isRunning = true;
      this.startedAt = Date.now();
      this.health.connected = true;

      const shutdownHandler = async () => {
        await this.stop();
      };
      process.once('SIGINT', shutdownHandler);
      process.once('SIGTERM', shutdownHandler);
      this.shutdownCallbacks.push(async () => {
        process.off('SIGINT', shutdownHandler);
        process.off('SIGTERM', shutdownHandler);
      });

      logger.info({ component: 'TelegramGateway' }, 'Telegram bot gateway started successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ component: 'TelegramGateway', error: message }, 'Failed to start bot');
      this.health.errors++;
      throw new Error(`TelegramGateway start failed: ${message}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.bot) {
      return;
    }

    logger.info({ component: 'TelegramGateway' }, 'Stopping Telegram bot gateway');

    try {
      for (const cb of this.shutdownCallbacks) {
        await cb().catch(() => {});
      }

      this.bot.stop();
      this.isRunning = false;
      this.health.connected = false;

      logger.info(
        {
          component: 'TelegramGateway',
          messagesSent: this.health.messagesSent,
          errors: this.health.errors,
          uptimeSeconds: this.getUptimeSeconds(),
        },
        'Telegram bot gateway stopped'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ component: 'TelegramGateway', error: message }, 'Error stopping bot');
    }
  }

  async sendMessage(chatId: number, text: string, extra?: Record<string, unknown>): Promise<void> {
    if (!this.bot || !this.isRunning) {
      this.health.messagesDropped++;
      throw new Error('Bot not running');
    }

    try {
      await this.bot.telegram.sendMessage(chatId, text, extra);
      this.health.messagesSent++;
    } catch (error) {
      this.health.errors++;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        { component: 'TelegramGateway', chatId, error: message },
        'Failed to send message'
      );
      throw error;
    }
  }

  getHealth(): BotHealthStatus {
    return {
      ...this.health,
      uptimeSeconds: this.getUptimeSeconds(),
    };
  }

  running(): boolean {
    return this.isRunning;
  }

  getBot(): Telegraf<OperatorContext> | null {
    return this.bot;
  }

  private getUptimeSeconds(): number {
    if (!this.startedAt) return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
