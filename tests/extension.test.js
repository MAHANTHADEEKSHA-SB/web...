import test from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  exportSessions,
  initialState,
  localDay,
  makeExport,
  MAX_GAP_MS,
  settle,
  siteForUrl,
} from "../extension/core.js";
import { parseImport } from "../src/data.js";

const start = new Date(2026, 10, 1, 12).getTime();
const claude = siteForUrl("https://claude.ai/chat/example");
const chatgpt = siteForUrl("https://chatgpt.com/c/example");
function enabled() {
  return { ...initialState("test-installation"), enabled: true };
}
function duration(state) {
  return Object.values(state.buckets).reduce(
    (sum, bucket) => sum + bucket.milliseconds,
    0,
  );
}

test("extension only recognizes exact supported HTTPS domains", () => {
  assert.equal(claude.id, "claude");
  assert.equal(
    siteForUrl("https://www.perplexity.ai/search/abc").id,
    "perplexity",
  );
  for (const url of [
    "https://claude.ai.example.com",
    "http://claude.ai",
    "https://example.com",
    "https://constructor",
    "https://toString",
    "chrome://newtab",
    undefined,
  ])
    assert.equal(siteForUrl(url), null);
});

test("tracking is disabled by default and never accrues before consent", () => {
  const state = advance(
    advance(initialState("id"), start, claude),
    start + 30000,
    claude,
  );
  assert.equal(state.enabled, false);
  assert.equal(state.cursor, null);
  assert.equal(duration(state), 0);
});

test("active intervals accumulate by provider, and switching away pauses time", () => {
  let state = advance(enabled(), start, claude);
  state = advance(state, start + 30000, chatgpt);
  state = advance(state, start + 45000, null);
  state = advance(state, start + 60000, null);
  assert.equal(duration(state), 45000);
  const records = exportSessions(state);
  assert.equal(
    records.find((record) => record.provider === "claude").duration,
    0.5,
  );
  assert.equal(
    records.find((record) => record.provider === "chatgpt").duration,
    0.25,
  );
});

test("long sleep gaps and backwards clock changes add no time", () => {
  let state = advance(enabled(), start, claude);
  state = advance(state, start + MAX_GAP_MS + 1, claude);
  assert.equal(duration(state), 0);
  state = advance(state, start, null);
  assert.equal(duration(state), 0);
});

test("settle flushes elapsed time and removes cursor before disabling", () => {
  const state = settle(advance(enabled(), start, claude), start + 10000);
  assert.equal(duration(state), 10000);
  assert.equal(state.cursor, null);
  assert.equal(duration(settle(state, start + 20000)), 10000);
});

test("a persisted cursor survives ordinary worker suspension without duplicating time", () => {
  let state = advance(enabled(), start, claude);
  state = JSON.parse(JSON.stringify(state));
  state = advance(state, start + 30000, claude);
  state = JSON.parse(JSON.stringify(state));
  state = advance(state, start + 60000, null);
  assert.equal(duration(state), 60000);
});

test("intervals crossing local midnight split into two calendar days", () => {
  const nearMidnight = new Date(2026, 10, 1, 23, 59, 45).getTime();
  const state = advance(
    advance(enabled(), nearMidnight, claude),
    nearMidnight + 30000,
    null,
  );
  const buckets = Object.values(state.buckets);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].milliseconds, 15000);
  assert.equal(buckets[1].milliseconds, 15000);
  assert.equal(buckets[0].day, localDay(nearMidnight));
  assert.equal(buckets[1].day, localDay(nearMidnight + 30000));
});

test("old and new ChatGPT hosts accumulate into one provider/day", () => {
  let state = advance(enabled(), start, chatgpt);
  state = advance(state, start + 30000, siteForUrl("https://chat.openai.com"));
  state = advance(state, start + 60000, null);
  assert.equal(exportSessions(state).length, 1);
  assert.equal(exportSessions(state)[0].duration, 1);
});

test("exports are accepted by the dashboard and stable IDs allow cumulative updates", () => {
  let state = advance(enabled(), start, claude);
  state = advance(state, start + 30000, claude);
  const first = parseImport(JSON.stringify(makeExport(state)));
  state = advance(state, start + 60000, null);
  const second = parseImport(JSON.stringify(makeExport(state)));
  assert.equal(first[0].id, second[0].id);
  assert.equal(second[0].duration, 1);
  assert.equal(second[0].inputTokens, 0);
  assert.equal(second[0].cost, 0);
});

test("Other AI sources retain distinct identities and no page metadata", () => {
  let state = advance(
    enabled(),
    start,
    siteForUrl("https://perplexity.ai/search/private-topic"),
  );
  state = advance(
    state,
    start + 30000,
    siteForUrl("https://copilot.microsoft.com"),
  );
  state = advance(state, start + 60000, null);
  const result = parseImport(JSON.stringify(makeExport(state)));
  assert.equal(result.length, 2);
  assert.ok(result.every((record) => record.provider === "other"));
  assert.notEqual(result[0].id, result[1].id);
  assert.equal(JSON.stringify(state).includes("private-topic"), false);
});
