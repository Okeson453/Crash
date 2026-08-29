/**
 * Telegram Operator Interface — Status Commands
 * LOGIN status and ACIE dry-run status are independent.
 * MarkdownV2 — escape dynamic values via escapeMarkdownV2.
 */

import { CommandHandler, CommandResult, OperatorContext } from '../types';
import { RouterDependencies } from '../router';

async function getTenantState(ctx: OperatorContext, deps: RouterDependencies): Promise<Record<string, unknown> | undefined> {
  if (ctx.tenantId && deps.tenantRuntimeFactory) {
    return await deps.tenantRuntimeFactory.getOrCreate(ctx.tenantId).then((runtime) => runtime.getStatus());
  }
  return deps.getOrchestratorState?.() as Record<string, unknown> | undefined;
}

async function getTenantHealth(ctx: OperatorContext, deps: RouterDependencies): Promise<Record<string, unknown> | undefined> {
  if (ctx.tenantId && deps.tenantRuntimeFactory) {
    return await deps.tenantRuntimeFactory.getOrCreate(ctx.tenantId).then((runtime) => runtime.getHealth());
  }
  return deps.getHealthStatus?.() as Record<string, unknown> | undefined;
}

function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function createStatusHandlers(deps: RouterDependencies): Map<string, CommandHandler> {
  const handlers = new Map<string, CommandHandler>();

  handlers.set('/status', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const state = await getTenantState(_ctx, deps);
    const mode = (state?.mode as string) ?? 'unknown';
    const running = state?.running ?? false;
    const sessionId = (state?.sessionId as string) ?? 'none';
    const roundsObserved = (state?.roundsObserved as number) ?? 0;
    const errors = (state?.errors as number) ?? 0;
    const startedAt = (state?.startedAt as string) ?? null;
    const uptime = startedAt
      ? formatDuration(Date.now() - new Date(startedAt).getTime())
      : 'N/A';
    const emoji = running ? '🟢' : '🔴';
    const modeEmoji = getModeEmoji(mode);

    const dry = (state as { dryRun?: {
      predictions?: number;
      signals?: number;
      signalsAccepted?: number;
      virtualBalance?: number;
      netPnl?: number;
      wins?: number;
      losses?: number;
    } })?.dryRun;

    const lines = [
      `${emoji} *System Status*`,
      '',
      `*Mode:* ${modeEmoji} ${escapeMarkdownV2(mode)}`,
      `*Running:* ${running ? 'Yes' : 'No'}`,
      `*Session:* \`${escapeMarkdownV2(sessionId)}\``,
      `*Rounds Observed:* ${escapeMarkdownV2(String(roundsObserved))}`,
      `*Errors:* ${escapeMarkdownV2(String(errors))}`,
      `*Uptime:* ${escapeMarkdownV2(uptime)}`,
    ];

    const loginStatus = escapeMarkdownV2(String((state as { loginStatus?: string })?.loginStatus ?? 'NOT_TESTED'));
    const loginClass = (state as { lastLoginClassification?: string | null })?.lastLoginClassification;
    const loginStage = (state as { lastLoginStage?: string | null })?.lastLoginStage;
    const phase = escapeMarkdownV2(String((state as { phase?: string })?.phase ?? 'unknown'));

    lines.push(
      '',
      '*LOGIN STATUS*',
      `*Status:* ${loginStatus}`,
    );
    if (loginClass) {
      lines.push(`*Classification:* ${escapeMarkdownV2(String(loginClass))}`);
    }
    if (loginStage) {
      lines.push(`*Last failed stage:* ${escapeMarkdownV2(String(loginStage))}`);
    }
    lines.push(`*Phase:* ${phase}`);

    let acieStatus = 'STOPPED';
    if (mode === 'dry-run') {
      const observing = Boolean((state as { observing?: boolean })?.observing);
      if (running && ((dry?.signals ?? 0) > 0 || (dry?.predictions ?? 0) > 0 || observing)) {
        acieStatus = 'SIGNALING';
      } else if (running || observing) {
        acieStatus = 'COLLECTING';
      } else if (
        (state as { phase?: string })?.phase === 'initializing' ||
        (state as { phase?: string })?.phase === 'launching-browser' ||
        (state as { phase?: string })?.phase === 'navigating'
      ) {
        acieStatus = 'STARTING';
      } else {
        acieStatus = 'STOPPED';
      }
    }

    if (mode === 'dry-run') {
      lines.push(
        '',
        '*ACIE DRY\\-RUN STATUS*',
        `*Status:* ${escapeMarkdownV2(acieStatus)}`,
        `*Predictions:* ${escapeMarkdownV2(String(dry?.predictions ?? 0))}`,
        `*Signals:* ${escapeMarkdownV2(String(dry?.signals ?? 0))} \\(accepted ${escapeMarkdownV2(String(dry?.signalsAccepted ?? 0))}\\)`,
        `*Virtual trades:* ${escapeMarkdownV2(String((dry?.wins ?? 0) + (dry?.losses ?? 0)))}`,
        `*Wins/Losses:* ${escapeMarkdownV2(String(dry?.wins ?? 0))}W / ${escapeMarkdownV2(String(dry?.losses ?? 0))}L`,
        `*Virtual P&L:* ${escapeMarkdownV2(String(dry?.netPnl ?? 0))}`,
        `*Virtual balance:* ${escapeMarkdownV2(String(dry?.virtualBalance ?? 0))}`,
        '',
        'Login and ACIE are independent\\.',
        'Live Execution: DISABLED',
      );
    }

    lines.push('', '_Use /balance, /daily, /health for more details\\._');
    return { success: true, message: lines.join('\n'), parseMode: 'MarkdownV2' };
  });

  handlers.set('/balance', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const state = await getTenantState(_ctx, deps);
    const balance = (state?.balance as number) ?? null;
    const message = balance !== null
      ? `💰 *Current Balance*\n\n${escapeMarkdownV2(formatCurrency(balance))}`
      : '💰 *Current Balance*\n\n_No balance data available\\._';
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/daily', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const summary = deps.getLedgerSummary?.() as Record<string, unknown> | undefined;
    const dailyKey = (summary?.dailyKey as string) ?? new Date().toISOString().slice(0, 10);
    const entriesConfirmed = (summary?.entriesConfirmed as number) ?? 0;
    const entriesAttempted = (summary?.entriesAttempted as number) ?? 0;
    const wins = (summary?.wins as number) ?? 0;
    const losses = (summary?.losses as number) ?? 0;
    const netPnl = (summary?.netPnl as number) ?? 0;
    const maxDrawdown = (summary?.maxDrawdown as number) ?? 0;
    const pnlEmoji = netPnl >= 0 ? '🟢' : '🔴';
    const message = [
      `📅 *Daily Summary — ${escapeMarkdownV2(dailyKey)}*`,
      '',
      `*Entries:* ${escapeMarkdownV2(`${entriesConfirmed}/${entriesAttempted}`)} confirmed`,
      `*Wins/Losses:* ${escapeMarkdownV2(`${wins}W / ${losses}L`)}`,
      `*Net P&L:* ${pnlEmoji} ${escapeMarkdownV2(formatCurrency(netPnl))}`,
      `*Max Drawdown:* ${escapeMarkdownV2(formatPercentage(maxDrawdown))}`,
    ].join('\n');
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/session', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const state = await getTenantState(_ctx, deps);
    const sessionId = (state?.sessionId as string) ?? 'none';
    const mode = (state?.mode as string) ?? 'unknown';
    const roundsObserved = (state?.roundsObserved as number) ?? 0;
    const ticksRecorded = (state?.ticksRecorded as number) ?? 0;
    const startedAt = (state?.startedAt as string) ?? null;
    const startedLabel = startedAt ? new Date(startedAt).toLocaleString() : 'N/A';
    const message = [
      `🔑 *Session Info*`,
      '',
      `*ID:* \`${escapeMarkdownV2(sessionId)}\``,
      `*Mode:* ${escapeMarkdownV2(mode)}`,
      `*Rounds:* ${escapeMarkdownV2(String(roundsObserved))}`,
      `*Ticks:* ${escapeMarkdownV2(String(ticksRecorded))}`,
      `*Started:* ${escapeMarkdownV2(startedLabel)}`,
    ].join('\n');
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/pnl', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const summary = deps.getLedgerSummary?.() as Record<string, unknown> | undefined;
    const netPnl = (summary?.netPnl as number) ?? 0;
    const grossProfit = (summary?.grossProfit as number) ?? 0;
    const grossLoss = (summary?.grossLoss as number) ?? 0;
    const hitRate = (summary?.hitRate as number) ?? null;
    const message = [
      `📊 *P&L Summary*`,
      '',
      `*Net P&L:* ${escapeMarkdownV2(formatCurrency(netPnl))}`,
      `*Gross Profit:* ${escapeMarkdownV2(formatCurrency(grossProfit))}`,
      `*Gross Loss:* ${escapeMarkdownV2(formatCurrency(grossLoss))}`,
      `*Hit Rate:* ${hitRate !== null ? escapeMarkdownV2(formatPercentage(hitRate)) : 'N/A'}`,
    ].join('\n');
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/entries', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const summary = deps.getLedgerSummary?.() as Record<string, unknown> | undefined;
    const entriesConfirmed = (summary?.entriesConfirmed as number) ?? 0;
    const entriesAttempted = (summary?.entriesAttempted as number) ?? 0;
    const maxDaily = (summary?.maxDailyEntries as number) ?? null;
    const message = [
      `🎫 *Entries*`,
      '',
      `*Confirmed:* ${escapeMarkdownV2(String(entriesConfirmed))}`,
      `*Attempted:* ${escapeMarkdownV2(String(entriesAttempted))}`,
      maxDaily !== null
        ? `*Daily Cap:* ${escapeMarkdownV2(String(maxDaily))}`
        : `*Daily Cap:* N/A`,
    ].join('\n');
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/health', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const health = await getTenantHealth(_ctx, deps);
    const status = (health?.status as string) ?? 'unknown';
    const checks = (health?.checks as Array<{ name: string; ok: boolean; message?: string }>) ?? [];
    const statusEmoji = status === 'healthy' ? '🟢' : status === 'degraded' ? '🟡' : '🔴';
    const checkLines = checks.map((c) => {
      const emoji = c.ok ? '✅' : '❌';
      const name = escapeMarkdownV2(c.name);
      const msg = c.message ? `: ${escapeMarkdownV2(c.message)}` : '';
      return `${emoji} ${name}${msg}`;
    });
    const message = [
      `${statusEmoji} *Health Status — ${escapeMarkdownV2(status.toUpperCase())}*`,
      '',
      ...(checkLines.length > 0 ? checkLines : ['_No health checks reported\\._']),
    ].join('\n');
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  handlers.set('/lastround', async (_ctx: OperatorContext): Promise<CommandResult> => {
    const state = await getTenantState(_ctx, deps);
    const currentRoundId = (state?.currentRoundId as string) ?? null;
    const lastCrashPoint = (state?.lastCrashPoint as number) ?? null;
    const message = currentRoundId
      ? [
          `🎯 *Last Round*`,
          '',
          `*Round ID:* \`${escapeMarkdownV2(currentRoundId)}\``,
          `*Crash Point:* ${lastCrashPoint !== null ? escapeMarkdownV2(`${lastCrashPoint}x`) : 'N/A'}`,
        ].join('\n')
      : '🎯 *Last Round*\n\n_No round data available\\._';
    return { success: true, message, parseMode: 'MarkdownV2' };
  });

  return handlers;
}

function getModeEmoji(mode: string): string {
  switch (mode) {
    case 'live': return '🔴';
    case 'dry-run': return '🟡';
    case 'observe-only': return '🔵';
    case 'maintenance': return '🔧';
    default: return '⚪';
  }
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
