import type { ReactNode } from 'react';
export function ROIChart({ children }: { children?: ReactNode }) { return <section className="card"><h2 className="section-header">ROIChart</h2>{children ?? <p className="text-sm text-tg-hint">Data will appear when the analytics API provides this series.</p>}</section>; }
