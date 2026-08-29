import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
export function UnauthorizedScreen() { const navigate = useNavigate(); return <main className="flex min-h-screen items-center justify-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-bold text-tg-text">Sign-in required</h1><p className="mt-2 text-sm text-tg-hint">This area requires an authenticated Telegram session.</p><Button className="mt-5" onClick={() => navigate('/onboarding')}>Go to sign in</Button></div></main>; }
