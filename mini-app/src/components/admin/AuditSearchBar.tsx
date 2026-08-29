import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';

interface AuditSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function AuditSearchBar({ value, onChange }: AuditSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tg-hint pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search audit actions..."
        className="pl-9 pr-9"
      />
      {value && (
        <IconButton
          className="absolute right-2 top-1/2 -translate-y-1/2"
          label="Clear search"
          onClick={() => onChange('')}
        >
          <X className="h-4 w-4 text-tg-hint" />
        </IconButton>
      )}
    </div>
  );
}
