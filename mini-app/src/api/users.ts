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
