type AuditFilter = 'all' | 'admin' | 'user' | 'system' | 'referral' | 'billing';

const FILTERS: { id: AuditFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admin' },
  { id: 'user', label: 'User' },
  { id: 'system', label: 'System' },
  { id: 'referral', label: 'Referral' },
  { id: 'billing', label: 'Billing' },
];

interface AuditFilterBarProps {
  value: AuditFilter;
  onChange: (v: AuditFilter) => void;
}

export function AuditFilterBar({ value, onChange }: AuditFilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === f.id ? 'bg-tg-link text-white' : 'bg-tg-section text-tg-hint hover:text-tg-text'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export type { AuditFilter };
