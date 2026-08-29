import type { RoundHistoryItem } from '@/types/game';
import { Card } from '@/components/ui/Card';
export function RecentRoundsList({ rounds }: { rounds: RoundHistoryItem[] }) { return <Card><h2 className="section-header">Recent rounds</h2><div className="flex gap-2 overflow-x-auto">{rounds.slice(0,10).map((round)=><span key={round.roundId} className="rounded-lg bg-tg-section px-2 py-1 text-xs text-tg-text">{round.crashPoint.toFixed(2)}x</span>)}</div></Card>; }
