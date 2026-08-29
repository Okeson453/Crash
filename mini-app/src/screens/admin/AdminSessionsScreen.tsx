import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminBrowserSessions,
  terminateAdminSession,
  type AdminBrowserSession,
} from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Monitor } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function AdminSessionsScreen() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({ queryKey: ['admin-sessions'], queryFn: getAdminBrowserSessions, refetchInterval: 15000 });
  const terminate = useMutation({
    mutationFn: (id: string) => terminateAdminSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-sessions'] });
      addToast({ type: 'success', message: 'Session terminated.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        icon={Monitor}
        title="No browser sessions"
        description="Active and historical browser sessions will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((s: AdminBrowserSession) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-tg-text truncate">{s.id.slice(0, 8)}…</p>
            <Badge variant={s.status === 'stopped' ? 'neutral' : s.status === 'error' ? 'danger' : 'success'}>
              {s.status}
            </Badge>
          </div>
          <p className="text-xs text-tg-hint">
            Mode {s.mode} · Started {new Date(s.startedAt).toLocaleString()}
            {s.endedAt ? ` · Ended ${new Date(s.endedAt).toLocaleString()}` : ''}
          </p>
          {s.browserProfileId && (
            <p className="text-xs text-tg-hint">Profile: {s.browserProfileId}</p>
          )}
          {s.status !== 'stopped' && (
            <Button
              variant="secondary"
              className="w-full"
              loading={terminate.isPending}
              onClick={() => terminate.mutate(s.id)}
            >
              Terminate
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
