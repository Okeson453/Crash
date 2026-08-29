import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminLogs, type AdminLogEntry } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ScrollText } from 'lucide-react';

export function AdminLogsScreen() {
  const [filter, setFilter] = useState('');
  const query = useQuery({ queryKey: ['admin-logs'], queryFn: getAdminLogs });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = (query.data ?? []).filter((e) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      e.message.toLowerCase().includes(q) ||
      e.source.toLowerCase().includes(q) ||
      (e.actorId ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter logs…"
      />
      {!rows.length ? (
        <EmptyState icon={ScrollText} title="No logs" description="Audit and system events will appear here." />
      ) : (
        rows.map((e: AdminLogEntry) => (
          <Card key={e.id} className="space-y-1">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium text-tg-text truncate">{e.message}</p>
              <Badge variant={e.level === 'warning' ? 'warning' : e.level === 'error' ? 'danger' : 'neutral'}>
                {e.source}
              </Badge>
            </div>
            <p className="text-xs text-tg-hint">
              {new Date(e.createdAt).toLocaleString()}
              {e.actorId ? ` · ${e.actorId.slice(0, 8)}` : ''}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}
