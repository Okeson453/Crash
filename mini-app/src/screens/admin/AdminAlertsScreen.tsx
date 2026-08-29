import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminAlerts, acknowledgeAdminAlert, type AdminAlert } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bell } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function AdminAlertsScreen() {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const query = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: getAdminAlerts,
    refetchInterval: 15000,
  });
  const ack = useMutation({
    mutationFn: (id: string) => acknowledgeAdminAlert(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-alerts'] });
      addToast({ type: 'success', message: 'Alert acknowledged.' });
    },
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return <EmptyState icon={Bell} title="All clear" description="No active alerts." />;
  }

  return (
    <div className="space-y-2">
      {rows.map((a: AdminAlert) => (
        <Card key={a.id} className="space-y-2">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-medium text-tg-text">{a.message}</p>
            <Badge
              variant={
                a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'warning' : 'neutral'
              }
            >
              {a.severity}
            </Badge>
          </div>
          <p className="text-xs text-tg-hint">
            {a.component} · {new Date(a.createdAt).toLocaleString()}
            {a.acknowledged ? ' · acked' : ''}
          </p>
          {!a.acknowledged && (
            <Button
              variant="secondary"
              className="w-full"
              loading={ack.isPending}
              onClick={() => ack.mutate(a.id)}
            >
              Acknowledge
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
