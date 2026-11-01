# Orbit — Work Status & Handoff

> **Last updated:** 2026-11-01 · **Live:** `main` @ `5c223cd` (PR #5, observed AI usage). GitHub Pages deploy run #6 succeeded at 11:13 UTC (checked via the GitHub Actions API).
> **Branches awaiting review (stacked; merge in this order):**
> 1. `feature/sprint-1`, based on `5c223cd`: Sprint 1 fixes plus extension 1.1.1. **13/26** checks.
> 2. `feature/visual-polish`, based on `feature/sprint-1`: chart, search, accessibility, first run, demo story, brand assets and CSP. **23/26** checks; Lighthouse a11y, best practices and performance 100. **This file describes this branch.**
> Neither is deployed until merged into `main` (0/26 checks).
> **Earlier branch:** `feat/observed-ai-usage` (extension v1.1.0) is merged and live.
> **Read next:** [`AUDIT.md`](AUDIT.md) (findings with exact fixes) · [`docs/audit/check.cjs`](docs/audit/check.cjs) (26 acceptance checks)

---

## 1. Summary (read this first)

**Orbit** is a private, local-first dashboard for understanding how you use AI tools (Claude, ChatGPT, Gemini, others). You log sessions (time, optional tokens/cost)
or import active time and observed send actions from the optional Chrome/Edge extension, then explore totals, a usage chart, your "AI mix", and insights. The feature dashboard prioritizes recorded time, observed sends, activity records, and active days; browser records do not invent token or billing values.
There is no backend, account or API key. Data lives in the browser's `localStorage`, with JSON/CSV export as the backup path. It is a static Vite site deployed to GitHub Pages.

**Baseline:** v1.0.0 was live and healthy at `41fc42a` (21/21 unit tests, Lighthouse Performance 100, 0 console errors). The observed-usage feature (`5c223cd`) is live with 38 passing tests; its provider-control fixtures pass, but logged-in provider layouts and real-profile installation remain unverified.
A full audit on 2026-11-01 found **5 data/trust issues, 15 UX/accessibility bugs, 14 code-health items and 9 extension items**, plus a 14-item feature roadmap. A follow-up review of the observed-usage feature added **N1–N11** ([AUDIT.md §10](AUDIT.md#10-follow-up-review-observed-ai-usage-main--5c223cd)).
**Sprint 1 is done on `feature/sprint-1`** (one commit per finding): A1, A2, A4, B5–B9, B11–B14, C4, C9, E3, E4 and N6.
**A visual-polish pass is done on `feature/visual-polish`**: B1, B3, B4, B10, B15, C1, C7, C8, E1, E2, E5 and the observed-usage follow-ups N1–N5, N9–N11. 51/51 tests pass and 23/26 checks. Next: review/merge both branches in order, then the remaining items in [§12](#12-next-steps).

---

## 2. Status at a glance

"Live" means `main` @ `5c223cd`. ✅ **fixed** means fixed on `feature/sprint-1` or `feature/visual-polish` (not live until merged).

| Area | Status | Notes / audit IDs |
|---|---|---|
| Dashboard: Overview · Sessions · Insights · Settings | ✅ Live | Hash routes `#overview` `#sessions` `#insights` `#settings` |
| Demo mode (sample data, default for new visitors) | ✅ fixed (A1, N1, N5) | New entries save to the personal workspace; the demo shows tracked chats with sends plus logged API work, with an organic rhythm |
| Manual session logging (dialog) | ✅ fixed (A2, B5) | Keeps unsaved edits; single-column form on phones, no iOS zoom |
| Search / provider filter | ✅ B1 fixed · ⚠️ B2 open | IME-safe, debounced, region updates, 50-row pages. **B2** (search filters the whole page) awaits an owner decision |
| Usage chart / AI mix / Insights | ✅ fixed (B3, B12, C9, N3, N4, N10) | Real-size chart with read-out; time-share mix by tool; Insights by tool for tracked data. Open: **C10** all-time weekly buckets |
| JSON import/export, CSV export | ✅ Live | **C1**–**C3**, **C11** polish |
| Browser extension (MV3, Chrome/Edge 120+) | v1.1.0 live · **v1.1.1** on branches | 1.1.1: alarm no longer postponed (E3), readable popup (E4), updates from ≥ 1.1.0 keep tracking on (N6), icons (E1, E2), real logo (E5). Logged-in provider layouts and real-profile installation remain unverified. Open: E6–E9 |
| Logged + tracked time together | ❌ Double counted | **A3** |
| Durability (Safari 7-day eviction, shared origin, backups) | ❌ Unaddressed | **A5** |
| Accessibility | ✅ fixed (B4, B8–B11, C7) | axe contrast failures 347 → 0; text < 12px 82% → 0%; Lighthouse accessibility **100** on mobile and desktop |
| Mobile / tablet layout | ✅ fixed (B4–B7, N9) | Card rows, single-column form, scrolling sidebar, accessible drawer, unclipped legend |
| Automated tests (`node --test`) | ✅ 51/51 on `feature/visual-polish` (46 on sprint-1, 38 on main) | Data, formatters, chart geometry, time/send accounting, control observations, mocked service-worker integration |
| Observed AI activity | ✅ Live (`5c223cd`) | Active time + observed submissions; old counts and unmeasured tokens/cost remain unavailable. Not provider-confirmed usage or remaining limits. Presentation follow-ups fixed except **N8** (owner decision) |
| UI / E2E checks | Targeted browser checks passed; no committed E2E suite | Five provider-control fixtures plus dashboard import/edit/persistence/mobile/ZIP checks were run. Automated control/worker tests are committed; browser fixtures are not part of CI. **C12** remains open. |
| CI on pull requests | ❌ None (deploy workflow only) | **C12** |
| Deploy (GitHub Actions → Pages) | ✅ Runs #3–#6 succeeded | On push to `main`; run #6 = `5c223cd` |
| Audit + acceptance checks | ✅ **23/26** on `feature/visual-polish` | 13/26 on sprint-1; 0/26 on `5c223cd`. Open: A3, B2 (owner decisions), C12 (CI) |
| First run, brand & sharing | ✅ fixed (B15, C8) | Welcome panel; social preview card, manifest/icons, apple-touch-icon, `<noscript>`, build-time CSP |

---

## 3. Timeline

| Date (UTC) | Commit / event | What happened |
|---|---|---|
| 2022-01-24 | `1b10b3b` | Initial commit (README only) |
| 2026-10-31 | `f5480dc` | Built the Orbit dashboard + optional browser time tracker (21 files, +5,478 lines) |
| 2026-10-31 23:36 | PR #1 `orbit-dashboard → dev` merged (`e03ddbe`) | No CI checks ran |
| 2026-10-31 23:41 | PR #2 `dev → main` merged (`ec04a80`) | No CI checks ran |
| 2026-10-31 | `6372e95` | Removed `--test-isolation=none` from `npm test` (Node 22 compatibility in the Pages build) |
| 2026-11-01 00:00 | `41fc42a` → deploy run #4 ✅ | Clarified session units; explained input/output tokens in the form |
| 2026-11-01 | branch `claude/adoring-dijkstra-l4t0gm` | Full audit → `AUDIT.md`, `WORK_STATUS.md`, `CLAUDE.md`, `docs/audit/*` |
| 2026-11-01 | `aaa4ff6` | Audit/handoff PR #3 merged into main; preserved in the feature branch |
| 2026-11-01 | `7027c2a`, `95eb225` | Observed-usage feature and initial handoff update on `feat/observed-ai-usage` |
| 2026-11-01 | Feature branch main sync | Fetched and merged `origin/main` @ `aaa4ff6`: already an ancestor, no conflicts. Re-ran 38 tests and production build under Node 22. |
| 2026-11-01 11:12 | PR #5 merged (`5c223cd`) → deploy run #6 ✅ | Observed AI usage + extension 1.1.0 live |
| 2026-11-01 | branch `feature/sprint-1` | Sprint 1 (one commit per finding) + follow-up review N1–N11; checks 0/26 → 13/26; tests 38 → 46 |
| 2026-11-01 | branch `feature/visual-polish` | Chart, search, a11y, first run, demo story, brand assets, CSP; checks 13/26 → 23/26; tests 46 → 51 |

---

## 4. Architecture

- **Static SPA**, Vite 7, **vanilla JS** with no framework. Views are HTML **template strings** written with `innerHTML`. Every user string passes `esc()`.
- **State:** one `state` object in `src/main.js` (`view`, `days`, `provider`, `query`, `chart`, `mode`, `personal`, `demo`). `render()` = `shell()` + `renderContent()`.
  `renderContent()` rebuilds the whole content area on most interactions, which is the root cause of B1 and B10.
- **Routing:** `location.hash` → `navigate()` (`src/main.js:372`). Unknown hashes fall back to Overview.
- **Data layer:** `src/data.js` holds pure functions for validation, filtering, aggregation, import/export, and storage I/O with injectable storage. The automated suite also covers extension accounting, control observations, and mocked worker integration.
- **Persistence:** `localStorage` only. The demo dataset is generated deterministically from "now" on every load (`createDemoSessions`).
- **Extension:** MV3 service worker plus a narrowly scoped `content.js` observer. `core.js` owns active-time accounting and observed-send accumulation. `background.js` samples the active tab on alarms/tab/window/idle events and accepts observations only from supported, active, top-frame, non-incognito tabs in the focused normal window. Page observers inspect send-control attributes and trusted events, never prompt/reply values; Stop controls and duplicate events are excluded. Observer readiness distinguishes unavailable counts from observed zero. The popup polls every 5s; updates pause tracking until the user opts in again.
- **Extension transfer:** local JSON export/import, with stable installation/day/site IDs so re-imports replace rather than duplicate. Bounded recent event IDs prevent duplicate send counting. Only provider/day totals and observation metadata are retained, not conversation URLs or text. Observed submissions are not provider-confirmed successful replies, exact tokens, billing, or remaining quotas.
- **Build glue:** `predev`/`prebuild` run `scripts/package-extension.mjs`, which zips `extension/` into `public/orbit-extension.zip` (gitignored).
  The site serves it from Settings → "Download extension".

---

## 5. File map

| Path | Role |
|---|---|
| `index.html` | App root, toast and dialogs, module entry |
| `src/main.js` | Icons, application state, hash routing, view builders, session and import/export flows |
| `src/format.js` | Pure display formatters: `compact`, `money`, `cellMoney`, `duration`, `shortDuration`, `plural` |
| `src/chart.js` | Pure chart geometry: `niceScale` (friendly ticks), `monotoneSegments`/`segmentsPath` (smooth line, gaps) |
| `vite.config.js` | Injects the Content-Security-Policy into production builds only |
| `src/data.js` | Provider rates, validation, summaries/daily charts, filtering, import/export, storage, demo data |
| `src/style.css` | Responsive styles; late override layers remain an audit concern (C6) |
| `public/favicon.svg` | Logo artwork (source for every raster icon) |
| `public/og-image.png`, `public/icon-*.png`, `public/apple-touch-icon.png`, `public/manifest.webmanifest` | Social preview card, app icons and web manifest |
| `extension/icons/` | Extension PNG icons 16/32/48/128 |
| `scripts/generate-brand-assets.cjs` | Regenerates every PNG above from the logo (needs Playwright) |
| `extension/manifest.json` | MV3 v1.1.1; storage/alarms/idle, seven host patterns, scoped content script |
| `extension/core.js` | Pure time accounting, observed-send deduplication, stable daily exports, `isOlderVersion` |
| `extension/background.js` | Sampling, observer readiness, sender/foreground validation, popup API, one-time update pause (from < 1.1.0) |
| `extension/content.js` | Trusted send-control observations; no prompt/reply values read or stored |
| `extension/popup.{html,js,css}` | Toggle, today's time/send totals, export and clear controls |
| `extension/help.html`, `extension/README.md` | Measurement limits, privacy, install/update instructions |
| `scripts/package-extension.mjs` | Packages the extension (recursively, including `icons/`) into the ignored public ZIP |
| `tests/data.test.js` | 15 data-model/storage/import/chart/demo/tool tests |
| `tests/format.test.js` | 5 formatter tests |
| `tests/chart.test.js` | 3 chart-geometry tests |
| `tests/extension.test.js` | 14 time/send-accounting, export and version tests |
| `tests/background.test.js` | 11 mocked service-worker integration tests |
| `tests/content.test.js` | 3 control-observer tests with DOM/runtime stubs |
| `.github/workflows/deploy.yml` | Node 22 install/test/build → Pages on pushes to `main` |
| `AUDIT.md` | Historical findings, proposed fixes, roadmap and sprint plan |
| `docs/audit/check.cjs` | 26 audit acceptance checks (23 pass on `feature/visual-polish`) |
| `docs/audit/contrast-map.json`, `docs/audit/*.jpg` | Audit measurements, evidence and proposed-fix previews |

---

## 6. Data model & storage

**Session record** (normalised by `validateSession`; unknown fields are dropped):

| Field | Type | Rules |
|---|---|---|
| `id` | string ≤ 128 | UUID; extension records use `orbit-extension-<installationId>-<YYYY-MM-DD>-<siteId>` |
| `provider` | `"claude" \| "chatgpt" \| "gemini" \| "other"` | Perplexity/Copilot map to `other` |
| `model` | string ≤ 100 | Defaults to the provider name (form allows 80) |
| `title` | string 1–140 | Required (form allows 120) |
| `date` | ISO string | Calendar-validated; date-only = local midnight |
| `duration` | minutes (float ≥ 0) | Form max 1440 |
| `source` | `"manual"` or `"extension"` | Existing extension ID prefixes also identify tracked records |
| `messageCount` | integer ≥ 0 or `null` | Observed send actions only; unavailable for historical/manual records |
| `inputTokens`, `outputTokens` | integers ≥ 0 or `null` | Manual values; extension records use `null` for unavailable |
| `cost` | USD float ≥ 0 or `null` | Manual values default to an illustrative estimate; extension records use `null` |
| `category` | `Writing \| Coding \| Research \| Learning \| Other` | |

**Export envelope:** `{ version: 1, exportedAt, sessions: [...] }`. The extension adds `source: "orbit-extension"`. A bare array of sessions also imports.

| Storage key | Where | Content |
|---|---|---|
| `ai-usage-sessions-v1` | site `localStorage` | Export envelope, currently pretty-printed (C1) |
| `orbit-mode` | site `localStorage` | `"demo"` or `"personal"` |
| `orbit-private-tracker-v1` | extension `chrome.storage.local` | `{ version, enabled, installationId, buckets, cursor, recentSends? }`; recent event IDs are bounded |

Each extension bucket has provider/site, local day, date, accumulated milliseconds, and nullable `messageCount`. The sampling cursor includes `at`, `site`, and `observerReady`; missing observers and historical counts remain unavailable. `recentSends` stores only deduplication IDs/timestamps, not message text. The storage/envelope version stays 1 for backward compatibility; the extension release is 1.1.1 (send observation since 1.1.0).

**Illustrative rates for manual records only** (USD per 1M input/output tokens): Claude 3 / 15 · ChatGPT 2.5 / 10 · Gemini 1.25 / 10 · Other 0 / 0. They're labelled as estimates in the UI; see D4 to make them per-model and editable.
**Limits:** 10,000 sessions · import 10 MB in the UI (20 MiB in the parser, C3) · extension gap cap 90s, idle threshold 60s.

---

## 7. Commands

```bash
npm ci                 # Node >= 22.12
npm run dev            # Vite dev server on 0.0.0.0 (packages the extension first)
npm test               # node --test -> 51 automated tests
npm run build          # -> dist/ (relative base, works on a Pages sub-path)
npm run preview
```

Acceptance checks (one per audit finding):

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
node docs/audit/check.cjs                 # report; add --strict for CI; --only=A1,B3 for a subset
```

They need `playwright` (preinstalled in Claude Code cloud sessions; locally `npm i -D playwright && npx playwright install chromium`). Check B8 also needs `axe-core`.

After changing the logo, regenerate the raster brand assets with `node scripts/generate-brand-assets.cjs` (also needs Playwright).

---

## 8. Deployment

- **How:** `.github/workflows/deploy.yml` on every push to `main` (or Actions → "Deploy Orbit to GitHub Pages" → Run workflow). Repo Settings → Pages → Source = **GitHub Actions**. No secrets.
- **Last deploy:** run #6, commit `5c223cd` (PR #5), success at 2026-11-01 11:13 UTC, verified via the GitHub Actions API.
- **Pending:** `feature/sprint-1` (based on `5c223cd`) is pushed for review. Merging it into `main` deploys it; then download the 1.1.1 extension ZIP from Settings, replace the files and click **Reload**. Tracking stays on (N6).
- **URL:** the project path is expected to be `https://mahanthadeeksha-sb.github.io/web.../`. Confirm it in Settings → Pages; the audit sandbox's network policy blocked fetching it.
- **Alternative:** Cloudflare Pages (preset None, build `npm run build`, output `dist`, Node ≥ 22.12). This also gives Orbit its own origin (A5).
- **Branch flow used so far:** feature → `dev` → `main` via PRs. Pages deploys only from `main`.

---

## 9. Invariants (don't break these)

1. **Privacy promise:** no backend, network requests, analytics, accounts or third-party scripts. Everything works offline. The extension never reads prompt/reply values or titles and retains no URLs beyond the hostname. With explicit opt-in, v1.1.0 inspects supported send-control attributes and trusted click/keyboard/submit events without storing message text.
2. Every user-controlled string interpolated into HTML goes through `esc()` (`src/main.js:50`).
3. Every stored or imported record passes `validateSession()`, and storage failures never overwrite unreadable data.
4. Pure logic lives in `src/data.js`, `src/format.js`, `src/chart.js` and `extension/core.js` and is covered by `node:test`. Add a test with each logic change.
5. Extension record IDs stay stable, because cumulative re-import depends on it.
6. Copy voice is calm and "mindful" ("A little clarity for your AI life"). Costs are always labelled as estimates.

---

## 10. Gotchas (learned the hard way)

- **Hash routing:** any `href="#x"` where `x` isn't a view re-routes to Overview, so skip links and in-page anchors must be buttons that move focus.
- **`renderContent()` replaces `innerHTML`.** That destroys focus, IME composition and listeners inside `#content`, so keep `<input>`s outside re-rendered regions (B1).
- **Future-dated sessions never count toward totals** (`filterSessions`); since A4 only the Sessions list shows them (`includeFuture`). In browser tests, **use past timestamps**:
  the container clock may be just after midnight UTC, so "today at 10:00" can be in the future and drop out of totals.
- **Popup API refuses tab senders** (since 1.1.0): opening `popup.html` in a normal tab leaves the toggle disabled. Test the real toolbar popup, or stub
  `chrome.runtime.sendMessage` in the page. Extension pages enforce the MV3 CSP, so inject test tools with Playwright's `bypassCSP`.
- **Reloading an unpacked extension fires `onInstalled` with reason `"update"`**, so anything done "on update" also happens on every Reload (N6).
- **Filtering updates `[data-region]` containers only** (`updateResults()` in `src/main.js`). Never re-render the search `<input>` or the provider `<select>`; bind new controls via `bindContent(root)`.
- **The chart is drawn at its measured width.** `mountChart()` measures the panel before first paint and a `ResizeObserver` redraws on resize. Browser tests must read it after layout.
- **The production build has a CSP** (`script-src 'self'`). Test tools injected as inline scripts (axe-core) need Playwright's `bypassCSP`; use it only for those checks. Dev builds have no CSP.
- **`og:image` is an absolute URL containing the repo path** (`…github.io/web.../og-image.png`). Update `index.html` if the repo is renamed (C14).
- **Dead CSS:** `.stat-value` responsive sizes never apply, because the late rule at `src/style.css:1866` wins (C6). Check computed styles before trusting a media query.
- **CSP:** Vite inlines assets under 4 KB as `data:` URIs (one font subset), so a CSP needs `font-src 'self' data:` (C8).
- **Extension ZIP:** generated into `public/` by `predev`/`prebuild` (gitignored), and the packager only takes **top-level** files (E2).
- **Tests:** `node --test` auto-runs `**/*.test.js`, so name Playwright specs `*.spec.js`. `package.json` is `"type": "module"`, so CommonJS scripts must be `.cjs`.
- **Shared origin:** all GitHub Pages project sites of one account share `localStorage` (A5).
- **Claude Code cloud sandbox:** `github.io` is blocked by the network policy, and the npm registry works. Playwright + Chromium are preinstalled:
  `require("playwright")` works from `.cjs`, but ESM `import` doesn't resolve the global install. Chromium is at `/opt/pw-browsers/chromium`.

---

## 11. Known issues

The full list with evidence and exact fixes is in [`AUDIT.md`](AUDIT.md). Fixed on the branches: A1, A2, A4, B1, B3–B15, C1, C4, C7–C9, E1–E5, N1–N7, N9–N11. Index:

| Priority | IDs |
|---|---|
| **P0 data & trust** | A1 demo-mode loss · A2 dialog loses input · A3 double counting · A4 invisible future sessions · A5 durability (Safari eviction, shared origin, no backup reminder) |
| **P1 UX & a11y** | B1 search/IME/perf · B2 filter scope · B3 chart sizing · B4 mobile drawer · B5 mobile form · B6 mobile table · B7 sidebar clipping · B8 contrast · B9 text size · B10 focus loss · B11 danger styling · B12 category colours · B13 plurals · B14 money/time formatting · B15 first-run |
| **P2 health** | C1 storage size · C2 limit message · C3 import limits · C4 key literal · C5 duplicated constants · C6 CSS architecture · C7 semantics · C8 head/CSP · C9 x-axis · C10 all-time chart · C11 CSV · C12 CI/tests · C13 deps (Vite 8.3.5) · C14 repo hygiene |
| **Extension** | E1 icons · E2 packager · E3 alarm reset · E4 contrast · E5 brand mark · E6 popup history/link · E7 idle threshold · E8 site coverage · E9 distribution |
| **Observed-usage follow-up** | ~~N1~~ · ~~N2~~ · ~~N3~~ · ~~N4~~ · ~~N5~~ · ~~N6~~ · ~~N7~~ · N8 spend totals gone (owner decision) · ~~N9~~ · ~~N10~~ · ~~N11~~ |
| **Roadmap** | D1 one-click sync · D2 PWA · D3 timer · D4 pricing · D5 insights · D6 goals · D7 schema v2 · D8 dark mode · D9 Wrapped · D10 keyboard · D11 undo · D12 URL filters · D13 auto-backup · D14 orbit visual |

---

## 12. Next steps

**Now:** review and merge `feature/sprint-1`, then `feature/visual-polish` (stacked on it), into `main`. Both are based on the live `5c223cd`; no conflicts expected. After Pages deploys, update the extension to 1.1.1 from Settings: replace the files and click **Reload**, and tracking stays on.

**Visual polish: done on `feature/visual-polish`.**

- [x] **B3 + N10** real-size chart, friendly ticks, smooth line, "today so far", hover/tap/keyboard read-out
- [x] **B1** IME-safe, debounced search; region updates; 50-row pages
- [x] **B4 · B10 · C7** accessible drawer, focus management, route semantics, skip link (Lighthouse a11y 100)
- [x] **B15** first-run welcome · **C1** compact storage
- [x] **C8 · E1 · E2 · E5** social card, manifest/icons, CSP, extension icons and logo
- [x] **N1–N5, N9, N11** demo story, quiet "—", Insights by tool, time-share mix, wording, mobile legend
- [x] Workspace card is a real switcher; motion polish (reduced-motion safe)

**Sprint 1, "stop data loss, make it readable": done on `feature/sprint-1`** (one commit per ID; `git log --oneline main..feature/sprint-1`).

- [x] **A1** new demo-mode entries save to the personal workspace
- [x] **A2** safe dialog dismissal + dirty flag
- [x] **A4** future-dated sessions listed in Sessions with a "Future" badge (`includeFuture`)
- [x] **B8** contrast map applied: axe 347 → 0
- [x] **B9** 12px font floor; the workspace subtitle wraps (ellipsis would hide copy)
- [x] **B5 / B6 / B7** mobile form grid, card rows (semantic cell classes + `na`), sidebar scroll
- [x] **B11 · B12 · B13 · B14** danger button, category colours, `plural()`, `cellMoney()` (formatters now in tested `src/format.js`)
- [x] **C4 · C9 · E3** storage-key constant, today labelled on the chart, alarm not re-created
- [x] Extras: **E4** readable popup, **N6** update pause only from < 1.1.0, **N7** deploy docs; extension 1.1.1

**Next (remaining backlog):** owner decisions **A3**, **B2** and **N8** (§13); **C12** CI (workflow in AUDIT.md; adds `playwright` + `axe-core` devDependencies); **A5** durability (`navigator.storage.persist()`, backup reminder, own origin); **C2, C3, C5, C10, C11**; **C6** CSS tokens (a prerequisite for dark mode, D8); **C13** Vite 8; **C14** repo hygiene; **D2** service worker for offline/PWA (the manifest is in place); extension **E6–E9**.
**Sprint 4 (pick 2–3):** D1 one-click sync, D3 timer, D4 pricing, D5 insights, D6 goals, D8 dark mode (needs C6), D9 Wrapped, D14 orbit visual.

After each sprint, update §2 and §11 here and note the `check.cjs` pass count (baseline **0/26**, Sprint 1 **13/26**, visual polish **23/26**).

---

## 13. Decisions only the owner can make

| Question | Recommendation |
|---|---|
| B2: where should search and the provider filter apply? | Provider filter global (next to the date range); search narrows only the table |
| A3: how to combine logged and tracked time | `max(logged, tracked)` per day × provider, with an optional setting |
| A5 / C14: give Orbit its own origin and rename the repo `web...` → `orbit`? | Yes. Same origin on rename keeps data; a custom domain or Cloudflare Pages isolates storage |
| C14: license | MIT if you want others to reuse it; otherwise state "all rights reserved" |
| E9: publish the extension to the Chrome Web Store (one-time developer fee) / Edge Add-ons (free)? | Yes once E1–E4 are done; auto-updates and no Developer-mode warning |
| A3 + the new "Time with AI" card (its note says "Active time recorded + any manual logs", i.e. a sum) | Still reconcile per day × provider with `max(logged, tracked)`; summing double counts work that was both logged and tracked |
| N8: show total logged spend again? | Yes, but only when the period has manual cost data |
| N6 (implemented): pause tracking only on updates from before 1.1.0 | Keep. Reverting is one condition in `background.js` `onInstalled` |
| B14 (implemented): exact-zero cost shows "$0", not "—" | Keep. "—" now means *unavailable* across the dashboard |
| Roadmap order | D1 → D2 → D3 → D5 |

---

## 14. Starting a new context

- **Claude Code:** [`CLAUDE.md`](CLAUDE.md) at the repo root loads automatically and points here.
- **Any assistant:** paste this:

```text
You are continuing work on "Orbit", a private, local-first AI-usage dashboard (static Vite SPA, vanilla JS)
with an optional MV3 Chrome/Edge extension for active time and observed send actions (no message text). Repo: MAHANTHADEEKSHA-SB/web...

1. Read WORK_STATUS.md (status, architecture, invariants, gotchas), then AUDIT.md (findings with exact fixes).
2. Continue the current user task first. main @ 5c223cd is live (run #6). feature/sprint-1 and feature/visual-polish (stacked on it) await review/merge; check `git branch -r` for newer feature/* branches. The backlog in §12 is not an automatic replacement for the user task.
3. For application changes run npm test && npm run build (51 tests currently). When fixing an audit ID, start `npx vite preview --host 127.0.0.1 --port 4173 --strictPort &`,
   then `node docs/audit/check.cjs --only=<ID>`. A claimed audit fix must pass its acceptance check; do not weaken assertions.
4. Never break the invariants in WORK_STATUS.md §9 (no network/analytics, esc() all user text, validateSession, tests for logic).
5. Don't weaken the assertions in docs/audit/check.cjs. If you choose a different design than AUDIT.md recommends, update the check and say why.
6. When done, update WORK_STATUS.md §2, §11 and §12 and report the check.cjs pass count.
```
