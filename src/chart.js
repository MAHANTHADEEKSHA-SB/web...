/** Pure chart geometry (no DOM). Covered by tests/chart.test.js. */

const TIME_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720];

/**
 * Round an axis up to friendly ticks: 1-2-2.5-5 steps for counts and money,
 * clock-friendly steps for minutes (10m, 15m, 30m, 1h, 2h...). Picks the
 * smallest step that covers the data in at most `count + 1` intervals.
 * Returns { max, step, ticks } with `ticks` from 0 to max inclusive.
 */
export function niceScale(maximum, { metric = "count", count = 4 } = {}) {
  const value = Number.isFinite(maximum) && maximum > 0 ? maximum : 0;
  const limit = count + 1;
  const fits = (step) => Math.ceil(value / step - 1e-9) <= limit;
  let step;
  if (metric === "minutes") {
    step =
      TIME_STEPS.find((candidate) => fits(candidate)) ??
      Math.ceil(value / limit / 1440) * 1440;
  } else {
    const floor = metric === "cost" ? 0.01 : 1;
    let magnitude = 10 ** Math.floor(Math.log10(Math.max(value / limit, floor)));
    search: for (;;) {
      for (const multiple of [1, 2, 2.5, 5]) {
        const candidate = Number((multiple * magnitude).toFixed(9));
        if (candidate < floor) continue;
        if (metric !== "cost" && !Number.isInteger(candidate)) continue;
        if (fits(candidate)) {
          step = candidate;
          break search;
        }
      }
      magnitude *= 10;
    }
  }
  const steps = Math.max(1, Math.ceil(value / step - 1e-9));
  const ticks = Array.from({ length: steps + 1 }, (_, i) =>
    Number((i * step).toFixed(6)),
  );
  return { max: ticks.at(-1), step, ticks };
}

/**
 * Monotone cubic (Fritsch–Carlson) segments through points [x, y] | null.
 * segments[i] is the cubic from point i to i+1 as
 * { from: [x, y], c1, c2, to } or null when either end is missing.
 * Monotone interpolation never overshoots, so a curve through values >= 0
 * never dips below the baseline.
 */
export function monotoneSegments(points) {
  const segments = new Array(Math.max(points.length - 1, 0)).fill(null);
  let runStart = 0;
  for (let i = 0; i <= points.length; i += 1) {
    if (i < points.length && points[i]) continue;
    const run = points.slice(runStart, i);
    if (run.length >= 2) {
      const tangents = fritschCarlson(run);
      for (let j = 0; j < run.length - 1; j += 1) {
        const [x0, y0] = run[j];
        const [x1, y1] = run[j + 1];
        const h = (x1 - x0) / 3;
        segments[runStart + j] = {
          from: [x0, y0],
          c1: [x0 + h, y0 + tangents[j] * h],
          c2: [x1 - h, y1 - tangents[j + 1] * h],
          to: [x1, y1],
        };
      }
    }
    runStart = i + 1;
  }
  return segments;
}

function fritschCarlson(points) {
  const n = points.length;
  const secants = [];
  for (let i = 0; i < n - 1; i += 1)
    secants.push(
      (points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0]),
    );
  const tangents = [secants[0]];
  for (let i = 1; i < n - 1; i += 1)
    tangents.push(
      secants[i - 1] * secants[i] <= 0 ? 0 : (secants[i - 1] + secants[i]) / 2,
    );
  tangents.push(secants[n - 2]);
  for (let i = 0; i < n - 1; i += 1) {
    if (secants[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / secants[i];
    const b = tangents[i + 1] / secants[i];
    const length = a * a + b * b;
    if (length > 9) {
      const tau = 3 / Math.sqrt(length);
      tangents[i] = tau * a * secants[i];
      tangents[i + 1] = tau * b * secants[i];
    }
  }
  return tangents;
}

/** SVG path data for a list of segments, starting a subpath at each gap. */
export function segmentsPath(segments) {
  let d = "";
  let previous = null;
  for (const segment of segments) {
    if (!segment) {
      previous = null;
      continue;
    }
    const f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const continues =
      previous &&
      previous[0] === segment.from[0] &&
      previous[1] === segment.from[1];
    if (!continues) d += `M${f(segment.from)}`;
    d += `C${f(segment.c1)} ${f(segment.c2)} ${f(segment.to)}`;
    previous = segment.to;
  }
  return d;
}
