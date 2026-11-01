import {
  advance,
  initialState,
  localDay,
  makeExport,
  settle,
  siteForUrl,
  recordSend,
  isOlderVersion,
  OBSERVER_VERSION,
} from "./core.js";

const KEY = "orbit-private-tracker-v1";
const ALARM = "orbit-sample";
let queue = Promise.resolve();
function serialize(action) {
  const task = queue.then(action);
  queue = task.catch(() => {});
  return task;
}
async function readState() {
  const stored = (await chrome.storage.local.get(KEY))[KEY];
  if (stored?.version === 1) return stored;
  return initialState(crypto.randomUUID());
}
async function saveState(state) {
  await chrome.storage.local.set({ [KEY]: state });
  await chrome.action.setBadgeText({ text: state.enabled ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#7961ca" });
}
async function activeContext() {
  try {
    if ((await chrome.idle.queryState(60)) !== "active") return null;
    const window = await chrome.windows.getLastFocused();
    if (!window.focused || window.type !== "normal" || window.incognito)
      return null;
    const [tab] = await chrome.tabs.query({
      active: true,
      windowId: window.id,
    });
    // The host permissions reveal URL only for supported domains. Nothing is read from the page.
    const site = tab && !tab.incognito ? siteForUrl(tab.url) : null;
    return site ? { site, tabId: tab.id } : null;
  } catch {
    return null;
  }
}
async function sample({ resetCursor = false } = {}) {
  let state = await readState();
  if (resetCursor) state = { ...state, cursor: null };
  const context = state.enabled ? await activeContext() : null;
  let observerReady = false;
  if (context) {
    try {
      observerReady =
        (
          await chrome.tabs.sendMessage(context.tabId, {
            type: "observer-status",
          })
        )?.available === true;
    } catch {
      /* No observer / unsupported UI: counts stay unavailable. */
    }
  }
  state = advance(state, Date.now(), context?.site ?? null, observerReady);
  await saveState(state);
  return state;
}
async function ensureAlarm() {
  // Creating an alarm that already exists replaces it and restarts its
  // period, so the popup's 5-second status polls would keep postponing the
  // 30-second sample. Only create it when it is missing.
  if (!(await chrome.alarms.get(ALARM)))
    await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  chrome.idle.setDetectionInterval(60);
}
function enqueueSample(options) {
  serialize(() => sample(options)).catch(() => {});
}
chrome.runtime.onInstalled.addListener((details) => {
  serialize(async () => {
    // Send observation (1.1.0) expanded what is tracked, so updating from an
    // older version needs a fresh opt-in. Later updates, including Reloads of
    // the unpacked extension, keep the user's choice.
    if (
      details.reason === "update" &&
      isOlderVersion(details.previousVersion, OBSERVER_VERSION)
    ) {
      const state = await readState();
      await saveState({ ...state, enabled: false, cursor: null });
    }
    await ensureAlarm();
    await sample({ resetCursor: true });
  }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  serialize(async () => {
    await ensureAlarm();
    await sample({ resetCursor: true });
  }).catch(() => {});
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) enqueueSample();
});
chrome.tabs.onActivated.addListener(() => enqueueSample());
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.url || change.status === "complete") enqueueSample();
});
chrome.tabs.onRemoved.addListener(() => enqueueSample());
chrome.windows.onFocusChanged.addListener(() => enqueueSample());
chrome.idle.onStateChanged.addListener(() => enqueueSample());
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message?.type === "observed-send") {
    const site = siteForUrl(sender.url);
    if (
      !site ||
      sender.frameId !== 0 ||
      !sender.tab?.active ||
      sender.tab.incognito
    )
      return false;
    serialize(async () => {
      const state = await sample();
      if (!state.enabled) return { ok: false };
      const focused = await chrome.windows.getLastFocused();
      const [tab] = await chrome.tabs.query({
        active: true,
        windowId: focused.id,
      });
      if (
        !focused.focused ||
        focused.incognito ||
        focused.type !== "normal" ||
        tab?.id !== sender.tab.id ||
        (await chrome.idle.queryState(60)) !== "active"
      )
        return { ok: false };
      const next = recordSend(state, site, message.eventId, Date.now());
      await saveState(next);
      return { ok: true };
    }).then(respond, () => respond({ ok: false }));
    return true;
  }
  if (
    sender.tab ||
    !["status", "enabled", "export", "clear"].includes(message?.type)
  )
    return false;
  serialize(async () => {
    await ensureAlarm();
    let state = await sample();
    if (message.type === "enabled") {
      state = settle(state, Date.now());
      state.enabled = message.enabled === true;
      state.cursor = null;
      await saveState(state);
      state = await sample();
    }
    if (message.type === "clear") {
      state = { ...initialState(crypto.randomUUID()), enabled: state.enabled };
      state.cursor = null;
      await saveState(state);
      state = await sample();
    }
    if (message.type === "export") return { ok: true, data: makeExport(state) };
    const today = localDay(Date.now());
    const rows = Object.values(state.buckets).filter(
      (bucket) => bucket.day === today,
    );
    return {
      ok: true,
      enabled: state.enabled,
      rows,
      totalMilliseconds: rows.reduce((sum, row) => sum + row.milliseconds, 0),
      totalMessages: rows.some((row) => row.messageCount != null)
        ? rows.reduce((sum, row) => sum + (row.messageCount || 0), 0)
        : null,
    };
  }).then(respond, () =>
    respond({
      ok: false,
      error: "Unable to save tracker data. Please try again.",
    }),
  );
  return true;
});
