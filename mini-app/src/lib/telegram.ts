import type { TelegramWebApp } from '@/types/telegram';

let webAppInstance: TelegramWebApp | null = null;

export function getTelegramWebApp(): TelegramWebApp | null {
  if (webAppInstance) return webAppInstance;

  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    webAppInstance = window.Telegram.WebApp;
    return webAppInstance;
  }

  return null;
}

export function isTelegramWebApp(): boolean {
  return getTelegramWebApp() !== null;
}

export function initTelegramWebApp(): TelegramWebApp | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  // Tell Telegram the app is ready
  webApp.ready();

  // Expand to full viewport
  webApp.expand();

  // Enable closing confirmation to prevent accidental closes during active bets
  webApp.enableClosingConfirmation();

  // Set header and background colors to match theme
  const bgColor = webApp.themeParams.bg_color || '#ffffff';
  webApp.setHeaderColor(bgColor);
  webApp.setBackgroundColor(bgColor);

  return webApp;
}

export function getTelegramUser() {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;
  return webApp.initDataUnsafe.user ?? null;
}

/**
 * Normalize Telegram user data to camelCase for consistent access.
 * The Telegram WebApp SDK returns snake_case fields (first_name, last_name, photo_url)
 * but our UI components expect camelCase (firstName, lastName, photoUrl).
 */
export function getTelegramUserNormalized() {
  const user = getTelegramUser();
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    photoUrl: user.photo_url ?? null,
    languageCode: user.language_code ?? null,
  };
}

export function getTelegramInitData(): string {
  const webApp = getTelegramWebApp();
  if (!webApp) return '';
  return webApp.initData;
}

export function setTelegramHeaderColor(color: string): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.setHeaderColor(color);
  }
}

export function setTelegramBackgroundColor(color: string): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.setBackgroundColor(color);
  }
}
