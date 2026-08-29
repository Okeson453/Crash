import type { AdminSessionState } from '@/types/api';
import { Card } from '@/components/ui/Card';
export function HealthChecks({ checks }: { checks: AdminSessionState['healthChecks'] }) { if(!checks.length)return null; return <Card><h3 className="section-header">Health checks</h3><div className="space-y-2">{checks.map((check)=><div key={check.component} className="rounded-lg bg-tg-section p-3"><p className="text-sm font-medium text-tg-text">{check.component}</p><p className="text-xs text-tg-hint">{check.status}: {check.message}</p></div>)}</div></Card>; }
