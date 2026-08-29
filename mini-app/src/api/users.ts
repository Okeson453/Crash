import { api } from './client';
import type {
  User,
  UserPreferences,
  UserStats,
  UserActivity,
  PaginatedResponse,
  BalanceResponse,
} from '@/types/api';

export async function getCurrentUser(): Promise<User> {
  return api.get<User>('/api/v1/users/me');
}

export async function updateUserProfile(data: {
  email?: string;
  timezone?: string;
}): Promise<User> {
  return api.put<User>('/api/v1/users/me', data);
}

export async function getUserStats(): Promise<UserStats> {
  return api.get<UserStats>('/api/v1/users/me/stats');
}

export async function getUserActivity(
  cursor?: string
): Promise<PaginatedResponse<UserActivity>> {
  const params = cursor ? `?cursor=${cursor}` : '';
  return api.get<PaginatedResponse<UserActivity>>(`/api/v1/users/me/activity${params}`);
}

export async function getUserPreferences(): Promise<UserPreferences> {
  return api.get<UserPreferences>('/api/v1/users/me/preferences');
}

export async function updateUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<UserPreferences> {
  return api.put<UserPreferences>('/api/v1/users/me/preferences', preferences);
}

export async function getBalance(): Promise<BalanceResponse> {
  return api.get<BalanceResponse>('/api/v1/users/me/balance');
}

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(unreadOnly = false): Promise<AppNotification[]> {
  const q = unreadOnly ? '?unread=true' : '';
  return api.get<AppNotification[]>(`/api/v1/users/me/notifications${q}`);
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return api.post<{ ok: boolean }>(`/api/v1/users/me/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return api.post<{ count: number }>('/api/v1/users/me/notifications/read-all');
}
