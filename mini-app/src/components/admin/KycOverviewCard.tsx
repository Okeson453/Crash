import { Card } from '@/components/ui/Card';
import type { KycOverview } from '@/types/api';
import { UserCheck, Clock, XCircle, Users } from 'lucide-react';

interface KycOverviewCardProps {
  overview: KycOverview;
}

export function KycOverviewCard({ overview }: KycOverviewCardProps) {
  const items = [
    { label: 'Verified', value: overview.verified, icon: UserCheck, color: 'text-crash-green' },
    { label: 'Pending', value: overview.pending, icon: Clock, color: 'text-crash-yellow' },
    { label: 'Rejected', value: overview.rejected, icon: XCircle, color: 'text-crash-red' },
    { label: 'Total', value: overview.total, icon: Users, color: 'text-tg-link' },
  ];
  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-tg-text">KYC overview</p>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <div>
              <p className="text-lg font-bold text-tg-text">{item.value}</p>
              <p className="text-xs text-tg-hint">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
