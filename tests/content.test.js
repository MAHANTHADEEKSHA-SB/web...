import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
  new URL("../extension/content.js", import.meta.url),
  "utf8",
);
async function fixture({ host = "chatgpt.com", enabled = true } = {}) {
  const listeners = {},
    messages = [];
  let clock = 1000,
    change,
    receive,
    currentEnabled = enabled;
  const button = {
    disabled: false,
    className: "",
    attributes: { "aria-label": "Send message" },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    getClientRects: () => [1],
    closest: () => button,
  };
  const composer = {
    closest(selector) {
      return selector === "form" ? null : composer;
    },
    get value() {
      throw new Error("Prompt text must never be read");
    },
    get innerText() {
      throw new Error("Prompt text must never be read");
    },
  };
  const document = {
    visibilityState: "visible",
    querySelector: () => button,
    addEventListener: (name, listener) => {
      listeners[name] = listener;
    },
  };
  const window = {};
  window.top = window;
  vm.runInNewContext(source, {
    location: { hostname: host },
    window,
    document,
    performance: { now: () => clock },
    crypto: { randomUUID: () => `test-event-${clock}` },
    getComputedStyle: () => ({ visibility: "visible", display: "block" }),
    chrome: {
      storage: {
        local: {
          get: async () => ({
            "orbit-private-tracker-v1": { enabled: currentEnabled },
          }),
        },
        onChanged: {
          addListener: (fn) => {
            change = fn;
          },
        },
      },
      runtime: {
        id: "test-extension",
        onMessage: {
          addListener: (fn) => {
            receive = fn;
          },
        },
        sendMessage: async (message) => {
          messages.push(message);
        },
      },
    },
  });
  await Promise.resolve();
  return {
    messages,
    button,
    composer,
    document,
    listeners,
    tick: () => {
      clock += 1000;
    },
    toggle(value) {
      currentEnabled = value;
      change?.(
        { "orbit-private-tracker-v1": { newValue: { enabled: value } } },
        "local",
      );
    },
    event(type, properties = {}) {
      listeners[type]?.({
        type,
        isTrusted: true,
        target: type === "keydown" ? composer : button,
        ...properties,
      });
    },
    status: () =>
      new Promise((resolve) =>
        receive({ type: "observer-status" }, { id: "test-extension" }, resolve),
      ),
  };
}

test("send controls count trusted click/submit once without ever reading prompt values", async () => {
  const f = await fixture();
  f.event("click");
  f.event("submit", { target: { querySelector: () => f.button } });
  assert.equal(f.messages.length, 1);
  f.tick();
  f.event("keydown", { key: "Enter" });
  assert.equal(f.messages.length, 2);
  assert.deepEqual(Object.keys(f.messages[0]).sort(), ["eventId", "type"]);
});

test("stop, disabled, modified Enter, composing and synthetic events do not count", async () => {
  const f = await fixture();
  f.button.attributes["data-testid"] = "stop-button";
  f.event("click");
  f.button.attributes["data-testid"] = null;
  f.button.attributes["aria-label"] = "Stop generating";
  f.event("click");
  f.button.attributes["aria-label"] = "Send message";
  f.button.disabled = true;
  f.event("click");
  f.button.disabled = false;
  for (const flags of [
    { shiftKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { isComposing: true },
    { repeat: true },
  ])
    f.event("keydown", { key: "Enter", ...flags });
  f.event("click", { isTrusted: false });
  assert.equal(f.messages.length, 0);
  f.event("click");
  assert.equal(f.messages.length, 1);
});

test("pause, background document and unsupported hosts prevent collection", async () => {
  const f = await fixture({ enabled: false });
  f.event("click");
  assert.equal(f.messages.length, 0);
  assert.equal((await f.status()).available, false);
  f.toggle(true);
  assert.equal((await f.status()).available, true);
  f.document.visibilityState = "hidden";
  f.event("click");
  assert.equal(f.messages.length, 0);
  f.document.visibilityState = "visible";
  f.event("click");
  assert.equal(f.messages.length, 1);
  f.toggle(false);
  f.tick();
  f.event("click");
  assert.equal(f.messages.length, 1);
  const other = await fixture({ host: "www.google.com" });
  assert.deepEqual(Object.keys(other.listeners), []);
});
