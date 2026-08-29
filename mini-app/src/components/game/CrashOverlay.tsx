import { useGameStore } from '@/stores/gameStore';
import { formatMultiplier } from '@/utils/formatting';
import { Skull } from 'lucide-react';

export function CrashOverlay() {
  const { phase, crashPoint, activeBet } = useGameStore();

  if (phase !== 'crashed') return null;

  const lostBet = activeBet && activeBet.state === 'lost';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 rounded-2xl animate-fade-in">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-crash-red flex items-center justify-center mx-auto mb-3 animate-crash-shake">
          <Skull className="w-8 h-8 text-white" />
        </div>
        <p className="text-3xl font-black text-white">{formatMultiplier(crashPoint ?? 1.0)}</p>
        <p className="text-white/80 font-semibold mt-1">CRASHED</p>
        {lostBet && (
          <p className="text-white/60 text-sm mt-2">You lost this round</p>
        )}
      </div>
    </div>
  );
}
