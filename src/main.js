import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "./style.css";
import {
  PROVIDERS,
  createDemoSessions,
  validateSession,
  calculateCost,
  summarize,
  filterSessions,
  dailyUsage,
  loadSessions,
  saveSessions,
  parseImport,
  exportData,
  STORAGE_KEY,
  timeByTool,
  toolName,
} from "./data.js";
import {
  cellMoney,
  compact,
  duration,
  money,
  plural,
  shortDuration,
} from "./format.js";
import { monotoneSegments, niceScale, segmentsPath } from "./chart.js";

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 2.5-6.2L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  chart: '<path d="M4 20h16M6 16v-5m6 5V4m6 12V8"/>',
  settings:
    '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  up: '<path d="m7 14 5-5 5 5"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  money: '<path d="M12 2v20m5-15c-1-4-10-4-10 1 0 5 10 3 10 8 0 5-9 5-11 1"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/><path d="M8 10h8m-8 4h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const prettyDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const provider = (id) =>
  PROVIDERS.find((p) => p.id === id) || PROVIDERS[PROVIDERS.length - 1];
function mark(id) {
  if (id === "claude")
    return '<span class="provider-logo claude" aria-hidden="true">✳</span>';
  if (id === "chatgpt")
    return '<span class="provider-logo chatgpt" aria-hidden="true">◎</span>';
  if (id === "gemini")
    return '<span class="provider-logo gemini" aria-hidden="true">✦</span>';
  return '<span class="provider-logo other" aria-hidden="true">✧</span>';
}
let stored = [],
  storageError = "";
try {
  stored = loadSessions();
} catch (e) {
  storageError = e.message;
}
let mode = "demo";
try {
  mode =
    localStorage.getItem("orbit-mode") || (stored.length ? "personal" : "demo");
} catch {
  storageError =
    "Browser storage is unavailable. Your changes cannot be saved.";
}
if (!["demo", "personal"].includes(mode)) mode = "demo";
const state = {
  view: "overview",
  days: 30,
  provider: "all",
  query: "",
  chart: "minutes",
  mode,
  personal: stored,
  demo: createDemoSessions(),
  limit: 50, // rows shown in the full activity list (B1 pagination)
  chartWidth: {}, // measured chart width per view, in CSS px
};
const all = () => (state.mode === "demo" ? state.demo : state.personal);
const filtered = () =>
  filterSessions(all(), {
    days: state.days,
    provider: state.provider,
    query: state.query,
    // Future-dated records never count toward totals, but the Sessions list
    // shows them so they can still be edited or deleted.
    includeFuture: state.view === "sessions",
  });
let toastTimer;
function toast(text) {
  const el = document.querySelector("#toast");
  el.textContent = text;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4000);
}
function setMode(next) {
  state.mode = next;
  state.chart = "minutes";
  try {
    localStorage.setItem("orbit-mode", next);
  } catch {
    toast("Browser storage is unavailable.");
  }
  state.query = "";
  state.provider = "all";
  render();
}
function persist(next) {
  if (storageError) {
    toast(
      "Saving is blocked to protect unreadable data. Export the stored file from Settings first.",
    );
    return false;
  }
  try {
    saveSessions(next);
    state.personal = next;
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}
const VIEW_TITLES = {
  overview: "Overview",
  sessions: "Sessions",
  insights: "Insights",
  settings: "Settings",
};
function shell() {
  const titles = VIEW_TITLES;
  const demo = state.mode === "demo";
  document.querySelector("#app").innerHTML = `
 <button class="skip-link" data-action="skip">Skip to content</button>
 <aside class="sidebar" id="sidebar"><a class="brand" href="#overview" aria-label="Orbit overview"><span class="orbit-symbol"><i></i></span>orbit<span class="brand-dot">.</span></a>
 <button class="workspace" data-action="${demo ? "personal" : "demo"}" title="${demo ? "Start your own private orbit" : "Explore the demo workspace"}"><span class="workspace-icon">${icon("spark")}</span><div>${demo ? "Demo workspace" : "Personal workspace"}<small>${demo ? "Sample data · switch to yours" : "Saved only in this browser"}</small></div><span class="workspace-switch">${icon("swap")}</span></button>
 <div class="nav-label">WORKSPACE</div><nav>${Object.entries(titles)
   .map(
     ([id, label], i) =>
       `<a href="#${id}" class="nav-item ${state.view === id ? "active" : ""}"${state.view === id ? ' aria-current="page"' : ""}>${icon(["grid", "history", "chart", "settings"][i])}<span>${label}</span>${id === "overview" ? '<span class="nav-dot"></span>' : ""}</a>`,
   )
   .join("")}</nav>
 <div class="sidebar-bottom"><div class="local-card"><span class="local-icon">${icon("lock")}</span><strong>Your data. Your orbit.</strong><p>Private by design.<br>Saved only in this browser.</p><a href="#settings">Manage your data ${icon("arrow")}</a></div><div class="profile"><span class="avatar">Y</span><div>Your workspace<small>Personal · Free forever</small></div><span class="online-dot"></span></div></div></aside>
 <div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-btn mobile-menu" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false" data-action="menu">${icon("menu")}</button><span>Workspace</span><span class="slash">/</span><strong>${titles[state.view]}</strong></div><div class="topbar-right"><span class="privacy-status"><i></i> Local & private</span><button class="top-avatar" data-action="settings" aria-label="Open settings">Y</button></div></header>
 <main id="main"><div class="page-heading"><div class="eyebrow">A LITTLE CLARITY FOR YOUR AI LIFE</div><div class="heading-row"><div><h1 tabindex="-1">${{ overview: "Your AI, in perspective.", sessions: "Every session, in one place.", insights: "Make sense of your habits.", settings: "A space that’s yours." }[state.view]}</h1><p class="subtitle">${{ overview: "A mindful look at the tools powering your everyday.", sessions: "The prompts, projects, and little breakthroughs along the way.", insights: "Discover where your time and creativity go.", settings: "Your preferences, your data, your control." }[state.view]}</p></div><div class="heading-actions"><button class="button secondary" data-action="export">${icon("download")}<span>Export</span></button><button class="button primary" data-action="add">${icon("plus")} Log session</button></div></div></div>
 ${storageError ? `<div class="error-banner" role="alert">${esc(storageError)} Export any accessible data before changing browser storage.</div>` : ""}
 ${state.mode === "demo" ? `<div class="demo-banner"><span>${icon("spark")} <strong>A little inspiration.</strong> You’re exploring sample data.</span><button data-action="personal">Start my own orbit ${icon("arrow")}</button></div>` : ""}
 ${state.mode === "personal" && state.personal.length && state.view === "overview" ? `<div class="tracking-banner"><span>${icon("clock")} <strong>Make time for your ideas.</strong> Track active AI time and observed send actions.</span><a href="#settings">Set up tracking ${icon("arrow")}</a></div>` : ""}<div id="content"></div>
 <footer><span><span class="tiny-orbit">◎</span> A little intention goes a long way.</span><span>Made for your curious mind <span class="footer-star">✧</span></span></footer></main></div>`;
  document.querySelectorAll("[data-action]").forEach(bindAction);
}
function periodControl() {
  return `<div class="period-control" role="group" aria-label="Date range">${[7, 30, 90, 0].map((n) => `<button data-days="${n}" class="${state.days === n ? "selected" : ""}" aria-pressed="${state.days === n}">${n ? n + " days" : "All time"}</button>`).join("")}</div>`;
}
function statsHTML(items) {
  const s = summarize(items);
  return `<div class="stats-grid">${[
    [
      "Time with AI",
      duration(s.totalMinutes),
      "clock",
      "blue",
      "Active time recorded + any manual logs",
    ],
    [
      "Observed sends",
      s.observedRecords ? compact(s.totalMessages) : "—",
      "chat",
      "violet",
      s.observedRecords
        ? "Send actions observed, not provider billing"
        : "Import from the updated extension",
    ],
    [
      "Activity records",
      compact(s.sessions),
      "history",
      "peach",
      "Manual sessions + daily browser totals",
    ],
    [
      "Active days",
      compact(s.activeDays),
      "sun",
      "green",
      "Days with recorded activity in this period",
    ],
  ]
    .map(
      ([label, value, ico, color, note]) =>
        `<article class="stat-card"><div class="stat-label">${label}<span class="stat-icon ${color}">${icon(ico)}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`,
    )
    .join("")}</div>`;
}
// ---- Usage chart --------------------------------------------------------
// Drawn at the panel's real pixel width (1 SVG unit = 1 CSS px), so text never
// shrinks and the plot never letterboxes; refits when the panel resizes.
const CHART_METRICS = {
  minutes: { option: "Time", legend: "Time with AI", axis: "minutes" },
  messages: {
    option: "Observed sends",
    legend: "Observed send actions",
    axis: "count",
  },
  tokens: {
    option: "Logged tokens",
    legend: "Manually logged tokens",
    axis: "count",
  },
  sessions: { option: "Entries", legend: "Entries per day", axis: "count" },
  cost: {
    option: "Logged / estimated cost",
    legend: "Estimated cost",
    axis: "cost",
  },
};
const chartValue = (metric, value) =>
  value == null
    ? "Not observed"
    : metric === "minutes"
      ? duration(value)
      : metric === "messages"
        ? plural(value, "send")
        : metric === "tokens"
          ? `${compact(value)} tokens`
          : metric === "cost"
            ? money(value)
            : plural(value, "entry", "entries");
const axisLabel = (metric, value) =>
  metric === "minutes"
    ? shortDuration(value)
    : metric === "cost"
      ? value === 0
        ? "$0"
        : money(value)
      : compact(value);
let chart = null; // { rows, metric, view, layout } for the chart on screen
let chartObserver = null;
function chartSummary() {
  const { rows, metric } = chart;
  const known = rows.filter((row) => row[metric] != null);
  const name = CHART_METRICS[metric].legend;
  if (!known.length) return `${name}: nothing recorded in this period.`;
  const total = known.reduce((sum, row) => sum + row[metric], 0);
  const peak = known.reduce((a, b) => (b[metric] > a[metric] ? b : a));
  return `${name} per day over ${plural(rows.length, "day")}. Total ${chartValue(metric, total)}. Busiest: ${peak.label}, ${chartValue(metric, peak[metric])}. Use the arrow keys to read each day.`;
}
function chartSVG(width) {
  const { rows, metric } = chart;
  const W = Math.max(280, Math.round(width));
  const H = W < 520 ? 196 : 216;
  const [left, right, top, bottom] = [46, 16, 14, 30];
  const values = rows.map((row) => row[metric]);
  const known = values.filter((value) => value != null);
  const scale = niceScale(Math.max(0, ...known), {
    metric: CHART_METRICS[metric].axis,
  });
  const xs = rows.map(
    (_, i) => left + (i * (W - left - right)) / Math.max(rows.length - 1, 1),
  );
  const y = (value) => H - bottom - (value / scale.max) * (H - top - bottom);
  const points = values.map((value, i) => (value == null ? null : [xs[i], y(value)]));
  const segments = monotoneSegments(points);
  const last = rows.length - 1;
  // Today is still in progress, so its segment is dashed rather than solid.
  const solid = segmentsPath(segments.slice(0, -1));
  const partial = segments.at(-1) ? segmentsPath([segments.at(-1)]) : "";
  const area =
    metric !== "messages" && known.length === rows.length
      ? `${segmentsPath(segments)}L${xs[last].toFixed(1)},${H - bottom}L${xs[0].toFixed(1)},${H - bottom}Z`
      : "";
  const every = Math.max(1, Math.ceil(rows.length / (W < 520 ? 4 : 7)));
  chart.layout = { xs, ys: points.map((point) => point?.[1] ?? null), top };
  const grid = scale.ticks
    .map(
      (tick) =>
        `<line class="chart-grid" x1="${left}" x2="${W - right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}"/><text x="${left - 10}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end">${esc(axisLabel(metric, tick))}</text>`,
    )
    .join("");
  const labels = rows
    .map((row, i) =>
      (last - i) % every === 0
        ? `<text x="${xs[i].toFixed(1)}" y="${H - 8}" text-anchor="${i === last ? "end" : i === 0 ? "start" : "middle"}">${esc(row.label)}</text>`
        : "",
    )
    .join("");
  const dots =
    metric === "messages"
      ? points
          .map((point) =>
            point
              ? `<circle class="chart-dot" cx="${point[0].toFixed(1)}" cy="${point[1].toFixed(1)}" r="3"/>`
              : "",
          )
          .join("")
      : "";
  const today = points[last]
    ? `<circle class="chart-today" cx="${points[last][0].toFixed(1)}" cy="${points[last][1].toFixed(1)}" r="4"/>`
    : "";
  const empty = known.length
    ? ""
    : `<text class="chart-empty" x="${W / 2}" y="${((H - bottom + top) / 2).toFixed(1)}" text-anchor="middle">${metric === "messages" ? "No observed sends in this period" : "Nothing recorded in this period"}</text>`;
  return `<svg class="usage-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0" aria-label="${esc(chartSummary())}"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8062d2" stop-opacity=".2"/><stop offset="100%" stop-color="#8062d2" stop-opacity="0"/></linearGradient></defs>${grid}${empty}${area ? `<path class="chart-area" d="${area}"/>` : ""}<path class="chart-line" d="${solid}"/>${partial ? `<path class="chart-line chart-partial" d="${partial}"/>` : ""}${dots}${today}<line class="chart-guide" x1="0" x2="0" y1="${top}" y2="${H - bottom}" visibility="hidden"/><circle class="chart-marker" r="5" visibility="hidden"/>${labels}</svg>`;
}
function chartHTML(items) {
  const dayCount =
    state.days ||
    Math.min(
      90,
      Math.max(
        7,
        Math.ceil(
          (Date.now() -
            Math.min(
              ...items.map((s) => new Date(s.date).getTime()),
              Date.now(),
            )) /
            86400000,
        ) + 1,
      ),
    );
  chart = {
    rows: dailyUsage(items, dayCount),
    metric: state.chart,
    view: state.view,
  };
  const meta = CHART_METRICS[state.chart];
  return `<article class="panel usage-panel"><div class="panel-heading"><div><h2>Usage over time</h2><p>A rhythm of curiosity and creation</p></div><select class="small-select" id="chart-metric" aria-label="Chart metric">${Object.entries(
    CHART_METRICS,
  )
    .map(
      ([value, metric]) =>
        `<option value="${value}" ${state.chart === value ? "selected" : ""}>${metric.option}</option>`,
    )
    .join(
      "",
    )}</select></div><div class="chart-legend"><i></i>${meta.legend}<em class="chart-key">today so far</em><span>${state.days ? "Last " + state.days + " days" : "Up to the last 90 days"}</span></div>
 <div class="chart-wrap">${chartSVG(state.chartWidth[state.view] ?? 760)}<div class="chart-tip" aria-hidden="true" hidden></div><p class="sr-only chart-live" aria-live="polite"></p></div><div class="chart-caption">${icon("spark")} ${state.chart === "messages" ? "Only observed dates are plotted; gaps are unavailable. Counts aren’t confirmed responses or remaining limits." : "Time is recorded from active tabs. Tokens and costs are only available when manually logged."}</div></article>`;
}
/** Fit the chart to its panel before first paint, follow resizes, and wire
 * the hover / touch / keyboard read-out. */
function mountChart() {
  chartObserver?.disconnect();
  const wrap = document.querySelector(".chart-wrap");
  if (!wrap || !chart) return;
  const tip = wrap.querySelector(".chart-tip");
  const live = wrap.querySelector(".chart-live");
  let index = null;
  const hide = () => {
    index = null;
    tip.hidden = true;
    const svg = wrap.querySelector("svg");
    svg.querySelector(".chart-guide").setAttribute("visibility", "hidden");
    svg.querySelector(".chart-marker").setAttribute("visibility", "hidden");
  };
  const fit = (width) => {
    const w = Math.round(width);
    if (Math.abs(w - (state.chartWidth[chart.view] ?? 0)) < 2) return;
    state.chartWidth[chart.view] = w;
    const focused = document.activeElement?.matches(".usage-chart");
    wrap.querySelector("svg").outerHTML = chartSVG(w);
    if (focused) wrap.querySelector("svg").focus();
    hide();
  };
  const style = getComputedStyle(wrap);
  fit(
    wrap.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight),
  );
  chartObserver = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
  chartObserver.observe(wrap);
  const show = (i, announce = false) => {
    const { xs, ys, top } = chart.layout;
    index = Math.max(0, Math.min(xs.length - 1, i));
    const row = chart.rows[index];
    const value = row[chart.metric];
    const svg = wrap.querySelector("svg");
    const guide = svg.querySelector(".chart-guide");
    guide.setAttribute("x1", xs[index]);
    guide.setAttribute("x2", xs[index]);
    guide.setAttribute("visibility", "visible");
    const marker = svg.querySelector(".chart-marker");
    if (ys[index] == null) marker.setAttribute("visibility", "hidden");
    else {
      marker.setAttribute("cx", xs[index]);
      marker.setAttribute("cy", ys[index]);
      marker.setAttribute("visibility", "visible");
    }
    const day = new Date(`${row.date}T00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const soFar = index === chart.rows.length - 1 ? " · so far" : "";
    tip.innerHTML = `<strong>${esc(chartValue(chart.metric, value))}</strong><span>${esc(day + soFar)}</span>`;
    tip.hidden = false;
    const x = parseFloat(getComputedStyle(wrap).paddingLeft) + xs[index];
    const edge = Math.min(80, wrap.clientWidth / 2);
    tip.style.left = `${Math.min(Math.max(x, edge), wrap.clientWidth - edge)}px`;
    tip.style.top = `${ys[index] ?? top + 24}px`;
    if (announce) live.textContent = `${day}${soFar}: ${chartValue(chart.metric, value)}`;
  };
  const nearest = (event) => {
    const { xs } = chart.layout;
    const x = event.clientX - wrap.querySelector("svg").getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < xs.length; i += 1)
      if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    return best;
  };
  wrap.addEventListener("pointermove", (event) => show(nearest(event)));
  wrap.addEventListener("pointerdown", (event) => show(nearest(event)));
  wrap.addEventListener("pointerleave", hide);
  wrap.addEventListener("focusin", (event) => {
    if (event.target.matches(".usage-chart"))
      show(index ?? chart.rows.length - 1, true);
  });
  wrap.addEventListener("focusout", hide);
  wrap.addEventListener("keydown", (event) => {
    if (!event.target.matches(".usage-chart")) return;
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key in moves) {
      event.preventDefault();
      show((index ?? chart.rows.length - 1) + moves[event.key], true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      show(event.key === "Home" ? 0 : chart.rows.length - 1, true);
    } else if (event.key === "Escape") hide();
  });
}
// Tools beyond the four providers keep their own colours in the mix.
const TOOL_COLORS = { Perplexity: "#5fa8b0", Copilot: "#7b9fd6" };
const toolColor = (tool) =>
  TOOL_COLORS[tool.name] ?? provider(tool.provider).color;
function breakdownHTML(items) {
  const tools = timeByTool(items);
  const totalMinutes = tools.reduce((sum, tool) => sum + tool.minutes, 0);
  // Share of time when time is known (N4), otherwise share of entries.
  const weight = (tool) =>
    totalMinutes
      ? tool.minutes
      : items.filter((s) => toolName(s) === tool.name).length;
  const total = tools.reduce((sum, tool) => sum + weight(tool), 0);
  const shares = tools.map((tool) => ({
    ...tool,
    share: total ? (100 * weight(tool)) / total : 0,
  }));
  let sum = 0;
  const gradient = shares
    .map((tool) => {
      const start = sum;
      sum += tool.share;
      return `${toolColor(tool)} ${start.toFixed(2)}% ${sum.toFixed(2)}%`;
    })
    .join(",");
  const legend = shares.length
    ? shares.slice(0, 5)
    : PROVIDERS.slice(0, 3).map((p) => ({
        name: p.name,
        provider: p.id,
        minutes: 0,
        share: 0,
      }));
  const summary = shares
    .map((tool) => `${tool.name} ${Math.round(tool.share)}%`)
    .join(", ");
  return `<article class="panel breakdown-panel"><div class="panel-heading"><div><h2>Your AI mix</h2><p>${totalMinutes ? "Share of your time, by tool" : "A tool for every kind of thought"}</p></div>${icon("spark", "muted")}</div><div class="donut" style="--donut:${gradient ? `conic-gradient(${gradient})` : "#eeeaf6"}" role="img" aria-label="${esc(summary ? `AI mix by time: ${summary}` : "No activity in this period")}"><div><span>${shares.length}</span><small>${shares.length === 1 ? "AI tool used" : "AI tools used"}</small></div></div><div class="provider-legend">${legend
    .map(
      (tool) =>
        `<div><span><i style="background:${toolColor(tool)}"></i>${esc(tool.name)}</span><strong>${Math.round(tool.share)}%<small>${duration(tool.minutes)}</small></strong></div>`,
    )
    .join("")}</div></article>`;
}
// Unavailable values are a quiet dash, explained once under the table (N2).
const NOT_MEASURED = '<span class="na-mark" title="Not measured for this entry">—</span>';
function rowHTML(s) {
  const tracked = s.source === "extension";
  const glyph = tracked
    ? "clock"
    : s.category === "Coding"
      ? "bolt"
      : s.category === "Research"
        ? "search"
        : "chat";
  return `<tr${tracked ? ' class="is-tracked"' : ""}><td class="col-title"><div class="session-title">${icon(glyph)}<div><strong>${esc(s.title)}</strong><small>${tracked ? "Tracked daily total" : esc(s.category)}</small></div></div></td><td class="col-tool"><span class="provider-pill">${mark(s.provider)}${esc(toolName(s))}</span></td><td class="col-date">${prettyDate(s.date)}${new Date(s.date) > Date.now() ? ' <small class="future-badge" title="Dated in the future: not counted in totals">Future</small>' : ""}</td><td class="numeric col-sends${s.messageCount == null ? " na" : ""}" data-unit="${s.messageCount === 1 ? "send" : "sends"}">${s.messageCount == null ? NOT_MEASURED : compact(s.messageCount)}</td><td class="numeric col-tokens${tracked ? " na" : ""}" data-unit="tokens">${tracked ? NOT_MEASURED : compact(s.inputTokens + s.outputTokens)}</td><td class="numeric col-cost${s.cost == null ? " na" : ""}">${s.cost == null ? NOT_MEASURED : cellMoney(s.cost)}</td><td class="col-time">${duration(s.duration)}</td><td class="col-actions"><div class="row-actions"><button class="icon-btn" data-edit="${esc(s.id)}" aria-label="Edit ${esc(s.title)}">${icon("edit")}</button><button class="icon-btn delete-btn" data-delete="${esc(s.id)}" aria-label="Delete ${esc(s.title)}">${icon("trash")}</button></div></td></tr>`;
}
const PAGE_SIZE = 50;
/** The part of the activity table that changes while filtering (B1). */
function rowsRegionHTML(items, full) {
  // filterSessions already returns newest first.
  const shown = full ? items.slice(0, state.limit) : items.slice(0, 5);
  const filtering = state.query || state.provider !== "all";
  const unmeasured = shown.some(
    (s) => s.source === "extension" || s.messageCount == null,
  );
  const more = full ? items.length - shown.length : 0;
  return `${shown.length ? `<div class="table-scroll"><table><thead><tr><th scope="col">Activity</th><th scope="col">AI tool</th><th scope="col">Date</th><th scope="col" title="Send actions observed by the browser extension">Sends</th><th scope="col" title="Tokens you logged by hand">Tokens</th><th scope="col" title="Logged or estimated cost of a logged session">Cost</th><th scope="col">Time</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${shown.map(rowHTML).join("")}</tbody></table></div>` : `<div class="empty-state"><span>${icon("chat")}</span><h3>${filtering ? "Nothing matches just yet." : "Your next idea starts here."}</h3><p>${filtering ? "Try another search or provider." : "Log your first AI session and watch your orbit take shape."}</p><button class="button primary" data-action="add">${icon("plus")} Log a session</button></div>`}${more > 0 ? `<div class="table-more"><button class="button secondary" data-more>Show ${Math.min(PAGE_SIZE, more).toLocaleString("en-US")} more</button></div>` : ""}
 <div class="table-bottom"><span>${shown.length.toLocaleString("en-US")} of ${plural(items.length, "entry", "entries")}${unmeasured ? ' · <span class="na-mark">—</span> not measured' : ""}</span><span>${icon("lock")} Only you can see your data</span></div>`;
}
function tableHTML(items, full = false) {
  return `<article class="panel sessions-panel"><div class="panel-heading"><div><h2>${full ? "All activity" : "Recent activity"} <span class="count-tag" data-region="count">${items.length.toLocaleString("en-US")}</span></h2><p>${full ? "Logged sessions and tracked daily totals, newest first." : "A few moments from your AI journey"}</p></div>${!full ? `<a class="text-link" href="#sessions">View all activity ${icon("arrow")}</a>` : ""}</div>
 <div class="table-toolbar"><label class="search-field">${icon("search")}<input id="search" type="search" placeholder="Search activity…" aria-label="Search activity" value="${esc(state.query)}" /></label><select id="provider-filter" aria-label="Filter by AI provider"><option value="all">All providers</option>${PROVIDERS.map((p) => `<option value="${p.id}" ${state.provider === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
 <div data-region="rows">${rowsRegionHTML(items, full)}</div></article>`;
}
// Colour follows the category, not its rank, so it means the same in every range.
const CATEGORY_COLORS = {
  Coding: "#9b83e9",
  Writing: "#dfa085",
  Research: "#8db8a7",
  Learning: "#8fa9d3",
  Other: "#c7c6d0",
};
function insightsHTML(items) {
  const s = summarize(items);
  const tools = timeByTool(items);
  const tracked = items.some((x) => x.source === "extension");
  const logged = items.filter((x) => x.source !== "extension");
  const cats = Object.keys(CATEGORY_COLORS)
    .map((name) => ({
      name,
      minutes: logged
        .filter((x) => x.category === name)
        .reduce((a, x) => a + x.duration, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);
  // Tracked records have no activity category, so with tracked data the
  // breakdown is by tool (N3); categories describe logged sessions.
  const bars = tracked
    ? tools.slice(0, 6).map((tool) => ({ ...tool, color: toolColor(tool) }))
    : cats.map((c) => ({ ...c, color: CATEGORY_COLORS[c.name] }));
  const max = Math.max(...bars.map((x) => x.minutes), 1);
  const totalMinutes = tools.reduce((sum, tool) => sum + tool.minutes, 0);
  const top = tools[0];
  const share = top && totalMinutes ? Math.round((100 * top.minutes) / totalMinutes) : 0;
  const watchedDays = new Set(
    items
      .filter((x) => x.messageCount != null)
      .map((x) => new Date(x.date).toDateString()),
  ).size;
  const story = !items.length
    ? "Start logging sessions to discover the tools and activities that shape your days."
    : [
        totalMinutes
          ? `${esc(top.name)} held ${share}% of your AI time.`
          : `You turned to ${esc(top.name)} most often.`,
        watchedDays
          ? `You sent about ${plural(Math.round(s.totalMessages / watchedDays), "message")} a day while the extension was watching.`
          : "",
        cats[0].minutes ? `${esc(cats[0].name)} leads your logged sessions.` : "",
      ]
        .filter(Boolean)
        .join(" ");
  return `${statsHTML(items)}<div class="insights-grid"><article class="panel"><div class="panel-heading"><div><h2>Where your attention goes</h2><p>${tracked ? "Time by tool" : "Minutes logged by activity"}</p></div>${icon("clock")}</div><div class="category-bars">${bars.map((bar) => `<div><div><span>${esc(bar.name)}</span><strong>${duration(bar.minutes)}</strong></div><div class="bar-track"><i style="width:${(bar.minutes / max) * 100}%;background:${bar.color}"></i></div></div>`).join("")}</div></article><article class="insight-card"><span class="insight-spark">✧</span><div class="eyebrow">YOUR CREATIVE COMPANION</div><h2>${items.length ? esc(top.name) : "Room to explore."}</h2><p>${story}</p><div class="insight-foot">${icon("spark")} Insights grow with your curiosity.</div></article></div>${chartHTML(items)}`;
}
function settingsHTML() {
  return `<div class="settings-grid">${storageError ? `<section class="panel settings-card wide"><div><h2>Recover your stored data</h2><p>Saving is paused because your stored file could not be read. Download it before clearing this site’s storage in your browser settings, then reload and import a repaired backup.</p><button class="button secondary" data-action="recover">${icon("download")} Download stored file</button></div></section>` : ""}<section class="panel settings-card"><span class="settings-icon violet">${icon("lock")}</span><h2>Your data stays with you.</h2><p>Orbit saves sessions in this browser. No account, no server, and no API keys needed. Data doesn’t automatically sync between devices.</p><div class="setting-row"><div><strong>Current workspace</strong><small>${state.mode === "demo" ? "Sample sessions · explore freely" : `${plural(state.personal.length, "personal session")} saved`}</small></div><span class="badge">${state.mode === "demo" ? "Demo" : "Personal"}</span></div><div class="setting-row"><div><strong>${state.mode === "demo" ? "Start your own orbit" : "Explore the demo"}</strong><small>${state.mode === "demo" ? "A fresh space for your real sessions" : "Your personal sessions will stay saved"}</small></div><button class="button secondary" data-action="${state.mode === "demo" ? "personal" : "demo"}">Switch ${icon("arrow")}</button></div></section>
 <section class="panel settings-card"><span class="settings-icon peach">${icon("download")}</span><h2>A backup for your peace of mind.</h2><p>Clearing browser data removes saved sessions. Export a JSON backup regularly, then import it on another browser or device.</p><div class="settings-buttons"><button class="button secondary" data-action="export">${icon("download")} Export JSON</button><button class="button secondary" data-action="csv">${icon("download")} Export CSV</button><button class="button secondary" data-action="import">${icon("upload")} Import JSON</button></div><p class="fine-print">Imports merge into your personal workspace. Matching session IDs are replaced after confirmation.</p></section>
 <section class="panel settings-card wide"><div class="settings-icon green">${icon("globe")}</div><div><h2>Honest numbers. Useful perspective.</h2><p>The dashboard prioritizes recorded time and observed send actions. Token counts and costs are optional manual entries. Cost estimates use illustrative provider rates, not your subscription bill. Enter an actual cost when you know it. A subscription chat can have a $0 incremental cost.</p><p>A website can’t read other tabs or your AI accounts. Manual session logs are entered by you. The browser extension adds active time and observed send-action counts. It does not access official token usage, invoices, or remaining message limits.</p><a class="text-link" href="https://github.com/MAHANTHADEEKSHA-SB/web..." target="_blank" rel="noreferrer">Setup & free hosting guide ${icon("arrow")}</a></div></section>
 <section class="panel settings-card wide extension-setup"><span class="settings-icon violet">${icon("clock")}</span><div><span class="eyebrow">LESS LOGGING. MORE CREATING.</span><h2>Let Orbit keep time.</h2><p>The optional Chrome / Edge extension records active time and observed message-send actions on ChatGPT, Claude, Gemini, Perplexity, and Copilot. It starts paused and keeps only daily totals on your device. It watches send controls without reading or storing prompts or replies.</p><ol class="setup-steps"><li>Download and unzip the extension below.</li><li>Open your browser’s Extensions page, enable Developer mode, choose <strong>Load unpacked</strong>, and select the unzipped folder.</li><li>If updating, replace the extension’s files and click Reload on the Extensions page. Refresh your AI tabs. Pin Orbit, open it, and enable tracking. Updating from a version before 1.1 pauses tracking once.</li><li>Choose <strong>Export for Orbit</strong> in the extension, then import that JSON file here. Repeated imports update the same daily totals.</li></ol><div class="settings-buttons"><a class="button primary" href="./orbit-extension.zip" download>${icon("download")} Download extension</a><button class="button secondary" data-action="import">${icon("upload")} Import tracked time</button></div><p class="fine-print">You grant access to the listed AI sites during installation. You can pause tracking or remove the extension at any time. Daily activity becomes one record per tool per day, not a count of conversations. Send controls vary between sites and languages, so counts may be missed. Observed sends are not confirmed successful replies or official usage quotas. Tokens, billing, and remaining limits aren’t measured.</p></div></section>
 <section class="panel settings-card wide danger-zone"><div><h2>Clear personal sessions</h2><p>Permanently remove the personal sessions saved in this browser. Export a backup first.</p></div><button class="button danger" data-action="clear">${icon("trash")} Clear data</button></section></div>`;
}
// B15: an empty personal workspace gets a welcome instead of a wall of zeros.
function onboardingHTML() {
  return `<section class="onboarding" data-onboarding aria-labelledby="onboarding-title"><div class="onboarding-intro"><span class="eyebrow">WELCOME TO YOUR ORBIT</span><h2 id="onboarding-title">Let’s start your orbit.</h2><p>Everything you add stays in this browser. Pick whichever start suits you; the others are always one click away.</p></div><div class="onboarding-grid"><button class="onboarding-card" data-action="add"><span class="settings-icon violet">${icon("plus")}</span><strong>Log your first session</strong><small>About 20 seconds. Tokens and cost are optional.</small><span class="onboarding-go">Log a session ${icon("arrow")}</span></button><a class="onboarding-card" href="#settings"><span class="settings-icon green">${icon("clock")}</span><strong>Track time automatically</strong><small>The private browser extension records active time and observed sends. It starts paused.</small><span class="onboarding-go">Set up tracking ${icon("arrow")}</span></a><button class="onboarding-card" data-action="import"><span class="settings-icon peach">${icon("upload")}</span><strong>Restore a backup</strong><small>Import an Orbit backup or an extension export.</small><span class="onboarding-go">Import a file ${icon("arrow")}</span></button></div><button class="text-link onboarding-demo" data-action="demo">Peek at the demo first ${icon("arrow")}</button></section>`;
}
function renderContent() {
  const items = filtered();
  const firstRun =
    state.mode === "personal" &&
    !state.personal.length &&
    state.view === "overview";
  const content = document.querySelector("#content");
  content.innerHTML =
    state.view === "settings"
      ? settingsHTML()
      : firstRun
        ? onboardingHTML()
        : `
 <div class="section-toolbar"><div class="section-label">${icon(state.view === "insights" ? "spark" : "grid")} ${state.view === "overview" ? "Your overview" : state.view === "insights" ? "The bigger picture" : "Activity history"} <span class="light-dot">·</span><span class="period-label">${state.days ? "Last " + state.days + " days" : "All time"}</span></div>${periodControl()}</div>
 ${state.view === "overview" ? `<div data-region="stats">${statsHTML(items)}</div><div class="charts-grid" data-region="charts">${chartHTML(items)}${breakdownHTML(items)}</div>${tableHTML(items)}` : state.view === "sessions" ? tableHTML(items, true) : insightsHTML(items)}`;
  bindContent(content);
  mountChart();
  document.querySelectorAll("[data-days]").forEach(
    (b) =>
      (b.onclick = () => {
        state.days = Number(b.dataset.days);
        state.limit = PAGE_SIZE;
        renderContent();
      }),
  );
  document
    .querySelector("#provider-filter")
    ?.addEventListener("change", (e) => {
      state.provider = e.target.value;
      state.limit = PAGE_SIZE;
      updateResults();
    });
  // B1: search never rebuilds its own <input> (that broke IME composition
  // and focus), waits for composition to finish, and is debounced.
  const search = document.querySelector("#search");
  if (search) {
    let timer;
    const apply = () => {
      clearTimeout(timer);
      if (state.query === search.value) return;
      state.query = search.value;
      state.limit = PAGE_SIZE;
      updateResults();
    };
    search.addEventListener("input", (e) => {
      if (e.isComposing) return;
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });
    search.addEventListener("compositionend", apply);
  }
}
/** Wire the controls inside a freshly rendered region. */
function bindContent(root) {
  root.querySelectorAll("[data-action]").forEach(bindAction);
  root.querySelector("#chart-metric")?.addEventListener("change", (e) => {
    state.chart = e.target.value;
    renderContent();
  });
  root
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openSession(all().find((s) => s.id === b.dataset.edit))),
    );
  root
    .querySelectorAll("[data-delete]")
    .forEach((b) => (b.onclick = () => deleteSession(b.dataset.delete)));
  root.querySelector("[data-more]")?.addEventListener("click", () => {
    state.limit += PAGE_SIZE;
    updateResults();
  });
}
/** Re-render only what filtering changes, leaving the filter controls alone. */
function updateResults() {
  const items = filtered();
  const region = (name) => document.querySelector(`[data-region="${name}"]`);
  if (region("stats")) region("stats").innerHTML = statsHTML(items);
  if (region("charts")) {
    region("charts").innerHTML = chartHTML(items) + breakdownHTML(items);
    bindContent(region("charts"));
    mountChart();
  }
  if (region("rows")) {
    region("rows").innerHTML = rowsRegionHTML(items, state.view === "sessions");
    bindContent(region("rows"));
  }
  if (region("count"))
    region("count").textContent = items.length.toLocaleString("en-US");
}
function render() {
  shell();
  renderContent();
}
let firstRoute = true;
function navigate() {
  const view = location.hash.slice(1);
  state.view = ["overview", "sessions", "insights", "settings"].includes(view)
    ? view
    : "overview";
  state.query = "";
  state.provider = "all";
  state.limit = PAGE_SIZE;
  render();
  document.title =
    state.view === "overview"
      ? "Orbit — Your AI, in perspective"
      : `${VIEW_TITLES[state.view]} · Orbit`;
  if (!firstRoute) {
    // Announce the new view to screen readers and start it at the top.
    window.scrollTo(0, 0);
    document.querySelector("#main h1")?.focus({ preventScroll: true });
  }
  firstRoute = false;
}
window.addEventListener("hashchange", navigate);
function bindAction(button) {
  button.onclick = () => {
    const actions = {
      add: () => openSession(),
      export: () => download(exportData(all()), "json"),
      csv: exportCSV,
      import: importFile,
      recover: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw !== null) download(raw, "json");
          else toast("No stored file is available.");
        } catch {
          toast("Browser storage is unavailable.");
        }
      },
      personal: () => {
        setMode("personal");
        toast("Welcome to your own orbit. Let’s log your first session.");
      },
      demo: () => setMode("demo"),
      settings: () => {
        location.hash = "settings";
      },
      menu: () =>
        setDrawer(!document.querySelector("#sidebar").classList.contains("is-open")),
      skip: () => document.querySelector("#main h1")?.focus(),
      clear: clearPersonal,
    };
    actions[button.dataset.action]?.();
  };
}
function setDrawer(open) {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("is-open", open);
  document
    .querySelector(".mobile-menu")
    ?.setAttribute("aria-expanded", String(open));
  if (open) sidebar.querySelector(".nav-item.active")?.focus();
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !document.querySelector("#sidebar.is-open")) return;
  setDrawer(false);
  document.querySelector(".mobile-menu")?.focus();
});
document.addEventListener("click", (e) => {
  const sidebar = document.querySelector("#sidebar");
  if (
    sidebar?.classList.contains("is-open") &&
    !sidebar.contains(e.target) &&
    !e.target.closest(".mobile-menu")
  )
    setDrawer(false);
});
function dateValue(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function openSession(session) {
  const dialog = document.querySelector("#session-dialog");
  const p = session?.provider || "claude";
  dialog.innerHTML = `<form id="session-form"><div class="modal-header"><span class="settings-icon violet">${icon("spark")}</span><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div><h2 id="session-dialog-title">${session ? "A little fine-tuning." : "What did you create today?"}</h2><p class="modal-subtitle">${state.mode === "demo" ? (session ? "You’re editing sample data. Changes disappear when you reload." : "Saving this starts your own private orbit. The sample data stays untouched.") : "Every session is a small step toward something."}</p><label>Session title<input name="title" required maxlength="120" placeholder="e.g. Brainstorming my next big idea" value="${esc(session?.title || "")}" autofocus /></label><div class="form-grid"><label>AI tool<select name="provider">${PROVIDERS.map((x) => `<option value="${x.id}" ${p === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Activity<select name="category">${["Writing", "Coding", "Research", "Learning", "Other"].map((c) => `<option ${session?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Date & time<input name="date" type="datetime-local" required max="${dateValue()}" value="${dateValue(session?.date)}" /></label><label>Duration (minutes)<span class="unit-input"><input name="duration" aria-label="Duration (minutes)" type="number" min="0" max="1440" step="any" value="${session?.duration ?? ""}" placeholder="e.g. 20" /><span aria-hidden="true">min</span></span></label></div><details ${session && (session.inputTokens || session.outputTokens || session.cost) ? "open" : ""}><summary>Tokens, model & cost <span>Optional</span></summary><label>Model<input name="model" maxlength="80" placeholder="e.g. Claude Sonnet" value="${esc(session?.model || "")}" /></label><div class="form-grid"><label>Input tokens<span class="unit-input"><input name="inputTokens" aria-label="Input tokens" type="number" min="0" step="1" value="${session?.inputTokens ?? ""}" placeholder="e.g. 1500" aria-describedby="token-help input-token-help" /><span aria-hidden="true">tokens</span></span><small class="field-help" id="input-token-help">Text sent to the AI, including context.</small></label><label>Output tokens<span class="unit-input"><input name="outputTokens" aria-label="Output tokens" type="number" min="0" step="1" value="${session?.outputTokens ?? ""}" placeholder="e.g. 500" aria-describedby="token-help output-token-help" /><span aria-hidden="true">tokens</span></span><small class="field-help" id="output-token-help">Text generated in the AI’s reply.</small></label></div><p class="fine-print" id="token-help">Enter whole token counts, not words or thousands: enter 1500 for 1.5k tokens. Use your provider’s usage report if available, or leave blank. The extension tracks time and observed send actions, not token counts.</p><label>Cost (USD)<span class="unit-input"><input name="cost" aria-label="Cost (USD)" type="number" min="0" step="any" value="${session?.cost ?? ""}" placeholder="Estimated if left blank" /><span aria-hidden="true">USD</span></span></label><p class="fine-print" id="cost-hint">Optional estimate; this isn’t your subscription bill. Leave tokens empty if you don’t know them.</p></details><p id="form-error" class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary" type="submit">${icon("check")} ${session ? "Save changes" : "Save session"}</button></div></form>`;
  dialog
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => dialog.close()));
  const form = dialog.querySelector("form");
  const tracked =
    session?.source === "extension" ||
    session?.id.startsWith("orbit-extension-");
  if (tracked) {
    for (const name of ["inputTokens", "outputTokens", "cost"])
      form.elements[name].disabled = true;
    dialog.querySelector("#cost-hint").textContent =
      "Browser records do not measure tokens, billing, or remaining limits. These fields are unavailable.";
    dialog.querySelector(".modal-subtitle").textContent =
      "A daily total from the browser extension. Importing a newer export replaces it, including edits made here.";
  }
  form.addEventListener("input", () => {
    // Unsaved edits block light dismissal (see the dialog handlers below).
    form.dataset.dirty = "true";
    if (tracked) return;
    const f = new FormData(form);
    dialog.querySelector("#cost-hint").textContent =
      `Illustrative token estimate: ${money(calculateCost(f.get("provider"), Math.min(1e12, Math.max(0, Number(f.get("inputTokens")) || 0)), Math.min(1e12, Math.max(0, Number(f.get("outputTokens")) || 0))))}. Enter 0 for subscription chats with no additional charge.`;
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      const raw = Object.fromEntries(new FormData(form));
      if (!raw.cost) raw.cost = undefined;
      const item = validateSession({
        ...session,
        ...raw,
        id: session?.id || crypto.randomUUID(),
        date: new Date(raw.date).toISOString(),
      });
      // A new entry is real data even when the demo is showing: save it to
      // the personal workspace. Edits to sample rows stay sample-only.
      const toPersonal = state.mode === "demo" && !session;
      const base = toPersonal ? state.personal : all();
      const next = session
        ? base.map((s) => (s.id === session.id ? item : s))
        : [item, ...base];
      if (state.mode === "personal" || toPersonal) {
        if (!persist(next)) return;
      } else {
        state.demo = next;
      }
      dialog.close();
      if (toPersonal) setMode("personal");
      else renderContent();
      if (session)
        document.querySelector(`[data-edit="${CSS.escape(item.id)}"]`)?.focus();
      toast(
        toPersonal
          ? "Saved to your own orbit. The sample data is untouched."
          : session
            ? "Session updated."
            : "A new moment in your orbit. Session saved.",
      );
    } catch (err) {
      dialog.querySelector("#form-error").textContent = err.message;
    }
  };
  dialog.showModal();
}
function confirmAction(title, message, label, fn, tone = "primary") {
  const d = document.querySelector("#confirm-dialog");
  d.innerHTML = `<div class="confirm-content"><h2 id="confirm-dialog-title">${esc(title)}</h2><p id="confirm-dialog-message">${esc(message)}</p><div class="modal-footer"><button class="button secondary" id="cancel-confirm">Cancel</button><button class="button ${tone}" id="accept-confirm">${esc(label)}</button></div></div>`;
  d.querySelector("#cancel-confirm").onclick = () => d.close();
  d.querySelector("#accept-confirm").onclick = () => {
    d.close();
    fn();
  };
  d.showModal();
}
function deleteSession(id) {
  const index = [...document.querySelectorAll("[data-delete]")].findIndex(
    (b) => b.dataset.delete === id,
  );
  confirmAction(
    "Remove this session?",
    "This will remove the session from this workspace.",
    "Remove session",
    () => {
      const next = all().filter((s) => s.id !== id);
      if (state.mode === "personal" && !persist(next)) return;
      if (state.mode === "demo") state.demo = next;
      renderContent();
      // The deleted row's button is gone; move focus to its neighbour.
      const rows = [...document.querySelectorAll("[data-delete]")];
      (rows[Math.min(index, rows.length - 1)] ?? document.querySelector("#main h1"))?.focus();
      toast("Session removed.");
    },
    "danger-solid",
  );
}
function clearPersonal() {
  confirmAction(
    "Clear your personal sessions?",
    "This cannot be undone. Make sure you have exported a backup first.",
    "Clear personal data",
    () => {
      if (persist([])) {
        renderContent();
        toast("Personal sessions cleared.");
      }
    },
    "danger-solid",
  );
}
function download(content, ext) {
  const blob = new Blob([content], {
    type: ext === "json" ? "application/json" : "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orbit-${state.mode}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your export is ready.");
}
function exportCSV() {
  const keys = [
    "title",
    "source",
    "messageCount",
    "provider",
    "model",
    "category",
    "date",
    "duration",
    "inputTokens",
    "outputTokens",
    "cost",
  ];
  const cell = (x) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  download(
    [
      keys.join(","),
      ...all().map((s) => keys.map((k) => cell(s[k])).join(",")),
    ].join("\r\n"),
    "csv",
  );
}
function importFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10_000_000) {
      toast("Choose a JSON backup smaller than 10 MB.");
      return;
    }
    try {
      const incoming = parseImport(await file.text());
      confirmAction(
        "Import your sessions?",
        `${plural(incoming.length, "session")} will be merged into your personal workspace. Matching IDs will be replaced.`,
        "Import sessions",
        () => {
          const merged = new Map(state.personal.map((s) => [s.id, s]));
          incoming.forEach((s) => merged.set(s.id, s));
          if (persist([...merged.values()])) {
            setMode("personal");
            toast(`${plural(incoming.length, "session")} imported.`);
          }
        },
      );
    } catch (err) {
      toast(err.message);
    }
  };
  input.click();
}
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    try {
      state.personal = loadSessions();
      renderContent();
    } catch (err) {
      storageError = err.message;
      render();
      toast(err.message);
    }
  }
});
// Light dismissal: close only when the press *started* on the backdrop (a
// drag-select that ends outside must not close), and never discard edits.
const outsideDialog = (d, e) => {
  const r = d.getBoundingClientRect();
  return (
    e.clientX < r.left ||
    e.clientX > r.right ||
    e.clientY < r.top ||
    e.clientY > r.bottom
  );
};
document.querySelectorAll("dialog").forEach((d) => {
  let pressedOutside = false;
  d.addEventListener("pointerdown", (e) => {
    pressedOutside = e.target === d && outsideDialog(d, e);
  });
  d.addEventListener("click", (e) => {
    const dirty = d.querySelector("form")?.dataset.dirty === "true";
    if (pressedOutside && e.target === d && outsideDialog(d, e) && !dirty)
      d.close();
    pressedOutside = false;
  });
});
navigate();
