#!/usr/bin/env node
/**
 * Orbit audit acceptance checks — one check per finding in AUDIT.md.
 *
 * Every check FAILS on the audited baseline (commit 41fc42a) and should PASS
 * once the matching fix from AUDIT.md is implemented. Re-run after each fix.
 *
 * Usage
 *   npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
 *   node docs/audit/check.cjs                       # all checks, report only
 *   node docs/audit/check.cjs --only=A1,B3          # a subset
 *   node docs/audit/check.cjs --strict              # exit 1 if anything fails (CI)
 *   node docs/audit/check.cjs http://localhost:5173/ # another server
 *
 * Requirements
 *   - playwright (preinstalled in Claude Code cloud sessions; locally:
 *     `npm i -D playwright && npx playwright install chromium`)
 *   - axe-core (optional, enables B8; `npm i -D axe-core`)
 *
 * Design notes
 *   - Each check runs in a fresh browser context (isolated localStorage).
 *   - Checks assert user-visible outcomes, not implementation details, so any
 *     reasonable fix passes. Where AUDIT.md recommends a specific design, the
 *     check accepts that design and documents its assumption inline.
 */
const fs = require("node:fs");
const path = require("node:path");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("playwright is not installed. Run: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}
let AXE_PATH = null;
try {
  AXE_PATH = require.resolve("axe-core/axe.min.js");
} catch {}

const args = process.argv.slice(2);
const BASE = args.find((a) => /^https?:\/\//.test(a)) || "http://127.0.0.1:4173/";
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const STRICT = args.includes("--strict");
const ROOT = path.resolve(__dirname, "..", "..");
const KEY = "ai-usage-sessions-v1";

const DESKTOP = { width: 1366, height: 900 };
const day = (offset = 0, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const session = (over = {}) => ({
  id: "s-" + Math.random().toString(36).slice(2),
  provider: "claude",
  title: "Audit session",
  date: day(-1).toISOString(),
  duration: 20,
  inputTokens: 1000,
  outputTokens: 500,
  category: "Coding",
  ...over,
});

const checks = [];
const check = (id, title, fn) => checks.push({ id, title, fn });

/* ------------------------------------------------------------------ helpers */
async function open(browser, { viewport = DESKTOP, hash = "overview", sessions, mode } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(BASE);
  if (sessions || mode) {
    await page.evaluate(
      ([key, s, m]) => {
        if (s) localStorage.setItem(key, JSON.stringify({ version: 1, sessions: s }));
        if (m) localStorage.setItem("orbit-mode", m);
      },
      [KEY, sessions, mode],
    );
  }
  await page.goto(BASE + "#" + hash);
  await page.reload();
  await page.waitForLoadState("networkidle");
  return { context, page };
}
const statValue = (page, labelPart) =>
  page.evaluate((part) => {
    const card = [...document.querySelectorAll(".stat-card")].find((c) => c.innerText.includes(part));
    return card?.querySelector(".stat-value")?.innerText.trim() ?? null;
  }, labelPart);
const goView = async (page, view) => {
  await page.evaluate((v) => (location.hash = v), view);
  await page.waitForTimeout(80);
};
const allTime = async (page) => {
  const b = page.locator('[data-days="0"]');
  if (await b.count()) await b.first().click();
};

/* -------------------------------------------------------------- P0: trust */
check("A1", "A session logged while the demo is showing survives a reload", async (b) => {
  const { context, page } = await open(b);
  await page.locator('[data-action="add"]').first().click();
  await page.fill('input[name="title"]', "AUDIT-A1");
  await page.locator('#session-form [type="submit"]').click();
  await page.waitForTimeout(150);
  await page.reload();
  const stored = await page.evaluate((k) => (localStorage.getItem(k) || "").includes("AUDIT-A1"), KEY);
  await context.close();
  return { pass: stored, detail: `stored in personal data after reload: ${stored}` };
});

check("A2", "Session dialog keeps typed input on drag-select or backdrop click", async (b) => {
  const { context, page } = await open(b);
  await page.locator('[data-action="add"]').first().click();
  await page.fill('input[name="title"]', "half-typed");
  const box = await page.locator('input[name="title"]').boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 6 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => document.querySelector("#session-dialog").open);
  await page.mouse.click(5, 5);
  const afterClick = await page.evaluate(() => document.querySelector("#session-dialog").open);
  await context.close();
  return { pass: afterDrag && afterClick, detail: `open after drag-out: ${afterDrag}; open after backdrop click with edits: ${afterClick}` };
});

check("A3", "Logged + tracked time for the same provider/day is not double counted", async (b) => {
  const y = day(-1, 0);
  const sessions = [
    session({ id: "manual-1", duration: 30, date: day(-1, 10).toISOString(), inputTokens: 0, outputTokens: 0 }),
    session({ id: `orbit-extension-audit-${ymd(y)}-claude`, title: "Claude · browser activity", model: "Claude website", duration: 30, date: y.toISOString(), inputTokens: 0, outputTokens: 0, cost: 0, category: "Other" }),
  ];
  const { context, page } = await open(b, { sessions, mode: "personal" });
  const time = await statValue(page, "Time");
  await context.close();
  // AUDIT.md recommends reconciling per provider/day as max(logged, tracked) => 30m.
  return { pass: time === "30m", detail: `"Time with AI" shows ${time} for one real 30-minute session` };
});

check("A4", "A future-dated session is visible (and therefore editable/deletable)", async (b) => {
  const sessions = [session({ title: "AUDIT-FUTURE", date: new Date(Date.now() + 36 * 3600e3).toISOString() })];
  const { context, page } = await open(b, { sessions, mode: "personal", hash: "sessions" });
  await allTime(page);
  const visible = await page.locator("text=AUDIT-FUTURE").count();
  await context.close();
  return { pass: visible > 0, detail: `rows visible in Sessions (All time): ${visible}` };
});

/* ------------------------------------------------------- P1: UX/a11y/perf */
check("B1", "Search keeps its input element, supports IME, and has no long tasks at 1,000 sessions", async (b) => {
  const sessions = Array.from({ length: 1000 }, (_, i) =>
    session({ id: "p" + i, title: `Session ${i} topic ${i % 50}`, date: day(-(i % 300)).toISOString() }),
  );
  const { context, page } = await open(b, { sessions, mode: "personal", hash: "sessions" });
  await allTime(page);
  await page.evaluate(() => {
    window.__el = document.querySelector("#search");
    window.__lt = [];
    new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => e.duration))).observe({ type: "longtask" });
  });
  await page.locator("#search").pressSequentially("topic", { delay: 40 });
  await page.waitForTimeout(500);
  const sameNode = await page.evaluate(() => window.__el === document.querySelector("#search"));
  const worstTask = Math.round(Math.max(0, ...(await page.evaluate(() => window.__lt))));
  // IME: compose "にほ" then commit "日本" — a correct field ends with exactly the committed text.
  await page.fill("#search", "");
  await page.waitForTimeout(300);
  await page.focus("#search");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.imeSetComposition", { text: "にほ", selectionStart: 2, selectionEnd: 2 });
  await cdp.send("Input.insertText", { text: "日本" });
  await page.waitForTimeout(300);
  const ime = await page.inputValue("#search");
  await context.close();
  return {
    pass: sameNode && worstTask < 100 && ime === "日本",
    detail: `same <input> node: ${sameNode}; worst long task: ${worstTask} ms (need <100); IME result: "${ime}" (need "日本")`,
  };
});

check("B2", "Table search/filter does not silently change the dashboard totals", async (b) => {
  const { context, page } = await open(b);
  const insidePanel = await page.evaluate(() => !!document.querySelector(".sessions-panel #search"));
  const before = await statValue(page, "sessions") ?? await statValue(page, "records");
  await page.locator("#search").fill("bug");
  await page.waitForTimeout(300);
  const after = await statValue(page, "sessions") ?? await statValue(page, "records");
  await context.close();
  // Either scope search to the table, or move filters to the global toolbar (then totals may change).
  const pass = !insidePanel || before === after;
  return { pass, detail: `search inside table panel: ${insidePanel}; total stat ${before} -> ${after}` };
});

check("B3", "Chart fills its panel and axis text renders >= 11px at every width", async (b) => {
  const bad = [];
  for (const width of [1920, 1366, 900, 390]) {
    for (const view of ["overview", "insights"]) {
      const { context, page } = await open(b, { viewport: { width, height: 1000 }, hash: view });
      const m = await page.evaluate(() => {
        const svg = document.querySelector(".usage-chart");
        if (!svg) return null;
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox?.baseVal;
        const scale = vb && vb.width ? Math.min(r.width / vb.width, r.height / vb.height) : 1;
        const gutter = vb && vb.width ? (r.width - vb.width * scale) / 2 : 0;
        const text = svg.querySelector("text");
        return { gutter: Math.round(gutter), font: +(parseFloat(getComputedStyle(text).fontSize) * scale).toFixed(1) };
      });
      await context.close();
      if (!m || m.gutter > 2 || m.font < 11) bad.push(`${width}/${view}: gutter ${m?.gutter}px, axis ${m?.font}px`);
    }
  }
  return { pass: bad.length === 0, detail: bad.length ? bad.join("; ") : "all 8 combinations fit" };
});

check("B4", "Mobile drawer: no invisible tab stops, aria-expanded, Escape closes", async (b) => {
  const { context, page } = await open(b, { viewport: { width: 390, height: 844 } });
  await page.keyboard.press("Tab");
  const firstVisible = await page.evaluate(() => {
    const r = document.activeElement.getBoundingClientRect();
    return r.right > 0 && r.left < innerWidth;
  });
  const btn = page.locator(".mobile-menu");
  const hasExpanded = (await btn.getAttribute("aria-expanded")) !== null;
  await btn.click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const closed = await page.evaluate(() => !document.querySelector("#sidebar").classList.contains("is-open"));
  await context.close();
  return { pass: firstVisible && hasExpanded && closed, detail: `first Tab stop visible: ${firstVisible}; aria-expanded: ${hasExpanded}; Escape closes: ${closed}` };
});

check("B5", "Session form fields are not squeezed at 360px", async (b) => {
  const { context, page } = await open(b, { viewport: { width: 360, height: 740 } });
  await page.locator('[data-action="add"]').first().click();
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".form-grid")).gridTemplateColumns);
  await context.close();
  const widths = cols.split(" ").map(parseFloat);
  const pass = Math.max(...widths) - Math.min(...widths) <= 2;
  return { pass, detail: `grid columns: ${cols}` };
});

check("B6", "Row edit/delete buttons are reachable without horizontal scrolling at 390px", async (b) => {
  const { context, page } = await open(b, { viewport: { width: 390, height: 844 } });
  const inView = await page.evaluate(() => {
    const r = document.querySelector("[data-edit]").getBoundingClientRect();
    return r.right <= innerWidth && r.left >= 0;
  });
  await context.close();
  return { pass: inView, detail: `first edit button inside viewport: ${inView}` };
});

check("B7", "Sidebar content is reachable on short viewports (1280x640)", async (b) => {
  const { context, page } = await open(b, { viewport: { width: 1280, height: 640 } });
  const ok = await page.evaluate(() => {
    const sb = document.querySelector(".sidebar");
    sb.scrollTop = 1e5;
    return document.querySelector(".profile").getBoundingClientRect().bottom <= innerHeight + 1;
  });
  await context.close();
  return { pass: ok, detail: `profile row reachable: ${ok}` };
});

check("B8", "No WCAG AA colour-contrast failures (axe-core), demo + personal, 4 views", async (b) => {
  if (!AXE_PATH) return { pass: null, detail: "SKIPPED: npm i -D axe-core to enable" };
  let nodes = 0;
  const samples = new Set();
  for (const mode of ["demo", "personal"]) {
    for (const view of ["overview", "sessions", "insights", "settings"]) {
      const { context, page } = await open(b, { hash: view, mode });
      await page.addScriptTag({ path: AXE_PATH });
      const found = await page.evaluate(async () =>
        (await axe.run(document, { runOnly: ["color-contrast"] })).violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
      );
      nodes += found.length;
      found.slice(0, 2).forEach((t) => samples.add(t));
      await context.close();
    }
  }
  return { pass: nodes === 0, detail: `failing nodes: ${nodes}${nodes ? " e.g. " + [...samples].slice(0, 3).join(" | ") : ""}` };
});

check("B9", "At most 5% of visible text is smaller than 12px (desktop and mobile)", async (b) => {
  const out = [];
  let pass = true;
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    let total = 0;
    let small = 0;
    for (const view of ["overview", "sessions", "insights", "settings"]) {
      const { context, page } = await open(b, { viewport, hash: view });
      const [t, s] = await page.evaluate(() => {
        let t = 0;
        let s = 0;
        const w = document.createTreeWalker(document.querySelector("#app"), NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          const n = w.currentNode;
          if (!n.textContent.trim() || n.parentElement.closest("svg")) continue;
          const cs = getComputedStyle(n.parentElement);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          t++;
          if (parseFloat(cs.fontSize) < 12) s++;
        }
        return [t, s];
      });
      total += t;
      small += s;
      await context.close();
    }
    const pct = Math.round((100 * small) / total);
    if (pct > 5) pass = false;
    out.push(`${viewport.width}px: ${pct}% under 12px`);
  }
  return { pass, detail: out.join("; ") };
});

check("B10", "Keyboard focus lands somewhere sensible after deleting a session", async (b) => {
  const { context, page } = await open(b, { hash: "sessions" });
  await page.locator("[data-delete]").first().click();
  await page.locator("#accept-confirm, #confirm-dialog .danger, #confirm-dialog [data-accept]").first().click();
  await page.waitForTimeout(150);
  const onBody = await page.evaluate(() => document.activeElement === document.body);
  await context.close();
  return { pass: !onBody, detail: `focus on <body> after delete: ${onBody}` };
});

check("B11", "Destructive confirmations use a danger-styled button", async (b) => {
  const { context, page } = await open(b, { hash: "settings" });
  await page.locator('[data-action="clear"]').click();
  const cls = await page.locator("#confirm-dialog button").last().getAttribute("class");
  await context.close();
  return { pass: /danger/.test(cls || ""), detail: `accept button class: "${cls}"` };
});

check("B12", "Each activity category keeps the same colour across date ranges", async (b) => {
  const { context, page } = await open(b, { hash: "insights" });
  const read = () =>
    page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll(".category-bars > div")].map((d) => [d.querySelector("span").innerText, d.querySelector(".bar-track i").style.background])),
    );
  await page.locator('[data-days="7"]').click();
  const a = await read();
  await page.locator('[data-days="90"]').click();
  const c = await read();
  await context.close();
  const changed = Object.keys(a).filter((k) => a[k] !== c[k]);
  return { pass: changed.length === 0, detail: changed.length ? `colour changed for: ${changed.join(", ")}` : "stable" };
});

check("B13", "Singular/plural text is correct (no '1 sessions')", async (b) => {
  const { context, page } = await open(b, { sessions: [session()], mode: "personal" });
  const texts = [await page.locator("#app").innerText()];
  await goView(page, "settings");
  texts.push(await page.locator("#app").innerText());
  await context.close();
  const hits = texts.join("\n").match(/\b1 (sessions|records|days)\b/g) || [];
  return { pass: hits.length === 0, detail: hits.length ? `found: ${[...new Set(hits)].join(", ")}` : "none" };
});

check("B14", "Costs never render as a misleading $0.00", async (b) => {
  const { context, page } = await open(b);
  const zeros = await page.evaluate(() => [...document.querySelectorAll("td")].filter((t) => t.innerText.trim() === "$0.00").length);
  await context.close();
  return { pass: zeros === 0, detail: `table cells showing $0.00: ${zeros} (use "—" for none, "<$0.01" for tiny)` };
});

check("B15", "First run (empty personal workspace) shows onboarding instead of a wall of zeros", async (b) => {
  const { context, page } = await open(b, { mode: "personal", viewport: { width: 1366, height: 768 } });
  const r = await page.evaluate(() => ({
    onboarding: !!document.querySelector("[data-onboarding]"),
    zeroStats: [...document.querySelectorAll(".stat-value")].filter((v) => /^(\$?0(\.00)?|0m)$/.test(v.innerText.trim())).length,
  }));
  await context.close();
  return { pass: r.onboarding || r.zeroStats === 0, detail: `[data-onboarding] present: ${r.onboarding}; zero-valued stat cards: ${r.zeroStats}` };
});

/* --------------------------------------------- P2: robustness & semantics */
check("C1", "localStorage uses compact JSON (not pretty-printed)", async (b) => {
  const { context, page } = await open(b, { mode: "personal" });
  await page.locator('[data-action="add"]').first().click();
  await page.fill('input[name="title"]', "compact check");
  await page.locator('#session-form [type="submit"]').click();
  await page.waitForTimeout(150);
  const pretty = await page.evaluate((k) => (localStorage.getItem(k) || "").includes("\n  "), KEY);
  await context.close();
  return { pass: !pretty, detail: `stored JSON pretty-printed: ${pretty}` };
});

check("C7", "Route semantics: per-view title, aria-current, aria-pressed, th scope, labelled dialogs", async (b) => {
  const { context, page } = await open(b);
  const titles = new Set();
  for (const v of ["overview", "sessions", "insights", "settings"]) {
    await goView(page, v);
    titles.add(await page.title());
  }
  await goView(page, "overview");
  const r = await page.evaluate(() => ({
    current: !!document.querySelector('.nav-item[aria-current="page"]'),
    pressed: [...document.querySelectorAll("[data-days]")].every((x) => x.hasAttribute("aria-pressed")),
    scope: [...document.querySelectorAll("th")].every((t) => t.getAttribute("scope") === "col"),
    dialogs: [...document.querySelectorAll("dialog")].every((d) => d.hasAttribute("aria-labelledby") || d.hasAttribute("aria-label")),
  }));
  await context.close();
  const pass = titles.size === 4 && r.current && r.pressed && r.scope && r.dialogs;
  return { pass, detail: `distinct titles: ${titles.size}/4; aria-current: ${r.current}; aria-pressed: ${r.pressed}; th scope: ${r.scope}; dialogs labelled: ${r.dialogs}` };
});

check("C8", "index.html has social preview, manifest, touch icon and noscript", async (b) => {
  const { context, page } = await open(b);
  const r = await page.evaluate(() => ({
    og: ["og:title", "og:description", "og:image"].every((p) => document.querySelector(`meta[property="${p}"]`)),
    manifest: !!document.querySelector('link[rel="manifest"]'),
    touch: !!document.querySelector('link[rel="apple-touch-icon"]'),
    noscript: !!document.querySelector("noscript"),
  }));
  await context.close();
  return { pass: Object.values(r).every(Boolean), detail: JSON.stringify(r) };
});

check("C9", "Chart x-axis labels the most recent day", async (b) => {
  const { context, page } = await open(b, { hash: "overview" });
  await page.locator('[data-days="7"]').click();
  const labels = await page.evaluate(() => [...document.querySelectorAll(".usage-chart text")].map((t) => t.textContent).filter((t) => /[A-Za-z]{3,} \d{1,2}|\d{1,2} [A-Za-z]{3,}/.test(t)));
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  await context.close();
  return { pass: labels.at(-1) === today, detail: `last x label "${labels.at(-1)}", today "${today}"` };
});

/* ----------------------------------------------- repo-level (no browser) */
check("E1", "Extension manifest declares PNG icons (16/32/48/128) that exist", async () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "extension/manifest.json"), "utf8"));
  const icons = m.icons || {};
  const sizes = ["16", "32", "48", "128"];
  const ok = sizes.every((s) => icons[s] && fs.existsSync(path.join(ROOT, "extension", icons[s])));
  return { pass: ok, detail: ok ? "icons present" : `icons: ${JSON.stringify(icons)}` };
});

check("E2", "Extension packager includes files in sub-folders (e.g. icons/)", async () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/package-extension.mjs"), "utf8");
  // Only the readdir() call matters; mkdir(..., { recursive: true }) must not count.
  const recursive = /readdir\([^)]*recursive:\s*true/.test(src);
  return { pass: recursive, detail: `readdir({ recursive: true }) used: ${recursive}` };
});

check("C12", "A CI workflow runs tests on pull requests", async () => {
  const dir = path.join(ROOT, ".github/workflows");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const hit = files.find((f) => /pull_request/.test(fs.readFileSync(path.join(dir, f), "utf8")));
  return { pass: !!hit, detail: hit ? `found in ${hit}` : `workflows: ${files.join(", ") || "none"} (none trigger on pull_request)` };
});

/* -------------------------------------------------------------------- run */
(async () => {
  const selected = checks.filter((c) => !ONLY.length || ONLY.includes(c.id));
  const browser = await chromium.launch();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  console.log(`Orbit audit checks against ${BASE}\n`);
  for (const c of selected) {
    let result;
    try {
      result = await c.fn(browser);
    } catch (error) {
      result = { pass: false, detail: `error: ${error.message.split("\n")[0]}` };
    }
    const tag = result.pass === null ? "SKIP" : result.pass ? "PASS" : "FAIL";
    if (tag === "PASS") passed++;
    else if (tag === "FAIL") failed++;
    else skipped++;
    console.log(`${tag}  ${c.id.padEnd(4)} ${c.title}\n      ${result.detail}`);
  }
  await browser.close();
  console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped (of ${selected.length})`);
  if (STRICT && failed) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
