import { useQuery } from '@tanstack/react-query';
import { getAdminSessionState } from '@/api/admin';
import { Card } from '@/components/ui/Card';
export function EngineStatusCard() { const q=useQuery({queryKey:['admin-session'],queryFn:getAdminSessionState,refetchInterval:5000}); return <Card><p className="text-xs text-tg-hint">Engine status</p><p className="font-semibold text-tg-text">{q.data?.status ?? 'not available'}</p></Card>; }
