import { useLocation, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  LayoutDashboard,
  History,
  Gift,
  Shield,
  BarChart3,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useHaptic } from '@/hooks/useHaptic';

interface TabItem {
  path: string;
  label: string;
  icon: typeof Gamepad2;
  roles?: string[];
}

const TABS: TabItem[] = [
  { path: '/', label: 'Game', icon: Gamepad2 },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/history', label: 'History', icon: History },
  { path: '/referrals', label: 'Referrals', icon: Gift },
];

const OPERATOR_TABS: TabItem[] = [
  { path: '/control', label: 'Control', icon: Shield, roles: ['operator', 'admin'] },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['operator', 'admin'] },
];

export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOperator } = useAuthStore();
  const { impact } = useHaptic();
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  const tabs = isOperator() ? [...TABS, ...OPERATOR_TABS] : TABS;

  const handleTabClick = (path: string) => {
    impact('light');
    setActiveTab(path);
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-tg-bg/90 backdrop-blur-lg border-t border-tg-hint/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => handleTabClick(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 touch-target transition-colors ${
                isActive
                  ? 'text-tg-link'
                  : 'text-tg-hint hover:text-tg-text'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
