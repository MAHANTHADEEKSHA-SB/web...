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
  const inputTokens = numeric(value.inputTokens, "Input tokens");
  const outputTokens = numeric(value.outputTokens, "Output tokens");
  if (!Number.isInteger(inputTokens) || !Number.isInteger(outputTokens))
    throw new Error("Token counts must be whole numbers.");
  const category = value.category || "Other";
  if (!CATEGORIES.includes(category))
    throw new Error("Choose a valid session category.");
  const id = textField(value.id, "Session ID", 128) || newId();
  return {
    id,
    provider: provider.id,
    model: textField(value.model, "Model", 100, provider.name) || provider.name,
    title,
    date: date.toISOString(),
    duration: numeric(value.duration, "Duration"),
    inputTokens,
    outputTokens,
    cost: numeric(
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
  };
  for (const session of sessions) {
    summary.totalTokens += session.inputTokens + session.outputTokens;
    summary.totalCost += session.cost;
    summary.totalMinutes += session.duration;
    activeDays.add(localDateKey(new Date(session.date)));
  }
  summary.activeDays = activeDays.size;
  return summary;
}

export function filterSessions(
  sessions,
  { days = 30, provider = "all", query = "", now = new Date() } = {},
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
        date <= end &&
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

export function exportData(sessions) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions: normalizeCollection(sessions),
    },
    null,
    2,
  );
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
  const json = exportData(sessions);
  try {
    storage.setItem(STORAGE_KEY, json);
  } catch {
    throw new Error(
      "Your sessions could not be saved. Browser storage may be full or disabled. Export a backup before leaving.",
    );
  }
}

/** Stable, clearly labeled sample data for exploring the interface. */
export function createDemoSessions(now = new Date()) {
  const end = new Date(now);
  const titles = [
    ["Refactoring the dashboard", "Coding"],
    ["A little help with the blank page", "Writing"],
    ["Exploring a new idea", "Research"],
    ["Learning something new", "Learning"],
    ["Making sense of the docs", "Coding"],
    ["A second pair of eyes", "Writing"],
    ["Deep dive into design systems", "Research"],
    ["Planning the next project", "Other"],
    ["Untangling a tricky bug", "Coding"],
    ["Turning notes into a story", "Writing"],
  ];
  const models = {
    claude: "Claude Sonnet",
    chatgpt: "GPT-4o",
    gemini: "Gemini Pro",
    other: "Other AI",
  };
  const providerOrder = [
    "claude",
    "chatgpt",
    "claude",
    "gemini",
    "chatgpt",
    "claude",
    "other",
  ];
  const result = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const count = 2 + ((offset * 7 + 3) % 5);
    for (let index = 0; index < count; index += 1) {
      const sequence = (29 - offset) * 7 + index;
      const date = startOfDay(end);
      date.setDate(date.getDate() - offset);
      date.setHours(8 + index * 2, (sequence * 13) % 60, 0, 0);
      if (date > end)
        date.setTime(
          Math.max(
            startOfDay(end).getTime(),
            end.getTime() - (count - index) * 60000,
          ),
        );
      const provider = providerOrder[(sequence + index) % providerOrder.length];
      const [title, category] = titles[sequence % titles.length];
      result.push(
        validateSession({
          id: `demo-${offset}-${index}`,
          provider,
          model: models[provider],
          title,
          date: date.toISOString(),
          duration: 8 + ((sequence * 11) % 48),
          inputTokens: 1650 + ((sequence * 967) % 14500),
          outputTokens: 760 + ((sequence * 421) % 5600),
          category,
        }),
      );
    }
  }
  return result.sort((a, b) => new Date(b.date) - new Date(a.date));
}
