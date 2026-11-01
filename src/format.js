/** Pure display formatters (no DOM). Covered by tests/format.test.js. */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "1.4M", "17.2K", "522". */
export const compact = (n) => compactNumber.format(n);

/** Totals and chart axes, with thousands separators: "$1,234.50". */
export const money = (n) => usd.format(n);

/**
 * Per-session cost cells. An exact zero is shown as "$0" (e.g. a subscription
 * chat with no extra charge); a positive cost that would round to "$0.00" is
 * shown as "<$0.01" so it never reads as free.
 */
export function cellMoney(n) {
  if (n === 0) return "$0";
  if (n > 0 && n < 0.005) return "<$0.01";
  return usd.format(n);
}

/** Minutes as "20s", "45m" or "2h 5m". */
export function duration(n) {
  if (n > 0 && n < 1) return `${Math.max(1, Math.round(n * 60))}s`;
  const m = Math.round(n);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

/** Count with a correctly inflected noun: "1 session", "1,204 sessions". */
export function plural(count, one, many = `${one}s`) {
  return `${Number(count).toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** Compact axis labels for minutes: "0", "45m", "1h", "1h 15m". */
export function shortDuration(minutes) {
  const m = Math.round(minutes);
  if (m === 0) return "0";
  if (m < 60) return `${m}m`;
  const rest = m % 60;
  return rest ? `${Math.floor(m / 60)}h ${rest}m` : `${m / 60}h`;
}
