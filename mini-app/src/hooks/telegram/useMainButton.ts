import { useCallback } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
export function useMainButton() {
  const { webApp } = useTelegram();
  return useCallback((text: string, onClick: () => void, active = true) => {
    if (!webApp) return () => undefined;
    webApp.MainButton.setText(text); webApp.MainButton.setParams({ is_active: active, is_visible: true }); webApp.MainButton.onClick(onClick);
    return () => { webApp.MainButton.offClick(onClick); webApp.MainButton.hide(); };
  }, [webApp]);
}
