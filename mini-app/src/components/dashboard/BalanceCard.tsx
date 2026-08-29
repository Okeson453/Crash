import { Card } from '@/components/ui/Card';
export function BalanceCard({ balance }: { balance: number | null }) { return <Card><p className="text-xs text-tg-hint">Balance</p><p className="mt-1 text-2xl font-bold text-tg-text">{balance === null ? '—' : balance.toFixed(2)}</p></Card>; }
