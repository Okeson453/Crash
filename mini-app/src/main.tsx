import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from '@/App';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { AppProviders } from '@/providers/AppProviders';
import '@/index.css';
import '@/i18n';
import { setupGlobalErrorHandlers } from '@/lib/error-handler';
import { initSentry } from '@/lib/sentry';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import { reportWebVitals } from '@/lib/web-vitals';

setupGlobalErrorHandlers();
initSentry();
registerServiceWorker();
reportWebVitals();

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <AppProviders>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AppProviders>
    </HashRouter>
  </React.StrictMode>
);
