import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { TelegramBotStatus } from '@/types/api';
import { Bot } from 'lucide-react';

interface TelegramBotCardProps {
  bot: TelegramBotStatus;
}

export function TelegramBotCard({ bot }: TelegramBotCardProps) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-tg-link" />
          <p className="text-sm font-semibold text-tg-text">Telegram Bot</p>
        </div>
        <Badge variant={bot.isConnected ? 'success' : 'danger'}>
          {bot.isConnected ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>
      <div className="rounded-xl bg-tg-section p-3">
        <p className="text-xs text-tg-hint">Bot name</p>
        <p className="text-sm font-medium text-tg-text">@{bot.botName}</p>
      </div>
      {bot.webhookUrl && (
        <p className="text-xs text-tg-hint truncate">Webhook: {bot.webhookUrl}</p>
      )}
    </Card>
  );
}
