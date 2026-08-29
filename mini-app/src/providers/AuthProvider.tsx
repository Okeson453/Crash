import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { getStoredTokens, initAuthFromStorage, getCurrentUser, refreshAccessToken, clearTokens } from '@/api/auth';
import { useUIStore } from '@/stores/uiStore';

interface AuthContextValue { isInitialized: boolean; isAuthenticated: boolean; isLoading: boolean; bootstrapError: string | null; retry: () => void; }
const AuthContext = createContext<AuthContextValue>({ isInitialized: false, isAuthenticated: false, isLoading: true, bootstrapError: null, retry: () => undefined });
export function useAuthContext() { return useContext(AuthContext); }
interface AuthProviderProps { children: ReactNode; }

export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const setShowOnboarding = useUIStore((s) => s.setShowOnboarding);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setLoading(true); setBootstrapError(null);
      try {
        const hasTokens = initAuthFromStorage();
        if (hasTokens) {
          const user = await getCurrentUser(); setUser(user);
          if (user.status === 'onboarding') setShowOnboarding(true);
        }
        if (!cancelled) setIsInitialized(true);
      } catch (error) {
        clearTokens(); logout();
        if (!cancelled) { setBootstrapError(error instanceof Error ? error.message : 'Unable to restore your session'); setIsInitialized(true); }
      } finally { if (!cancelled) setLoading(false); }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [attempt, setShowOnboarding, setLoading, setUser, logout]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      if (cancelled) return;
      const tokens = getStoredTokens(); if (!tokens) return;
      const delay = Math.max(1000, tokens.expiresAt - Date.now() - 60_000);
      timer = window.setTimeout(() => {
        void refreshAccessToken().then(schedule).catch(() => { clearTokens(); logout(); });
      }, delay);
    };
    schedule();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [isAuthenticated, logout]);

  return <AuthContext.Provider value={{ isInitialized, isAuthenticated, isLoading, bootstrapError, retry: () => setAttempt((value) => value + 1) }}>{children}</AuthContext.Provider>;
}
