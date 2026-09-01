import type { CommandHandler, CommandResult, OperatorContext } from '../types';
import type { RouterDependencies } from '../router';

/** Plain text — no Markdown (avoids Telegram 400 parse entities). */
const MENU_TEXT = [
  '🚀 CrashWave Operator Bot',
  '',
  'Primary control plane (Telegram commands).',
  '',
  '— Getting started —',
  '/start  · this menu',
  '/menu   · same as start',
  '/help   · command list',
  '/login  · connect BC.Game (secure)',
  '',
  '— Status —',
  '/status /balance /daily /session',
  '/pnl /entries /health /lastround',
  '',
  '— Control —',
  '/pause /resume /stop /emergencystop',
  '/mode /sheath /unsheath',
  '',
  '— Config & analytics —',
  '/config /analytics',
  '',
  'Tip: type / and pick a command from Telegram’s menu.',
  'Passwords are never stored or logged.',
].join('\n');

const HELP_TEXT = [
  'CrashWave — all bot commands',
  '',
  'Status:   /status /balance /daily /session /pnl /entries /health /lastround',
  'Control:  /pause /resume /stop /emergencystop /mode /sheath /unsheath',
  'Config:   /config',
  'Signals:  /analytics',
  'Auth:     /login /login_cancel',
  'Nav:      /start /menu /help',
  '',
  'Need the dashboard? /status is the main operator view.',
].join('\n');

export function createStartHandlers(deps: RouterDependencies): Map<string, CommandHandler> {
  const handlers = new Map<string, CommandHandler>();

  handlers.set('/start', async (ctx: OperatorContext): Promise<CommandResult> => {
    try {
      if (ctx.tenantId && deps.tenantRuntimeFactory) {
        void deps.tenantRuntimeFactory
          .getOrCreate(ctx.tenantId)
          .then((runtime) => runtime.start())
          .catch(() => undefined);
      }
      return { success: true, message: MENU_TEXT };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Could not start session: ${msg}\n\nTry /status. If this persists, contact support.`,
      };
    }
  });

  handlers.set('/menu', async (_ctx: OperatorContext): Promise<CommandResult> => {
    return { success: true, message: MENU_TEXT };
  });

  handlers.set('/help', async (_ctx: OperatorContext): Promise<CommandResult> => {
    return { success: true, message: HELP_TEXT };
  });

  return handlers;
}
