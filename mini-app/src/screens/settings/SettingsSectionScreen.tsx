import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
const titles: Record<string,string> = { account:'Account', betting:'Betting', notifications:'Notifications', appearance:'Appearance', security:'Security', telegram:'Telegram', risk:'Risk', about:'About' };
export function SettingsSectionScreen() { const location=useLocation(); const navigate=useNavigate(); const key=location.pathname.split('/').pop() ?? 'about'; const title=titles[key] ?? 'Settings'; return <main className="page-container px-4 py-4"><Card><h1 className="text-xl font-bold text-tg-text">{title}</h1><p className="mt-2 text-sm text-tg-hint">This settings area uses the shared user-preferences API. Add jurisdiction-specific controls before enabling real-money operation.</p><Button variant="secondary" className="mt-4" onClick={()=>navigate('/settings')}>Back to settings</Button></Card></main>; }
