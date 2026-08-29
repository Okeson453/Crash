import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
export function SessionExpiredScreen() { const { login, isLoading } = useAuth(); return <main className="flex min-h-screen items-center justify-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-bold text-tg-text">Session expired</h1><p className="mt-2 text-sm text-tg-hint">Please sign in again to continue.</p><Button className="mt-5 w-full" loading={isLoading} onClick={() => void login()}>Sign in again</Button></div></main>; }
