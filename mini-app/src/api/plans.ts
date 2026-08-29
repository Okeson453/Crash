import { api } from './client';
import type { Plan } from '@/types/api';

export async function getPlans(): Promise<Plan[]> {
  return api.get<Plan[]>('/api/v1/plans');
}
