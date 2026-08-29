import { useGameStore } from '@/stores/gameStore';

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: 'Idle', color: 'bg-tg-hint' },
  waiting: { label: 'Waiting', color: 'bg-tg-hint' },
  countdown: { label: 'Starting', color: 'bg-crash-yellow' },
  running: { label: 'Live', color: 'bg-crash-green' },
  crashed: { label: 'Crashed', color: 'bg-crash-red' },
  paused: { label: 'Paused', color: 'bg-crash-orange' },
  error: { label: 'Error', color: 'bg-crash-red' },
};

export function RoundStatus() {
  const { phase, roundId } = useGameStore();
  const status = PHASE_LABELS[phase] || PHASE_LABELS.idle;

  return (
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${status.color} ${phase === 'running' ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-tg-text">{status.label}</span>
      </div>
      {roundId && (
        <span className="text-xs text-tg-hint font-mono">
          #{roundId.slice(-6)}
        </span>
      )}
    </div>
  );
}
