/**
 * A per-process cache for hot, rarely-changing reads (the signed-out landing page). Values are
 * kept as-is (no serialization), concurrent misses share one load, and a failed load is not
 * cached. Each web process has its own copy, so after a change a process may serve the old
 * value for up to `ttlMs` unless that same process called `clear()`.
 */
export function ttlCache<T>(ttlMs: number, load: () => Promise<T>, now = () => Date.now()) {
  let value: T | undefined;
  let expires = 0;
  let pending: Promise<T> | null = null;
  return {
    get(): Promise<T> {
      if (value !== undefined && now() < expires) return Promise.resolve(value);
      pending ??= load()
        .then((v) => {
          value = v;
          expires = now() + ttlMs;
          return v;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    clear() {
      value = undefined;
      expires = 0;
    },
  };
}
