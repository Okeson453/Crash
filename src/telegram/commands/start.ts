import type { CommandHandler, CommandResult, OperatorContext } from '../types';
import type { RouterDependencies } from '../router';

/** Plain text — no Markdown (avoids Telegram 400 parse entities). */
const MENU_TEXT = [
  '🚀 BC.Game Crash Automation',
  '',
  'Welcome to your private Crash analytics workspace.',
  '',
  'Choose an action:',
  '',
  '🔐 Connect BC.Game — /login',
  '📊 Dashboard — /status',
  '🧠 ACIE / Signals — /analytics',
  '🧪 Dry Run — set APP_SYSTEM__MODE=dry-run',
  '⚙️ Settings — /config',
  '📡 System Status — /health',
  '❓ Help — /help',
  '',
  'Also: /balance /daily /session /pause /resume',
  '',
  'Passwords are never stored or logged.',
].join('\n');

export function createStartHandlers(deps: RouterDependencies): Map<string, CommandHandler> {
  const handlers = new Map<string, CommandHandler>();

  handlers.set('/start', async (ctx: OperatorContext): Promise<CommandResult> => {
    try {
      if (!ctx.tenantId || !deps.tenantRuntimeFactory) {
        return { success: true, message: MENU_TEXT };
      }
      void deps.tenantRuntimeFactory
        .getOrCreate(ctx.tenantId)
        .then((runtime) => runtime.start())
        .catch(() => undefined);
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
    return { success: true, message: MENU_TEXT };
  });

  return handlers;
}
