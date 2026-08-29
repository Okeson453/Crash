import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ConnectedService } from '@/types/api';
import { Server } from 'lucide-react';

interface ConnectedServicesListProps {
  services: ConnectedService[];
}

export function ConnectedServicesList({ services }: ConnectedServicesListProps) {
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Connected services</p>
      {services.map((svc) => (
        <div
          key={svc.name}
          className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
        >
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-tg-hint" />
            <p className="text-sm text-tg-text">{svc.name}</p>
          </div>
          <Badge variant={svc.status === 'connected' ? 'success' : 'danger'}>{svc.status}</Badge>
        </div>
      ))}
    </Card>
  );
}
