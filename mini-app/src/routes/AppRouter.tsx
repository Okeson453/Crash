import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

// Screens
import { GameScreen } from '@/screens/GameScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { VerifyScreen } from '@/screens/VerifyScreen';
import { PricingScreen } from '@/screens/PricingScreen';
import { NotFoundScreen } from '@/screens/NotFoundScreen';
import { MaintenanceScreen } from '@/screens/MaintenanceScreen';
import { LegalScreen } from '@/screens/LegalScreen';
import { ControlScreen } from '@/screens/ControlScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { AdminScreen } from '@/screens/AdminScreen';
import { HealthScreen } from '@/screens/HealthScreen';
import { SettingsSectionScreen } from '@/screens/settings/SettingsSectionScreen';

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/onboarding" element={<ErrorBoundary><OnboardingScreen /></ErrorBoundary>} />
      <Route path="/maintenance" element={<ErrorBoundary><MaintenanceScreen /></ErrorBoundary>} />
      <Route path="/legal/:document" element={<ErrorBoundary><LegalScreen /></ErrorBoundary>} />

      {/* Protected player routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ErrorBoundary><GameScreen /></ErrorBoundary>} />
        <Route path="/dashboard" element={<ErrorBoundary><DashboardScreen /></ErrorBoundary>} />
        <Route path="/history" element={<ErrorBoundary><HistoryScreen /></ErrorBoundary>} />
        <Route path="/settings" element={<ErrorBoundary><SettingsScreen /></ErrorBoundary>} />
        <Route path="/settings/:section" element={<ErrorBoundary><SettingsSectionScreen /></ErrorBoundary>} />
        <Route path="/pricing" element={<ErrorBoundary><PricingScreen /></ErrorBoundary>} />
        <Route path="/verify/:roundId" element={<ErrorBoundary><VerifyScreen /></ErrorBoundary>} />
      </Route>

      {/* Operator routes */}
      <Route element={<RoleRoute allowedRoles={['operator', 'admin']} />}>
        <Route path="/control" element={<ErrorBoundary><ControlScreen /></ErrorBoundary>} />
        <Route path="/analytics" element={<ErrorBoundary><AnalyticsScreen /></ErrorBoundary>} />
        <Route path="/health" element={<ErrorBoundary><HealthScreen /></ErrorBoundary>} />
      </Route>

      {/* Admin routes */}
      <Route element={<RoleRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<ErrorBoundary><AdminScreen /></ErrorBoundary>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<ErrorBoundary><NotFoundScreen /></ErrorBoundary>} />
    </Routes>
  );
}
