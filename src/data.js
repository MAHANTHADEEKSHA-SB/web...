/** Local-only data model. Rates are illustrative USD per one million tokens. */
export const PROVIDERS = Object.freeze([
  {
    id: "claude",
    name: "Claude",
    color: "#d99374",
    inputRate: 3,
    outputRate: 15,
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    color: "#88ad9c",
    inputRate: 2.5,
    outputRate: 10,
  },
  {
    id: "gemini",
    name: "Gemini",
    color: "#8d94d3",
    inputRate: 1.25,
    outputRate: 10,
  },
  {
    id: "other",
    name: "Other AI",
    color: "#c7b986",
    inputRate: 0,
    outputRate: 0,
  },
]);

export const STORAGE_KEY = "ai-usage-sessions-v1";
const MAX_SESSIONS = 10000;
const CATEGORIES = ["Writing", "Coding", "Research", "Learning", "Other"];

function numeric(value, label, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!["number", "string"].includes(typeof value))
    throw new Error(`${label} must be a number.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e12) {
    throw new Error(
      `${label} must be a finite, nonnegative number no greater than one trillion.`,
    );
  }
  return number;
}

function textField(value, label, max, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const result = value.trim();
  if (result.length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return result;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function calculateCost(provider, inputTokens, outputTokens) {
  const definition = PROVIDERS.find((item) => item.id === provider);
  if (!definition) throw new Error("Choose a supported provider, or Other AI.");
  const input = numeric(inputTokens, "Input tokens");
  const output = numeric(outputTokens, "Output tokens");
  return (input * definition.inputRate + output * definition.outputRate) / 1e6;
}

/** Normalize form/import data. Unknown properties are discarded. */
export function validateSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Each session must be an object.");
  const provider = PROVIDERS.find((item) => item.id === value.provider);
  if (!provider) throw new Error("Choose a supported provider, or Other AI.");
  const title = textField(value.title, "Session title", 140);
  if (!title) throw new Error("Enter a session title.");
  if (
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value.date)
  ) {
    throw new Error("Enter a valid session date.");
  }
  // Date constructors normalize impossible dates such as February 30. Reject them.
  const calendarPart = value.date.slice(0, 10);
  const [year, month, day] = calendarPart.split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  ) {
    throw new Error("Enter a valid session date.");
  }
  // A date without a time represents the user's local calendar day, not UTC
  // midnight (which would move it to the previous day in western timezones).
  const date =
    value.date.length === 10
      ? new Date(year, month - 1, day)
      : new Date(value.date);
  const time = value.date.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (
    !Number.isFinite(date.getTime()) ||
    (time &&
      (Number(time[1]) > 23 ||
        Number(time[2]) > 59 ||
        Number(time[3] || 0) > 59))
  ) {
    throw new Error("Enter a valid session date.");
  }
  const id = textField(value.id, "Session ID", 128) || newId();
  const tracked =
    value.source === "extension" || id.startsWith("orbit-extension-");
  const messageCount =
    tracked && value.messageCount != null
      ? numeric(value.messageCount, "Observed sends")
      : null;
  if (messageCount !== null && !Number.isInteger(messageCount))
    throw new Error("Observed send counts must be whole numbers.");
  const inputTokens = numeric(value.inputTokens, "Input tokens");
  const outputTokens = numeric(value.outputTokens, "Output tokens");
  if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens))
    throw new Error("Token counts must be whole numbers.");
  const category = value.category || "Other";
  if (!CATEGORIES.includes(category))
    throw new Error("Choose a valid session category.");
  return {
    id,
    provider: provider.id,
    model: textField(value.model, "Model", 100, provider.name) || provider.name,
    title,
    date: date.toISOString(),
    duration: numeric(value.duration, "Duration"),
    source: tracked ? "extension" : "manual",
    messageCount,
    inputTokens: tracked ? null : inputTokens,
    outputTokens: tracked ? null : outputTokens,
    cost: tracked
      ? null
      : numeric(
          value.cost,
          "Cost",
          calculateCost(provider.id, inputTokens, outputTokens),
        ),
    category,
  };
}

export function summarize(sessions) {
  const activeDays = new Set();
  const summary = {
    sessions: sessions.length,
    totalTokens: 0,
    totalCost: 0,
    totalMinutes: 0,
    activeDays: 0,
    totalMessages: 0,
    observedRecords: 0,
  };
  for (const session of sessions) {
    summary.totalTokens += session.inputTokens + session.outputTokens;
    summary.totalCost += session.cost;
    summary.totalMinutes += session.duration;
    summary.totalMessages += session.messageCount || 0;
    if (session.messageCount != null) summary.observedRecords += 1;
    activeDays.add(localDateKey(new Date(session.date)));
  }
  summary.activeDays = activeDays.size;
  return summary;
}

/**
 * Filter by period, provider and search. Future-dated records (an import from
 * another timezone or a wrong clock) are excluded from totals and charts, but
 * `includeFuture` keeps them listable so they can be edited or deleted.
 */
export function filterSessions(
  sessions,
  {
    days = 30,
    provider = "all",
    query = "",
    now = new Date(),
    includeFuture = false,
  } = {},
) {
  const end = new Date(now);
  const start = startOfDay(end);
  const count = Number(days);
  const allTime = days === "all" || days === null || count === 0;
  if (!allTime && (!Number.isInteger(count) || count < 1 || count > 36500))
    throw new Error("Choose a valid date range.");
  start.setDate(start.getDate() - (count - 1));
  const search = String(query).trim().toLowerCase();
  return sessions
    .filter((session) => {
      const date = new Date(session.date);
      const matchesSearch =
        !search ||
        [
          session.title,
          session.model,
          session.provider,
          session.category,
          PROVIDERS.find((item) => item.id === session.provider)?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      return (
        (includeFuture || date <= end) &&
        (allTime || date >= start) &&
        (provider === "all" || session.provider === provider) &&
        matchesSearch
      );
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function dailyUsage(sessions, days = 14, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("Daily chart range must be between 1 and 366 days.");
  const end = new Date(now);
  const rows = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = startOfDay(end);
    date.setDate(date.getDate() - offset);
    rows.push({
      date: localDateKey(date),
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      tokens: 0,
      cost: 0,
      sessions: 0,
      minutes: 0,
      messages: null,
    });
  }
  const buckets = new Map(rows.map((row) => [row.date, row]));
  for (const session of sessions) {
    const date = new Date(session.date);
    if (date > end) continue;
    const row = buckets.get(localDateKey(date));
    if (!row) continue;
    row.tokens += session.inputTokens + session.outputTokens;
    row.cost += session.cost;
    row.sessions += 1;
    row.minutes += session.duration;
    if (session.messageCount != null)
      row.messages = (row.messages || 0) + session.messageCount;
  }
  return rows;
}

function normalizeCollection(sessions) {
  if (!Array.isArray(sessions))
    throw new Error("This file must contain a sessions array.");
  if (sessions.length > MAX_SESSIONS)
    throw new Error(
      `Import up to ${MAX_SESSIONS.toLocaleString("en-US")} sessions at a time.`,
    );
  const ids = new Set();
  return sessions.map((session, index) => {
    let normalized;
    try {
      normalized = validateSession(session);
    } catch (error) {
      throw new Error(`Session ${index + 1}: ${error.message}`);
    }
    if (ids.has(normalized.id))
      throw new Error(`Session ${index + 1}: duplicate session ID.`);
    ids.add(normalized.id);
    return normalized;
  });
}

export function parseImport(json) {
  if (typeof json !== "string") throw new Error("Choose a JSON export file.");
  if (json.length > 20 * 1024 * 1024)
    throw new Error("Choose a JSON file smaller than 20 MB.");
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose an exported usage file.",
    );
  }
  if (Array.isArray(parsed)) return normalizeCollection(parsed);
  if (!parsed || parsed.version !== 1)
    throw new Error(
      "Unsupported file version. Choose a version 1 usage export.",
    );
  return normalizeCollection(parsed.sessions);
}

/** Serialize validated sessions; `pretty` indents for human-readable files. */
function serializeSessions(sessions, pretty) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: normalizeCollection(sessions),
    },
    null,
    pretty ? 2 : undefined,
  );
}

/** Downloadable backup: indented so people can read it. */
export function exportData(sessions) {
  return serializeSessions(sessions, true);
}

export function loadSessions(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    throw new Error(
      "Browser storage is unavailable. Enable local storage to save your sessions.",
    );
  }
  if (raw === null) return [];
  try {
    return parseImport(raw);
  } catch (error) {
    throw new Error(
      `Saved sessions could not be loaded. Your stored data has been preserved. ${error.message}`,
    );
  }
}

export function saveSessions(sessions, storage = globalThis.localStorage) {
  // Compact JSON: ~30% smaller than the indented export (C1).
  const json = serializeSessions(sessions, false);
  try {
    storage.setItem(STORAGE_KEY, json);
  } catch {
    throw new Error(
      "Your sessions could not be saved. Browser storage may be full or disabled. Export a backup before leaving.",
    );
  }
}

/** Display name of the tool behind a record: the tracked site, else the provider. */
export function toolName(session) {
  if (session.source === "extension" && session.model?.endsWith(" website"))
    return session.model.slice(0, -" website".length);
  return PROVIDERS.find((item) => item.id === session.provider)?.name ?? "Other AI";
}

/**
 * Minutes and observed sends per tool, largest first. Tracked records keep
 * their site name (Perplexity, Copilot) instead of collapsing into Other AI.
 */
export function timeByTool(sessions) {
  const tools = new Map();
  for (const session of sessions) {
    const name = toolName(session);
    const row = tools.get(name) ?? {
      name,
      provider: session.provider,
      minutes: 0,
      sends: 0,
      observed: false,
    };
    row.minutes += session.duration;
    if (session.messageCount != null) {
      row.sends += session.messageCount;
      row.observed = true;
    }
    tools.set(name, row);
  }
  return [...tools.values()].sort(
    (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name),
  );
}

/** Deterministic pseudo-random numbers (mulberry32): organic but stable. */
function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable, clearly labeled sample data for exploring the interface. It mirrors
 * real use: the extension records web chats as daily totals with observed
 * sends, and API or local-model work is logged by hand with tokens and cost.
 * A provider never has both on the same day, so demo totals stay honest.
 */
export function createDemoSessions(now = new Date()) {
  const end = new Date(now);
  const random = seededRandom(7);
  const tools = [
    { site: "claude", provider: "claude", name: "Claude", minutes: 46, rate: 0.45, chance: 0.92 },
    { site: "chatgpt", provider: "chatgpt", name: "ChatGPT", minutes: 34, rate: 0.62, chance: 0.82 },
    { site: "gemini", provider: "gemini", name: "Gemini", minutes: 19, rate: 0.5, chance: 0.42 },
    { site: "perplexity", provider: "other", name: "Perplexity", minutes: 13, rate: 0.85, chance: 0.4 },
  ];
  const logged = [
    ["Batch-summarising research notes", "Research", "claude", "Claude API"],
    ["Untangling a tricky bug", "Coding", "claude", "Claude API"],
    ["Drafting the launch email", "Writing", "chatgpt", "OpenAI API"],
    ["Learning the new framework", "Learning", "chatgpt", "OpenAI API"],
    ["Turning notes into a story", "Writing", "gemini", "Gemini API"],
    ["Refactoring the dashboard", "Coding", "other", "Local model"],
  ];
  const today = startOfDay(end);
  const elapsed = Math.max(0, (end - today) / 60000);
  const result = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = startOfDay(end);
    day.setDate(day.getDate() - offset);
    const key = localDateKey(day);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const trend = 0.85 + (0.3 * (29 - offset)) / 29; // gently busier lately
    const mood = 0.7 + random() * 0.6; // day-to-day variation
    // Today is still in progress: scale by the share of a 16-hour day so far.
    const share = offset === 0 ? Math.min(1, elapsed / 960) : 1;
    const scale = (weekend ? 0.45 : 1) * trend * mood * share;
    const manual =
      !weekend && random() < 0.38
        ? logged[Math.floor(random() * logged.length)]
        : null;
    const before = result.length;
    for (const tool of tools) {
      if (manual?.[2] === tool.provider) continue;
      if (random() > tool.chance * (weekend ? 0.8 : 1)) continue;
      let minutes = tool.minutes * scale * (0.55 + random() * 0.9);
      if (offset === 0) minutes = Math.min(minutes, elapsed);
      minutes = Math.round(minutes * 100) / 100;
      if (minutes < 0.5) continue;
      result.push(
        validateSession({
          id: `orbit-extension-demo-${key}-${tool.site}`,
          provider: tool.provider,
          model: `${tool.name} website`,
          title: `${tool.name} · browser activity`,
          date: day.toISOString(),
          duration: minutes,
          source: "extension",
          messageCount: Math.max(
            1,
            Math.round(minutes * tool.rate * (0.7 + random() * 0.6)),
          ),
          category: "Other",
        }),
      );
    }
    if (manual) {
      const at = new Date(day);
      at.setHours(10 + Math.floor(random() * 7), Math.floor(random() * 60), 0, 0);
      if (at <= end) {
        const [title, category, provider, model] = manual;
        result.push(
          validateSession({
            id: `demo-${key}-logged`,
            provider,
            model,
            title,
            date: at.toISOString(),
            duration: 10 + Math.round(random() * 45),
            inputTokens: 4000 + Math.round(random() * 56000),
            outputTokens: 900 + Math.round(random() * 11000),
            category,
          }),
        );
      }
    }
    if (result.length === before) {
      // Every demo day has some activity, even a barely started today.
      result.push(
        validateSession({
          id: `orbit-extension-demo-${key}-claude`,
          provider: "claude",
          model: "Claude website",
          title: "Claude · browser activity",
          date: day.toISOString(),
          duration:
            offset === 0
              ? Math.max(0.1, Math.min(elapsed, 6))
              : Math.round((6 + random() * 9) * 100) / 100,
          source: "extension",
          messageCount: 1 + Math.floor(random() * 5),
          category: "Other",
        }),
      );
    }
  }
  return result.sort((a, b) => new Date(b.date) - new Date(a.date));
}
