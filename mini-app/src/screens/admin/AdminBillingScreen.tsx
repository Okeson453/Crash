import { useQuery } from '@tanstack/react-query';
import { getBillingStatus, getBillingUsage, getBillingInvoices } from '@/api/admin';
import { SubscriptionCard } from '@/components/admin/SubscriptionCard';
import { UsageMeter } from '@/components/admin/UsageMeter';
import { InvoiceList } from '@/components/admin/InvoiceList';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
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
      {sub.data && <SubscriptionCard subscription={sub.data} />}
      {usage.data && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-tg-text">Usage</p>
          <UsageMeter label="API calls" used={usage.data.apiCalls} limit={usage.data.apiCallsLimit} />
          <UsageMeter label="Players" used={usage.data.players} limit={usage.data.playersLimit} />
          <UsageMeter label="Rounds" used={usage.data.rounds} limit={usage.data.roundsLimit} />
        </Card>
      )}
      {invoices.data && <InvoiceList invoices={invoices.data} />}
    </div>
  );
}
