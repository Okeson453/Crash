interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
}

export function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-tg-hint">{label}</span>
        <span className="text-tg-text">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-tg-hint/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-tg-link transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
