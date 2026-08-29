import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useTelegram } from '@/hooks/useTelegram';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'CrashWave',
  '/dashboard': 'Dashboard',
  '/history': 'History',
  '/settings': 'Settings',
  '/control': 'Control',
  '/analytics': 'Analytics',
  '/admin': 'Admin',
  '/health': 'Health',
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { webApp } = useTelegram();

  const title = ROUTE_TITLES[location.pathname] || 'CrashWave';
  const showBack = location.pathname !== '/' && location.pathname !== '/onboarding';

  // Use Telegram back button when available
  useEffect(() => {
    if (webApp?.BackButton && showBack) {
      webApp.BackButton.show();
      const handleClick = () => navigate(-1);
      webApp.BackButton.onClick(handleClick);
      return () => {
        webApp.BackButton.offClick(handleClick);
        webApp.BackButton.hide();
      };
    }
  }, [webApp, showBack, navigate]);

  if (location.pathname === '/onboarding') return null;

  return (
    <header className="sticky top-0 z-50 bg-tg-bg/80 backdrop-blur-md border-b border-tg-hint/10">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          {showBack && !webApp?.BackButton && (
            <button
              onClick={() => navigate(-1)}
              className="touch-target flex items-center justify-center -ml-2 p-2 rounded-lg active:bg-tg-section transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-tg-text" />
            </button>
          )}
          <h1 className="text-lg font-semibold text-tg-text">{title}</h1>
        </div>

        {isAuthenticated && (
          <button
            onClick={() => navigate('/settings')}
            className="touch-target flex items-center justify-center p-2 rounded-full active:bg-tg-section transition-colors"
            aria-label="Profile settings"
          >
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.firstName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-tg-button flex items-center justify-center">
                <User className="w-4 h-4 text-tg-button-text" />
              </div>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
