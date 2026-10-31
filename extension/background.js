import {
  advance,
  initialState,
  localDay,
  makeExport,
  settle,
  siteForUrl,
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
async function activeSite() {
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
    return tab && !tab.incognito ? siteForUrl(tab.url) : null;
  } catch {
    return null;
  }
}
async function sample({ resetCursor = false } = {}) {
  let state = await readState();
  if (resetCursor) state = { ...state, cursor: null };
  const site = state.enabled ? await activeSite() : null;
  state = advance(state, Date.now(), site);
  await saveState(state);
  return state;
}
async function ensureAlarm() {
  await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  chrome.idle.setDetectionInterval(60);
}
function enqueueSample(options) {
  serialize(() => sample(options)).catch(() => {});
}
chrome.runtime.onInstalled.addListener(() => {
  serialize(async () => {
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
  if (
    sender.id !== chrome.runtime.id ||
    !["status", "enabled", "export", "clear"].includes(message?.type)
  )
    return false;
  serialize(async () => {
    await ensureAlarm();
    let state = await sample();
    if (message.type === "enabled") {
      state = settle(state, Date.now());
      state.enabled = message.enabled === true;
      state = advance(
        state,
        Date.now(),
        state.enabled ? await activeSite() : null,
      );
      await saveState(state);
    }
    if (message.type === "clear") {
      state = { ...initialState(crypto.randomUUID()), enabled: state.enabled };
      state = advance(
        state,
        Date.now(),
        state.enabled ? await activeSite() : null,
      );
      await saveState(state);
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
    };
  }).then(respond, () =>
    respond({
      ok: false,
      error: "Unable to save tracker data. Please try again.",
    }),
  );
  return true;
});
