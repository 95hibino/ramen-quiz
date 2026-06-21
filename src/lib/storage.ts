/**
 * localStorage アクセスのラッパー。SSR / プライベートブラウジングでの例外を吸収する。
 */

export const STORAGE_KEYS = {
  users: 'ramen-quiz:users',
  credentials: 'ramen-quiz:credentials',
  scores: 'ramen-quiz:scores',
  authState: 'ramen-quiz:auth-state',
} as const;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // 容量超過などは握りつぶす (UX を妨げないため)
  }
}

/** UUID v4 を生成する。`crypto.randomUUID` が無い古い環境のためのフォールバック付き。 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 簡易フォールバック (一意性のみ重視、衝突確率は実用上無視可)
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `${time}-${rand}`;
}
