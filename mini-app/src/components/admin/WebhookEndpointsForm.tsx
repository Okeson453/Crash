import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { updateWebhookEndpoints } from '@/api/admin';
import { webhookEndpointsSchema } from '@/schemas/admin';
import { useUIStore } from '@/stores/uiStore';
import type { WebhookEndpoints } from '@/types/api';
import { z } from 'zod';
import { Webhook } from 'lucide-react';

type FormValues = z.infer<typeof webhookEndpointsSchema>;

export function WebhookEndpointsForm({ endpoints }: { endpoints: WebhookEndpoints }) {
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const form = useForm<FormValues>({
    defaultValues: endpoints,
    resolver: zodResolver(webhookEndpointsSchema),
  });
  const mutation = useMutation({
    mutationFn: updateWebhookEndpoints,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integration-webhooks'] });
      addToast({ type: 'success', message: 'Webhooks saved.' });
    },
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Webhook className="h-4 w-4 text-tg-link" />
        <p className="text-sm font-semibold text-tg-text">Webhook endpoints</p>
      </div>
      <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div>
          <Label htmlFor="betEvents">Bet events</Label>
          <Input id="betEvents" {...form.register('betEvents')} />
        </div>
        <div>
          <Label htmlFor="roundEvents">Round events</Label>
          <Input id="roundEvents" {...form.register('roundEvents')} />
        </div>
        <div>
          <Label htmlFor="userEvents">User events</Label>
          <Input id="userEvents" {...form.register('userEvents')} />
        </div>
        <Button type="submit" loading={mutation.isPending} className="w-full">
          Save webhooks
        </Button>
      </form>
    </Card>
  );
}
