import test from "node:test";
import assert from "node:assert/strict";
import { monotoneSegments, niceScale, segmentsPath } from "../src/chart.js";

test("niceScale rounds axes to friendly steps for counts, money and minutes", () => {
  assert.deepEqual(niceScale(228, { metric: "count" }).ticks, [
    0, 50, 100, 150, 200, 250,
  ]);
  assert.deepEqual(niceScale(93600).ticks, [
    0, 20000, 40000, 60000, 80000, 100000,
  ]);
  assert.deepEqual(niceScale(12).ticks, [0, 5, 10, 15]);
  assert.deepEqual(niceScale(3).ticks, [0, 1, 2, 3]);
  assert.deepEqual(niceScale(0).ticks, [0, 1]);
  assert.deepEqual(niceScale(0.27, { metric: "cost" }).ticks, [
    0, 0.1, 0.2, 0.3,
  ]);
  // Minutes use clock-friendly steps: 200 min -> 1h steps up to 4h.
  assert.deepEqual(niceScale(200, { metric: "minutes" }).ticks, [
    0, 60, 120, 180, 240,
  ]);
  assert.deepEqual(niceScale(50, { metric: "minutes" }).ticks, [
    0, 10, 20, 30, 40, 50,
  ]);
  assert.deepEqual(niceScale(70, { metric: "minutes" }).ticks, [
    0, 15, 30, 45, 60, 75,
  ]);
  for (const [max, metric] of [
    [228, "count"],
    [0.27, "cost"],
    [200, "minutes"],
    [1, "minutes"],
  ]) {
    const scale = niceScale(max, { metric });
    assert.ok(scale.max >= max, `${metric} axis covers ${max}`);
    assert.ok(scale.ticks.length <= 6, `${metric} axis stays readable`);
  }
});

test("monotone curves pass through every point and never dip below the data", () => {
  const points = [
    [0, 100],
    [10, 0],
    [20, 0],
    [30, 80],
    [40, 60],
  ];
  const segments = monotoneSegments(points);
  assert.equal(segments.length, 4);
  segments.forEach((segment, i) => {
    assert.deepEqual(segment.from, points[i]);
    assert.deepEqual(segment.to, points[i + 1]);
    const lo = Math.min(segment.from[1], segment.to[1]);
    const hi = Math.max(segment.from[1], segment.to[1]);
    for (const control of [segment.c1, segment.c2]) {
      assert.ok(
        control[1] >= lo - 1e-9 && control[1] <= hi + 1e-9,
        `segment ${i} control stays within its interval (no overshoot)`,
      );
    }
  });
  // A flat stretch stays exactly flat.
  assert.equal(segments[1].c1[1], 0);
  assert.equal(segments[1].c2[1], 0);
});

test("gaps split the curve into separate runs and isolated points draw nothing", () => {
  const segments = monotoneSegments([
    [0, 1],
    [1, 2],
    null,
    [3, 4],
    null,
    [5, 6],
    [6, 7],
  ]);
  assert.deepEqual(
    segments.map((segment) => segment !== null),
    [true, false, false, false, false, true],
  );
  const d = segmentsPath(segments);
  assert.equal((d.match(/M/g) || []).length, 2, "one subpath per run");
  assert.equal((d.match(/C/g) || []).length, 2);
  // A continuous run is one subpath, so an area fill can close it.
  const continuous = segmentsPath(
    monotoneSegments([
      [0, 1],
      [1, 3],
      [2, 2],
    ]),
  );
  assert.equal((continuous.match(/M/g) || []).length, 1);
});
