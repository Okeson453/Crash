import { useQuery } from '@tanstack/react-query';
import { getAdminTransactions, type AdminTransaction } from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CreditCard } from 'lucide-react';

export function AdminTransactionsScreen() {
  const query = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: getAdminTransactions,
  });

  if (query.isLoading) return <LoadingSpinner size="lg" />;
  const rows = query.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No transactions"
        description="Deposits, withdrawals and ledger events will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((t: AdminTransaction) => (
        <Card key={t.id} className="space-y-1">
          <div className="flex justify-between gap-2">
            <p className="text-sm font-medium text-tg-text truncate">
              {t.type} · {t.amount.toLocaleString()}
            </p>
            <Badge
              variant={
                t.status === 'completed' || t.status === 'success' || t.status === 'paid'
                  ? 'success'
                  : t.status === 'failed' || t.status === 'reversed'
                    ? 'danger'
                    : 'warning'
              }
            >
              {t.status}
            </Badge>
          </div>
          <p className="text-xs text-tg-hint">
            @{t.username || (t.userId ? t.userId.slice(0, 8) : 'system')} ·{' '}
            {new Date(t.createdAt).toLocaleString()}
          </p>
          {t.reference && <p className="text-xs text-tg-hint truncate">Ref: {t.reference}</p>}
        </Card>
      ))}
    </div>
  );
}
