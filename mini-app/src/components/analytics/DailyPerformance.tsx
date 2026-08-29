import type { ReactNode } from 'react';
export function DailyPerformance({ children }: { children?: ReactNode }) { return <section className="card"><h2 className="section-header">DailyPerformance</h2>{children ?? <p className="text-sm text-tg-hint">Data will appear when the analytics API provides this series.</p>}</section>; }
