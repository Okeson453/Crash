import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Invoice } from '@/types/api';

interface InvoiceListProps {
  invoices: Invoice[];
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  if (!invoices.length) return null;
  return (
    <Card className="space-y-2">
      <p className="text-sm font-semibold text-tg-text">Invoices</p>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0"
        >
          <div>
            <p className="text-sm text-tg-text">{inv.period}</p>
            <p className="text-xs text-tg-hint">{new Date(inv.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-tg-text">${inv.amount}</p>
            <Badge
              variant={
                inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'
              }
            >
              {inv.status}
            </Badge>
          </div>
        </div>
      ))}
    </Card>
  );
}
