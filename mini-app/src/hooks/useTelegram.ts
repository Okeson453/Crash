import { useCallback, useEffect, useState } from 'react';
import {
  initTelegramWebApp,
  getTelegramUserNormalized,
  getTelegramInitData,
  setTelegramHeaderColor,
  setTelegramBackgroundColor,
} from '@/lib/telegram';
import type { TelegramWebApp, TelegramThemeParams } from '@/types/telegram';

export function useTelegram() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [themeParams, setThemeParams] = useState<TelegramThemeParams>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const app = initTelegramWebApp();
    if (app) {
      setWebApp(app);
      setThemeParams(app.themeParams);
      setIsReady(true);

      // Listen for theme changes
      const handleThemeChange = () => {
        setThemeParams({ ...app.themeParams });
      };
      app.onEvent('themeChanged', handleThemeChange);

      return () => {
        app.offEvent('themeChanged', handleThemeChange);
      };
    }
  }, []);

  const haptic = useCallback(
    (type: 'impact' | 'notification' | 'selection', value?: string) => {
      if (!webApp?.HapticFeedback) return;
      try {
        switch (type) {
          case 'impact':
            const style = value === 'light' || value === 'heavy' ? value : 'medium';
            webApp.HapticFeedback.impactOccurred(style);
            break;
          case 'notification':
            webApp.HapticFeedback.notificationOccurred(
              value === 'warning' || value === 'error' ? value : 'success'
            );
            break;
          case 'selection':
            webApp.HapticFeedback.selectionChanged();
            break;
        }
      } catch {
        // Haptic feedback not supported
      }
    },
    [webApp]
  );

  const showPopup = useCallback(
    (
      params: Parameters<TelegramWebApp['showPopup']>[0]
    ): Promise<string | undefined> => {
      return new Promise((resolve) => {
        if (!webApp) {
          resolve(undefined);
          return;
        }
        webApp.showPopup(params, (buttonId) => resolve(buttonId));
      });
    },
    [webApp]
  );

  const showConfirm = useCallback(
    (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!webApp) {
          resolve(false);
          return;
        }
        webApp.showConfirm(message, (confirmed) => resolve(confirmed));
      });
    },
    [webApp]
  );

  const showAlert = useCallback(
    (message: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!webApp) {
          resolve();
          return;
        }
        webApp.showAlert(message, () => resolve());
      });
    },
    [webApp]
  );

  const setHeaderColor = useCallback(
    (color: string) => {
      setTelegramHeaderColor(color);
    },
    []
  );

  const setBackgroundColor = useCallback(
    (color: string) => {
      setTelegramBackgroundColor(color);
    },
    []
  );

  return {
    webApp,
    themeParams,
    isReady,
    isTelegram: !!webApp,
    user: getTelegramUserNormalized(),
    initData: getTelegramInitData(),
    haptic,
    showPopup,
    showConfirm,
    showAlert,
    setHeaderColor,
    setBackgroundColor,
    expand: () => webApp?.expand(),
    close: () => webApp?.close(),
    useMainButton: (text: string, onClick: () => void, active = true) => {
      if (!webApp) return () => undefined;
      webApp.MainButton.setText(text); webApp.MainButton.setParams({ is_active: active, is_visible: true }); webApp.MainButton.onClick(onClick);
      return () => { webApp.MainButton.offClick(onClick); webApp.MainButton.hide(); };
    },
  };
}
