import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authenticateWithTelegram, refreshAccessToken, logout as apiLogout, clearTokens } from '@/api/auth';
import { getTelegramInitData } from '@/lib/telegram';
import { useUIStore } from '@/stores/uiStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const isOperator = useAuthStore((s) => s.isOperator());
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);
  const setUser = useAuthStore((s) => s.setUser);
  const logoutStore = useAuthStore((s) => s.logout);
  const addToast = useUIStore((s) => s.addToast);
  const login = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const initData = getTelegramInitData();
      if (!initData) throw new Error('Telegram initData not available');
      const response = await authenticateWithTelegram(initData);
      setUser(response.user);
      if (response.isNewUser) useUIStore.getState().setShowOnboarding(true);
      addToast({ type: 'success', message: `Welcome, ${response.user.firstName}!` });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setError(message); addToast({ type: 'error', message }); throw error;
    } finally { setLoading(false); }
  }, [setLoading, setError, setUser, addToast]);

  const refresh = useCallback(async () => {
    try { await refreshAccessToken(); }
    catch (error) { clearTokens(); logoutStore(); throw error; }
  }, [logoutStore]);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* local revocation still runs */ }
    finally { logoutStore(); addToast({ type: 'info', message: 'You have been logged out.' }); }
  }, [logoutStore, addToast]);

  return { user, isAuthenticated, isLoading, isOperator, isAdmin, error, login, refresh, logout };
}
