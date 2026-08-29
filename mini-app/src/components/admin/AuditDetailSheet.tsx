import { BottomSheet } from '@/components/ui/BottomSheet';
import { Badge } from '@/components/ui/Badge';

export interface AuditEventView {
  id: string;
  actorName?: string;
  action: string;
  target?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface AuditDetailSheetProps {
  event: AuditEventView | null;
  onClose: () => void;
}

export function AuditDetailSheet({ event, onClose }: AuditDetailSheetProps) {
  return (
    <BottomSheet isOpen={Boolean(event)} onClose={onClose} title="Audit event">
      {event && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-tg-hint">Action</p>
            <p className="text-sm font-medium text-tg-text">{event.action}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-tg-hint">Actor</p>
              <p className="text-sm text-tg-text">{event.actorName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-tg-hint">Target</p>
              <p className="text-sm text-tg-text truncate">{event.target ?? '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-tg-hint">Timestamp</p>
            <p className="text-sm text-tg-text">{new Date(event.createdAt).toLocaleString()}</p>
          </div>
          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div>
              <p className="text-xs text-tg-hint mb-1">Metadata</p>
              <pre className="text-xs bg-tg-section rounded-xl p-3 overflow-x-auto text-tg-text">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
          <Badge variant="neutral">{event.id}</Badge>
        </div>
      )}
    </BottomSheet>
  );
}
