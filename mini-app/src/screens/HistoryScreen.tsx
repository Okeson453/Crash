import { formatCurrency, formatMultiplier, formatDateTime } from '@/utils/formatting';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { HistorySkeleton } from '@/components/history/HistorySkeleton';
import { EmptyHistoryState } from '@/components/history/EmptyHistoryState';
import { ExportHistoryButton } from '@/components/history/ExportHistoryButton';
import { Button } from '@/components/ui/Button';
import { useBetHistory } from '@/hooks/betting/useBetHistory';

const STATUS_LABELS: Record<string, string> = { pending: 'Pending', placed: 'Placed', active: 'Active', cashed_out: 'Won', lost: 'Lost', cancelled: 'Cancelled', failed: 'Failed' };
export function HistoryScreen() {
  const { bets, filters, range, setFilters, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useBetHistory();
  const selectedStatus = Array.isArray(filters.status) ? undefined : filters.status;
  return <div className="page-container px-4 py-4 space-y-4"><div className="flex items-center justify-between"><h1 className="text-xl font-bold text-tg-text">History</h1><ExportHistoryButton bets={bets} /></div><HistoryFilters status={selectedStatus} range={range} onStatus={(status) => setFilters({ status })} onRange={(next) => setFilters({ range: next })} />{isLoading ? <HistorySkeleton /> : bets.length === 0 ? <EmptyHistoryState /> : <div className="space-y-3">{bets.map((bet) => <div key={bet.id} className="card"><div className="flex items-center justify-between"><span className="font-mono text-xs text-tg-hint">#{bet.id.slice(-6)}</span><span className="rounded-full bg-tg-section px-2 py-1 text-xs text-tg-text">{STATUS_LABELS[bet.state] ?? bet.state}</span></div><div className="mt-2 flex items-center justify-between"><div><p className="text-lg font-bold text-tg-text">{formatCurrency(bet.amount)}</p>{bet.autoCashout && <p className="text-xs text-tg-hint">Auto: {formatMultiplier(bet.autoCashout)}</p>}</div><div className="text-right">{bet.cashoutMultiplier && <p className="text-lg font-bold text-crash-green">{formatMultiplier(bet.cashoutMultiplier)}</p>}{bet.pnl !== null && <p className={`text-sm font-medium ${bet.pnl >= 0 ? 'text-crash-green' : 'text-crash-red'}`}>{bet.pnl >= 0 ? '+' : ''}{formatCurrency(bet.pnl)}</p>}</div></div><p className="mt-2 text-xs text-tg-hint">{formatDateTime(bet.createdAt)}</p></div>)}{hasNextPage && <Button className="w-full" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>Load more</Button>}</div>}</div>;
}
