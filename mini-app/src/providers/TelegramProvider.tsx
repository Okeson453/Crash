import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { initTelegramWebApp } from '@/lib/telegram';
import type { TelegramWebApp, TelegramThemeParams, TelegramUser } from '@/types/telegram';

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  user: TelegramUser | null;
  initData: string;
  themeParams: TelegramThemeParams;
  isReady: boolean;
  isTelegram: boolean;
}

const TelegramContext = createContext<TelegramContextValue>({
  webApp: null,
  user: null,
  initData: '',
  themeParams: {},
  isReady: false,
  isTelegram: false,
});

export function useTelegramContext() {
  return useContext(TelegramContext);
}

interface TelegramProviderProps {
  children: ReactNode;
}

export function TelegramProvider({ children }: TelegramProviderProps) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const app = initTelegramWebApp();
    if (app) {
      setWebApp(app);
      setThemeParams(app.themeParams);
      setIsReady(true);

      const handleThemeChange = () => {
        setThemeParams({ ...app.themeParams });
      };

      app.onEvent('themeChanged', handleThemeChange);

      return () => {
        app.offEvent('themeChanged', handleThemeChange);
      };
    } else {
      // Not running in Telegram - set defaults
      setIsReady(true);
    }
  }, []);

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const params = webApp?.themeParams || {};

    const mappings: Record<string, string | undefined> = {
      '--tg-theme-bg-color': params.bg_color,
      '--tg-theme-secondary-bg-color': params.secondary_bg_color,
      '--tg-theme-text-color': params.text_color,
      '--tg-theme-hint-color': params.hint_color,
      '--tg-theme-link-color': params.link_color,
      '--tg-theme-button-color': params.button_color,
      '--tg-theme-button-text-color': params.button_text_color,
      '--tg-theme-header-bg-color': params.header_bg_color,
      '--tg-theme-accent-text-color': params.accent_text_color,
      '--tg-theme-section-bg-color': params.section_bg_color,
      '--tg-theme-section-header-text-color': params.section_header_text_color,
      '--tg-theme-subtitle-text-color': params.subtitle_text_color,
      '--tg-theme-destructive-text-color': params.destructive_text_color,
    };

    Object.entries(mappings).forEach(([key, value]) => {
      if (value) {
        root.style.setProperty(key, value);
      }
    });

    // Set meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && params.bg_color) {
      metaThemeColor.setAttribute('content', params.bg_color);
    }
  }, [webApp?.themeParams]);

  const user = webApp?.initDataUnsafe?.user ?? null;
  const initData = webApp?.initData ?? '';

  return (
    <TelegramContext.Provider
      value={{
        webApp,
        user,
        initData,
        themeParams,
        isReady,
        isTelegram: !!webApp,
      }}
    >
      {children}
    </TelegramContext.Provider>
  );
}
