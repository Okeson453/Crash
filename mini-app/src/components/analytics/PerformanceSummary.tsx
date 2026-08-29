import type { AnalyticsOverview } from '@/types/api';
import { Stat } from '@/components/ui/Stat';
export function PerformanceSummary({ data }: { data: AnalyticsOverview }) { return <div className="grid grid-cols-2 gap-3"><Stat label="Active players" value={data.activePlayers}/><Stat label="Total bets" value={data.totalBets}/><Stat label="Wagered" value={data.totalWagered}/><Stat label="House profit" value={data.houseProfit}/></div>; }
