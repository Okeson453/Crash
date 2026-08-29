import { History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
export function EmptyHistoryState() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={History}
      title="No bets yet"
      description="Place your first bet to see it here."
      action={{ label: 'Place a bet', onClick: () => navigate('/') }}
    />
  );
}
