import type { ReactNode } from 'react';
export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) { return <div className="card"><div className="flex items-center gap-2 text-xs text-tg-hint">{icon}{label}</div><div className="mt-1 text-xl font-bold text-tg-text">{value}</div></div>; }
