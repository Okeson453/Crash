import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SafeArea } from './SafeArea';
import { Header } from './Header';
import { BottomTabBar } from './BottomTabBar';
import { OfflineBanner } from './OfflineBanner';
import { useAuthStore } from '@/stores/authStore';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface AppLayoutProps {
  children: ReactNode;
}

const HIDDEN_TABBAR_PATHS = ['/onboarding', '/verify'];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hideTabBar = HIDDEN_TABBAR_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  return (
    <div className="flex flex-col min-h-screen bg-tg-bg text-tg-text">
      <NotificationCenter />
      <SafeArea>
        <OfflineBanner />
        <Header />
        <main className="flex-1 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
        {isAuthenticated && !hideTabBar && <BottomTabBar />}
      </SafeArea>
    </div>
  );
}
