import { useQuery } from '@tanstack/react-query';
import { getBillingStatus, getBillingUsage, getBillingInvoices } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CreditCard } from 'lucide-react';

export function AdminBillingScreen() {
  const sub = useQuery({ queryKey: ['admin-billing-sub'], queryFn: getBillingStatus });
  const usage = useQuery({ queryKey: ['admin-billing-usage'], queryFn: getBillingUsage });
  const invoices = useQuery({ queryKey: ['admin-billing-invoices'], queryFn: getBillingInvoices });

  if (sub.isLoading || usage.isLoading) return <LoadingSpinner size="lg" />;

  if (!sub.data && !usage.data) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Billing unavailable"
        description="No subscription or usage data returned from the backend."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sub.data && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-tg-text">Subscription</p>
            <Badge
              variant={
                sub.data.status === 'active'
                  ? 'success'
                  : sub.data.status === 'past_due'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {sub.data.status}
            </Badge>
          </div>
          <p className="text-lg font-bold text-tg-text">{sub.data.planName}</p>
          <p className="text-sm text-tg-hint">{sub.data.price}</p>
          {sub.data.renewsAt && (
            <p className="text-xs text-tg-hint">
              Renews {new Date(sub.data.renewsAt).toLocaleDateString()}
            </p>
          )}
        </Card>
      )}
      {usage.data && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-tg-text">Usage</p>
          <UsageRow label="API calls" used={usage.data.apiCalls} limit={usage.data.apiCallsLimit} />
          <UsageRow label="Players" used={usage.data.players} limit={usage.data.playersLimit} />
          <UsageRow label="Rounds" used={usage.data.rounds} limit={usage.data.roundsLimit} />
        </Card>
      )}
      {invoices.data && invoices.data.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-tg-text">Invoices</p>
          {invoices.data.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
            >
              <div>
                <p className="text-sm text-tg-text">{inv.period}</p>
                <p className="text-xs text-tg-hint">
                  {new Date(inv.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-tg-text">${inv.amount}</p>
                <Badge
                  variant={
                    inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'
                  }
                >
                  {inv.status}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-tg-hint">{label}</span>
        <span className="text-tg-text">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-tg-hint/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-tg-link transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
