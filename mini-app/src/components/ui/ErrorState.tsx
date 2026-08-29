import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
export function ErrorState({ message = 'Something went wrong.', onRetry }: { message?: string; onRetry?: () => void }) { return <div role="alert" className="rounded-2xl bg-crash-red/10 p-4 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-crash-red" /><p className="text-sm text-tg-text">{message}</p>{onRetry && <Button className="mt-3" onClick={onRetry}>Try again</Button>}</div>; }
