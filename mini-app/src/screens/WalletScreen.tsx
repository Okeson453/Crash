import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBalance, getDepositAccount, getWalletTransactions } from '@/api/users';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Wallet, ArrowDownLeft, ArrowUpRight, Copy } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function WalletScreen() {
  const [showDeposit, setShowDeposit] = useState(false);
  const addToast = useUIStore((s) => s.addToast);
  const balance = useQuery({ queryKey: ['balance'], queryFn: getBalance });
  const deposit = useQuery({
    queryKey: ['deposit-account'],
    queryFn: getDepositAccount,
    enabled: showDeposit,
  });
  const txs = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: getWalletTransactions,
  });

  if (balance.isLoading) return <LoadingSpinner size="lg" />;

  const b = balance.data;

  return (
    <div className="page-container px-4 py-4 space-y-4">
      <Card className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Cash balance</p>
        </div>
        <p className="text-2xl font-bold text-tg-text">
          {b?.currencySymbol ?? '$'}
          {(b?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-tg-hint">
          Cash balance is separate from promotional bonus entries and betting time — rewards
          cannot be withdrawn.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => setShowDeposit(true)}
          loading={showDeposit && deposit.isLoading}
        >
          <ArrowDownLeft className="mr-2 h-4 w-4" /> Deposit
        </Button>
        <Button
          variant="secondary"
          disabled
          onClick={() =>
            addToast({
              type: 'info',
              message: 'Withdrawals require bank details and live Paystack transfers — not enabled.',
            })
          }
        >
          <ArrowUpRight className="mr-2 h-4 w-4" /> Withdraw
        </Button>
      </div>

      {showDeposit && (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-tg-text">Bank transfer deposit</p>
          {deposit.isLoading && <LoadingSpinner />}
          {deposit.isError && (
            <p className="text-sm text-crash-red">
              {deposit.error instanceof Error
                ? deposit.error.message
                : 'Could not load deposit account'}
            </p>
          )}
          {deposit.data && !deposit.data.configured && (
            <p className="text-sm text-tg-hint">
              {deposit.data.message ??
                'Payment provider is not configured. Set PAYSTACK_SECRET_KEY to enable deposits.'}
            </p>
          )}
          {deposit.data?.configured && deposit.data.accountNumber && (
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-tg-hint">Bank</p>
                <p className="font-medium text-tg-text">{deposit.data.bankName}</p>
              </div>
              <div>
                <p className="text-xs text-tg-hint">Account name</p>
                <p className="font-medium text-tg-text">{deposit.data.accountName}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-tg-hint">Account number</p>
                  <p className="font-mono font-medium text-tg-text">{deposit.data.accountNumber}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(deposit.data!.accountNumber!);
                    addToast({ type: 'success', message: 'Account number copied.' });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-tg-hint">
                Transfer any amount to this dedicated account. Credits appear after Paystack
                confirms the payment webhook.
              </p>
            </div>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setShowDeposit(false)}>
            Close
          </Button>
        </Card>
      )}

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-tg-text">Transactions</p>
        {txs.isLoading && <LoadingSpinner />}
        {!txs.isLoading && !(txs.data?.length) && (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            description="Deposits and payment events will list here."
          />
        )}
        {txs.data?.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between border-b border-tg-hint/10 py-2 last:border-0 text-sm"
          >
            <div>
              <p className="text-tg-text">
                {t.currency} {t.amount}
              </p>
              <p className="text-xs text-tg-hint">{new Date(t.createdAt).toLocaleString()}</p>
            </div>
            <Badge
              variant={
                t.status === 'success' || t.status === 'completed'
                  ? 'success'
                  : t.status === 'failed'
                    ? 'danger'
                    : 'neutral'
              }
            >
              {t.status}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
