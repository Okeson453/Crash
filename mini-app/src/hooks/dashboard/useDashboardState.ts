import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '@/api/health';
import { useConnectionState } from '@/hooks/useConnectionState';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useGameStore } from '@/stores/gameStore';
export type DashboardState = 'LOADING' | 'READY' | 'DEGRADED' | 'OFFLINE' | 'ENGINE_STOPPED' | 'ENGINE_STARTING' | 'ENGINE_ERROR' | 'AUTH_REQUIRED' | 'STALE';
export function useDashboardState(): { state: DashboardState; lastUpdated: string | null; healthLoading: boolean; healthError: unknown } {
  const online = useOnlineStatus();
  const connection = useConnectionState();
  const serverTime = useGameStore((s) => s.serverTime);
  const phase = useGameStore((s) => s.phase);
  const health = useQuery({ queryKey: ['health'], queryFn: getHealthStatus, staleTime: 10_000, refetchInterval: 15_000, retry: 1 });
  const state = useMemo<DashboardState>(() => {
    if (!online) return 'OFFLINE';
    if (health.isError) return 'DEGRADED';
    if (phase === 'error' || health.data?.status === 'unhealthy') return 'ENGINE_ERROR';
    if (phase === 'paused') return 'ENGINE_STOPPED';
    if (connection.isReconnecting) return 'DEGRADED';
    if (serverTime && Date.now() - Date.parse(serverTime) > 30_000) return 'STALE';
    if (health.isLoading) return 'LOADING';
    return 'READY';
  }, [online, health.isError, health.data?.status, health.isLoading, phase, connection.isReconnecting, serverTime]);
  return { state, lastUpdated: serverTime, healthLoading: health.isLoading, healthError: health.error };
}
