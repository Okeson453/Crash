import { Card } from '@/components/ui/Card';
import { Activity, Settings } from 'lucide-react';
import { formatDateTime } from '@/utils/formatting';
import type { AuditLogEntry } from '@/types/api';

interface AuditListItemProps {
  log: AuditLogEntry;
  onClick?: () => void;
}

export function AuditListItem({ log, onClick }: AuditListItemProps) {
  return (
    <Card
      className={onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : undefined}
      onClick={onClick}
    >
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
  );
}
