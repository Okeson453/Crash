import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export function SessionExpiredScreen() {
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-bold text-tg-text">{t('auth.sessionExpired')}</h1>
        <p className="mt-2 text-sm text-tg-hint">{t('errors.sessionExpired')}</p>
        <Button className="mt-6 w-full" loading={isLoading} onClick={() => void login()}>
          {t('common.continue')}
        </Button>
      </div>
    </main>
  );
}
