import { api, setAuthToken } from './client';
import { getStorageItem, removeStorageItem, setStorageItem } from '@/lib/storage';
import type { TelegramAuthResponse, RefreshTokenRequest, User, AuthTokens } from '@/types/api';
const TOKEN_KEY = 'auth-tokens';
export function storeTokens(tokens: AuthTokens): void { setStorageItem(TOKEN_KEY, JSON.stringify(tokens)); setAuthToken(tokens.accessToken); }
export function getStoredTokens(): AuthTokens | null {
  const raw = getStorageItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.accessToken !== 'string' || typeof value.refreshToken !== 'string' || typeof value.expiresAt !== 'number') return null;
    return { accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: value.expiresAt };
  } catch { return null; }
}
export function clearTokens(): void { removeStorageItem(TOKEN_KEY); setAuthToken(null); }
export function initAuthFromStorage(): boolean { const tokens = getStoredTokens(); if (tokens && tokens.expiresAt > Date.now()) { setAuthToken(tokens.accessToken); return true; } clearTokens(); return false; }
export async function authenticateWithTelegram(initData: string): Promise<TelegramAuthResponse> {
  const response = await api.post<TelegramAuthResponse>('/api/v1/auth/telegram', { initData }); storeTokens(response.tokens); return response;
}
export async function refreshAccessToken(): Promise<AuthTokens> {
  const tokens = getStoredTokens(); if (!tokens) throw new Error('No refresh token available');
  const response = await api.post<AuthTokens>('/api/v1/auth/refresh', { refreshToken: tokens.refreshToken } satisfies RefreshTokenRequest); storeTokens(response); return response;
}
export async function logout(): Promise<void> { try { await api.post('/api/v1/auth/logout'); } finally { clearTokens(); } }
export async function getCurrentUser(): Promise<User> { return api.get<User>('/api/v1/auth/me'); }
