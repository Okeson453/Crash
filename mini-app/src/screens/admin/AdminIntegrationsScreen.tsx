import { useQuery } from '@tanstack/react-query';
import {
  getTelegramBotStatus,
  getWebhookEndpoints,
  getConnectedServices,
} from '@/api/admin';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Plug, Bot, Webhook, Server } from 'lucide-react';

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
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-tg-link" />
              <p className="text-sm font-semibold text-tg-text">Telegram Bot</p>
            </div>
            <Badge variant={bot.data.isConnected ? 'success' : 'danger'}>
              {bot.data.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="rounded-xl bg-tg-section p-3">
            <p className="text-xs text-tg-hint">Bot name</p>
            <p className="text-sm font-medium text-tg-text">@{bot.data.botName}</p>
          </div>
          {bot.data.webhookUrl && (
            <p className="text-xs text-tg-hint truncate">Webhook: {bot.data.webhookUrl}</p>
          )}
        </Card>
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
          <p className="text-xs text-tg-hint truncate">
            Round: {webhooks.data.roundEvents || '—'}
          </p>
          <p className="text-xs text-tg-hint truncate">
            User: {webhooks.data.userEvents || '—'}
          </p>
        </Card>
      )}

      {services.data && services.data.length > 0 && (
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-tg-text">Connected services</p>
          {services.data.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
            >
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-tg-hint" />
                <p className="text-sm text-tg-text">{svc.name}</p>
              </div>
              <Badge variant={svc.status === 'connected' ? 'success' : 'danger'}>
                {svc.status}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
