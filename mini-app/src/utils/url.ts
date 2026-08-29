const ALLOWED_HOSTS = new Set(['crashwave.example.com', 'api.crashwave.example.com', 't.me', 'telegram.org']);
export function isAllowedUrl(value: string): boolean {
  try { const parsed = new URL(value); return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname); } catch { return false; }
}
