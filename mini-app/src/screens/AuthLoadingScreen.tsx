import { LoadingSpinner } from '@/components/ui/Spinner';
export function AuthLoadingScreen() { return <main className="flex min-h-screen items-center justify-center p-6" aria-busy="true"><div className="text-center"><LoadingSpinner size="lg" /><p className="mt-3 text-sm text-tg-hint">Restoring your session…</p></div></main>; }
