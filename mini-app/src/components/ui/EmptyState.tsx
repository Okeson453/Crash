import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: typeof Inbox;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'Check back later for updates.',
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-tg-section flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-tg-hint" />
      </div>
      <h3 className="text-lg font-semibold text-tg-text mb-1">{title}</h3>
      <p className="text-sm text-tg-hint max-w-xs">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary mt-4 text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
