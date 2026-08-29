import { useTelegram } from '@/hooks/useTelegram';
export function usePlatform() { const { webApp } = useTelegram(); return { platform: webApp?.platform ?? 'web', version: webApp?.version ?? null }; }
