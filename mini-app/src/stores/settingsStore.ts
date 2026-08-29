import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPreferences } from '@/types/api';

type SettingsState = UserPreferences & {
  hasCompletedOnboarding: boolean;
  lastVisitedAt: string | null;
  updateSettings: (settings: Partial<UserPreferences>) => void;
  completeOnboarding: () => void;
  setLastVisited: () => void;
};

const defaultPreferences: UserPreferences = {
  defaultBetAmount: 10,
  defaultAutoCashout: null,
  soundEnabled: false,
  hapticEnabled: true,
  animationsEnabled: true,
  theme: 'system',
  language: 'en',
  notificationsEnabled: true,
  maxDailyLoss: null,
  sessionLossLimit: null,
  autoBet: { enabled: false, strategy: 'repeat-last', maxBet: 100, stopAfterRounds: null },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      hasCompletedOnboarding: false,
      lastVisitedAt: null,

      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      setLastVisited: () => set({ lastVisitedAt: new Date().toISOString() }),
    }),
    {
      name: 'crashwave-settings',
    }
  )
);
