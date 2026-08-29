const PREFIX = 'crashwave:';
function key(name: string): string { return `${PREFIX}${name}`; }
export function getStorageItem(name: string): string | null { try { return window.localStorage.getItem(key(name)); } catch { return null; } }
export function setStorageItem(name: string, value: string): boolean { try { window.localStorage.setItem(key(name), value); return true; } catch { return false; } }
export function removeStorageItem(name: string): void { try { window.localStorage.removeItem(key(name)); } catch { /* unavailable */ } }
export function getOrCreateSessionId(): string { const existing = getStorageItem('session-id'); if (existing) return existing; const id = crypto.randomUUID(); setStorageItem('session-id', id); return id; }
