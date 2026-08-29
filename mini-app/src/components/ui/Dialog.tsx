import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
export function Dialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }) { return <Modal open={open} title={title} onClose={onCancel}><p className="text-sm text-tg-hint">{message}</p><div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={onCancel}>{cancelLabel}</Button><Button variant="destructive" className="flex-1" onClick={onConfirm}>{confirmLabel}</Button></div></Modal>; }
