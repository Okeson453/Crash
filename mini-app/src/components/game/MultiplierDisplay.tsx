import { useGameStore } from '@/stores/gameStore';
import { formatMultiplier } from '@/utils/formatting';
import { useSettingsStore } from '@/stores/settingsStore';

export function MultiplierDisplay() {
  const { phase, multiplier, crashPoint } = useGameStore();
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled);

  const getBgGradient = () => {
    if (phase === 'crashed') return 'gradient-crash';
    if (phase === 'running') return 'gradient-multiplier';
    return 'bg-tg-section';
  };

  const displayValue = phase === 'crashed' && crashPoint
    ? crashPoint
    : multiplier ?? 1.0;

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl p-8 min-h-[180px] ${getBgGradient()} ${animationsEnabled && phase === 'running' ? 'animate-pulse-fast' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Current multiplier: ${formatMultiplier(displayValue)}`}
    >
      <div className="text-center">
        <div
          className={`text-6xl font-black tracking-tight ${phase === 'crashed' ? 'text-white' : phase === 'running' ? 'text-white' : 'text-tg-text'} ${animationsEnabled && phase === 'running' ? 'transition-transform duration-100' : ''}`}
        >
          {formatMultiplier(displayValue)}
        </div>
        {phase === 'crashed' && (
          <p className="text-white/80 text-lg font-semibold mt-2 animate-crash">
            CRASHED
          </p>
        )}
        {phase === 'running' && (
          <p className="text-white/60 text-sm mt-1">Growing...</p>
        )}
      </div>

      {/* Decorative elements */}
      {phase === 'running' && animationsEnabled && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 animate-pulse" />
        </div>
      )}
    </div>
  );
}
