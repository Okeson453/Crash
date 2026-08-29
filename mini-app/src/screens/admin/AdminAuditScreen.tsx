import { useInfiniteQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/utils/formatting';
import { ClipboardList, Activity, Settings } from 'lucide-react';

export function AdminAuditScreen() {
  const query = useInfiniteQuery({
    queryKey: ['admin-audit'],
    queryFn: ({ pageParam }) => getAuditLogs(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const logs = query.data?.pages.flatMap((page) => page.data) ?? [];

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  if (!logs.length) return <EmptyState icon={ClipboardList} title="No audit logs" />;

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id}>
          <div className="flex items-start gap-3">
            <Activity className="h-5 w-5 text-tg-link shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-tg-text">{log.action}</p>
              <p className="text-xs text-tg-hint">
                {log.actorType} · {formatDateTime(log.createdAt)}
              </p>
            </div>
            <Settings className="h-4 w-4 text-tg-hint shrink-0" />
          </div>
        </Card>
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
  );
}
