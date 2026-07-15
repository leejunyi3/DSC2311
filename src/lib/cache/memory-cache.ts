/**
 * Minimal in-process TTL cache (§28). Used to serve recent CACHED data in
 * Degraded Mode when a live source fails. A production deployment could swap
 * this for Redis via REDIS_URL; the interface intentionally stays tiny.
 *
 * NOTE: in serverless deployments this cache is per-instance and best-effort.
 * That limitation is documented in docs/api-limitations.md.
 */

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): void {
  const now = Date.now();
  store.set(key, {
    value,
    storedAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });
}

export interface CacheHit<T> {
  value: T;
  ageSeconds: number;
  expired: boolean;
}

/** Return the entry even if expired, flagged — Degraded Mode may still use it. */
export function cacheGet<T>(key: string): CacheHit<T> | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const now = Date.now();
  return {
    value: entry.value,
    ageSeconds: Math.max(0, Math.round((now - entry.storedAt) / 1000)),
    expired: now > entry.expiresAt,
  };
}

export function cacheClear(): void {
  store.clear();
}
