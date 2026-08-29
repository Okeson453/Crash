import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [open, onClose]);
  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-tg-bg p-4 shadow-xl"><div className="flex items-center gap-2"><h2 id="modal-title" className="flex-1 text-lg font-bold text-tg-text">{title}</h2><IconButton label="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton></div><div className="mt-4">{children}</div></div></div>;
}
