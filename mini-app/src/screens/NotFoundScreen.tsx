import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-black text-tg-text">404</h1>
        <p className="mt-2 text-sm text-tg-hint">{t('errors.notFound')}</p>
        <Button className="mt-6" onClick={() => navigate('/', { replace: true })}>
          {t('common.back')}
        </Button>
      </div>
    </main>
  );
}
