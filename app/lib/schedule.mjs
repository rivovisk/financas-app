// When to read again by itself. Meu Pluggy reads the bank once a day, so the app reads once after that.
const MIN = 60000;
export function nextRead(sync, items, now) {
  if (!sync.lastOk) return sync.lastTry ? Date.parse(sync.lastTry) + 60 * MIN : now;
  if (sync.problem && sync.lastTry) return Date.parse(sync.lastTry) + 60 * MIN; // a failed read tries again in an hour
  const ok = Date.parse(sync.lastOk);
  const next = items.map((i) => Date.parse(i.next ?? '')).filter((t) => t > ok);
  return next.length ? Math.max(...next) + 20 * MIN : ok + 24 * 60 * MIN;
}
export const isDue = (sync, items, now) => now >= nextRead(sync, items, now);
