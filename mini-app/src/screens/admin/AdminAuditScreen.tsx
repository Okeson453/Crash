import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/api/admin';
import { AuditSearchBar } from '@/components/admin/AuditSearchBar';
import { AuditListItem } from '@/components/admin/AuditListItem';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ClipboardList } from 'lucide-react';

export function AdminAuditScreen() {
  const [search, setSearch] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['admin-audit', search],
    queryFn: ({ pageParam }) => getAuditLogs(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const logs = (query.data?.pages.flatMap((page) => page.data) ?? []).filter((log) =>
    search
      ? log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.actorType.toLowerCase().includes(search.toLowerCase())
      : true
  );

  if (query.isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-3">
      <AuditSearchBar value={search} onChange={setSearch} />
      {!logs.length ? (
        <EmptyState icon={ClipboardList} title="No audit logs" />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <AuditListItem key={log.id} log={log} />
          ))}
          {query.hasNextPage && (
            <Button
              className="w-full"
              loading={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
