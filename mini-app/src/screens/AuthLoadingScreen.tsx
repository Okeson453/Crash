import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '@/components/ui/Spinner';

export function AuthLoadingScreen() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center p-6" aria-busy="true">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-sm text-tg-hint">{t('auth.loading')}</p>
      </div>
    </main>
  );
}
