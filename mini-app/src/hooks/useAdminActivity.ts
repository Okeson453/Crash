import { useQuery } from '@tanstack/react-query';
import { getAdminActivity } from '@/api/admin';
import { useEffect, useState } from 'react';
import type { AdminActivity } from '@/types/api';

export function useAdminActivity() {
  const [activities, setActivities] = useState<AdminActivity[]>([]);

  const query = useQuery({
    queryKey: ['admin-activity'],
    queryFn: getAdminActivity,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (query.data) {
      setActivities((prev) => {
        const merged = [...query.data, ...prev];
        const seen = new Set<string>();
        return merged
          .filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
          })
          .slice(0, 50);
      });
    }
  }, [query.data]);

  return { activities, isLoading: query.isLoading };
}
