/**
 * "At most once per `ms` per key", kept in memory — enough for one Next.js process (SPEC §12).
 * Returns a function that says whether the caller may go ahead now.
 */
export function createThrottle(ms: number, maxKeys = 10_000) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()): boolean => {
    const prev = last.get(key);
    if (prev !== undefined && now - prev < ms) return false;
    if (last.size >= maxKeys) last.clear();
    last.set(key, now);
    return true;
  };
}
