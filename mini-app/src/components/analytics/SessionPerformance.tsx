import type { ReactNode } from 'react';
export function SessionPerformance({ children }: { children?: ReactNode }) { return <section className="card"><h2 className="section-header">SessionPerformance</h2>{children ?? <p className="text-sm text-tg-hint">Data will appear when the analytics API provides this series.</p>}</section>; }
