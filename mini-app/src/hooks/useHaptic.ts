import { useCallback } from 'react';
import { useTelegram } from './useTelegram';
import { useSettingsStore } from '@/stores/settingsStore';

export function useHaptic() {
  const { haptic } = useTelegram();
  const enabled = useSettingsStore((s) => s.hapticEnabled);

  const impact = useCallback(
    (style: 'light' | 'medium' | 'heavy' = 'medium') => {
      if (enabled) {
        haptic('impact', style);
      }
    },
    [enabled, haptic]
  );

  const notification = useCallback(
    (type: 'success' | 'warning' | 'error' = 'success') => {
      if (enabled) {
        haptic('notification', type);
      }
    },
    [enabled, haptic]
  );

  const selection = useCallback(() => {
    if (enabled) {
      haptic('selection');
    }
  }, [enabled, haptic]);

  return {
    impact,
    notification,
    selection,
    enabled,
  };
}
