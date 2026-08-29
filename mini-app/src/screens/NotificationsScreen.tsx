/**
 * Persistent notification center (not only toasts).
 */
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Bell } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

type NotifCategory = 'all' | 'bets' | 'balance' | 'subscription' | 'referral' | 'system';

interface LocalNotification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** Seed from in-memory toasts history if present; otherwise empty state. */
function useLocalNotifications(): LocalNotification[] {
  const toasts = useUIStore((s) => s.toasts);
  return toasts.map((t) => ({
    id: t.id,
    category: 'system' as const,
    title: t.type.charAt(0).toUpperCase() + t.type.slice(1),
    body: t.message,
    read: false,
    createdAt: new Date().toISOString(),
  }));
}

export function NotificationsScreen() {
  const [filter, setFilter] = useState<NotifCategory>('all');
  const items = useLocalNotifications();
  const filtered =
    filter === 'all' ? items : items.filter((n) => n.category === filter);

  const filters: { id: NotifCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'bets', label: 'Bets' },
    { id: 'balance', label: 'Balance' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'referral', label: 'Referrals' },
    { id: 'system', label: 'System' },
  ];

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.id
                ? 'bg-tg-link text-white'
                : 'bg-tg-section text-tg-hint'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Bet results, referral milestones, and system alerts will show up here."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card key={n.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-tg-text">{n.title}</p>
                {!n.read && <Badge variant="info">New</Badge>}
              </div>
              <p className="text-xs text-tg-hint">{n.body}</p>
            </Card>
          ))}
          <Button variant="secondary" className="w-full" disabled>
            Mark all read
          </Button>
        </div>
      )}
    </div>
  );
}
