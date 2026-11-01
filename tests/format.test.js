import test from "node:test";
import assert from "node:assert/strict";
import {
  cellMoney,
  compact,
  duration,
  money,
  plural,
} from "../src/format.js";

test("plural inflects singular counts and keeps thousands separators", () => {
  assert.equal(plural(1, "session"), "1 session");
  assert.equal(plural(0, "session"), "0 sessions");
  assert.equal(plural(2, "day"), "2 days");
  assert.equal(plural(1204, "record"), "1,204 records");
  assert.equal(plural(1, "entry", "entries"), "1 entry");
  assert.equal(plural(3, "entry", "entries"), "3 entries");
});

test("money formats totals with separators; cells never show a misleading $0.00", () => {
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(0), "$0.00");
  assert.equal(cellMoney(0), "$0");
  assert.equal(cellMoney(0.004), "<$0.01");
  assert.equal(cellMoney(0.005), "$0.01");
  assert.equal(cellMoney(0.07), "$0.07");
  assert.equal(cellMoney(1234.5), "$1,234.50");
});

test("duration shows seconds below a minute and hours above an hour", () => {
  assert.equal(duration(0), "0m");
  assert.equal(duration(0.33), "20s");
  assert.equal(duration(0.001), "1s");
  assert.equal(duration(45), "45m");
  assert.equal(duration(59.6), "1h 0m");
  assert.equal(duration(125), "2h 5m");
});

test("compact abbreviates large counts", () => {
  assert.equal(compact(522), "522");
  assert.equal(compact(17200), "17.2K");
  assert.equal(compact(1400000), "1.4M");
});
