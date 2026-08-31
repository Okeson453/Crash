const STATIC_ALLOWED = new Set([
  'crashwave.example.com',
  'api.crashwave.example.com',
  't.me',
  'telegram.org',
  'web.telegram.org',
]);

function hostFromApiBase(): string | null {
  try {
    const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!base) return null;
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

export function isAllowedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (STATIC_ALLOWED.has(parsed.hostname)) return true;
    const apiHost = hostFromApiBase();
    if (apiHost && parsed.hostname === apiHost) return true;
    // Allow same-origin and common Railway / Vercel hosts used with the Mini App
    if (typeof window !== 'undefined' && parsed.hostname === window.location.hostname) return true;
    if (/\.railway\.app$/i.test(parsed.hostname)) return true;
    if (/\.vercel\.app$/i.test(parsed.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}
