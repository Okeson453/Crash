import { useQuery } from '@tanstack/react-query';
import { getHealthStatus } from '@/api/health';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
export function SystemStatusCard() { const q=useQuery({queryKey:['health'],queryFn:getHealthStatus,refetchInterval:15000}); return <Card className="flex items-center justify-between"><div><p className="text-xs text-tg-hint">System health</p><p className="font-semibold text-tg-text">{q.data?.status ?? (q.isError ? 'unavailable' : 'checking')}</p></div><Badge variant={q.data?.status==='healthy'?'success':q.data?.status==='degraded'?'warning':'danger'}>{q.data?.status ?? 'unknown'}</Badge></Card>; }
