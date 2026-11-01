/** Pure time accounting. Only a supported hostname is retained, never a URL/title. */
export const SITES = Object.freeze({
  "chatgpt.com": { id: "chatgpt", name: "ChatGPT" },
  "chat.openai.com": { id: "chatgpt", name: "ChatGPT" },
  "claude.ai": { id: "claude", name: "Claude" },
  "gemini.google.com": { id: "gemini", name: "Gemini" },
  "perplexity.ai": { id: "perplexity", name: "Perplexity" },
  "www.perplexity.ai": { id: "perplexity", name: "Perplexity" },
  "copilot.microsoft.com": { id: "copilot", name: "Copilot" },
});
export const MAX_GAP_MS = 90000;
/** Send observation shipped in this version and needs a fresh opt-in once. */
export const OBSERVER_VERSION = "1.1.0";
/** True when dotted version `version` is older than `than`; unknown is older. */
export function isOlderVersion(version, than) {
  if (typeof version !== "string" || !/^\d+(\.\d+)*$/.test(version))
    return true;
  const a = version.split(".").map(Number);
  const b = than.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference < 0;
  }
  return false;
}
export function siteForUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && Object.hasOwn(SITES, parsed.hostname)
      ? SITES[parsed.hostname]
      : null;
  } catch {
    return null;
  }
}
export function localDay(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function initialState(installationId) {
  return {
    version: 1,
    enabled: false,
    installationId,
    buckets: {},
    cursor: null,
  };
}
/** Adds only a short observed interval and splits it at local midnight. */
export function settle(state, timestamp) {
  const cursor = state.cursor;
  const result = { ...state, buckets: { ...state.buckets }, cursor: null };
  if (!state.enabled || !cursor?.site || !Number.isFinite(timestamp))
    return result;
  const gap = timestamp - cursor.at;
  if (gap <= 0 || gap > MAX_GAP_MS) return result;
  let start = cursor.at;
  while (start < timestamp) {
    const day = localDay(start);
    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(timestamp, midnight.getTime());
    const key = `${day}|${cursor.site.id}`;
    const existing = result.buckets[key];
    const date = new Date(start);
    date.setHours(0, 0, 0, 0);
    result.buckets[key] = {
      day,
      site: cursor.site,
      date: existing?.date ?? date.toISOString(),
      milliseconds: (existing?.milliseconds ?? 0) + end - start,
      messageCount: existing
        ? (existing.messageCount ?? null)
        : cursor.observerReady
          ? 0
          : null,
    };
    start = end;
  }
  return result;
}
export function advance(
  state,
  timestamp,
  activeSite = null,
  observerReady = false,
) {
  const result = settle(state, timestamp);
  if (result.enabled && activeSite)
    result.cursor = { at: timestamp, site: activeSite, observerReady };
  return result;
}

/** Count an observed send action, never message text or estimated tokens. */
export function recordSend(state, site, eventId, timestamp) {
  if (
    !state.enabled ||
    !site ||
    typeof eventId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(eventId)
  )
    return state;
  const recent = (state.recentSends || []).filter(
    (event) => timestamp - event.at < 120000,
  );
  if (recent.some((event) => event.id === eventId)) return state;
  const day = localDay(timestamp);
  const key = `${day}|${site.id}`;
  const existing = state.buckets[key];
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return {
    ...state,
    recentSends: [...recent, { id: eventId, at: timestamp }].slice(-128),
    buckets: {
      ...state.buckets,
      [key]: {
        day,
        site,
        date: existing?.date ?? date.toISOString(),
        milliseconds: existing?.milliseconds ?? 0,
        messageCount: (existing?.messageCount ?? 0) + 1,
      },
    },
  };
}
export function exportSessions(state) {
  return Object.values(state.buckets)
    .filter((bucket) => bucket.milliseconds > 0 || bucket.messageCount > 0)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.site.id.localeCompare(b.site.id),
    )
    .map((bucket) => ({
      id: `orbit-extension-${state.installationId}-${bucket.day}-${bucket.site.id}`,
      provider: ["chatgpt", "claude", "gemini"].includes(bucket.site.id)
        ? bucket.site.id
        : "other",
      model: `${bucket.site.name} website`,
      title: `${bucket.site.name} · browser activity`,
      date: bucket.date,
      duration: Math.round(bucket.milliseconds / 600) / 100,
      source: "extension",
      messageCount: bucket.messageCount ?? null,
      inputTokens: null,
      outputTokens: null,
      cost: null,
      category: "Other",
    }));
}
export function makeExport(state) {
  return {
    version: 1,
    source: "orbit-extension",
    exportedAt: new Date().toISOString(),
    sessions: exportSessions(state),
  };
}
