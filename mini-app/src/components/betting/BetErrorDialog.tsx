import { Dialog } from '@/components/ui/Dialog';
export function BetErrorDialog({ open, message, onClose, onRetry }: { open: boolean; message: string; onClose: () => void; onRetry?: () => void }) { return <Dialog open={open} title="Bet failed" message={message} confirmLabel="Retry" cancelLabel="Cancel" onConfirm={onRetry ?? onClose} onCancel={onClose}/>; }
