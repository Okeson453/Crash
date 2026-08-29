import { api } from './client';
import type { AnalyticsOverview, AnalyticsRevenue } from '@/types/api';
import type { PlayerAnalytics } from '@/types/analytics';

export async function getAnalyticsOverview(
  period: 'day' | 'week' | 'month' = 'day'
): Promise<AnalyticsOverview> {
  return api.get<AnalyticsOverview>(`/api/v1/analytics/overview?period=${period}`);
}

export async function getAnalyticsRevenue(
  period: 'day' | 'week' | 'month' = 'day'
): Promise<AnalyticsRevenue> {
  return api.get<AnalyticsRevenue>(`/api/v1/analytics/revenue?period=${period}`);
}

export async function getPlayerAnalytics(
  period: 'day' | 'week' | 'month' = 'day'
): Promise<PlayerAnalytics[]> {
  return api.get<PlayerAnalytics[]>(`/api/v1/analytics/players?period=${period}`);
}
