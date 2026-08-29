/**
 * /login — secure multi-step BC.Game authentication via Telegram.
 * Password never logged, never stored; deleted from chat when possible.
 * Auth runs in the background so Telegram is not blocked for 90s.
 * Login test is independent of ACIE dry-run — failures do not stop observation.
 */

import { getLogger } from '../../observability/logger';
import {
  beginLoginConversation,
  endLoginConversation,
  getLoginConversation,
  setLoginEmail,
  markAuthenticating,
  maskEmail,
} from '../../security/ephemeral-login';
import type { CommandHandler, CommandResult, OperatorContext } from '../types';
import type { RouterDependencies } from '../router';
import { formatLoginTestReport, type LoginTestReport } from '../../browser/login-test-pipeline';

const logger = getLogger();

/** Map machine codes / detail strings to tenant-safe Telegram messages (plain text preferred). */
export function formatLoginFailureMessage(detail?: string): string {
  const d = (detail ?? '').toUpperCase();
  const raw = detail ?? '';

  if (
    d.includes('BROWSER_LAUNCH_FAILED') ||
    d.includes('BROWSER_FAILED') ||
    d.includes('BROWSER_NOT_READY') ||
    d.includes('BROWSER_NOT_LAUNCHED') ||
    d.includes("EXECUTABLE DOESN'T EXIST") ||
    d.includes('EXECUTABLE DOES NOT EXIST') ||
    /chromium[-_]?\d+/i.test(raw) ||
    /ms-playwright/i.test(raw) ||
    /MISSING X SERVER/i.test(raw) ||
    /DISPLAY/i.test(raw)
  ) {
    return [
      'Browser Service Unavailable',
      '',
      'Chromium could not start or the browser page is not available.',
      'Authentication was NOT attempted.',
      '',
      'Admin: pin playwright + Docker image to 1.62.1, BROWSER_HEADLESS=true, rebuild --no-cache.',
      raw ? `Detail: ${raw.slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    d.includes('GEO_RESTRICTION') ||
    d.includes('REGION_BLOCKED') ||
    d.includes('REGION RESTRICTION')
  ) {
    return [
      'BC.Game region restriction detected',
      '',
      'The browser reached BC.Game, but the login form is unavailable from the current deployment region/IP.',
      'ACIE dry-run can continue without login.',
      '',
      'Run the browser/session infrastructure from a location where BC.Game officially permits access,',
      'or use an officially supported access mechanism. Do not treat this as a form/selector failure.',
    ].join('\n');
  }

  if (
    d.includes('NAVIGATION_FAILED') ||
    d.includes('LOGIN_NAVIGATION_FAILED') ||
    d.includes('ERR_NAME_NOT_RESOLVED') ||
    d.includes('ERR_CONNECTION') ||
    d.includes('ERR_CERT') ||
    d.includes('TIMEOUT') && d.includes('NAV')
  ) {
    return [
      'Navigation failed',
      '',
      'The browser could not open the BC.Game login page.',
      'Check Deploy logs for: requestedUrl, finalUrl, pageTitle, navigationError.',
      'Typical causes: DNS, TLS, timeout, blocked region/IP, or wrong BC_GAME_LOGIN_URL.',
      raw ? `Detail: ${raw.slice(0, 300)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

    if (d.includes('LOGIN_PAGE_UNKNOWN') || d.includes('LOGIN_FORM_NOT_FOUND') || d.includes('LOGIN_FORM_UNSTABLE')) {
    return [
      'Login page could not be classified',
      '',
      'Form was not available after navigation. Check Deploy logs for:',
      'requestedUrl, finalUrl, pageTitle, detectedPageState, regionRestrictionDetected.',
      'If regionRestrictionDetected is true, the primary failure is GEO_RESTRICTION_DETECTED.',
    ].join('\n');
  }

  if (d.includes('AUTHENTICATION_REQUIRED') || d.includes('SESSION_EXPIRED')) {
    return [
      'Session expired or login required',
      'Use /login again to reconnect BC.Game.',
      raw ? `Detail: ${raw.slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (d.includes('GAME_LOAD_FAILED')) {
    return [
      'Game load failed',
      'Browser started but the Crash game did not load.',
      'Check network and try /login again.',
      raw ? `Detail: ${raw.slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (
    d.includes('CAPTCHA') ||
    d.includes('2FA') ||
    d.includes('CHALLENGE') ||
    d.includes('CLOUDFLARE') ||
    d.includes('SECURITY_CHALLENGE')
  ) {
    return [
      'Security challenge required',
      'A CAPTCHA or browser check appeared. Complete it in an allowed environment, then /login again.',
      raw ? `Detail: ${raw.slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (d.includes('AUTHENTICATION_FAILED') || d.includes('AUTH_FAILED') || d.includes('INVALID')) {
    return [
      'Authentication failed',
      'BC.Game rejected the credentials or sign-in did not complete.',
      'Verify email/password, then /login again.',
      raw ? `Detail: ${raw.slice(0, 200)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Authentication failed${detail ? ` (${detail})` : ''}.`,
    'Try /login again. If this persists, contact support with /status output.',
  ].join('\n');
}

export function createLoginHandlers(deps: RouterDependencies): Map<string, CommandHandler> {
  const handlers = new Map<string, CommandHandler>();

  handlers.set('/login', async (ctx: OperatorContext): Promise<CommandResult> => {
    const chatId = ctx.chat?.id;
    if (chatId == null) {
      return { success: false, message: 'Unable to resolve chat.' };
    }

    endLoginConversation(chatId);
    beginLoginConversation(chatId, ctx.tenantId);

    const prompt = [
      'BC.Game Login',
      '',
      'Credentials are used once inside the secure browser session.',
      'The password is never stored.',
      'Login testing runs in parallel with ACIE dry-run and will not stop it.',
      '',
      'Enter your BC.Game email or phone:',
      '',
      'Send /login_cancel to abort.',
    ].join('\n');

    try {
      await ctx.reply(prompt);
      logger.info({ component: 'LoginCommand', chatId, tenantId: ctx.tenantId }, 'Login flow started');
    } catch (err) {
      logger.error({ component: 'LoginCommand', chatId, error: String(err) }, 'Login prompt reply failed');
      return { success: false, message: 'Could not send login prompt. Try again or /start.' };
    }

    return { success: true, message: '' };
  });

  handlers.set('/login_cancel', async (ctx: OperatorContext): Promise<CommandResult> => {
    const chatId = ctx.chat?.id;
    if (chatId != null) endLoginConversation(chatId);
    return {
      success: true,
      message: 'Login cancelled. No credentials retained.',
    };
  });

  void deps;
  void logger;
  return handlers;
}

export async function handleLoginConversationText(
  ctx: OperatorContext,
  text: string,
  deps: RouterDependencies
): Promise<boolean> {
  const chatId = ctx.chat?.id;
  if (chatId == null) return false;

  const conv = getLoginConversation(chatId);
  if (!conv || conv.step === 'idle' || conv.step === 'authenticating') {
    return false;
  }

  const msgId = ctx.message && 'message_id' in ctx.message ? ctx.message.message_id : undefined;
  if (msgId != null) {
    try {
      await ctx.deleteMessage(msgId);
    } catch {
      /* bot may lack delete permission */
    }
  }

  if (conv.step === 'awaiting_email') {
    const email = text.trim();
    if (!email || email.length < 3) {
      await ctx.reply('Please enter a valid email or phone.');
      return true;
    }
    setLoginEmail(chatId, email);
    await ctx.reply(
      'Enter your BC.Game password:\n\n(Your message will be deleted when possible. Use /login_cancel to abort.)'
    );
    return true;
  }

  if (conv.step === 'awaiting_password') {
    const password = text;
    const email = conv.email ?? '';
    markAuthenticating(chatId);

    const runtime =
      ctx.tenantId && deps.tenantRuntimeFactory
        ? await deps.tenantRuntimeFactory.getOrCreate(ctx.tenantId)
        : null;
    const loginFn = runtime
      ? (emailValue: string, passwordValue: string) => runtime.authenticate(emailValue, passwordValue)
      : deps.loginWithCredentials;
    if (!loginFn) {
      endLoginConversation(chatId);
      await ctx.reply('Login service unavailable (supervisor not wired).');
      return true;
    }

    await ctx.reply(
      'Login session started.\n\nAuthenticating in the background. You will get a staged LOGIN TEST report shortly.\nUse /status — LOGIN and ACIE are independent.'
    );

    const notify = async (msg: string) => {
      try {
        await ctx.reply(msg);
      } catch {
        /* ignore */
      }
    };

    void (async () => {
      let localPassword = password;
      try {
        const result = await loginFn(email, localPassword);
        localPassword = '';
        endLoginConversation(chatId);

        const report = (result as { loginReport?: LoginTestReport }).loginReport;
        if (report) {
          await notify(formatLoginTestReport(report));
          return;
        }
        if (result.regionBlocked) {
          await notify(formatLoginFailureMessage('GEO_RESTRICTION_DETECTED'));
          return;
        }
        if (result.ok && result.authenticated) {
          const account = result.maskedEmail ?? maskEmail(email);
          await notify(
            [
              '🔐 LOGIN TEST',
              '',
              'Status: SUCCESS',
              `Account: ${account}`,
              'Session: ACTIVE',
              `Game: ${result.gameLoaded ? 'Ready' : 'Loading'}`,
              `Observer: ${result.observing ? 'Running' : 'Pending'}`,
              '',
              'Use /status — LOGIN and ACIE are independent.',
            ].join('\n')
          );
          return;
        }
        const failDetail = [(result as { code?: string }).code, result.detail].filter(Boolean).join(': ');
        await notify(formatLoginFailureMessage(failDetail || undefined));
      } catch (err) {
        localPassword = '';
        endLoginConversation(chatId);
        const message = err instanceof Error ? err.message : String(err);
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: string }).code ?? '')
            : '';
        await notify(formatLoginFailureMessage(code || message));
      }
    })();

    return true;
  }

  return false;
}
