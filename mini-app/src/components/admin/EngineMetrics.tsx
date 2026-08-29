import { Card } from '@/components/ui/Card';
import type { AdminSessionState } from '@/types/api';

interface EngineMetricsProps {
  session: AdminSessionState | undefined;
}

export function EngineMetrics({ session }: EngineMetricsProps) {
  if (!session) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <p className="text-xs text-tg-hint">Uptime</p>
        <p className="text-sm font-bold text-tg-text">
          {Math.floor((session.uptimeSeconds ?? 0) / 60)}m
        </p>
      </Card>
      <Card>
        <p className="text-xs text-tg-hint">Total rounds</p>
        <p className="text-sm font-bold text-tg-text">{session.totalRounds}</p>
      </Card>
      <Card>
        <p className="text-xs text-tg-hint">Total bets</p>
        <p className="text-sm font-bold text-tg-text">{session.totalBets}</p>
      </Card>
      <Card>
        <p className="text-xs text-tg-hint">PnL</p>
        <p className="text-sm font-bold text-tg-text">{session.totalPnl}</p>
      </Card>
    </div>
  );
}
