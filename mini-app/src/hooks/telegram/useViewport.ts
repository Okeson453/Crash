import { useEffect, useState } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
export function useViewport() { const { webApp } = useTelegram(); const [height, setHeight] = useState(webApp?.viewportStableHeight ?? window.innerHeight); useEffect(() => { if (!webApp) return; const update = () => setHeight(webApp.viewportStableHeight || webApp.viewportHeight || window.innerHeight); update(); webApp.onEvent('viewportChanged', update); return () => webApp.offEvent('viewportChanged', update); }, [webApp]); return { height }; }
