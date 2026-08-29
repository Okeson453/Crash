type UserStatusFilter = 'all' | 'active' | 'suspended' | 'banned' | 'onboarding';

const FILTERS: { id: UserStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'banned', label: 'Banned' },
  { id: 'onboarding', label: 'Onboarding' },
];

interface UserFilterChipsProps {
  value: UserStatusFilter;
  onChange: (filter: UserStatusFilter) => void;
}

export function UserFilterChips({ value, onChange }: UserFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === f.id
              ? 'bg-tg-link text-white'
              : 'bg-tg-section text-tg-hint hover:text-tg-text'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
