import { ErrorState } from '@/components/ui/ErrorState';
import { getErrorMessage } from '@/utils/errors';
export function ApiErrorBoundary({ error, onRetry }: { error: unknown; onRetry: () => void }) { return <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />; }
