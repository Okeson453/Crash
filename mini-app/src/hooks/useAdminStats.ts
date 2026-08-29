import { useQuery } from '@tanstack/react-query';
import { getAdminOverview } from '@/api/admin';

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: getAdminOverview,
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
