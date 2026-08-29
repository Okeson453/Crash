import { Card } from '@/components/ui/Card';
import type { AdminConfig } from '@/types/api';

export function ConfigPreview({ config }: { config: AdminConfig }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Stake per entry', value: String(config.stakePerEntry ?? '—') },
    { label: 'Cash-out target', value: String(config.cashOutTarget ?? '—') },
    { label: 'Max daily entries', value: String(config.maxDailyEntries ?? '—') },
    { label: 'Mode', value: String(config.mode ?? '—') },
  ];
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Current configuration</p>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-xs text-tg-hint">{r.label}</p>
            <p className="text-sm font-medium text-tg-text">{r.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
