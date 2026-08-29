import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { History } from 'lucide-react';
import type { ConfigHistoryEntry } from '@/types/api';

export function ConfigHistory({ entries }: { entries: ConfigHistoryEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon={History}
        title="No configuration history"
        description="Changes to execution config will appear here."
      />
    );
  }
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Configuration history</p>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li key={e.id} className="border-b border-tg-hint/10 pb-2 last:border-0">
            <p className="text-sm text-tg-text">{e.description}</p>
            <p className="text-xs text-tg-hint">
              {e.actorName} · {new Date(e.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
