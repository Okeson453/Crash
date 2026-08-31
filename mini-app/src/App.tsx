import { AppRouter } from '@/routes/AppRouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { ToastContainer } from '@/components/ui/Toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useConnectionState } from '@/hooks/useConnectionState';
import { useAuthContext } from '@/providers/AuthProvider';
import { AuthLoadingScreen } from '@/screens/AuthLoadingScreen';
import { NetworkErrorScreen } from '@/screens/NetworkErrorScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { MaintenanceScreen } from '@/screens/MaintenanceScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { env } from '@/config/env';

function AppContent() {
  useOnlineStatus();
  const { isReconnecting } = useConnectionState();
  const { isInitialized, isAuthenticated, isLoading, bootstrapError, retry } = useAuthContext();
  const addToast = useUIStore((s) => s.addToast);
  useEffect(() => { if (isReconnecting) addToast({ type: 'warning', message: 'Reconnecting to server...', duration: 3000 }); }, [isReconnecting, addToast]);
  if (env.isMisconfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          message="App is misconfigured: set VITE_API_BASE_URL in Vercel (Production) to your Railway API URL, then redeploy."
        />
      </main>
    );
  }
  if (!navigator.onLine && !isAuthenticated) return <NetworkErrorScreen />;
  if (!isInitialized || isLoading) return <AuthLoadingScreen />;
  if (bootstrapError && !isAuthenticated) return <main className="flex min-h-screen items-center justify-center p-6"><ErrorState message={bootstrapError} onRetry={retry} /></main>;
  if (!isAuthenticated) return <OnboardingScreen />;
  const maintenance = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  if (maintenance) return <MaintenanceScreen />;
  return <AppLayout><AppRouter /><ToastContainer /></AppLayout>;
}
export default function App() { return <AppContent />; }
