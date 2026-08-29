import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/api/users';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { Bell } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

type NotifCategory = 'all' | 'bets' | 'balance' | 'subscription' | 'referral' | 'system';

export function NotificationsScreen() {
  const [filter, setFilter] = useState<NotifCategory>('all');
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(false),
    refetchInterval: 30_000,
  });

  const markOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      addToast({ type: 'success', message: 'All notifications marked read.' });
    },
  });

  const items = (query.data ?? []).filter((n: AppNotification) =>
    filter === 'all' ? true : n.category === filter
  );

  const filters: { id: NotifCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'bets', label: 'Bets' },
    { id: 'balance', label: 'Balance' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'referral', label: 'Referrals' },
    { id: 'system', label: 'System' },
  ];

  if (query.isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.id ? 'bg-tg-link text-white' : 'bg-tg-section text-tg-hint'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isError ? (
        <EmptyState
          icon={Bell}
          title="Could not load notifications"
          description="Pull to retry or check your connection."
        />
      ) : !items.length ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Bet results, referral milestones, and system alerts will show up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className="space-y-1 cursor-pointer"
              onClick={() => {
                if (!n.readAt) markOne.mutate(n.id);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-tg-text">{n.title}</p>
                {!n.readAt && <Badge variant="info">New</Badge>}
              </div>
              <p className="text-xs text-tg-hint">{n.body}</p>
              <p className="text-[10px] text-tg-hint">{new Date(n.createdAt).toLocaleString()}</p>
            </Card>
          ))}
          <Button
            variant="secondary"
            className="w-full"
            loading={markAll.isPending}
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>
      )}
    </div>
  );
}
