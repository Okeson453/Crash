/**
 * Environment configuration
 *
 * Every Mini App public env var must be VITE_-prefixed (Vite only exposes those
 * to the client bundle) and configured in Vercel project settings — never Railway.
 *
 * Do not throw at module load in production: an uncaught import-time error
 * blanks the entire app (white screen) before React can render an error UI.
 */

const getEnv = (key: string, defaultValue = ''): string => {
  const value = import.meta.env[key];
  if (value === undefined || value === '') return defaultValue;
  return String(value);
};

const getBool = (key: string, defaultValue = false): boolean => {
  const value = import.meta.env[key];
  if (value === undefined || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const apiBaseUrl = getEnv(
  'VITE_API_BASE_URL',
  import.meta.env.DEV ? 'http://localhost:8080' : ''
);
const wsUrl = getEnv(
  'VITE_WS_URL',
  import.meta.env.DEV ? 'ws://localhost:8080' : ''
);

if (import.meta.env.PROD && !apiBaseUrl) {
  // Surface in console / optional UI; do not throw during module evaluation.
  console.error(
    '[CrashWave] Missing VITE_API_BASE_URL — set it in Vercel project settings and redeploy.'
  );
}

export const env = {
  apiBaseUrl: apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
  wsUrl:
    wsUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
      : ''),
  appName: getEnv('VITE_APP_NAME', 'CrashWave'),
  appVersion: getEnv('VITE_APP_VERSION', '1.1.0'),
  enableAnalytics: getBool('VITE_ENABLE_ANALYTICS', true),
  enableFairnessVerifier: getBool('VITE_ENABLE_FAIRNESS_VERIFIER', true),
  enableSounds: getBool('VITE_ENABLE_SOUNDS', false),
  sentryDsn: getEnv('VITE_SENTRY_DSN', ''),
  appEnv: getEnv('VITE_APP_ENV', import.meta.env.MODE || 'development'),
  /** True when production build lacks a configured API base URL */
  isMisconfigured: import.meta.env.PROD && !apiBaseUrl,
} as const;

export const API_BASE_URL = env.apiBaseUrl;
export const WS_URL = env.wsUrl;
