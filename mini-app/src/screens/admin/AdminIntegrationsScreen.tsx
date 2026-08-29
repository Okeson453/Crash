import { useQuery } from '@tanstack/react-query';
import {
  getTelegramBotStatus,
  getWebhookEndpoints,
  getConnectedServices,
} from '@/api/admin';
import { TelegramBotCard } from '@/components/admin/TelegramBotCard';
import { WebhookEndpointsForm } from '@/components/admin/WebhookEndpointsForm';
import { ConnectedServicesList } from '@/components/admin/ConnectedServicesList';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plug } from 'lucide-react';

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
      {webhooks.data && <WebhookEndpointsForm endpoints={webhooks.data} />}
      {services.data && services.data.length > 0 && (
        <ConnectedServicesList services={services.data} />
      )}
    </div>
  );
}
