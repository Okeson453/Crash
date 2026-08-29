import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '@/api/health';

export function useHealthPolling(intervalMs = 10000) {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealthStatus,
    refetchInterval: intervalMs,
    staleTime: intervalMs / 2,
  });
}
