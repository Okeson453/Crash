import { useConnectionState } from '@/hooks/useConnectionState';
import { Card } from '@/components/ui/Card';
export function ConnectionStatus() { const c=useConnectionState(); return <Card><p className="text-xs text-tg-hint">Realtime connection</p><p className="font-semibold text-tg-text capitalize">{c.state}</p></Card>; }
