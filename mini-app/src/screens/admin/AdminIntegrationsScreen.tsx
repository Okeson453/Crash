import { useQuery } from '@tanstack/react-query';
import {
  getTelegramBotStatus,
  getWebhookEndpoints,
  getConnectedServices,
} from '@/api/admin';
import { TelegramBotCard } from '@/components/admin/TelegramBotCard';
import { ConnectedServicesList } from '@/components/admin/ConnectedServicesList';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Plug, Webhook } from 'lucide-react';

export function AdminIntegrationsScreen() {
  const bot = useQuery({ queryKey: ['integration-bot'], queryFn: getTelegramBotStatus });
  const webhooks = useQuery({
    queryKey: ['integration-webhooks'],
    queryFn: getWebhookEndpoints,
  });
  const services = useQuery({
    queryKey: ['integration-services'],
    queryFn: getConnectedServices,
  });

  if (bot.isLoading || webhooks.isLoading || services.isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-4">
      {bot.data ? (
        <TelegramBotCard bot={bot.data} />
      ) : (
        <EmptyState icon={Plug} title="Bot status unavailable" />
      )}
      {webhooks.data && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-tg-link" />
            <p className="text-sm font-semibold text-tg-text">Webhook endpoints</p>
          </div>
          <p className="text-xs text-tg-hint truncate">Bet: {webhooks.data.betEvents || '—'}</p>
          <p className="text-xs text-tg-hint truncate">Round: {webhooks.data.roundEvents || '—'}</p>
          <p className="text-xs text-tg-hint truncate">User: {webhooks.data.userEvents || '—'}</p>
        </Card>
      )}
      {services.data && services.data.length > 0 && (
        <ConnectedServicesList services={services.data} />
      )}
    </div>
  );
}
