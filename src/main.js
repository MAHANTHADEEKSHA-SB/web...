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
} from "./data.js";
import { cellMoney, compact, duration, money, plural } from "./format.js";

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
  showAll: false,
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
function shell() {
  const titles = {
    overview: "Overview",
    sessions: "Sessions",
    insights: "Insights",
    settings: "Settings",
  };
  document.querySelector("#app").innerHTML = `
 <aside class="sidebar" id="sidebar"><a class="brand" href="#overview" aria-label="Orbit overview"><span class="orbit-symbol"><i></i></span>orbit<span class="brand-dot">.</span></a>
 <div class="workspace"><span class="workspace-icon">${icon("spark")}</span><div>Personal workspace<small>Make space for your ideas</small></div><span class="workspace-chevron">${icon("down")}</span></div>
 <div class="nav-label">WORKSPACE</div><nav>${Object.entries(titles)
   .map(
     ([id, label], i) =>
       `<a href="#${id}" class="nav-item ${state.view === id ? "active" : ""}">${icon(["grid", "history", "chart", "settings"][i])}<span>${label}</span>${id === "overview" ? '<span class="nav-dot"></span>' : ""}</a>`,
   )
   .join("")}</nav>
 <div class="sidebar-bottom"><div class="local-card"><span class="local-icon">${icon("lock")}</span><strong>Your data. Your orbit.</strong><p>Private by design.<br>Saved only in this browser.</p><a href="#settings">Manage your data ${icon("arrow")}</a></div><div class="profile"><span class="avatar">Y</span><div>Your workspace<small>Personal · Free forever</small></div><span class="online-dot"></span></div></div></aside>
 <div class="main-shell"><header class="topbar"><div class="breadcrumb"><button class="icon-btn mobile-menu" aria-label="Toggle navigation" data-action="menu">${icon("menu")}</button><span>Workspace</span><span class="slash">/</span><strong>${titles[state.view]}</strong></div><div class="topbar-right"><span class="privacy-status"><i></i> Local & private</span><button class="top-avatar" data-action="settings" aria-label="Open settings">Y</button></div></header>
 <main id="main"><div class="page-heading"><div class="eyebrow">A LITTLE CLARITY FOR YOUR AI LIFE</div><div class="heading-row"><div><h1>${{ overview: "Your AI, in perspective.", sessions: "Every session, in one place.", insights: "Make sense of your habits.", settings: "A space that’s yours." }[state.view]}</h1><p class="subtitle">${{ overview: "A mindful look at the tools powering your everyday.", sessions: "The prompts, projects, and little breakthroughs along the way.", insights: "Discover where your time and creativity go.", settings: "Your preferences, your data, your control." }[state.view]}</p></div><div class="heading-actions"><button class="button secondary" data-action="export">${icon("download")}<span>Export</span></button><button class="button primary" data-action="add">${icon("plus")} Log session</button></div></div></div>
 ${storageError ? `<div class="error-banner" role="alert">${esc(storageError)} Export any accessible data before changing browser storage.</div>` : ""}
 ${state.mode === "demo" ? `<div class="demo-banner"><span>${icon("spark")} <strong>A little inspiration.</strong> You’re exploring sample data.</span><button data-action="personal">Start my own orbit ${icon("arrow")}</button></div>` : ""}
 ${state.mode === "personal" && state.view === "overview" ? `<div class="tracking-banner"><span>${icon("clock")} <strong>Make time for your ideas.</strong> Track active AI time and observed send actions.</span><a href="#settings">Set up tracking ${icon("arrow")}</a></div>` : ""}<div id="content"></div>
 <footer><span><span class="tiny-orbit">◎</span> A little intention goes a long way.</span><span>Made for your curious mind <span class="footer-star">✧</span></span></footer></main></div>`;
  document.querySelectorAll("[data-action]").forEach(bindAction);
}
function periodControl() {
  return `<div class="period-control" role="group" aria-label="Date range">${[7, 30, 90, 0].map((n) => `<button data-days="${n}" class="${state.days === n ? "selected" : ""}">${n ? n + " days" : "All time"}</button>`).join("")}</div>`;
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
  const rows = dailyUsage(items, dayCount);
  const values = rows.map((r) => r[state.chart]);
  const maximum = Math.max(...values, 1);
  const max =
    state.chart === "cost"
      ? Math.max(0.1, Math.ceil(maximum * 10) / 10)
      : Math.max(4, Math.ceil(maximum / 4) * 4);
  const W = window.innerWidth < 760 ? 420 : 760,
    H = 205,
    left = 48,
    right = 12,
    top = 15,
    bottom = 26;
  const points = rows.map((r, i) =>
    state.chart === "messages" && r.messages == null
      ? null
      : [
          left + (i * (W - left - right)) / Math.max(rows.length - 1, 1),
          H - bottom - (r[state.chart] / max) * (H - top - bottom),
        ],
  );
  const line = points
    .map((point, i) =>
      point
        ? `${i && points[i - 1] ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`
        : "",
    )
    .join(" ");
  const area = `${line} L${W - right},${H - bottom} L${left},${H - bottom} Z`;
  const every = Math.max(1, Math.floor(rows.length / 6));
  return `<article class="panel usage-panel"><div class="panel-heading"><div><h2>Usage over time</h2><p>A rhythm of curiosity and creation</p></div><select class="small-select" id="chart-metric" aria-label="Chart metric"><option value="minutes" ${state.chart === "minutes" ? "selected" : ""}>Time</option><option value="messages" ${state.chart === "messages" ? "selected" : ""}>Observed sends</option><option value="tokens" ${state.chart === "tokens" ? "selected" : ""}>Logged tokens</option><option value="sessions" ${state.chart === "sessions" ? "selected" : ""}>Activity records</option><option value="cost" ${state.chart === "cost" ? "selected" : ""}>Logged / estimated cost</option></select></div><div class="chart-legend"><i></i>${state.chart === "messages" ? "Observed send actions" : state.chart === "tokens" ? "Manually logged tokens" : state.chart === "cost" ? "Estimated cost" : state.chart === "minutes" ? "Time in minutes" : "Activity records"}<span>${state.days ? "Last " + state.days + " days" : "Up to the last 90 days"}</span></div>
 <div class="chart-wrap"><svg class="usage-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily ${state.chart} over ${dayCount} days"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9b83e9" stop-opacity=".28"/><stop offset="100%" stop-color="#9b83e9" stop-opacity=".02"/></linearGradient></defs>${[
   0, 1, 2, 3, 4,
 ]
   .map((i) => {
     const y = top + (i * (H - top - bottom)) / 4;
     return `<line x1="${left}" x2="${W - right}" y1="${y}" y2="${y}" stroke="#ececf1" stroke-dasharray="4 5"/><text x="${left - 12}" y="${y + 4}" text-anchor="end">${state.chart === "cost" ? money((max * (4 - i)) / 4) : compact((max * (4 - i)) / 4)}</text>`;
   })
   .join(
     "",
   )}${state.chart === "messages" && values.every((value) => value == null) ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle">No observed send data in this period</text>` : ""}<path d="${area}" fill="${state.chart === "messages" ? "none" : "url(#chart-fill)"}"/><path d="${line}" fill="none" stroke="#9476e2" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>${points.map((point, i) => (point ? `<circle class="chart-point ${state.chart === "messages" ? "observation-point" : ""}" cx="${point[0]}" cy="${point[1]}" r="5" fill="#9476e2"><title>${esc(rows[i].label)}: ${state.chart === "cost" ? money(values[i]) : values[i].toLocaleString()} ${state.chart === "cost" ? "USD" : state.chart}</title></circle>` : "")).join("")}${rows.map((r, i) => (i % every === 0 && i < rows.length - 1 ? `<text x="${left + (i * (W - left - right)) / Math.max(rows.length - 1, 1)}" y="${H - 3}" text-anchor="middle">${esc(r.label)}</text>` : "")).join("")}</svg></div><div class="chart-caption">${icon("spark")} ${state.chart === "messages" ? "Only observed dates are plotted; gaps are unavailable. Counts aren’t confirmed responses or remaining limits." : "Time is recorded from active tabs. Tokens and costs are only available when manually logged."}</div></article>`;
}
function breakdownHTML(items) {
  const count = items.length;
  let sum = 0;
  const groups = PROVIDERS.map((p) => ({
    ...p,
    count: items.filter((s) => s.provider === p.id).length,
  })).filter((p) => p.count > 0);
  const gradient = groups
    .map((p) => {
      const start = sum;
      sum += (100 * p.count) / (count || 1);
      return `${p.color} ${start}% ${sum}%`;
    })
    .join(",");
  return `<article class="panel breakdown-panel"><div class="panel-heading"><div><h2>Your AI mix</h2><p>A tool for every kind of thought</p></div>${icon("spark", "muted")}</div><div class="donut" style="--donut:${gradient ? `conic-gradient(${gradient})` : "#eeeaf6"}" role="img" aria-label="Session share by provider"><div><span>${groups.length}</span><small>AI tools used</small></div></div><div class="provider-legend">${(groups.length ? groups : PROVIDERS.slice(0, 3).map((p) => ({ ...p, count: 0 }))).map((p) => `<div><span><i style="background:${p.color}"></i>${esc(p.name)}</span><strong>${count ? Math.round((p.count / count) * 100) : 0}%<small>${plural(p.count, "session")}</small></strong></div>`).join("")}</div></article>`;
}
function tableHTML(items, full = false) {
  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  const shown = full ? sorted : sorted.slice(0, 5);
  return `<article class="panel sessions-panel"><div class="panel-heading"><div><h2>${full ? "Your sessions" : "Recent sessions"} <span class="count-tag">${items.length}</span></h2><p>${full ? "All your AI moments, neatly organized." : "A few moments from your AI journey"}</p></div>${!full ? `<a class="text-link" href="#sessions">View all sessions ${icon("arrow")}</a>` : ""}</div>
 <div class="table-toolbar"><label class="search-field">${icon("search")}<input id="search" type="search" placeholder="Search sessions…" aria-label="Search sessions" value="${esc(state.query)}" /></label><select id="provider-filter" aria-label="Filter by AI provider"><option value="all">All providers</option>${PROVIDERS.map((p) => `<option value="${p.id}" ${state.provider === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
 ${shown.length ? `<div class="table-scroll"><table><thead><tr><th>Session</th><th>AI tool</th><th>Date</th><th>Observed sends</th><th>Logged tokens</th><th>Logged / est. cost</th><th>Time</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${shown.map((s) => `<tr><td class="col-title"><div class="session-title">${icon(s.category === "Coding" ? "bolt" : s.category === "Research" ? "search" : "chat")}<div><strong>${esc(s.title)}</strong><small>${esc(s.category)}</small></div></div></td><td class="col-tool"><span class="provider-pill">${mark(s.provider)}${esc(provider(s.provider).name)}</span></td><td class="col-date">${prettyDate(s.date)}${new Date(s.date) > Date.now() ? ' <small class="future-badge" title="Dated in the future: not counted in totals">Future</small>' : ""}</td><td class="numeric col-sends${s.messageCount == null ? " na" : ""}" data-unit="${s.messageCount === 1 ? "send" : "sends"}">${s.messageCount == null ? "—" : compact(s.messageCount)}</td><td class="numeric col-tokens${s.source === "extension" ? " na" : ""}" data-unit="tokens">${s.source === "extension" ? "Not measured" : compact(s.inputTokens + s.outputTokens)}</td><td class="numeric col-cost${s.cost == null ? " na" : ""}">${s.cost == null ? "Not measured" : cellMoney(s.cost)}</td><td class="col-time">${duration(s.duration)}</td><td class="col-actions"><div class="row-actions"><button class="icon-btn" data-edit="${esc(s.id)}" aria-label="Edit ${esc(s.title)}">${icon("edit")}</button><button class="icon-btn delete-btn" data-delete="${esc(s.id)}" aria-label="Delete ${esc(s.title)}">${icon("trash")}</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><span>${icon("chat")}</span><h3>${state.query || state.provider !== "all" ? "No sessions match just yet." : "Your next idea starts here."}</h3><p>${state.query || state.provider !== "all" ? "Try another search or provider." : "Log your first AI session and watch your orbit take shape."}</p><button class="button primary" data-action="add">${icon("plus")} Log a session</button></div>`}
 <div class="table-bottom"><span>${shown.length.toLocaleString("en-US")} of ${plural(items.length, "session")}</span><span>${icon("lock")} Only you can see your data</span></div></article>`;
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
  const cats = ["Coding", "Writing", "Research", "Learning", "Other"]
    .map((name) => ({
      name,
      minutes: items
        .filter((x) => x.category === name)
        .reduce((a, x) => a + x.duration, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);
  const max = Math.max(...cats.map((x) => x.minutes), 1);
  const favorite = PROVIDERS.map((p) => ({
    ...p,
    count: items.filter((x) => x.provider === p.id).length,
  })).sort((a, b) => b.count - a.count)[0];
  return `${statsHTML(items)}<div class="insights-grid"><article class="panel"><div class="panel-heading"><div><h2>Where your attention goes</h2><p>Minutes logged by activity</p></div>${icon("clock")}</div><div class="category-bars">${cats.map((c) => `<div><div><span>${c.name}</span><strong>${duration(c.minutes)}</strong></div><div class="bar-track"><i style="width:${(c.minutes / max) * 100}%;background:${CATEGORY_COLORS[c.name]}"></i></div></div>`).join("")}</div></article><article class="insight-card"><span class="insight-spark">✧</span><div class="eyebrow">YOUR CREATIVE COMPANION</div><h2>${s.sessions ? esc(favorite.name) : "Room to explore."}</h2><p>${s.sessions ? `You turned to ${esc(favorite.name)} for ${favorite.count.toLocaleString("en-US")} of your ${plural(s.sessions, "session")}. ${cats[0].minutes ? esc(cats[0].name) + " is where you spent the most time." : "Add session duration to discover your habits."}` : "Start logging sessions to discover the tools and activities that shape your days."}</p><div class="insight-foot">${icon("spark")} Insights grow with your curiosity.</div></article></div>${chartHTML(items)}`;
}
function settingsHTML() {
  return `<div class="settings-grid">${storageError ? `<section class="panel settings-card wide"><div><h2>Recover your stored data</h2><p>Saving is paused because your stored file could not be read. Download it before clearing this site’s storage in your browser settings, then reload and import a repaired backup.</p><button class="button secondary" data-action="recover">${icon("download")} Download stored file</button></div></section>` : ""}<section class="panel settings-card"><span class="settings-icon violet">${icon("lock")}</span><h2>Your data stays with you.</h2><p>Orbit saves sessions in this browser. No account, no server, and no API keys needed. Data doesn’t automatically sync between devices.</p><div class="setting-row"><div><strong>Current workspace</strong><small>${state.mode === "demo" ? "Sample sessions · explore freely" : `${plural(state.personal.length, "personal session")} saved`}</small></div><span class="badge">${state.mode === "demo" ? "Demo" : "Personal"}</span></div><div class="setting-row"><div><strong>${state.mode === "demo" ? "Start your own orbit" : "Explore the demo"}</strong><small>${state.mode === "demo" ? "A fresh space for your real sessions" : "Your personal sessions will stay saved"}</small></div><button class="button secondary" data-action="${state.mode === "demo" ? "personal" : "demo"}">Switch ${icon("arrow")}</button></div></section>
 <section class="panel settings-card"><span class="settings-icon peach">${icon("download")}</span><h2>A backup for your peace of mind.</h2><p>Clearing browser data removes saved sessions. Export a JSON backup regularly, then import it on another browser or device.</p><div class="settings-buttons"><button class="button secondary" data-action="export">${icon("download")} Export JSON</button><button class="button secondary" data-action="csv">${icon("download")} Export CSV</button><button class="button secondary" data-action="import">${icon("upload")} Import JSON</button></div><p class="fine-print">Imports merge into your personal workspace. Matching session IDs are replaced after confirmation.</p></section>
 <section class="panel settings-card wide"><div class="settings-icon green">${icon("globe")}</div><div><h2>Honest numbers. Useful perspective.</h2><p>The dashboard prioritizes recorded time and observed send actions. Token counts and costs are optional manual entries. Cost estimates use illustrative provider rates, not your subscription bill. Enter an actual cost when you know it. A subscription chat can have a $0 incremental cost.</p><p>A website can’t read other tabs or your AI accounts. Manual session logs are entered by you. The browser extension adds active time and observed send-action counts. It does not access official token usage, invoices, or remaining message limits.</p><a class="text-link" href="https://github.com/MAHANTHADEEKSHA-SB/web..." target="_blank" rel="noreferrer">Setup & free hosting guide ${icon("arrow")}</a></div></section>
 <section class="panel settings-card wide extension-setup"><span class="settings-icon violet">${icon("clock")}</span><div><span class="eyebrow">LESS LOGGING. MORE CREATING.</span><h2>Let Orbit keep time.</h2><p>The optional Chrome / Edge extension records active time and observed message-send actions on ChatGPT, Claude, Gemini, Perplexity, and Copilot. It starts paused and keeps only daily totals on your device. It watches send controls without reading or storing prompts or replies.</p><ol class="setup-steps"><li>Download and unzip the extension below.</li><li>Open your browser’s Extensions page, enable Developer mode, choose <strong>Load unpacked</strong>, and select the unzipped folder.</li><li>If updating, replace the extension’s files and click Reload on the Extensions page. Refresh your AI tabs. Pin Orbit, open it, and enable tracking; updates start paused.</li><li>Choose <strong>Export for Orbit</strong> in the extension, then import that JSON file here. Repeated imports update the same daily totals.</li></ol><div class="settings-buttons"><a class="button primary" href="./orbit-extension.zip" download>${icon("download")} Download extension</a><button class="button secondary" data-action="import">${icon("upload")} Import tracked time</button></div><p class="fine-print">You grant access to the listed AI sites during installation. You can pause tracking or remove the extension at any time. Daily activity becomes one record per tool per day, not a count of conversations. Send controls vary between sites and languages, so counts may be missed. Observed sends are not confirmed successful replies or official usage quotas. Tokens, billing, and remaining limits aren’t measured.</p></div></section>
 <section class="panel settings-card wide danger-zone"><div><h2>Clear personal sessions</h2><p>Permanently remove the personal sessions saved in this browser. Export a backup first.</p></div><button class="button danger" data-action="clear">${icon("trash")} Clear data</button></section></div>`;
}
function renderContent() {
  const items = filtered();
  document.querySelector("#content").innerHTML =
    state.view === "settings"
      ? settingsHTML()
      : `
 <div class="section-toolbar"><div class="section-label">${icon(state.view === "insights" ? "spark" : "grid")} ${state.view === "overview" ? "Your overview" : state.view === "insights" ? "The bigger picture" : "Session history"} <span class="light-dot">·</span><span class="period-label">${state.days ? "Last " + state.days + " days" : "All time"}</span></div>${periodControl()}</div>
 ${state.view === "overview" ? `${statsHTML(items)}<div class="charts-grid">${chartHTML(items)}${breakdownHTML(items)}</div>${tableHTML(items)}` : state.view === "sessions" ? tableHTML(items, true) : insightsHTML(items)}`;
  document.querySelectorAll("#content [data-action]").forEach(bindAction);
  document.querySelectorAll("[data-days]").forEach(
    (b) =>
      (b.onclick = () => {
        state.days = Number(b.dataset.days);
        renderContent();
      }),
  );
  document.querySelector("#chart-metric")?.addEventListener("change", (e) => {
    state.chart = e.target.value;
    renderContent();
  });
  document
    .querySelector("#provider-filter")
    ?.addEventListener("change", (e) => {
      state.provider = e.target.value;
      renderContent();
    });
  document.querySelector("#search")?.addEventListener("input", (e) => {
    const position = e.target.selectionStart;
    state.query = e.target.value;
    renderContent();
    const field = document.querySelector("#search");
    field.focus();
    try {
      field.setSelectionRange(position, position);
    } catch {}
  });
  document
    .querySelectorAll("[data-edit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          openSession(all().find((s) => s.id === b.dataset.edit))),
    );
  document
    .querySelectorAll("[data-delete]")
    .forEach((b) => (b.onclick = () => deleteSession(b.dataset.delete)));
}
function render() {
  shell();
  renderContent();
}
function navigate() {
  const view = location.hash.slice(1);
  state.view = ["overview", "sessions", "insights", "settings"].includes(view)
    ? view
    : "overview";
  state.query = "";
  state.provider = "all";
  render();
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
        document.querySelector("#sidebar").classList.toggle("is-open"),
      clear: clearPersonal,
    };
    actions[button.dataset.action]?.();
  };
}
function dateValue(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function openSession(session) {
  const dialog = document.querySelector("#session-dialog");
  const p = session?.provider || "claude";
  dialog.innerHTML = `<form id="session-form"><div class="modal-header"><span class="settings-icon violet">${icon("spark")}</span><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div><h2>${session ? "A little fine-tuning." : "What did you create today?"}</h2><p class="modal-subtitle">${state.mode === "demo" ? (session ? "You’re editing sample data. Changes disappear when you reload." : "Saving this starts your own private orbit. The sample data stays untouched.") : "Every session is a small step toward something."}</p><label>Session title<input name="title" required maxlength="120" placeholder="e.g. Brainstorming my next big idea" value="${esc(session?.title || "")}" autofocus /></label><div class="form-grid"><label>AI tool<select name="provider">${PROVIDERS.map((x) => `<option value="${x.id}" ${p === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label>Activity<select name="category">${["Writing", "Coding", "Research", "Learning", "Other"].map((c) => `<option ${session?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Date & time<input name="date" type="datetime-local" required max="${dateValue()}" value="${dateValue(session?.date)}" /></label><label>Duration (minutes)<span class="unit-input"><input name="duration" aria-label="Duration (minutes)" type="number" min="0" max="1440" step="any" value="${session?.duration ?? ""}" placeholder="e.g. 20" /><span aria-hidden="true">min</span></span></label></div><details ${session && (session.inputTokens || session.outputTokens || session.cost) ? "open" : ""}><summary>Tokens, model & cost <span>Optional</span></summary><label>Model<input name="model" maxlength="80" placeholder="e.g. Claude Sonnet" value="${esc(session?.model || "")}" /></label><div class="form-grid"><label>Input tokens<span class="unit-input"><input name="inputTokens" aria-label="Input tokens" type="number" min="0" step="1" value="${session?.inputTokens ?? ""}" placeholder="e.g. 1500" aria-describedby="token-help input-token-help" /><span aria-hidden="true">tokens</span></span><small class="field-help" id="input-token-help">Text sent to the AI, including context.</small></label><label>Output tokens<span class="unit-input"><input name="outputTokens" aria-label="Output tokens" type="number" min="0" step="1" value="${session?.outputTokens ?? ""}" placeholder="e.g. 500" aria-describedby="token-help output-token-help" /><span aria-hidden="true">tokens</span></span><small class="field-help" id="output-token-help">Text generated in the AI’s reply.</small></label></div><p class="fine-print" id="token-help">Enter whole token counts, not words or thousands: enter 1500 for 1.5k tokens. Use your provider’s usage report if available, or leave blank. The extension tracks time and observed send actions, not token counts.</p><label>Cost (USD)<span class="unit-input"><input name="cost" aria-label="Cost (USD)" type="number" min="0" step="any" value="${session?.cost ?? ""}" placeholder="Estimated if left blank" /><span aria-hidden="true">USD</span></span></label><p class="fine-print" id="cost-hint">Optional estimate; this isn’t your subscription bill. Leave tokens empty if you don’t know them.</p></details><p id="form-error" class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary" type="submit">${icon("check")} ${session ? "Save changes" : "Save session"}</button></div></form>`;
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
  d.innerHTML = `<div class="confirm-content"><h2>${esc(title)}</h2><p>${esc(message)}</p><div class="modal-footer"><button class="button secondary" id="cancel-confirm">Cancel</button><button class="button ${tone}" id="accept-confirm">${esc(label)}</button></div></div>`;
  d.querySelector("#cancel-confirm").onclick = () => d.close();
  d.querySelector("#accept-confirm").onclick = () => {
    d.close();
    fn();
  };
  d.showModal();
}
function deleteSession(id) {
  confirmAction(
    "Remove this session?",
    "This will remove the session from this workspace.",
    "Remove session",
    () => {
      const next = all().filter((s) => s.id !== id);
      if (state.mode === "personal" && !persist(next)) return;
      if (state.mode === "demo") state.demo = next;
      renderContent();
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
