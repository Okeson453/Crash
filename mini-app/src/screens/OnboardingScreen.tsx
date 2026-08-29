import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useTelegram } from '@/hooks/useTelegram';
import { useSettingsStore } from '@/stores/settingsStore';
import { getTelegramUserNormalized } from '@/lib/telegram';
import { Gamepad2, Shield, Zap, TrendingUp } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/Spinner';

const FEATURES = [
  {
    icon: Zap,
    title: 'Fast-Paced Action',
    description: 'Place your bet and watch the multiplier grow. Cash out before it crashes!',
  },
  {
    icon: Shield,
    title: 'Provably Fair',
    description: 'Every round is cryptographically verifiable. Trust the math, not the house.',
  },
  {
    icon: TrendingUp,
    title: 'Real-Time Stats',
    description: 'Track your performance, analyze trends, and improve your strategy.',
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const { isAuthenticated } = useAuthStore();
  const { isTelegram, user } = useTelegram();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  // Redirect if already authenticated — must be in useEffect, not during render
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleStart = async () => {
    try {
      await login();
      completeOnboarding();
      navigate('/', { replace: true });
    } catch {
      // Error handled in useAuth
    }
  };

  return (
    <div className="flex flex-col min-h-screen px-6 py-8">
      {/* Logo */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-tg-button flex items-center justify-center mb-6">
          <Gamepad2 className="w-10 h-10 text-tg-button-text" />
        </div>
        <h1 className="text-3xl font-black text-tg-text mb-2">CrashWave</h1>
        <p className="text-center text-tg-hint mb-8 max-w-xs">
          The ultimate crash game experience on Telegram
        </p>

        {/* Features */}
        <div className="w-full max-w-sm space-y-4 mb-8">
          {FEATURES.map((feature, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-tg-section flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-tg-link" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-tg-text">{feature.title}</h3>
                <p className="text-xs text-tg-hint mt-0.5">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm mx-auto space-y-3">
        {!isTelegram && (
          <div className="bg-crash-yellow/10 border border-crash-yellow/20 rounded-xl p-3 text-center">
            <p className="text-xs text-crash-yellow font-medium">
              Open this app in Telegram for the best experience
            </p>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full btn-primary py-4 text-lg"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Connecting...
            </span>
          ) : (
            `Start Playing${getTelegramUserNormalized()?.firstName ? `, ${getTelegramUserNormalized()?.firstName}` : ''}`
          )}
        </button>

        <p className="text-center text-xs text-tg-hint">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
