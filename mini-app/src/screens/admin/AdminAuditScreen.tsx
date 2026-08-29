import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/api/admin';
import { AuditSearchBar } from '@/components/admin/AuditSearchBar';
import { AuditFilterBar, type AuditFilter } from '@/components/admin/AuditFilterBar';
import { AuditListItem } from '@/components/admin/AuditListItem';
import { AuditDetailSheet, type AuditEventView } from '@/components/admin/AuditDetailSheet';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ClipboardList } from 'lucide-react';
import type { AuditLogEntry } from '@/types/api';

function matchesFilter(log: AuditLogEntry, filter: AuditFilter): boolean {
  if (filter === 'all') return true;
  const hay = `${log.action} ${log.actorType}`.toLowerCase();
  return hay.includes(filter);
}

export function AdminAuditScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [selected, setSelected] = useState<AuditEventView | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['admin-audit', search],
    queryFn: ({ pageParam }) => getAuditLogs(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const logs = (query.data?.pages.flatMap((page) => page.data) ?? []).filter((log) => {
    if (!matchesFilter(log, filter)) return false;
    if (!search) return true;
    return (
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actorType.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-3">
      <AuditSearchBar value={search} onChange={setSearch} />
      <AuditFilterBar value={filter} onChange={setFilter} />
      {!logs.length ? (
        <EmptyState icon={ClipboardList} title="No audit logs" />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelected({
                  id: log.id,
                  actorName: log.actorType,
                  action: log.action,
                  target: log.targetUserId ?? undefined,
                  createdAt: log.createdAt,
                  metadata: log.payload,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelected({
                    id: log.id,
                    actorName: log.actorType,
                    action: log.action,
                    target: log.targetUserId ?? undefined,
                    createdAt: log.createdAt,
                    metadata: log.payload,
                  });
                }
              }}
            >
              <AuditListItem log={log} />
            </div>
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
      <AuditDetailSheet event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
