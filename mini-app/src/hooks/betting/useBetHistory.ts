import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getBets } from '@/api/bets';
import type { BetFilters, BetStatus } from '@/types/bet';
function parseStatus(value: string | null): BetStatus | undefined { const allowed: BetStatus[] = ['pending','placed','active','cashed_out','lost','cancelled','failed']; return value ? allowed.find((item) => item === value) : undefined; }
export function useBetHistory() {
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const range = params.get('range') ?? 'all';
  const filters: BetFilters = { status, ...(range === '7d' ? { fromDate: new Date(Date.now() - 7 * 86400000).toISOString() } : {}), ...(range === '30d' ? { fromDate: new Date(Date.now() - 30 * 86400000).toISOString() } : {}) };
  const query = useInfiniteQuery({ queryKey: ['bets', filters], queryFn: ({ pageParam }) => getBets(filters, pageParam || undefined), getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? '', initialPageParam: '', staleTime: 10000 });
  const setFilters = (next: Partial<{ status: BetStatus | null; range: string }>) => { const copy = new URLSearchParams(params); if ('status' in next) next.status ? copy.set('status', next.status) : copy.delete('status'); if ('range' in next) next.range && next.range !== 'all' ? copy.set('range', next.range) : copy.delete('range'); setParams(copy); };
  return { ...query, filters, range, setFilters, bets: query.data?.pages.flatMap((page) => page.data) ?? [] };
}
