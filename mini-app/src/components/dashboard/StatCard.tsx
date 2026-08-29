import { Card } from '@/components/ui/Card';
export function StatCard({ label, value }: { label: string; value: string | number }) { return <Card><p className="text-xs text-tg-hint">{label}</p><p className="mt-1 text-xl font-bold text-tg-text">{value}</p></Card>; }
