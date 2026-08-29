import { api } from './client';
import type { HealthStatus } from '@/types/api';

export async function getHealthStatus(): Promise<HealthStatus> {
  return api.get<HealthStatus>('/api/v1/health');
}
