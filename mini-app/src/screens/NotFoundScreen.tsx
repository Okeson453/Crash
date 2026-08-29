import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
export function NotFoundScreen() { const navigate = useNavigate(); return <main className="flex min-h-screen items-center justify-center p-6"><div className="text-center"><h1 className="text-3xl font-black text-tg-text">404</h1><p className="mt-2 text-sm text-tg-hint">That page does not exist.</p><Button className="mt-5" onClick={() => navigate('/')}>Go home</Button></div></main>; }
