import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCost,
  createDemoSessions,
  dailyUsage,
  exportData,
  filterSessions,
  loadSessions,
  parseImport,
  saveSessions,
  STORAGE_KEY,
  summarize,
  timeByTool,
  toolName,
  validateSession,
} from "../src/data.js";

const example = (overrides = {}) => ({
  id: "first",
  provider: "claude",
  title: "Build a dashboard",
  model: "Sonnet",
  date: "2026-10-30T14:00:00.000Z",
  duration: 30,
  inputTokens: 1000,
  outputTokens: 2000,
  category: "Coding",
  ...overrides,
});

test("normalizes form data and computes an editable cost estimate", () => {
  const session = validateSession(
    example({
      title: "  Build a dashboard  ",
      duration: "25",
      inputTokens: "1000",
    }),
  );
  assert.equal(session.title, "Build a dashboard");
  assert.equal(session.duration, 25);
  assert.equal(session.cost, 0.033);
  assert.equal(validateSession(example({ cost: "1.25" })).cost, 1.25);
  assert.equal(calculateCost("chatgpt", 1000000, 1000000), 12.5);
  assert.equal(calculateCost("other", 1000000, 1000000), 0);
});

test("rejects malformed dates, providers, text and metrics", () => {
  for (const invalid of [
    null,
    [],
    example({ date: "yesterday" }),
    example({ date: "2026-02-30T12:00:00Z" }),
    example({ date: "2026-10-30T24:00:00Z" }),
    example({ provider: "unknown" }),
    example({ title: " " }),
    example({ title: "a".repeat(141) }),
    example({ duration: -1 }),
    example({ inputTokens: 1.5 }),
    example({ inputTokens: true }),
    example({ cost: Infinity }),
    example({ outputTokens: "NaN" }),
    example({ category: "Invalid" }),
  ]) {
    assert.throws(() => validateSession(invalid));
  }
});

test("date-only imports stay on their local calendar day", () => {
  const session = validateSession(example({ date: "2026-10-30" }));
  const date = new Date(session.date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 30);
  assert.equal(date.getHours(), 0);
});

test("automatic tracked time supports fractional minutes and stable daily IDs through export", () => {
  const session = validateSession(
    example({
      id: "orbit-time-claude-2026-10-30",
      duration: 123.45,
      title: "Claude · active website time",
      model: "Website time",
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    }),
  );
  assert.equal(session.duration, 123.45);
  assert.equal(session.cost, 0);
  assert.deepEqual(parseImport(exportData([session])), [session]);
});

test("metrics sum independently and count distinct local active days", () => {
  const sessions = [
    validateSession(example()),
    validateSession(example({ id: "second", cost: 0.5, duration: 10 })),
  ];
  assert.deepEqual(summarize(sessions), {
    sessions: 2,
    totalTokens: 6000,
    totalCost: 0.533,
    totalMinutes: 40,
    activeDays: 1,
    totalMessages: 0,
    observedRecords: 0,
  });
  assert.deepEqual(summarize([]), {
    sessions: 0,
    totalTokens: 0,
    totalCost: 0,
    totalMinutes: 0,
    activeDays: 0,
    totalMessages: 0,
    observedRecords: 0,
  });
});

test("filters local date boundaries, provider and case-insensitive search; excludes future data", () => {
  const now = new Date(2026, 9, 31, 12);
  const make = (id, date, overrides = {}) =>
    validateSession(example({ id, date: date.toISOString(), ...overrides }));
  const sessions = [
    make("old", new Date(2026, 9, 24, 23, 59)),
    make("boundary", new Date(2026, 9, 25)),
    make("today", new Date(2026, 9, 31, 11), {
      provider: "chatgpt",
      title: "Write a story",
    }),
    make("future", new Date(2026, 9, 31, 13)),
  ];
  assert.deepEqual(
    filterSessions(sessions, { days: 7, now }).map((s) => s.id),
    ["today", "boundary"],
  );
  assert.deepEqual(
    filterSessions(sessions, {
      days: 7,
      now,
      provider: "claude",
      query: "DASHBOARD",
    }).map((s) => s.id),
    ["boundary"],
  );
  assert.equal(filterSessions(sessions, { days: "all", now }).length, 3);
  assert.equal(filterSessions(sessions, { days: 0, now }).length, 3);
});

test("future-dated records stay listable for editing without entering totals", () => {
  const now = new Date(2026, 9, 31, 12);
  const sessions = [
    validateSession(example({ id: "past", date: new Date(2026, 9, 30).toISOString() })),
    validateSession(
      example({ id: "future", date: new Date(2026, 10, 2, 9).toISOString() }),
    ),
  ];
  assert.deepEqual(
    filterSessions(sessions, { days: 0, now }).map((s) => s.id),
    ["past"],
  );
  assert.deepEqual(
    filterSessions(sessions, { days: 0, now, includeFuture: true }).map(
      (s) => s.id,
    ),
    ["future", "past"],
  );
  // Bounded ranges keep their lower edge; the future record is still listed.
  assert.deepEqual(
    filterSessions(sessions, { days: 7, now, includeFuture: true }).map(
      (s) => s.id,
    ),
    ["future", "past"],
  );
});

test("daily buckets include empty days and aggregate at local midnight", () => {
  const now = new Date(2026, 9, 31, 12);
  const sessions = [
    validateSession(
      example({ date: new Date(2026, 9, 30, 23, 59).toISOString() }),
    ),
    validateSession(
      example({
        id: "second",
        date: new Date(2026, 9, 31, 0, 1).toISOString(),
      }),
    ),
  ];
  const rows = dailyUsage(sessions, 3, now);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.sessions),
    [0, 1, 1],
  );
  assert.deepEqual(
    rows.map((row) => row.date),
    ["2026-10-29", "2026-10-30", "2026-10-31"],
  );
  assert.equal(rows[2].tokens, 3000);
  assert.deepEqual(
    rows.map((row) => row.minutes),
    [0, 30, 30],
  );
});

test("daily time chart combines fractional minutes and ignores future or out-of-range sessions", () => {
  const now = new Date(2026, 9, 31, 12);
  const session = (id, date, duration) =>
    validateSession(example({ id, date: date.toISOString(), duration }));
  const rows = dailyUsage(
    [
      session("one", new Date(2026, 9, 31, 9), 4.25),
      session("two", new Date(2026, 9, 31, 11), 7.5),
      session("future", new Date(2026, 9, 31, 13), 100),
      session("past", new Date(2026, 9, 28, 11), 100),
    ],
    2,
    now,
  );
  assert.deepEqual(
    rows.map((row) => row.minutes),
    [0, 11.75],
  );
  assert.deepEqual(
    rows.map((row) => row.sessions),
    [0, 2],
  );
});

test("JSON export round trips and imports reject malformed, partial or duplicate records", () => {
  const sessions = [validateSession(example())];
  assert.deepEqual(parseImport(exportData(sessions)), sessions);
  assert.deepEqual(parseImport(JSON.stringify(sessions)), sessions);
  for (const input of [
    "broken",
    "{}",
    '{"version":2,"sessions":[]}',
    JSON.stringify([example(), { bad: true }]),
    JSON.stringify([example(), example()]),
    JSON.stringify(Array(10001).fill(example())),
  ]) {
    assert.throws(() => parseImport(input));
  }
});

test("storage round trips; corrupt data is preserved and storage failures remain visible", () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  assert.deepEqual(loadSessions(storage), []);
  const sessions = [validateSession(example())];
  saveSessions(sessions, storage);
  assert.deepEqual(loadSessions(storage), sessions);
  data.set(STORAGE_KEY, "broken");
  assert.throws(() => loadSessions(storage), /preserved/);
  assert.equal(data.get(STORAGE_KEY), "broken");
  assert.throws(
    () =>
      saveSessions(sessions, {
        setItem() {
          throw new Error("quota exceeded");
        },
      }),
    /could not be saved/,
  );
  assert.throws(
    () =>
      loadSessions({
        getItem() {
          throw new Error("disabled");
        },
      }),
    /unavailable/,
  );
});

test("demo data is deterministic, complete, unique and never in the future", () => {
  const now = new Date(2026, 10, 1, 0, 1);
  const sessions = createDemoSessions(now);
  assert.deepEqual(sessions, createDemoSessions(now));
  assert.ok(sessions.length >= 60);
  assert.ok(
    sessions.some((s) => s.source === "extension" && s.messageCount > 0),
    "the demo shows observed sends",
  );
  assert.ok(
    sessions.some((s) => s.source === "manual" && s.cost > 0),
    "the demo shows logged tokens and cost",
  );
  // A provider never has both logged and tracked time on one day, so the
  // demo's totals are not inflated by double counting.
  const byDay = new Map();
  for (const s of sessions) {
    const key = `${new Date(s.date).toDateString()}|${s.provider}`;
    byDay.set(key, (byDay.get(key) || new Set()).add(s.source));
  }
  assert.ok([...byDay.values()].every((sources) => sources.size === 1));
  assert.equal(
    new Set(sessions.map((session) => session.id)).size,
    sessions.length,
  );
  assert.ok(sessions.every((session) => new Date(session.date) <= now));
  assert.equal(summarize(sessions).activeDays, 30);
  assert.equal(parseImport(exportData(sessions)).length, sessions.length);
});

test("extension imports preserve observations, distinguish unknown data, and survive export/edit normalization", () => {
  const tracked = validateSession(
    example({
      id: "orbit-extension-record",
      messageCount: 8,
      source: "extension",
      cost: 25,
    }),
  );
  assert.equal(tracked.messageCount, 8);
  assert.equal(tracked.inputTokens, null);
  assert.equal(tracked.cost, null);
  const legacy = validateSession(
    example({ id: "orbit-extension-legacy", cost: 0 }),
  );
  assert.equal(legacy.messageCount, null);
  assert.equal(legacy.cost, null);
  const edit = validateSession({ ...tracked, title: "Updated", duration: 15 });
  assert.equal(edit.messageCount, 8);
  const roundtrip = parseImport(exportData([edit, legacy]));
  assert.deepEqual(roundtrip, [edit, legacy]);
  const metrics = summarize(roundtrip);
  assert.equal(metrics.totalMessages, 8);
  assert.equal(metrics.observedRecords, 1);
  assert.equal(metrics.totalTokens, 0);
  assert.equal(metrics.totalCost, 0);
  const chart = dailyUsage(roundtrip, 1, new Date(2026, 9, 30, 23, 59));
  assert.equal(chart[0].messages, 8);
  assert.throws(() => validateSession({ ...tracked, messageCount: -1 }));
  assert.throws(() => validateSession({ ...tracked, messageCount: 1.5 }));
});

test("daily observed charts preserve unknown gaps rather than manufacturing zeros", () => {
  const now = new Date(2026, 9, 31, 23);
  const tracked = validateSession(
    example({
      id: "orbit-extension-measured",
      date: new Date(2026, 9, 31, 10).toISOString(),
      messageCount: 0,
    }),
  );
  const legacy = validateSession(
    example({
      id: "orbit-extension-unknown",
      date: new Date(2026, 9, 30, 10).toISOString(),
    }),
  );
  assert.deepEqual(
    dailyUsage([tracked, legacy], 3, now).map((day) => day.messages),
    [null, null, 0],
  );
});

test("time by tool keeps tracked site names and merges logged and tracked use of a tool", () => {
  const day = new Date(2026, 9, 30).toISOString();
  const tracked = (site, provider, duration, messageCount) =>
    validateSession({
      id: `orbit-extension-x-2026-10-30-${site.toLowerCase()}`,
      provider,
      model: `${site} website`,
      title: `${site} · browser activity`,
      date: day,
      duration,
      source: "extension",
      messageCount,
      category: "Other",
    });
  const sessions = [
    tracked("Claude", "claude", 40, 12),
    tracked("Perplexity", "other", 25, null),
    validateSession(example({ id: "api", duration: 30 })), // logged Claude work
    validateSession(example({ id: "local", provider: "other", duration: 5 })),
  ];
  assert.equal(toolName(sessions[1]), "Perplexity");
  assert.equal(toolName(sessions[3]), "Other AI");
  assert.deepEqual(
    timeByTool(sessions).map(({ name, minutes, sends, observed }) => [
      name,
      minutes,
      sends,
      observed,
    ]),
    [
      ["Claude", 70, 12, true],
      ["Perplexity", 25, 0, false],
      ["Other AI", 5, 0, false],
    ],
  );
});
