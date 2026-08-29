export function LastUpdated({ value }: { value: string | null }) { return <p className="text-xs text-tg-hint">Last updated: {value ? new Date(value).toLocaleTimeString() : '—'}</p>; }
