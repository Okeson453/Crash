import { Dialog } from '@/components/ui/Dialog';
export function InsufficientBalanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) { return <Dialog open={open} title="Insufficient balance" message="Your current balance is lower than this stake." confirmLabel="OK" cancelLabel="Close" onConfirm={onClose} onCancel={onClose}/>; }
