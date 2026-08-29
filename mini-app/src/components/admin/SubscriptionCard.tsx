import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Subscription } from '@/types/api';

interface SubscriptionCardProps {
  subscription: Subscription;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-tg-text">Subscription</p>
        <Badge
          variant={
            subscription.status === 'active'
              ? 'success'
              : subscription.status === 'past_due'
                ? 'warning'
                : 'neutral'
          }
        >
          {subscription.status}
        </Badge>
      </div>
      <p className="text-lg font-bold text-tg-text">{subscription.planName}</p>
      <p className="text-sm text-tg-hint">{subscription.price}</p>
      {subscription.renewsAt && (
        <p className="text-xs text-tg-hint">
          Renews {new Date(subscription.renewsAt).toLocaleDateString()}
        </p>
      )}
    </Card>
  );
}
