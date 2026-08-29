import { useGameStore } from '@/stores/gameStore';
import { Timer } from 'lucide-react';

export function RoundCountdown() {
  const { countdownSeconds, phase } = useGameStore();

  if (phase !== 'countdown' || countdownSeconds === null) return null;

  const isUrgent = countdownSeconds <= 3;

  return (
    <div
      className={`flex items-center justify-center gap-2 py-3 rounded-xl ${isUrgent ? 'bg-crash-red/10' : 'bg-tg-section'}`}
      role="timer"
      aria-label={`Round starts in ${countdownSeconds} seconds`}
    >
      <Timer className={`w-5 h-5 ${isUrgent ? 'text-crash-red' : 'text-tg-hint'}`} />
      <span
        className={`text-2xl font-bold tabular-nums ${isUrgent ? 'text-crash-red animate-pulse' : 'text-tg-text'}`}
      >
        {countdownSeconds.toFixed(1)}s
      </span>
    </div>
  );
}
