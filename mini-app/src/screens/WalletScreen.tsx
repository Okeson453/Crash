/**
 * Wallet — cash balance vs promotional entitlements.
 * Cash Balance ≠ Bonus Entries ≠ Bonus Betting Time
 */
import { useQuery } from '@tanstack/react-query';
import { getBalance, getUserActivity } from '@/api/users';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/utils/formatting';
import { Wallet, ArrowDownLeft, ArrowUpRight, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WalletScreen() {
  const navigate = useNavigate();
  const balance = useQuery({ queryKey: ['balance'], queryFn: getBalance, refetchInterval: 15000 });
  const activity = useQuery({
    queryKey: ['wallet-activity'],
    queryFn: () => getUserActivity(),
  });

  if (balance.isLoading) return <LoadingSpinner size="lg" />;

  const bal = balance.data;
  const txs = activity.data?.data ?? [];

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <Card className="space-y-2 bg-tg-button/10 border border-tg-button/20">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-tg-link" />
          <p className="text-sm text-tg-hint">Cash balance</p>
        </div>
        <p className="text-3xl font-black text-tg-text">
          {bal?.currencySymbol ?? '$'}
          {(bal?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-tg-hint">{bal?.currency ?? 'USD'}</p>
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Promotional entitlements</p>
        </div>
        <p className="text-xs text-tg-hint">
          Bonus entries and betting time from referrals or promotions are separate from cash and
          cannot be withdrawn.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-tg-section p-3">
            <p className="text-xs text-tg-hint">Bonus entries</p>
            <p className="font-medium text-tg-text">—</p>
          </div>
          <div className="rounded-xl bg-tg-section p-3">
            <p className="text-xs text-tg-hint">Bonus betting time</p>
            <p className="font-medium text-tg-text">—</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled>
          <ArrowDownLeft className="mr-2 h-4 w-4" /> Deposit
        </Button>
        <Button variant="secondary" disabled>
          <ArrowUpRight className="mr-2 h-4 w-4" /> Withdraw
        </Button>
      </div>
      <p className="text-xs text-tg-hint text-center">
        Real-money deposit/withdraw flows are not enabled in this build.
      </p>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Recent activity</p>
        {activity.isLoading && <LoadingSpinner size="sm" />}
        {!activity.isLoading && txs.length === 0 && (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Bets and balance changes will appear here."
            action={{ label: 'Play', onClick: () => navigate('/') }}
          />
        )}
        {txs.map((tx) => (
          <Card key={tx.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-tg-text">{tx.description || tx.type}</p>
              <p className="text-xs text-tg-hint">{formatDateTime(tx.createdAt)}</p>
            </div>
            <div className="text-right">
              {tx.amount != null && (
                <p className="text-sm font-medium text-tg-text">{tx.amount}</p>
              )}
              <Badge variant="neutral">{tx.type}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
