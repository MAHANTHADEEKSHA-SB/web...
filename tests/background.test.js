import test from "node:test";
import assert from "node:assert/strict";
import { initialState, localDay } from "../extension/core.js";

const KEY = "orbit-private-tracker-v1";
const ID = "orbit-extension-test";
let workerSerial = 0;

function event() {
  const listeners = [];
  return {
    listeners,
    addListener: (fn) => listeners.push(fn),
    emit: (...args) => listeners.forEach((fn) => fn(...args)),
  };
}

async function worker(t, initial = {}) {
  const previousChrome = globalThis.chrome;
  const previousNow = Date.now;
  let now = new Date(2026, 10, 1, 12).getTime();
  const storage = {
    [KEY]: {
      ...initialState("installation-test"),
      ...structuredClone(initial),
    },
  };
  const context = {
    tab: {
      id: 4,
      windowId: 10,
      active: true,
      incognito: false,
      url: "https://claude.ai/chat/private-conversation",
    },
    window: { id: 10, focused: true, type: "normal", incognito: false },
    idle: "active",
    observerReady: true,
    badges: [],
    alarms: [],
    detection: [],
  };
  const chrome = {
    runtime: {
      id: ID,
      onInstalled: event(),
      onStartup: event(),
      onMessage: event(),
    },
    storage: {
      local: {
        get: async (key) => ({ [key]: structuredClone(storage[key]) }),
        set: async (data) => {
          Object.assign(storage, structuredClone(data));
        },
      },
    },
    action: {
      setBadgeText: async (value) => context.badges.push(value.text),
      setBadgeBackgroundColor: async () => {},
    },
    alarms: {
      create: async (...args) => context.alarms.push(args),
      get: async (name) => {
        const created = context.alarms.findLast((args) => args[0] === name);
        return created ? { name, ...created[1] } : undefined;
      },
      onAlarm: event(),
    },
    idle: {
      queryState: async () => context.idle,
      setDetectionInterval: (value) => context.detection.push(value),
      onStateChanged: event(),
    },
    windows: {
      getLastFocused: async () => ({ ...context.window }),
      onFocusChanged: event(),
    },
    tabs: {
      query: async () => [{ ...context.tab }],
      sendMessage: async (_tabId, request) => {
        assert.equal(request.type, "observer-status");
        if (context.observerReady === "missing")
          throw new Error("No receiving end");
        return { available: context.observerReady };
      },
      onActivated: event(),
      onUpdated: event(),
      onRemoved: event(),
    },
  };
  globalThis.chrome = chrome;
  Date.now = () => now;
  t.after(() => {
    Date.now = previousNow;
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  });
  await import(`../extension/background.js?test=${++workerSerial}`);

  const popup = { id: ID, url: `chrome-extension://${ID}/popup.html` };
  const content = () => ({
    id: ID,
    frameId: 0,
    url: context.tab.url,
    tab: { ...context.tab },
  });
  function message(value, sender = popup) {
    return new Promise((resolve) => {
      const accepted = chrome.runtime.onMessage.listeners[0](
        value,
        sender,
        (response) => resolve({ accepted: true, response }),
      );
      if (accepted !== true) resolve({ accepted: false });
    });
  }
  return {
    chrome,
    context,
    content,
    popup,
    message,
    get state() {
      return structuredClone(storage[KEY]);
    },
    replace: (value) => {
      storage[KEY] = structuredClone(value);
    },
    tick: (ms) => {
      now += ms;
    },
    get now() {
      return now;
    },
  };
}

function totalSends(state) {
  return Object.values(state.buckets).reduce(
    (sum, bucket) => sum + (bucket.messageCount || 0),
    0,
  );
}

test("worker popup starts paused, toggles persistently, and reports recorded active time", async (t) => {
  const w = await worker(t);
  let result = await w.message({ type: "status" });
  assert.equal(result.response.enabled, false);
  assert.equal(result.response.totalMessages, null);
  assert.equal(result.response.totalMilliseconds, 0);
  assert.deepEqual(w.context.alarms[0], [
    "orbit-sample",
    { periodInMinutes: 0.5 },
  ]);
  assert.equal(w.context.detection[0], 60);

  result = await w.message({ type: "enabled", enabled: true });
  assert.equal(result.response.enabled, true);
  assert.equal(w.state.enabled, true);
  assert.equal(w.context.badges.at(-1), "ON");
  w.tick(30000);
  result = await w.message({ type: "status" });
  assert.equal(result.response.totalMilliseconds, 30000);
  assert.equal(
    result.response.totalMessages,
    0,
    "Ready observer records zero sends after enabling, not unavailable",
  );
  result = await w.message({ type: "enabled", enabled: false });
  assert.equal(result.response.enabled, false);
  assert.equal(w.state.cursor, null);
  assert.equal(w.context.badges.at(-1), "");
  w.tick(30000);
  assert.equal(
    (await w.message({ type: "status" })).response.totalMilliseconds,
    30000,
  );
});

test("popup polling never re-creates, and so never postpones, the sampling alarm", async (t) => {
  const w = await worker(t, { enabled: true });
  w.chrome.runtime.onInstalled.emit({ reason: "install" });
  for (let poll = 0; poll < 5; poll += 1) await w.message({ type: "status" });
  assert.equal(w.context.alarms.length, 1);
  assert.deepEqual(w.context.alarms[0], [
    "orbit-sample",
    { periodInMinutes: 0.5 },
  ]);
});

test("worker rejects foreign extensions and content scripts cannot read or control the popup API", async (t) => {
  const w = await worker(t, { enabled: true });
  for (const type of [
    "status",
    "enabled",
    "export",
    "clear",
    "observed-send",
  ]) {
    const result = await w.message(
      { type, enabled: false, eventId: "foreign" },
      { ...w.popup, id: "other-extension" },
    );
    assert.equal(result.accepted, false, type);
  }
  for (const type of ["status", "enabled", "export", "clear"]) {
    assert.equal(
      (await w.message({ type, enabled: false }, w.content())).accepted,
      false,
      type,
    );
  }
  assert.equal(w.state.enabled, true);
  assert.deepEqual(w.state.buckets, {});
});

test("worker accepts only top-frame send observations from supported active non-incognito tabs", async (t) => {
  const w = await worker(t, { enabled: true });
  const sender = w.content();
  const invalid = [
    { ...sender, url: "https://example.com" },
    { ...sender, url: "https://claude.ai.example.com" },
    { ...sender, url: "http://claude.ai" },
    { ...sender, frameId: 1 },
    { ...sender, frameId: undefined },
    { ...sender, tab: { ...sender.tab, active: false } },
    { ...sender, tab: { ...sender.tab, incognito: true } },
    { ...sender, tab: undefined },
  ];
  for (const candidate of invalid) {
    assert.equal(
      (
        await w.message(
          { type: "observed-send", eventId: "invalid-origin" },
          candidate,
        )
      ).accepted,
      false,
    );
  }
  assert.equal(totalSends(w.state), 0);
  const result = await w.message(
    { type: "observed-send", eventId: "valid-origin" },
    sender,
  );
  assert.equal(result.response.ok, true);
  assert.equal(totalSends(w.state), 1);
});

test("worker counts no sends while paused, unfocused, idle, incognito, or on another foreground tab", async (t) => {
  const w = await worker(t);
  assert.equal(
    (await w.message({ type: "observed-send", eventId: "paused" }, w.content()))
      .response.ok,
    false,
  );
  await w.message({ type: "enabled", enabled: true });
  const sender = w.content();
  const cases = [
    () => {
      w.context.window.focused = false;
    },
    () => {
      w.context.window.incognito = true;
    },
    () => {
      w.context.window.type = "popup";
    },
    () => {
      w.context.idle = "idle";
    },
    () => {
      w.context.idle = "locked";
    },
    () => {
      w.context.tab.id = 99;
    },
  ];
  for (const [index, change] of cases.entries()) {
    w.context.window = {
      id: 10,
      focused: true,
      type: "normal",
      incognito: false,
    };
    w.context.idle = "active";
    w.context.tab.id = 4;
    change();
    const result = await w.message(
      { type: "observed-send", eventId: `blocked-${index}` },
      sender,
    );
    assert.equal(result.response.ok, false, `case ${index}`);
    assert.equal(totalSends(w.state), 0);
  }
});

test("worker deduplicates send events and exports counts without prompts or invented token usage", async (t) => {
  const w = await worker(t, { enabled: true });
  for (const eventId of ["one-event", "one-event", "second-event"]) {
    await w.message(
      {
        type: "observed-send",
        eventId,
        prompt: "sensitive input that must not be saved",
      },
      w.content(),
    );
  }
  assert.equal(totalSends(w.state), 2);
  const status = (await w.message({ type: "status" })).response;
  assert.equal(status.totalMessages, 2);
  const exported = (await w.message({ type: "export" })).response.data;
  assert.equal(exported.sessions.length, 1);
  const record = exported.sessions[0];
  assert.equal(record.messageCount, 2);
  assert.equal(record.source, "extension");
  assert.equal(record.inputTokens, null);
  assert.equal(record.outputTokens, null);
  assert.equal(record.cost, null);
  assert.equal(JSON.stringify(w.state).includes("sensitive input"), false);
  assert.equal(
    JSON.stringify(exported).includes("private-conversation"),
    false,
  );
});

test("worker safely ignores malformed event IDs without affecting valid counts", async (t) => {
  const w = await worker(t, { enabled: true });
  for (const eventId of [
    undefined,
    null,
    {},
    42,
    "",
    "a".repeat(81),
    "<script>",
    "spaces are not allowed",
  ]) {
    await w.message({ type: "observed-send", eventId }, w.content());
  }
  assert.equal(totalSends(w.state), 0);
  await w.message(
    { type: "observed-send", eventId: "valid-after-invalid" },
    w.content(),
  );
  assert.equal(totalSends(w.state), 1);
});

test("extension update pauses tracking while preserving accumulated records and installation ID", async (t) => {
  const now = new Date(2026, 10, 1, 12).getTime();
  const day = localDay(now);
  const bucket = {
    day,
    site: { id: "claude", name: "Claude" },
    date: new Date(now).toISOString(),
    milliseconds: 123000,
    messageCount: 3,
  };
  const w = await worker(t, {
    enabled: true,
    installationId: "retained-id",
    buckets: { [`${day}|claude`]: bucket },
  });
  w.chrome.runtime.onInstalled.emit({ reason: "update" });
  const result = await w.message({ type: "status" }); // Queued after update initialization.
  assert.equal(result.response.enabled, false);
  assert.equal(result.response.totalMilliseconds, 123000);
  assert.equal(result.response.totalMessages, 3);
  assert.equal(w.state.installationId, "retained-id");
  assert.deepEqual(w.state.buckets[`${day}|claude`], bucket);
  assert.equal(w.state.cursor, null);
});

test("worker distinguishes unavailable observation from a ready observer with zero sends", async (t) => {
  const w = await worker(t, { enabled: true });
  w.context.observerReady = "missing";
  await w.message({ type: "status" });
  w.tick(30000);
  let result = await w.message({ type: "status" });
  assert.equal(result.response.totalMessages, null);
  assert.equal(result.response.totalMilliseconds, 30000);
  let record = (await w.message({ type: "export" })).response.data.sessions[0];
  assert.equal(record.messageCount, null);

  w.replace({ ...initialState("ready-installation"), enabled: true });
  w.context.observerReady = true;
  await w.message({ type: "status" });
  w.tick(30000);
  result = await w.message({ type: "status" });
  assert.equal(result.response.totalMessages, 0);
  assert.equal(result.response.totalMilliseconds, 30000);
  record = (await w.message({ type: "export" })).response.data.sessions[0];
  assert.equal(record.messageCount, 0);
});

test("popup clear resets history and retains enabled observation with a fresh cursor", async (t) => {
  const w = await worker(t, { enabled: true, installationId: "before-clear" });
  await w.message(
    { type: "observed-send", eventId: "before-clear" },
    w.content(),
  );
  w.tick(30000);
  assert.equal((await w.message({ type: "status" })).response.totalMessages, 1);
  const result = await w.message({ type: "clear" });
  assert.equal(result.response.enabled, true);
  assert.equal(result.response.totalMilliseconds, 0);
  assert.equal(result.response.totalMessages, null);
  assert.equal(w.state.cursor.observerReady, true);
  assert.notEqual(w.state.installationId, "before-clear");
  assert.deepEqual(w.state.buckets, {});
  w.tick(30000);
  assert.equal((await w.message({ type: "status" })).response.totalMessages, 0);
});
