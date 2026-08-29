/**
 * Environment configuration
 */

const getEnv = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value);
};

const getBool = (key: string, defaultValue = false): boolean => {
  const value = import.meta.env[key];
  if (value === undefined || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

export const env = {
  apiBaseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:8080'),
  wsUrl: getEnv('VITE_WS_URL', 'ws://localhost:8080'),
  appName: getEnv('VITE_APP_NAME', 'CrashWave'),
  appVersion: getEnv('VITE_APP_VERSION', '1.1.0'),
  enableAnalytics: getBool('VITE_ENABLE_ANALYTICS', true),
  enableFairnessVerifier: getBool('VITE_ENABLE_FAIRNESS_VERIFIER', true),
  enableSounds: getBool('VITE_ENABLE_SOUNDS', false),
  sentryDsn: getEnv('VITE_SENTRY_DSN', ''),
  appEnv: getEnv('VITE_APP_ENV', 'development'),
} as const;

export const API_BASE_URL = env.apiBaseUrl;
export const WS_URL = env.wsUrl;
