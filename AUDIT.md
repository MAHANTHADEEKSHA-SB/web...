# Orbit — Website Audit & Upgrade Plan

> **Audited:** 2026-11-01 · commit `41fc42a` (= `main`, published by GitHub Pages deploy run #4) · by Claude Code
> **Companions:** [`docs/audit/check.cjs`](docs/audit/check.cjs) (26 executable acceptance checks, one per finding) ·
> [`docs/audit/contrast-map.json`](docs/audit/contrast-map.json) (verified colour fixes) · [`docs/audit/*.jpg`](docs/audit) (evidence)
> **Handoff/status:** [`WORK_STATUS.md`](WORK_STATUS.md)

> **Fix status (2026-11-01, branch `feature/sprint-1`, based on `main` @ `5c223cd`):** Sprint 1 is implemented.
> Fixed: A1, A2, A4, B5, B6, B7, B8, B9, B11, B12, B13, B14, C4, C9, E3, E4, plus the new finding N6.
> `check.cjs`: **13/26 pass** (0/26 on `main`). Findings from the follow-up review of the observed-usage feature are in [§10](#10-follow-up-review-observed-ai-usage-main--5c223cd).

---

## 0. TL;DR

Orbit is fast, private and well-engineered at the data layer: Lighthouse **Performance 100/100**, a 13 KB (gzipped) JS bundle, XSS-safe rendering and strict import validation.
The weak spots are the **UI layer** (`src/main.js` + `src/style.css`, which have no tests). There are **3 ways to lose or distort data**,
a **search box that breaks for Japanese/Chinese/Korean input and lags at realistic data sizes**, **text that is too small and too faint**
(82% of desktop text is under 12px; 35 colour pairs fail WCAG AA), and several **mobile/tablet layout breaks**.
Most are XS–S fixes. Several were **verified by applying the fix to a throwaway build** and re-measuring (marked ✅ verified fix).

### Scorecard (baseline)

| Area | Result |
|---|---|
| Unit tests | 21/21 pass (`npm test`), covering `src/data.js` + `extension/core.js` |
| UI tests | **none**: `src/main.js` (593 lines) and `src/style.css` (1,972 lines) are untested |
| Build | OK · JS 35.9 KB (**13.2 KB gz**) · CSS 31.3 KB (10.0 KB gz) · 7 font files, self-hosted |
| Lighthouse mobile | Perf **100** · A11y **94** · Best practices **96** · SEO 91\* |
| Lighthouse desktop | Perf **100** · A11y **96** · Best practices **100** · SEO 91\* |
| axe-core 4.14 | **35 failing colour pairs** (347 nodes on desktop across 4 views × demo/personal); no other desktop violations |
| Legible text (≥ 12px) | **18%** at 1366px · **16%** at 390px (Lighthouse: "10.24% legible text") |
| Console errors / failed requests | 0 |
| Acceptance checks (`check.cjs`) | **0 / 26 pass** |

\* The SEO deduction is only `robots-txt`, an artifact of the local preview server's SPA fallback. It does not apply to a GitHub Pages project path.

### Top 10 (do these first)

| # | ID | Fix | Effort |
|---|---|---|---|
| 1 | [A1](#a1) | Sessions logged while the demo is showing are silently discarded on reload | XS |
| 2 | [A2](#a2) | Session dialog closes and loses typed input on backdrop click / drag-select | XS |
| 3 | [B8](#b8)+[B9](#b9) | Contrast + text-size patch (✅ verified: axe 347 → 0, small text 82% → 0%) | S |
| 4 | [B1](#b1) | Search: IME broken, full-page re-render per keystroke (350 ms @ 1k sessions) | M |
| 5 | [A5](#a5) | Durability: Safari's 7-day storage eviction, shared `github.io` origin, no backup reminder | S |
| 6 | [B3](#b3) | Chart letterboxing (up to 298px blank gutters) and 5.4px axis text | S |
| 7 | [A3](#a3) | Logged + tracked time for the same work is double counted | M |
| 8 | [B4](#b4)–[B7](#b7) | Mobile/tablet: drawer focus, squeezed form, cut-off table, clipped sidebar (✅ CSS verified) | S |
| 9 | [C12](#c12) | CI on pull requests + UI smoke tests (PRs #1/#2 merged with no checks) | M |
| 10 | [D1](#d1) | One-click extension → dashboard sync (removes the export/import loop) | M |

Effort: **XS** < 30 min · **S** ≤ 2 h · **M** ½–1 day · **L** multi-day.

---

## 1. How this audit was done (reproducible)

- **Source:** every file read (21 files). `npm ci && npm test && npm run build` run on Node 22.23.4.
- **Runtime:** production build served by `vite preview`, driven by Playwright 1.63 + Chromium 153 at
  1920×1080, 1366×768/900, 1280×640, 1440×700, 900×1180, 390×844 and 360×740, in demo and personal modes, with 0 / 1 / 500 / 1,000 / 2,500 / 10,000 sessions.
- **Tools:** axe-core 4.14.0, Lighthouse 12.8.2 (mobile + desktop), a custom text-size scan, CDP IME simulation, and the extension loaded unpacked in Chromium.
- **Live site:** this sandbox's network policy blocks `mahanthadeeksha-sb.github.io`, so the live URL could not be fetched. The audited artifact is the local
  build of commit `41fc42a`, which is the exact commit deployed by Pages run #4 (success, 2026-11-01 00:00 UTC).
- **Verification of fixes:** CSS fixes B5–B9, the CSP from C8 and the mobile card layout were applied to a **throwaway copy** of the repository, rebuilt and re-measured.
  Nothing in `src/` was changed by this audit.
- **Re-run everything:** see [§9](#9-acceptance-checks).

---

## 2. What is already good (keep it)

- **Security:** every user string goes through `esc()` before `innerHTML` (I checked all ~40 interpolations), so I found no XSS. Toasts use `textContent`.
- **Import validation** (`src/data.js:85-149`, `:241-281`): rejects impossible calendar dates (Feb 30), invalid times, non-integer tokens, duplicate IDs, more than 10k sessions and files over 20 MB.
- **Corrupt-storage safety:** unreadable stored data is preserved, saving is blocked, and a "Download stored file" recovery path exists (`src/main.js:138-153`, `:389-397`).
- **CSV export** guards against formula injection per OWASP (`src/main.js:521-526`).
- **Extension privacy design:** opt-in, no content scripts, hostname-only, ignores incognito, midnight-split intervals, gap cap. All of it is unit-tested.
- **Timezone care:** date-only imports stay on the local calendar day, with tests for local-midnight boundaries.
- **Performance:** no framework, 13 KB gzipped JS, fonts self-hosted (no Google Fonts requests), CLS 0, TBT 0 ms.
- **Honest copy:** cost estimates are clearly labelled as illustrative; the app never pretends to read provider bills.
- **Native `<dialog>`** with Cancel auto-focused on destructive confirms (a good default), plus `prefers-reduced-motion` support.

---

## 3. P0 — Data loss & trust (fix first)

<a id="a1"></a>
### A1 · Sessions logged while the demo is showing are silently discarded · XS

- **Where:** `src/main.js:442-453` (save), `src/main.js:422` (dialog subtitle), default mode at `src/main.js:91-99`.
- **Evidence:** first-time visitors land in **demo** mode. "Log session" saves into `state.demo`, which `createDemoSessions()` regenerates on every load.
  Verified: logged row visible → reload → **gone** (check `A1`). The only warning is 11px grey subtitle text.
- **Fix:** a *new* entry is always real data, so save it to the personal workspace and switch modes. Edits to sample rows stay sample-only.
  ```js
  // src/main.js — form.onsubmit, replace lines 442-453
  const toPersonal = state.mode === "demo" && !session;
  const base = toPersonal ? state.personal : all();
  const next = session ? base.map((s) => (s.id === session.id ? item : s)) : [item, ...base];
  if (state.mode === "personal" || toPersonal) {
    if (!persist(next)) return;
  } else {
    state.demo = next;
  }
  dialog.close();
  if (toPersonal) setMode("personal");
  else renderContent();
  toast(toPersonal ? "Saved to your own orbit. The sample data is untouched."
    : session ? "Session updated." : "A new moment in your orbit. Session saved.");
  ```
  Update the demo subtitle at `:422`: when `!session`, use "Saving this starts your own private orbit. The sample data stays untouched."
- **Done when:** `node docs/audit/check.cjs --only=A1` passes.

<a id="a2"></a>
### A2 · The session dialog closes and loses everything you typed · XS

- **Where:** `src/main.js:579-592` (click-outside handler), `src/main.js:427-431` (form input listener).
- **Evidence:** (1) a plain click on the backdrop closes the form, even with unsaved input; (2) **selecting text in an input and releasing the mouse outside the dialog
  also closes it**, because the `click` fires on the common ancestor `<dialog>` with outside coordinates. Both verified (check `A2`).
- **Fix:** close only when the press *started* on the backdrop, and never when the form has edits.
  ```js
  // src/main.js — replace lines 579-592
  const outside = (d, e) => {
    const r = d.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  document.querySelectorAll("dialog").forEach((d) => {
    let pressedOutside = false;
    d.addEventListener("pointerdown", (e) => (pressedOutside = e.target === d && outside(d, e)));
    d.addEventListener("click", (e) => {
      const dirty = d.querySelector("form")?.dataset.dirty === "true";
      if (pressedOutside && e.target === d && outside(d, e) && !dirty) d.close();
      pressedOutside = false;
    });
  });
  // src/main.js:427 — first line inside the existing form "input" listener:
  form.dataset.dirty = "true";
  ```
  Escape and Cancel still close the dialog, since those are explicit choices.
- **Done when:** check `A2` passes.

<a id="a3"></a>
### A3 · The same work is counted twice when you log it *and* the extension tracks it · M

- **Where:** `src/data.js:151-168` (`summarize`), `src/data.js:228-237` (`dailyUsage`), `src/main.js:182-221` (stat cards), `src/main.js:297-313` (insight copy).
- **Evidence:** one real 30-minute Claude session, logged manually and also tracked by the extension, shows **"Time with AI: 1h 0m"**, **"2 of your 2 sessions"**,
  and "Coding 30m / Other 30m" (check `A3`). The README encourages using both features together, so this will happen.
- **Fix:** reconcile per *local day × provider* as `max(logged, tracked)`. Never sum the two. Count "sessions" from logged entries only.
  ```js
  // src/data.js — new exports (tracked records already have stable "orbit-extension-" IDs)
  export const isTracked = (s) => s.id.startsWith("orbit-extension-");
  export function reconcile(sessions) {               // Map<"YYYY-MM-DD|provider", {logged, tracked}>
    const cells = new Map();
    for (const s of sessions) {
      const key = `${localDateKey(new Date(s.date))}|${s.provider}`;
      const cell = cells.get(key) ?? { logged: 0, tracked: 0 };
      cell[isTracked(s) ? "tracked" : "logged"] += s.duration;
      cells.set(key, cell);
    }
    return cells;
  }
  export const countedMinutes = (cell) => Math.max(cell.logged, cell.tracked);
  ```
  - `summarize()`: `totalMinutes = Σ countedMinutes(cell)`; add `loggedMinutes`, `trackedMinutes`, `loggedSessions`.
  - `dailyUsage()`: replace `row.minutes += session.duration` (`:236`) with a pass over `reconcile(sessions.filter((s) => new Date(s.date) <= end))` that adds `countedMinutes` to `buckets.get(key.slice(0, 10))`.
  - Stat card note: "Logged 30m · Tracked 30m" when both exist. "Average per session" uses `loggedMinutes / loggedSessions`.
  - Insight copy (`src/main.js:312`): for tracked-only users, say "Claude had 64% of your AI time" instead of counting "sessions".
  - Optional setting "Count time from: Best of both (default) · Logged only · Tracked only".
  - Unit test to add in `tests/data.test.js`: a logged 30m entry plus a tracked 45m entry, same provider and day → `summarize().totalMinutes === 45`. The existing "metrics sum independently" test still holds (40 logged, 0 tracked → 40).
- **Done when:** check `A3` passes and the new unit test passes.

<a id="a4"></a>
### A4 · Future-dated sessions become invisible and undeletable · XS

- **Where:** `src/data.js:198` (`date <= end` in `filterSessions`).
- **Evidence:** an imported session dated +36h counts in Settings ("1 personal sessions saved") but appears **nowhere**, even in Sessions → All time.
  It can only be removed by clearing all data (check `A4`). Causes: imports from another timezone or device, or a wrong system clock.
- **Fix:** add an `includeFuture` option and use it in the Sessions view. Badge those rows.
  ```js
  // src/data.js:170-172 — add to the options object:   includeFuture = false
  // src/data.js:198 — replace `date <= end &&` with:
  (includeFuture || date <= end) &&
  // src/main.js:112-117 (filtered) — pass:  includeFuture: state.view === "sessions"
  // tableHTML row: append `<small class="badge">Future</small>` when new Date(s.date) > Date.now()
  ```
- **Done when:** check `A4` passes.

<a id="a5"></a>
### A5 · Durability: three ways the whole history can disappear or leak · S

This is documented platform behaviour, so it isn't reproducible in headless Chromium, but it applies to real users:

1. **Safari deletes the data.** WebKit's tracking prevention deletes *all script-writable storage*, including `localStorage`, for a site after
   **7 days of Safari use without the user interacting with that site**. Home-Screen web apps are exempt.
2. **The origin is shared.** Every GitHub Pages *project* site of an account is served from the same origin (`https://mahanthadeeksha-sb.github.io`),
   so **any other Pages project on that account can read `localStorage["ai-usage-sessions-v1"]`**, including any third-party scripts those pages load.
3. **Nothing reminds the user to back up.** The README advises backups, but the app never asks.

- **Fix (all S):**
  ```js
  // after the first successful personal save (src/main.js persist(), :146):
  navigator.storage?.persist?.().then((ok) => localStorage.setItem("orbit-storage-persisted", String(ok)));
  // in download() (src/main.js:497): when state.mode === "personal", localStorage.setItem("orbit-last-backup", Date.now())
  // in shell(): if personal sessions exist and the last backup is > 14 days old (or missing), show a banner:
  //   "Last backup: 3 weeks ago · Export now"   (Safari users: "Safari may clear site data after 7 days away")
  ```
  - Settings → "Your data" card: show "Storage: persistent ✓ / best-effort" and "Last backup: <date>".
  - Give Orbit **its own origin**: a custom (sub)domain on Pages, or Cloudflare Pages (`*.pages.dev`, already documented in the README).
    Then namespace keys (`orbit:sessions:v1`) and migrate once.
  - Ship the PWA ([D2](#d2)) so iOS users can install it and escape the 7-day rule.

---

## 4. P1 — Broken or painful for real users

<a id="b1"></a>
### B1 · Search breaks IME input and re-renders the entire page on every keystroke · M

- **Where:** `src/main.js:347-356` (handler), `src/main.js:289-296` (table renders *all* rows), unused `state.showAll` (`src/main.js:109`).
- **Evidence:**
  - **IME:** composing にほ → 日本 in the search box yields **`ににほ日本`**. A plain `<input>` control yields `日本`. The input element is destroyed mid-composition.
  - **Lag:** each keystroke rebuilds the stats, chart, donut and table:

    | Personal sessions | Rows rendered (All time) | Per keystroke |
    |---|---|---|
    | 500 | 500 | 170–210 ms |
    | 1,000 (≈ 1 year at 3/day) | 1,000 | **330–400 ms** |
    | 2,500 | 2,500 | **820–970 ms** |
    | 10,000 (the import limit) | 10,000 · 52,557 DOM nodes | **4–11 s** |

    Google treats interaction latency over 200 ms as "needs improvement" and over 500 ms as "poor". On mobile, the 120-row demo Sessions page is about 11,000px tall.
- **Fix:**
  1. **IME + debounce:**
     ```js
     // src/main.js — replace lines 347-356
     const search = document.querySelector("#search");
     let searchTimer;
     const applySearch = () => { state.query = search.value; state.limit = PAGE_SIZE; renderResults(); };
     search?.addEventListener("input", (e) => {
       if (e.isComposing) return;            // let the IME finish first
       clearTimeout(searchTimer);
       searchTimer = setTimeout(applySearch, 120);
     });
     search?.addEventListener("compositionend", applySearch);
     ```
  2. **Never re-render the `<input>`:** split `tableHTML` into `tableShell()` (heading, toolbar and `#search`, rendered once per view) and `tableRows(items)`
     (tbody + footer, rendered into `<div data-region="rows">`). `renderResults()` updates only `[data-region]` containers.
  3. **Paginate:** replace `showAll` with `state.limit = PAGE_SIZE` (50). `tableRows` renders `items.slice(0, state.limit)` plus a
     "Show 50 more" button. Reset the limit in `navigate()` and whenever filters change.
  4. **Sort once:** `filterSessions` already sorts (`src/data.js:204`), so drop the second sort at `src/main.js:290`.
- **Done when:** check `B1` passes (same input node, IME gives `日本`, no long task ≥ 100 ms at 1,000 sessions).

<a id="b2"></a>
### B2 · The search box inside "Recent sessions" silently filters the whole dashboard · S

- **Where:** filters rendered at `src/main.js:293`, applied to everything via `filtered()` at `:112-117` and `:322`.
- **Evidence:** typing "bug" in the table's search changes **Total sessions 120 → 6**, the chart, and the donut ("1 AI tools used"), even though the field sits
  at the bottom of the page inside the table card (check `B2`).
- **Fix (recommended split):**
  - **Provider filter becomes global:** move `#provider-filter` from the table toolbar (`:293`) to `.section-toolbar` (`:327`) next to the date range.
    Stats, chart and table all follow it, and it reads as a page-level control.
  - **Search becomes table-only:** totals stay put.
  ```js
  // renderContent():
  const scoped = filterSessions(all(), { days: state.days, provider: state.provider }); // stats, chart, mix
  const rows = state.query ? filterSessions(scoped, { days: 0, query: state.query }) : scoped; // table only
  ```
- **Done when:** check `B2` passes.

<a id="b3"></a>
### B3 · The usage chart is letterboxed on wide screens and unreadable on tablets · S

- **Where:** `src/main.js:246` (`const W = window.innerWidth < 760 ? 420 : 760`), `src/style.css:639-649`, `:1326-1328`, `:1527-1529`, `:1670-1673`, `:1961-1963`.
- **Evidence:** the SVG is drawn in a fixed 760-unit viewBox inside a fixed-height box, then scaled to fit (`meet`):

  | Width | View | Empty gutter each side | Axis text rendered at |
  |---|---|---|---|
  | 1920 | Insights | **298px** (plot uses 54% of the card) | 11.2px |
  | 1366 | Insights | **168px** | 8.9px |
  | 1920 | Overview | 67px | 11.2px |
  | 900 (tablet) | Overview | 29px blank *vertical* band | **5.4px** |
  | 390 | Both | 0 | 8.7px |

  Evidence images: [01](docs/audit/01-chart-letterbox-insights-1366.jpg), [02](docs/audit/02-chart-axis-5px-tablet-900.jpg). The window width is also only read at render time,
  so resizing or rotating doesn't re-layout.
- **Fix:** draw at the real pixel width so 1 SVG unit = 1 CSS px. Re-draw only the `<svg>` on resize.
  ```js
  // state (src/main.js:100): add   chartWidth: {},
  // src/main.js:246:
  const W = Math.max(280, Math.round(state.chartWidth[state.view] ?? 760)),
  // Split chartHTML into the panel + chartSVG(items) (the <svg>…</svg> part of :262-271), then after renderContent():
  let chartObserver;
  function observeChart(items) {
    chartObserver?.disconnect();
    const wrap = document.querySelector(".chart-wrap");
    if (!wrap) return;
    chartObserver = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (Math.abs(width - (state.chartWidth[state.view] ?? 0)) < 8) return;
      state.chartWidth[state.view] = width;
      entry.target.innerHTML = chartSVG(items); // panel, <select> and listeners stay intact
    });
    chartObserver.observe(wrap);
  }
  ```
  ```css
  /* src/style.css — replace every .usage-chart height rule (641, 1326-1328, 1527-1529, 1670-1673) */
  .usage-chart { width: 100%; height: auto; display: block; overflow: visible; }
  .usage-chart text { font-size: 12px; }   /* replaces :648 and :1961-1963 */
  ```
- **Done when:** check `B3` passes (gutter ≤ 2px and axis text ≥ 11px at 1920/1366/900/390 on both views).

<a id="b4"></a>
### B4 · Mobile drawer: invisible keyboard stops, no state, no way to dismiss · S

- **Where:** `src/main.js:171` (menu button), `:406-407` (toggle), `src/style.css:1558-1568`.
- **Evidence (390px):** the **first 6 Tab stops are off-screen sidebar links** (x = -223px). The menu button has no `aria-expanded`/`aria-controls`.
  Escape and clicking outside don't close the drawer. axe also flags the hidden-but-focusable links (`skip-link` rule) on all mobile views.
- **Fix:** (✅ CSS verified: the first Tab stop becomes the visible menu button)
  ```css
  @media (max-width: 760px) {
    .sidebar { visibility: hidden; transition: transform .2s, visibility 0s linear .2s; }
    .sidebar.is-open { visibility: visible; transition: transform .2s; }
  }
  ```
  ```js
  // src/main.js:171 — the button:
  // <button class="icon-btn mobile-menu" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false" data-action="menu">
  // src/main.js:406-407 — replace the toggle:
  menu: () => setDrawer(!document.querySelector("#sidebar").classList.contains("is-open")),
  // new:
  function setDrawer(open) {
    document.querySelector("#sidebar").classList.toggle("is-open", open);
    document.querySelector(".mobile-menu")?.setAttribute("aria-expanded", String(open));
    if (open) document.querySelector("#sidebar .nav-item.active")?.focus();
  }
  document.addEventListener("keydown", (e) => e.key === "Escape" && setDrawer(false));
  document.addEventListener("click", (e) => {
    const sb = document.querySelector("#sidebar");
    if (sb?.classList.contains("is-open") && !sb.contains(e.target) && !e.target.closest(".mobile-menu")) setDrawer(false);
  });
  ```
- **Done when:** check `B4` passes.

<a id="b5"></a>
### B5 · The session form is squeezed on phones (and iOS zooms in on every field) · XS · ✅ verified fix

- **Where:** `src/style.css:1253-1257` (`.form-grid { grid-template-columns: 1fr 1fr }`).
- **Evidence (360px):** columns resolve to **about 185px + 69px** (it varies slightly with the time shown) because `1fr` respects the date input's min-content width. "Activity" shows **"Writ"** and Duration is a sliver
  ([04](docs/audit/04-mobile-dialog-squeezed-360.jpg)). All inputs are 10–12px, so iOS Safari zooms the page on focus (it does this below 16px).
- **Fix:**
  ```css
  .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 420px) { .form-grid { grid-template-columns: 1fr; } }
  @media (max-width: 760px) {
    input, select, textarea, .search-field input, form input, form select { font-size: 16px; }
  }
  ```
  After: [12](docs/audit/12-after-css-patch-mobile-dialog-360.jpg). Check `B5` passes on the patched build.

<a id="b6"></a>
### B6 · On phones the sessions table hides Date/Tokens/Cost/Time and the edit/delete buttons · S · ✅ verified fix

- **Where:** `src/style.css:814-819` (`white-space: nowrap` 7-column table), `:811-813`.
- **Evidence (390px):** only "Session" and "AI tool" fit; the actions need horizontal scrolling that users don't discover ([05](docs/audit/05-mobile-table-cutoff-390.jpg)).
- **Fix:** card rows under 640px (verified at 360/390/640: title and actions on line 1, details on line 2, no horizontal scroll).
  ```css
  @media (max-width: 640px) {
    .sessions-panel table { white-space: normal; }
    .sessions-panel thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .sessions-panel tbody { display: block; }
    .sessions-panel tr { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 14px 18px; border-bottom: 1px solid #f5f2f7; }
    .sessions-panel td { display: block; padding: 0; border: 0; font-size: 12px; }
    .sessions-panel td:first-child { flex: 1 1 calc(100% - 72px); }
    .sessions-panel td:last-child { margin-left: auto; }
    .sessions-panel td:nth-child(n+2):nth-child(-n+6) { order: 3; }
    .sessions-panel td:nth-child(4)::after { content: " tokens"; }
    .text-link { white-space: nowrap; }
  }
  ```
  After: [11](docs/audit/11-after-css-patch-mobile-table-390.jpg). Check `B6`.

<a id="b7"></a>
### B7 · The sidebar is clipped on short laptop screens · XS · ✅ verified fix

- **Where:** `src/style.css:84-95` (`position: fixed`, no overflow).
- **Evidence:** the sidebar needs 738px. At 1280×640 and 1440×700 the profile row is cut off and can't be scrolled to ([03](docs/audit/03-sidebar-clipped-1280x640.jpg)).
  Browser chrome on a 768px laptop leaves about 650px.
- **Fix:** `.sidebar { overflow-y: auto; }`. Optionally tighten spacing with `@media (max-height: 760px) { .workspace { margin: 20px 0; } .sidebar-bottom { padding-top: 20px; } }`.

<a id="b8"></a>
### B8 · 35 colour pairs fail WCAG AA contrast, including the primary button · S · ✅ verified fix

- **Where:** throughout `src/style.css`; the primary button is `src/style.css:402-407` (white on `#8d72d7` = **3.80:1**).
- **Evidence:** axe-core flags 35 unique foreground/background pairs (worst: `summary > span` at **1.91:1**, chart legend 2.28:1, settings hints 2.40:1, badges 2.47:1).
  The extension popup has the same problem: 10 of its 13 text colours fail (`.transfer` 2.83:1, `#total span` 3.04:1).
- **Fix:** [`docs/audit/contrast-map.json`](docs/audit/contrast-map.json) holds a same-hue, lower-lightness replacement for every failing colour
  (36 for the site, 11 for the popup, including button fills `#8d72d7 → #8062d2` and `#8770c7 → #7e65c3`). **Verified: axe failures 347 → 0.**
  The only non-text uses being changed are the primary button's fill and border, which is intended. Apply it with:
  ```bash
  node -e 'const fs=require("fs");const maps=require("./docs/audit/contrast-map.json");for(const [file,map] of Object.entries(maps)){if(file.startsWith("$"))continue;let s=fs.readFileSync(file,"utf8");for(const [a,b] of Object.entries(map))s=s.replace(new RegExp(a,"gi"),b);fs.writeFileSync(file,s);console.log("updated",file)}'
  ```
  Preview of the result (with B9): [10](docs/audit/10-after-css-patch-desktop-1366.jpg). The look stays calm and lavender, just legible.
- **Done when:** check `B8` passes (requires `npm i -D axe-core`).

<a id="b9"></a>
### B9 · Most text is 7–11px · S · ✅ verified fix

- **Where:** 78 `font-size` declarations below 11px in `src/style.css` (2 × 7px, 14 × 8px, 31 × 9px, 31 × 10px), plus 22 × 11px.
- **Evidence:** **82%** of visible text is under 12px at 1366px and **84%** at 390px. The smallest is 7px ("Only you can see your data" on mobile, the workspace subtitle at ≤1000px).
  Lighthouse's mobile best-practices audit fails "Document uses legible font sizes" with only **10.24%** legible.
- **Fix:** enforce a 12px floor. This was verified to give 0% sub-12px text with no layout breakage:
  ```bash
  sed -i -E 's/font-size: (7|8|9|10|11)px/font-size: 12px/g' src/style.css
  ```
  One side effect: "Make space for your ideas" wraps in the sidebar, so add `.workspace small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`.
  Better long-term: tokens `--fs-xs: 12px; --fs-sm: 13px; --fs-md: 14px; --fs-lg: 16px; --fs-xl: 22px; --fs-2xl: 29px` (see [C6](#c6)).
  Apply the same floor to `extension/popup.css` (8–11px today).
- **Done when:** check `B9` passes.

<a id="b10"></a>
### B10 · Keyboard focus is lost after deleting or editing a session · XS

- **Where:** `src/main.js:470-483` (delete), `:447-448` (edit save).
- **Evidence:** after a confirmed delete, `document.activeElement` is `<body>`, so keyboard and screen-reader users are thrown to the top of the page (check `B10`).
- **Fix:**
  ```js
  // deleteSession(id): capture the row index before confirming
  const index = [...document.querySelectorAll("[data-delete]")].findIndex((b) => b.dataset.delete === id);
  // …after renderContent() inside the confirm callback:
  const rows = [...document.querySelectorAll("[data-delete]")];
  (rows[Math.min(index, rows.length - 1)] ?? document.querySelector("#main h1"))?.focus();
  // after an edit save: document.querySelector(`[data-edit="${CSS.escape(item.id)}"]`)?.focus();
  // shell() src/main.js:172 — give the page <h1> tabindex="-1" so it can take focus.
  ```

<a id="b11"></a>
### B11 · Destructive confirmations look like ordinary actions · XS

- **Where:** `src/main.js:460-469` (`confirmAction` always renders `button primary`), called at `:471` and `:485`.
- **Evidence:** "Clear personal data" uses the same purple primary button as "Import sessions" ([06](docs/audit/06-destructive-confirm-not-red.jpg)).
- **Fix:** add `tone = "primary"` as a 5th parameter and render `class="button ${tone}"`. Pass `"danger-solid"` from `deleteSession` and `clearPersonal`.
  ```css
  .button.danger-solid { background: #b4233c; border-color: #a01f35; color: #fff; } /* white text 6.47:1 */
  .button.danger-solid:hover { background: #a01f35; }
  ```
  Keep Cancel auto-focused (already the case). Check `B11` passes when the accept button's class contains "danger".

<a id="b12"></a>
### B12 · Category colours change meaning when you switch date ranges · XS

- **Where:** `src/main.js:312`, where colour is taken from rank index `[...][i]` after sorting by minutes.
- **Evidence:** "Writing" is purple for 7 days and peach for 90 days; "Research" swaps the other way (check `B12`).
- **Fix:**
  ```js
  const CATEGORY_COLORS = { Coding: "#9b83e9", Writing: "#dfa085", Research: "#8db8a7", Learning: "#8fa9d3", Other: "#c7c6d0" };
  // in the bar template: background:${CATEGORY_COLORS[c.name]}
  ```

<a id="b13"></a>
### B13 · "1 sessions" grammar bugs (6 places) · XS

- **Where:** `src/main.js:287` (`${p.count} sessions`), `:295` (`of ${items.length} sessions`), `:312` (`of your ${s.sessions} sessions`),
  `:315` (`personal sessions saved`), `:550` (`sessions will be merged`), `:557` (`sessions imported`).
- **Evidence:** with one session the UI shows "100%1 sessions", "1 of 1 sessions", "1 personal sessions saved" (check `B13`).
- **Fix:** `const plural = (n, one, many = one + "s") => \`${n.toLocaleString()} ${n === 1 ? one : many}\`;` and use it at all six sites.
  The legend at `:287` also needs a space before the count.

<a id="b14"></a>
### B14 · Money and time formatting mislead · XS

- **Where:** `src/main.js:63-67`.
- **Evidence:** `money(0.004)` → **"$0.00"** for a real cost; "Other AI" rows show "$0.00" when there is simply no rate; `money(1234.5)` → "$1234.50" (no separator);
  `duration(0.4)` → **"0m"**, so a 20-second tracked visit reads as nothing.
- **Fix:**
  ```js
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const money = (n) => usd.format(n);                                   // totals and chart axis
  const cellMoney = (n) => (n === 0 ? "—" : n < 0.005 ? "<$0.01" : usd.format(n)); // table cells (:294)
  const duration = (n) => {
    if (n > 0 && n < 0.5) return "<1m";
    const m = Math.round(n);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };
  ```

<a id="b15"></a>
### B15 · The first run is a wall of zeros · M

- **Where:** `src/main.js:328` (overview always renders stats, chart, mix and table).
- **Evidence:** a new personal workspace shows 0 / 0 / $0.00 / 0m, a flat chart, "0 AI tools used" and Claude/ChatGPT/Gemini at 0%. The only call to action sits at
  y≈1,200px, below the fold on a 1366×768 laptop ([07](docs/audit/07-first-run-wall-of-zeros-1366x768.jpg)).
- **Fix:** when `state.mode === "personal" && !state.personal.length`, render an onboarding panel instead:
  ```js
  `<section class="panel onboarding" data-onboarding>
     <h2>Let’s start your orbit.</h2>
     <div class="onboarding-grid">
       <button class="onboarding-card" data-action="add">${icon("plus")}<strong>Log your first session</strong><small>About 20 seconds. Tokens are optional.</small></button>
       <a class="onboarding-card" href="#settings">${icon("clock")}<strong>Track time automatically</strong><small>Private browser extension, off until you enable it.</small></a>
       <button class="onboarding-card" data-action="import">${icon("upload")}<strong>Restore a backup</strong><small>Import an Orbit JSON export.</small></button>
     </div>
     <button class="text-link" data-action="demo">Peek at the demo first ${icon("arrow")}</button>
   </section>`
  ```

---

## 5. P2 — Robustness, code health, SEO, security hygiene

<a id="c1"></a>
### C1 · localStorage stores pretty-printed JSON (+41% size) · XS
`saveSessions` (`src/data.js:314-323`) reuses `exportData`, which indents by 2 (`:290`). That's 341 vs 235 bytes per session, and **3.07 MB vs 2.17 MB at 10k sessions**,
eating into the roughly 5 MB per-origin quota.
**Fix:** `export function serialize(sessions, { pretty = false } = {})`. Storage uses the compact form; downloads keep `pretty: true`. Check `C1`.

### C2 · Misleading error once you reach 10,000 sessions · XS
Saving a 10,001st session fails with **"Import up to 10,000 sessions at a time."** (`src/data.js:244-246`, reached via `exportData` from `saveSessions`), even when nothing is being imported.
Merging an import into existing data hits the same message. **Fix:** pass a context to `normalizeCollection` and say
"This browser can keep up to 10,000 sessions. Export and clear older ones to add more." Pre-check `merged.size` in `importFile` (`src/main.js:553`).

### C3 · Two different import size limits · XS
The UI rejects files over **10,000,000 bytes** ("smaller than 10 MB", `src/main.js:542`); the parser allows **20 MiB** (`src/data.js:265`). **Fix:** export one `MAX_IMPORT_BYTES = 10 * 1024 * 1024` from `data.js` and use it in both places.

### C4 · Storage key hard-coded twice · XS
`"ai-usage-sessions-v1"` is repeated at `src/main.js:391` and `:568`, although `STORAGE_KEY` is exported (`src/data.js:33`). Import it.

<a id="c5"></a>
### C5 · Duplicated constants that already drift · XS
- Category list copied at `src/main.js:299` and `:422`; it lives at `src/data.js:35` but isn't exported. Export `CATEGORIES`.
- The form allows a title of `maxlength="120"` and model `"80"`; validation allows **140** and **100** (`src/data.js:90`, `:136`). Export `LIMITS` and use it in the form.

<a id="c6"></a>
### C6 · CSS has grown by patching · M
- **193 distinct hex colours**, while 3 of the 5 custom properties are never used (`--purple`, `--muted`, `--text`), and there are 6 `!important`.
- **Dead responsive rules (verified):** `.stat-value` renders at **31px at 1700/1300/1100/900px**, so the intended 36px (≥1600, `:1323`), 27px (≤1200, `:1387`) and
  23px (≤1000, `:1497`) never apply. The late override at `:1866` wins on source order.
- The override layers at `:1792-1972` restate earlier selectors, and the block at `:1966-1972` is minified onto single lines.
- **Fix:** introduce ~14 semantic tokens (`--bg --surface --surface-2 --border --text-1 --text-2 --text-3 --accent --accent-strong --accent-soft --danger --success --chart-1..5`).
  Fold the override layers back into the original rules, delete dead rules, and add Prettier + Stylelint. This is a prerequisite for dark mode ([D8](#d8)).

<a id="c7"></a>
### C7 · Route and landmark semantics · S
Verified missing (check `C7`):
- `document.title` is always "Orbit — Your AI, in perspective". Set it in `navigate()` (`src/main.js:372-380`): `` `${titles[state.view]} · Orbit` ``.
- No `aria-current="page"` on the active nav item (`:167`).
- No `aria-pressed` on the date-range buttons (`:180`).
- No `scope="col"` on `<th>` (`:294`).
- Dialogs have no `aria-labelledby`. Give the `<h2>`s ids and set them on both dialogs.
- No skip link. **Gotcha:** because of hash routing, `<a href="#main">` would trigger `navigate()` and bounce to Overview. Use
  `<button class="skip-link" data-action="skip">Skip to content</button>` with `skip: () => document.querySelector("#main h1").focus()`.
- Move focus to the `<h1>` (with `tabindex="-1"`) after route changes so screen readers announce the new view.
- The chart's only data access is `<title>` tooltips on invisible circles (mouse only). Add a `<details><summary>View data</summary><table>…` under the chart,
  and an `aria-label` on the donut that lists the shares ("Claude 50%, ChatGPT 30%, …").

<a id="c8"></a>
### C8 · `index.html` head: no social preview, PWA, touch icon, noscript or CSP · XS · ✅ CSP verified
Verified missing (check `C8`). Add:
```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Orbit — Your AI, in perspective" />
<meta property="og:description" content="A private dashboard for your AI time, tokens and costs. No account, no server." />
<meta property="og:image" content="https://<your-pages-host>/og-image.png" /> <!-- absolute URL, 1200×630 -->
<meta name="twitter:card" content="summary_large_image" />
<link rel="manifest" href="./manifest.webmanifest" />
<link rel="apple-touch-icon" href="./apple-touch-icon.png" />  <!-- 180×180 PNG -->
<noscript>Orbit needs JavaScript to show your private dashboard. Your data never leaves this browser.</noscript>
```
**CSP, injected at build time only** (the dev server's HMR websocket would be blocked). The policy below was tested on the production build with **0 violations**;
JSON/CSV downloads and fonts still work. **Gotcha found while testing:** Vite inlines one small font subset as a `data:` URI, so `font-src` needs `data:`.
```js
// vite.config.js (new file)
import { defineConfig } from "vite";
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
export default defineConfig({
  plugins: [{
    name: "orbit-csp",
    apply: "build",
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  }],
});
```
`'unsafe-inline'` in `style-src` is required by the inline `style="…"` attributes (donut, bars, legend dots). Also: `npm run dev` binds to `0.0.0.0` (`package.json:7`), so the dev
server is reachable from your LAN. Prefer `--host 127.0.0.1` unless you're testing on a phone.

### C9 · The chart never labels today · XS
`src/main.js:271` skips the last point (`i < rows.length - 1`), so with 30 days the last label is "Oct 28" and with 7 days it's "Oct 31" when today is Nov 1 (check `C9`).
**Fix:** count ticks back from the end: `(rows.length - 1 - i) % every === 0`. That labels today and keeps even spacing.

### C10 · "All time" silently truncates to 90 days · S
`src/main.js:223-238` caps the chart at 90 days. **Fix:** bucket by week when the range is over 90 days and by month when it's over 2 years. Add `bucket: "day" | "week" | "month"` to `dailyUsage`.

### C11 · CSV export is spreadsheet-unfriendly · XS
`src/main.js:509-534`: there's no UTF-8 BOM, so Excel on Windows garbles "Café"; dates are UTC ISO strings; there's no `id` column; and costs are raw floats (`0.00430125`).
```js
const keys = ["id", "title", "provider", "model", "category", "date", "localDate", "duration", "inputTokens", "outputTokens", "cost"];
const row = (s) => ({ ...s, localDate: new Date(s.date).toLocaleString("sv-SE").slice(0, 16), cost: +s.cost.toFixed(6) });
download("﻿" + [keys.join(","), ...all().map((s) => keys.map((k) => cell(row(s)[k])).join(","))].join("\r\n"), "csv");
```

<a id="c12"></a>
### C12 · No CI on pull requests and no UI tests · M
`deploy.yml` only runs on pushes to `main`, so PRs #1 and #2 merged with **zero checks**. `src/main.js` has no tests.
```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches-ignore: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - name: Audit acceptance checks (grow --only as fixes land)
        run: |
          npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
          for i in $(seq 1 30); do curl -sf http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
          node docs/audit/check.cjs --strict --only=A1,A2
```
This needs `npm i -D playwright axe-core`. Name UI specs `tests/e2e/*.spec.js`: `node --test` only auto-runs `*.test.js` (plus `test/` dirs), so specs stay out of the unit run.
Also add Prettier + ESLint (flat config) with a `npm run lint` step. Check `C12`.

### C13 · Dependencies · S
`vite` 7.3.7 → **8.3.5** is available (`npm outdated`). Its engines (`^20.19.0 || >=22.12.0`) match `package.json`. Upgrade on a branch, then run tests, the build and `check.cjs`.
The other dependencies are current. Add `.github/dependabot.yml` for `npm` and `github-actions` (weekly) so Action versions get bumped by PRs rather than guesswork.

### C14 · Repository hygiene · XS
- The GitHub description is **"hii"**. Suggestion: "Orbit: a private, local-first dashboard for your AI time, tokens and cost." Also set the website URL and topics.
- **No LICENSE**, so the code is all-rights-reserved by default. Add MIT if you want others to reuse it.
- README: add a screenshot (`docs/audit/08-baseline-demo-overview-1366.jpg` works) and the live link.
- The repo name **`web...` is fragile.** GitHub-Flavoured Markdown's autolinker excludes trailing `.` from links, so a pasted `https://github.com/MAHANTHADEEKSHA-SB/web...`
  links to `/web`. Windows naming rules also disallow folder names ending in a period. Renaming to `orbit` changes the Pages path to `/orbit/` but **keeps the same origin**,
  so users' saved data survives. Update the hard-coded link at `src/main.js:317`.

---

## 6. Browser extension

Verified by loading it unpacked in Chromium 153: it loads with no errors, toggling works, and the export is accepted by the dashboard.

| ID | Finding | Where | Fix | Effort |
|---|---|---|---|---|
| <a id="e1"></a>E1 | **No icons.** `chrome.runtime.getManifest()` has no `icons` or `action.default_icon`, so Chrome shows a generic letter. | `extension/manifest.json` | Add 16/32/48/128 **PNG** icons (SVG isn't accepted for manifest icons) rendered from `public/favicon.svg`; declare `icons` + `action.default_icon`. | S |
| E2 | The packager only zips **top-level** files, so an `icons/` folder would be silently dropped. | `scripts/package-extension.mjs:10-15` | `readdir(directory, { recursive: true, withFileTypes: true })`, build paths from `entry.parentPath`. | XS |
| E3 | **Alarm reset on every popup poll.** `ensureAlarm()` runs per message (`background.js:88`), and `alarms.create` replaces the alarm. Verified: each 5-second poll pushed the 30-second alarm back about 4.2s. | `extension/background.js:52-55` | `if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });` | XS |
| E4 | Popup contrast: 10/13 text colours fail AA; text is 8–11px. | `extension/popup.css` | `docs/audit/contrast-map.json` → `"extension/popup.css"` (same one-liner as B8) + 12px floor. | XS |
| E5 | The popup brand mark is the Unicode `◌`; the site uses the orbit logo. | `extension/popup.html:11` | Inline the `favicon.svg` artwork. | XS |
| E6 | The popup only shows "Today" and has no link back to the dashboard. | `extension/popup.html` | Add a 7-day mini bar chart from `state.buckets`, plus an "Open Orbit ↗" link (dashboard URL stored in `chrome.storage.local`, set on first sync). | S |
| E7 | Idle threshold is fixed at 60s, so reading a long answer pauses tracking. | `extension/background.js:30` | Let users pick 1 / 2 / 5 min (stored in state) in the popup. | XS |
| E8 | Coverage: no DeepSeek, Mistral, Grok, AI Studio, NotebookLM, Poe or Meta AI. Perplexity and Copilot collapse into "Other AI" (`core.js:78-80`). | `manifest.json:8-16`, `core.js:2-10` | Put extra hosts in **`optional_host_permissions`**, requested per site from the popup via `chrome.permissions.request` (no new install-time warning). Promote Perplexity/Copilot to first-class `PROVIDERS` (see D4). Verify each domain when adding. | S |
| E9 | Distribution: Developer-mode unpacked only. Two version sources (`package.json` + `manifest.json`). | — | Chrome Web Store (one-time developer fee) and Edge Add-ons (free) give auto-updates and no Developer-mode warning. Firefox needs a `background.scripts` fallback + `browser_specific_settings.gecko.id`. Have the packager stamp `package.json`'s version into the zipped manifest. | M |

---

## 7. Upgrades & new features (creative roadmap)

Ordered by value ÷ effort. All of these keep the promise of **no server, no account, no network calls**.

<a id="d1"></a>
### D1 · One-click "Sync from extension" (kills the export → import loop) · M
Today the user must export a JSON file from the popup and import it on the site, every time.
- `manifest.json`: add a fixed `"key"` so the unpacked extension ID is stable (generate it with `openssl genrsa 2048 | openssl rsa -pubout -outform DER | base64 -w0`).
  Add `"externally_connectable": { "matches": ["https://<your-pages-host>/*", "http://localhost/*", "http://127.0.0.1/*"] }`.
- `background.js`: a read-only external endpoint:
  `chrome.runtime.onMessageExternal.addListener((m, _s, respond) => { if (m?.type !== "export") return false; serialize(async () => respond({ ok: true, data: makeExport(await readState()) })); return true; });`
- Dashboard: a "Sync from extension" button that feature-detects `globalThis.chrome?.runtime?.sendMessage`, calls
  `chrome.runtime.sendMessage(EXTENSION_ID, { type: "export" })`, and feeds the result through the existing `parseImport` + merge. Stable IDs make it idempotent.
  Add an opt-in "Sync automatically when I open Orbit" setting.

<a id="d2"></a>
### D2 · Installable, offline PWA · S
`public/manifest.webmanifest` (name, `short_name: "Orbit"`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, theme `#8062d2`, icons 192/512 + maskable 512).
Add a small `public/sw.js`: cache-first for hashed `/assets/*`, network-first for `index.html`. Register it only in production (`import.meta.env.PROD`).
Benefits: works offline, launches like an app, and **iOS Home-Screen installs are exempt from Safari's 7-day storage deletion** ([A5](#a5)).

### D3 · Live session timer · M
A "Start session" button in the top bar stores `{ startedAt, provider }` in `localStorage["orbit-timer"]` (survives reloads) and shows `12:34 · Stop`.
Stop opens the log dialog pre-filled with date = `startedAt` and duration = elapsed. Shortcut `T`. An optional, opt-in gentle nudge at 45 minutes via the Notification API fits the "mindful" voice.

### D4 · Pricing that stays honest · M
- A per-model rate table: `MODELS = [{ id, provider, name, inputRate, outputRate, reviewedAt }]`, a model `<select>` instead of free text, and a "Rates last reviewed: <date>" note.
  Verify every rate on the provider's pricing page when you write it; today's rates are per-provider (`src/data.js:2-31`) and the demo still says "GPT-4o" (`:342`).
- User-editable rates and **custom providers** (name, colour, rates) in Settings, stored as `orbit-providers-v1`.
- **Subscription mode:** "ChatGPT Plus, $20/month" turns cost into **cost per hour of use** ("Your plan cost $1.85/hour this month"). That's a genuinely useful insight the app can uniquely give.

### D5 · Insights 2.0 · M
- Period-over-period deltas on all four stat cards ("▲ 12% vs previous 30 days"). The `up` icon is already defined but unused (`src/main.js:26`).
- Current and longest streak of active days.
- Weekday × hour heatmap (7×24) built from *logged* sessions only, since tracked daily totals carry midnight timestamps.
- Cost per hour and tokens per minute by provider; weekly category trend; most-used model.

### D6 · Mindful goals & budgets · S
Settings: "Weekly AI time goal" (a cap or a target) and "Monthly spend budget". The Overview gets a progress ring, with a soft banner at 80% and 100%.
This fits the brand line in the footer: "A little intention goes a long way."

### D7 · Richer sessions (schema v2) · M
Optional `project` (≤ 60 chars, autocompletes from history), `notes` (≤ 500), `rating` 1–5 ("How useful was it?"), and `tags[]`.
Bump the export to `version: 2`; `parseImport` accepts 1 and 2, migrating v1 with defaults. **Note:** `validateSession` drops unknown fields (`src/data.js:84`),
so v2 exports imported into an *old* build lose the new fields. Say so in the release notes.

<a id="d8"></a>
### D8 · Dark mode · M (after C6)
`@media (prefers-color-scheme: dark)` plus a toggle using the already-defined but unused `sun` icon (`src/main.js:42`), stored as `orbit-theme`.
Add `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#17141d">`.

### D9 · "Orbit Wrapped": a monthly share card · M
A 1080×1350 PNG drawn on `<canvas>` after `document.fonts.ready`: total time, top tool, longest streak, top category, busiest day.
Share via `navigator.share({ files })` where available, otherwise download. Generated locally; nothing is uploaded.

### D10 · Keyboard-first · S
`N` new session, `/` search, `g o` / `g s` / `g i` / `g ,` to navigate, `?` for a shortcut sheet, `⌘/Ctrl-K` command palette (export, import, switch demo, start timer).

### D11 · Undo instead of confirm · S
Delete removes immediately and shows a toast "Session removed · Undo" (10s). Import snapshots `state.personal` first: "Imported 42 · Undo".
Keep the confirm only for "Clear all".

### D12 · Shareable filtered views · XS
Store filters in the hash: `#sessions?days=90&provider=claude&q=bug`, parsed in `navigate()` with `new URLSearchParams(location.hash.split("?")[1])`.

### D13 · Automatic backup to a file you choose · M (Chromium progressive enhancement)
"Back up automatically to…" calls `showSaveFilePicker()`, stores the `FileSystemFileHandle` in IndexedDB, and writes the export after each save
(`queryPermission`/`requestPermission` once per session). Pointing it at an iCloud/Dropbox/OneDrive folder gives a cross-device backup with zero servers.

### D14 · A signature "orbit" visual · M
The brand is *Orbit*, but the mix chart is a generic donut. Replace it, or offer a toggle, with an animated SVG system: each provider is a planet on its own ring
(`r = 50, 85, 120, 155` by rank), sized `6 + 18·√share`, orbiting at `60s × (rank + 1)` per revolution. Focus or hover shows details, and it renders static under
`prefers-reduced-motion`. It would be memorable and on-brand, with no new dependencies.

---

## 8. Suggested execution plan

| Sprint | Goal | Items | Estimate |
|---|---|---|---|
| 1 | Stop data loss; make it readable | A1, A2, A4, B5, B6, B7, B8, B9, B11, B12, B13, B14, C4, C9, E3 | ~1 day |
| 2 | Fast, accessible, correct | B1, B2, B3, B4, B10, C1, C2, C3, C5, C7, C11 | ~2 days |
| 3 | Trust & quality gates | A3, A5, B15, C8 + D2, C12, C13, C14, E1, E2, E4, E5 | ~2 days |
| 4 | Delight (pick 2–3) | D1, D3, D4, D5, D6, D8 (needs C6), D9, D14 | ~1 day each |

After each sprint, run `node docs/audit/check.cjs`. The checks tied to that sprint's IDs should flip to PASS.

---

## 9. Acceptance checks

```bash
npm run build
npx vite preview --host 127.0.0.1 --port 4173 --strictPort &   # leave running
node docs/audit/check.cjs              # report (add --strict to exit 1 on failure)
node docs/audit/check.cjs --only=B3    # one finding
```
It needs `playwright` (preinstalled in Claude Code cloud sessions; locally `npm i -D playwright && npx playwright install chromium`). B8 also needs `axe-core`.

**Baseline on `41fc42a`: 0 passed · 26 failed.** On the throwaway build with the CSS fixes applied (B5–B9, plus B4's CSS half), B5, B6, B7, B8 and B9 pass.
B4 still fails until its JavaScript part (`aria-expanded`, Escape) lands, which confirms the checks catch partial fixes.

| ID | What it asserts |
|---|---|
| A1 | A session logged while the demo is showing survives a reload |
| A2 | The dialog stays open on drag-select-out and on a backdrop click with edits |
| A3 | One logged + tracked 30-minute session shows "30m" |
| A4 | A future-dated session is visible in Sessions → All time |
| B1 | Same `<input>` node after typing; IME gives `日本`; no long task ≥ 100 ms at 1k sessions |
| B2 | Table search doesn't change totals (or filters live outside the table) |
| B3 | Chart gutter ≤ 2px and axis ≥ 11px at 1920/1366/900/390 |
| B4 | First mobile Tab stop is visible; `aria-expanded`; Escape closes |
| B5 | Form grid columns equal at 360px |
| B6 | Edit/delete in the viewport at 390px |
| B7 | Sidebar profile reachable at 1280×640 |
| B8 | 0 axe colour-contrast nodes (4 views × 2 modes) |
| B9 | ≤ 5% of text under 12px (desktop and mobile) |
| B10 | Focus not on `<body>` after delete |
| B11 | Destructive confirm button is danger-styled |
| B12 | Category colours stable across ranges |
| B13 | No "1 sessions" |
| B14 | No "$0.00" cells |
| B15 | Onboarding instead of zero-valued stats on first run |
| C1 | Compact JSON in storage |
| C7 | Per-view titles, `aria-current`, `aria-pressed`, `th scope`, labelled dialogs |
| C8 | OG tags, manifest, touch icon, noscript |
| C9 | Last x-axis label is today |
| C12 | A workflow triggers on `pull_request` |
| E1 | Manifest PNG icons 16/32/48/128 exist |
| E2 | Packager reads sub-folders |

---

## 10. Follow-up review: observed AI usage (`main` @ `5c223cd`)

PR #5 added extension v1.1.0 (active time + observed send actions, `extension/content.js`) and reshaped the dashboard around time and sends.
It deployed with run #6 (2026-11-01 11:13 UTC). I re-ran the 26 checks on that commit (**0/26**, so every finding above still applied) and reviewed the
new code and UI with realistic data: 21 days of extension records for four tools plus a few manual API sessions.

**The new code is careful:** sends are counted from trusted events on recognised controls only, prompt text is never read, Stop/disabled
controls and IME composition are excluded, duplicates are suppressed twice (750 ms window + event IDs), and unknown values stay `null`
instead of zero. 38 well-targeted tests cover it. The issues below are mostly about presentation.

| ID | Finding | Evidence / where | Fix | Status |
|---|---|---|---|---|
| N1 | **The demo doesn't show the headline feature.** "Observed sends" reads "—" with "Import from the updated extension"; the column is all dashes; the sends chart says "No observed send data". | `createDemoSessions` (`src/data.js`) makes manual sessions only | Give the demo extension-style daily records (time + sends) for the browser tools, and keep manual sessions for API/other tools, which tells the real story | `feature/visual-polish` |
| N2 | **Tracked rows repeat "Not measured" twice.** 112 such cells on Sessions for 61 records; the table grew to 8 columns. | `tableHTML` (`src/main.js`) | Muted "—" with a tooltip, plus one line under the table explaining it; phones omit them (done in B6) | `feature/visual-polish` |
| N3 | **The activity breakdown is meaningless for tracked time.** Every extension record has category "Other", so Insights shows "Other 43h 38m" and "Other is where you spent the most time." | `insightsHTML` (`src/main.js`) | When tracked time exists, break attention down **by tool** (record site name), keep categories for manual logs | `feature/visual-polish` |
| N4 | **Daily totals are called "sessions".** "19 sessions" in the mix legend, "Recent sessions" listing "Claude · browser activity", "19 of your 61 sessions". | `breakdownHTML`, `tableHTML`, `insightsHTML` | Say "entries" for mixed lists and "days" for tracked shares | `feature/visual-polish` |
| N5 | **The demo chart looks synthetic.** Daily counts follow `(offset*7+3) % 5`, a visible 5-day saw-tooth. | `createDemoSessions` | Weekday rhythm + gentle trend + seeded variation | `feature/visual-polish` |
| N6 | **Every extension update paused tracking**, including **Reload** of the unpacked extension (how users install updates), so people silently stopped tracking. | `extension/background.js` `onInstalled` | Pause only when `previousVersion` is older than 1.1.0 (or unknown); unit + worker tests | ✅ `feature/sprint-1` |
| N7 | **Docs said the feature was "not confirmed deployed"**, but run #6 for `5c223cd` succeeded. | `WORK_STATUS.md`, `CLAUDE.md` | Corrected | ✅ `feature/sprint-1` |
| N8 | **Token and cost totals disappeared.** The Tokens/Cost stat cards were replaced, so people who log API usage no longer see total spend anywhere. | `statsHTML` | Show a "Logged spend" figure only when the period has manual cost data | Owner decision (§13 of WORK_STATUS) |
| N9 | **Mobile "AI mix" legend is clipped:** its last line is cut by the card edge at 390px. | `.breakdown-panel` mobile CSS | Bottom padding / no clipping | `feature/visual-polish` |
| N10 | **The time chart always "crashes" at today.** Extension users import later, so today's point drops toward 0. | `chartHTML` | Draw today's segment dashed with a hollow point ("in progress") | `feature/visual-polish` |
| N11 | **Edits to tracked records are silently overwritten** by the next import (stable IDs replace them). | session dialog | Say so in the dialog for tracked records | `feature/visual-polish` |

### Sprint 1 results (`feature/sprint-1`)

| ID | Commit summary | Verified by |
|---|---|---|
| A1 | New demo-mode entries save to the personal workspace | check A1 |
| A2 | Light dismissal only from the backdrop and never with unsaved edits | check A2 + pristine/Escape spot-check |
| A4 | `filterSessions({ includeFuture })`; Sessions lists future rows with a "Future" badge | check A4 + unit test |
| B5 | `minmax(0, 1fr)` grid, single column < 420px, 16px touch controls | check B5 (360/430/600px) |
| B6 | Semantic cell classes + `na`; two-line cards under 640px | check B6 + screenshot |
| B7 | Sidebar scrolls | check B7 |
| B8 | Contrast map (39 occurrences) | check B8: axe 347 → 0 |
| B9 | 12px floor (100 declarations); wrapping workspace subtitle | check B9: 82% → 0% |
| B11 | `confirmAction(…, tone)`; `danger-solid` for destructive actions | check B11 + screenshot |
| B12 | Category colours keyed by name | check B12 |
| B13 | `plural()` at 6 sites; formatters moved to tested `src/format.js` | check B13 + 4 unit tests |
| B14 | `cellMoney()`: "$0" for exact zero, "<$0.01" for sub-cent; Intl totals. ("—" is now reserved for *unavailable*, so zero isn't shown as "—".) | check B14 + unit test |
| C4 | `STORAGE_KEY` instead of literals | grep + tests |
| C9 | Ticks counted back from today; last label right-aligned | check C9 (7/30/90 days) |
| E3 | Alarm created only when missing | worker regression test (fails without the fix) |
| E4 | Popup contrast map + 12px floor; extension 1.1.1 | axe on popup: 12 → 0; min text 8 → 12px |
| N6 | Version-gated update pause | unit + worker tests |

Unit tests: 38 → **46**. Remaining failing checks (A3, B1–B4, B10, B15, C1, C7, C8, C12, E1, E2) belong to Sprints 2–3.

---

## Appendix — evidence images

| File | Shows |
|---|---|
| [01](docs/audit/01-chart-letterbox-insights-1366.jpg) | Insights chart: 168px empty gutters (red) at 1366px |
| [02](docs/audit/02-chart-axis-5px-tablet-900.jpg) | Tablet 900px: axis text rendered at about 5px |
| [03](docs/audit/03-sidebar-clipped-1280x640.jpg) | Sidebar profile row cut off; the sidebar can't scroll |
| [04](docs/audit/04-mobile-dialog-squeezed-360.jpg) | Mobile dialog: "Writ", 69px duration field |
| [05](docs/audit/05-mobile-table-cutoff-390.jpg) | Mobile table: Date/Tokens/Cost/Time/actions off-screen |
| [06](docs/audit/06-destructive-confirm-not-red.jpg) | "Clear personal data" styled as a normal primary action |
| [07](docs/audit/07-first-run-wall-of-zeros-1366x768.jpg) | First run on a 1366×768 laptop |
| [08](docs/audit/08-baseline-demo-overview-1366.jpg) | Baseline demo overview (for before/after comparison) |
| [09](docs/audit/09-extension-popup-baseline.jpg) | Extension popup, tracking on |
| [10](docs/audit/10-after-css-patch-desktop-1366.jpg) | **After** B8 + B9 + B7 (throwaway build) |
| [11](docs/audit/11-after-css-patch-mobile-table-390.jpg) | **After** B6 card rows (an earlier variant with `·` separators; the CSS in B6 uses `gap` instead) |
| [12](docs/audit/12-after-css-patch-mobile-dialog-360.jpg) | **After** B5 single-column form with 16px inputs |
