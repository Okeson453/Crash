import { WifiOff } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function OfflineBanner() {
  const isOffline = useUIStore((s) => s.isOffline);

  if (!isOffline) return null;

  return (
    <div
      className="bg-crash-yellow/90 text-black px-4 py-2 text-sm font-medium flex items-center justify-center gap-2"
      role="alert"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}
