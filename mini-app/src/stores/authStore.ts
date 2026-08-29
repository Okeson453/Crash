import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserPreferences, UserStats } from '@/types/api';

interface AuthState {
  user: User | null;
  preferences: UserPreferences | null;
  stats: UserStats | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setPreferences: (preferences: UserPreferences | null) => void;
  setStats: (stats: UserStats | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  isOperator: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: null,
      stats: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          error: null,
        }),

      setPreferences: (preferences) => set({ preferences }),

      setStats: (stats) => set({ stats }),

      setAuthenticated: (value) => set({ isAuthenticated: value }),

      setLoading: (value) => set({ isLoading: value }),

      setError: (error) => set({ error }),

      logout: () =>
        set({
          user: null,
          preferences: null,
          stats: null,
          isAuthenticated: false,
          error: null,
        }),

      updatePreferences: (prefs) =>
        set((state) => ({
          preferences: state.preferences ? { ...state.preferences, ...prefs } : null,
        })),

      isOperator: () => {
        const { user } = get();
        return user?.role === 'operator' || user?.role === 'admin';
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },
    }),
    {
      name: 'crashwave-auth',
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
