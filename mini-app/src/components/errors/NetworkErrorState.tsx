import { Button } from '@/components/ui/Button';
export function NetworkErrorState({ onRetry }: { onRetry: () => void }) { return <div role="alert" className="rounded-2xl bg-tg-section p-4 text-center"><p className="text-sm text-tg-text">Network unavailable.</p><Button className="mt-3" onClick={onRetry}>Retry</Button></div>; }
