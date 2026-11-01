# Orbit — Work Status & Handoff

> **Last updated:** 2026-11-01 · **Main sync:** fetched `origin/main` @ `aaa4ff6`; already included in this branch, no conflicts.
> **Last reported deployment:** `41fc42a` (GitHub Pages deploy run #4 succeeded per the audit). Current deployment status has not been independently verified here.
> **Current feature branch:** `feat/observed-ai-usage` adds extension v1.1.0 active-time + observed-send recording and separates observations from unavailable token/billing data. It includes the previously merged audit/handoff files. This feature is not yet confirmed deployed.
> **Read next:** [`AUDIT.md`](AUDIT.md) (findings with exact fixes) · [`docs/audit/check.cjs`](docs/audit/check.cjs) (26 acceptance checks)

---

## 1. Summary (read this first)

**Orbit** is a private, local-first dashboard for understanding how you use AI tools (Claude, ChatGPT, Gemini, others). You log sessions (time, optional tokens/cost)
or import active time and observed send actions from the optional Chrome/Edge extension, then explore totals, a usage chart, your "AI mix", and insights. The feature dashboard prioritizes recorded time, observed sends, activity records, and active days; browser records do not invent token or billing values.
There is no backend, account or API key. Data lives in the browser's `localStorage`, with JSON/CSV export as the backup path. It is a static Vite site deployed to GitHub Pages.

**Baseline:** v1.0.0 was reported live and healthy at `41fc42a` (21/21 unit tests, Lighthouse Performance 100, 0 console errors). The current feature branch has 38 passing automated tests under Node 22, a passing production build, and targeted browser checks for provider-control fixtures and dashboard imports. This does not establish live provider selector coverage or a new deployed build.
A full audit on 2026-11-01 found **5 data/trust issues, 15 UX/accessibility bugs, 14 code-health items and 9 extension items**, plus a 14-item feature roadmap.
**None are fixed yet.** The recommended next step is **Sprint 1** in [§12](#12-next-steps): about 1 day of mostly XS fixes, several pre-verified.

---

## 2. Status at a glance

Rows labelled Live and audit findings describe the reported `41fc42a` baseline. Feature readiness and current verification are listed separately; they do not establish a deployment.

| Area | Status | Notes / audit IDs |
|---|---|---|
| Dashboard: Overview · Sessions · Insights · Settings | ✅ Live | Hash routes `#overview` `#sessions` `#insights` `#settings` |
| Demo mode (sample data, default for new visitors) | ⚠️ Live, data-loss bug | **A1**: sessions logged in demo mode vanish on reload |
| Manual session logging (dialog) | ⚠️ Live | **A2** loses input on backdrop click · **B5** squeezed on phones |
| Search / provider filter | ⚠️ Live | **B1** IME broken + slow · **B2** filters whole page |
| Usage chart / AI mix / Insights | ⚠️ Live | **B3** letterboxing + tiny axis text · **B12** colours · **C9** · **C10** |
| JSON import/export, CSV export | ✅ Live | **C1**–**C3**, **C11** polish |
| Browser extension (MV3, Chrome/Edge 120+) | Baseline time tracker; v1.1.0 prepared | New observed-send controls and worker logic tested with fixtures/mocks. Logged-in provider layouts and real-profile installation remain unverified. **E1**–**E9** backlog retained. |
| Logged + tracked time together | ❌ Double counted | **A3** |
| Durability (Safari 7-day eviction, shared origin, backups) | ❌ Unaddressed | **A5** |
| Accessibility | ⚠️ A11y 94–96 | **B8** contrast (35 pairs) · **B9** 82% of text < 12px · **B4** · **B10** · **C7** |
| Mobile / tablet layout | ⚠️ | **B4**–**B7** (CSS for B5–B7 pre-verified) |
| Automated tests (`node --test`) | ✅ 38/38 on feature branch | Data, time/send accounting, control observations, mocked service-worker integration |
| Observed AI activity | ✅ Prepared on feature branch | Active time + observed submissions; old counts and unmeasured tokens/cost remain unavailable. Not provider-confirmed usage or remaining limits. |
| UI / E2E checks | Targeted browser checks passed; no committed E2E suite | Five provider-control fixtures plus dashboard import/edit/persistence/mobile/ZIP checks were run. Automated control/worker tests are committed; browser fixtures are not part of CI. **C12** remains open. |
| CI on pull requests | ❌ None (deploy workflow only) | **C12** |
| Deploy (GitHub Actions → Pages) | ✅ Runs #3, #4 succeeded | On push to `main` |
| Audit + acceptance checks | Historical baseline retained | `AUDIT.md` · `check.cjs`: **0/26 passing** at the audit baseline; not rerun for this feature or documentation sync. |

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
| `src/main.js` | Icons/formatters, application state, hash routing, view builders, session and import/export flows |
| `src/data.js` | Provider rates, validation, summaries/daily charts, filtering, import/export, storage, demo data |
| `src/style.css` | Responsive styles; late override layers remain an audit concern (C6) |
| `public/favicon.svg` | Brand icon; PNG extension icons remain E1 |
| `extension/manifest.json` | MV3 v1.1.0; storage/alarms/idle, seven host patterns, scoped content script |
| `extension/core.js` | Pure time accounting, observed-send deduplication, stable daily exports |
| `extension/background.js` | Sampling, observer readiness, sender/foreground validation, popup API, update pause |
| `extension/content.js` | Trusted send-control observations; no prompt/reply values read or stored |
| `extension/popup.{html,js,css}` | Toggle, today's time/send totals, export and clear controls |
| `extension/help.html`, `extension/README.md` | Measurement limits, privacy, install/update instructions |
| `scripts/package-extension.mjs` | Packages top-level extension files into the ignored public ZIP |
| `tests/data.test.js` | 13 data-model/storage/import/chart tests |
| `tests/extension.test.js` | 13 time/send-accounting and export tests |
| `tests/background.test.js` | 9 mocked service-worker integration tests |
| `tests/content.test.js` | 3 control-observer tests with DOM/runtime stubs |
| `.github/workflows/deploy.yml` | Node 22 install/test/build → Pages on pushes to `main` |
| `AUDIT.md` | Historical findings, proposed fixes, roadmap and sprint plan |
| `docs/audit/check.cjs` | 26 audit acceptance checks; baseline results are historical |
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

Each extension bucket has provider/site, local day, date, accumulated milliseconds, and nullable `messageCount`. The sampling cursor includes `at`, `site`, and `observerReady`; missing observers and historical counts remain unavailable. `recentSends` stores only deduplication IDs/timestamps, not message text. The storage/envelope version stays 1 for backward compatibility; the extension release is 1.1.0.

**Illustrative rates for manual records only** (USD per 1M input/output tokens): Claude 3 / 15 · ChatGPT 2.5 / 10 · Gemini 1.25 / 10 · Other 0 / 0. They're labelled as estimates in the UI; see D4 to make them per-model and editable.
**Limits:** 10,000 sessions · import 10 MB in the UI (20 MiB in the parser, C3) · extension gap cap 90s, idle threshold 60s.

---

## 7. Commands

```bash
npm ci                 # Node >= 22.12
npm run dev            # Vite dev server on 0.0.0.0 (packages the extension first)
npm test               # node --test -> 38 automated tests on the feature branch
npm run build          # -> dist/ (relative base, works on a Pages sub-path)
npm run preview
```

Acceptance checks (one per audit finding):

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
node docs/audit/check.cjs                 # report; add --strict for CI; --only=A1,B3 for a subset
```

They need `playwright` (preinstalled in Claude Code cloud sessions; locally `npm i -D playwright && npx playwright install chromium`). Check B8 also needs `axe-core`.

---

## 8. Deployment

- **How:** `.github/workflows/deploy.yml` on every push to `main` (or Actions → "Deploy Orbit to GitHub Pages" → Run workflow). Repo Settings → Pages → Source = **GitHub Actions**. No secrets.
- **Last reported deploy:** run #4, commit `41fc42a`, success at 2026-11-01 00:00 UTC according to the imported audit. Not re-verified in this environment.
- **Current sync:** feature branch includes fetched main `aaa4ff6`. The observed-usage changes are pushed to `feat/observed-ai-usage`, not to main. GitHub API restrictions blocked automatic pull-request creation; review/merge through GitHub is still required.
- **URL:** the project path is expected to be `https://mahanthadeeksha-sb.github.io/web.../`. Confirm it in Settings → Pages; the audit sandbox's network policy blocked fetching it.
- **Alternative:** Cloudflare Pages (preset None, build `npm run build`, output `dist`, Node ≥ 22.12). This also gives Orbit its own origin (A5).
- **Branch flow used so far:** feature → `dev` → `main` via PRs. Pages deploys only from `main`.

---

## 9. Invariants (don't break these)

1. **Privacy promise:** no backend, network requests, analytics, accounts or third-party scripts. Everything works offline. The extension never reads prompt/reply values or titles and retains no URLs beyond the hostname. With explicit opt-in, v1.1.0 inspects supported send-control attributes and trusted click/keyboard/submit events without storing message text.
2. Every user-controlled string interpolated into HTML goes through `esc()` (`src/main.js:50`).
3. Every stored or imported record passes `validateSession()`, and storage failures never overwrite unreadable data.
4. Pure logic lives in `src/data.js` / `extension/core.js` and is covered by `node:test`. Add a test with each logic change.
5. Extension record IDs stay stable, because cumulative re-import depends on it.
6. Copy voice is calm and "mindful" ("A little clarity for your AI life"). Costs are always labelled as estimates.

---

## 10. Gotchas (learned the hard way)

- **Hash routing:** any `href="#x"` where `x` isn't a view re-routes to Overview, so skip links and in-page anchors must be buttons that move focus.
- **`renderContent()` replaces `innerHTML`.** That destroys focus, IME composition and listeners inside `#content`, so keep `<input>`s outside re-rendered regions (B1).
- **Future-dated sessions are filtered out everywhere** (`src/data.js:198`, A4). In browser tests, **use past timestamps**: the container clock may be just after
  midnight UTC, so "today at 10:00" can be in the future and silently disappear.
- **Dead CSS:** `.stat-value` responsive sizes never apply, because the late rule at `src/style.css:1866` wins (C6). Check computed styles before trusting a media query.
- **CSP:** Vite inlines assets under 4 KB as `data:` URIs (one font subset), so a CSP needs `font-src 'self' data:` (C8).
- **Extension ZIP:** generated into `public/` by `predev`/`prebuild` (gitignored), and the packager only takes **top-level** files (E2).
- **Tests:** `node --test` auto-runs `**/*.test.js`, so name Playwright specs `*.spec.js`. `package.json` is `"type": "module"`, so CommonJS scripts must be `.cjs`.
- **Shared origin:** all GitHub Pages project sites of one account share `localStorage` (A5).
- **Claude Code cloud sandbox:** `github.io` is blocked by the network policy, and the npm registry works. Playwright + Chromium are preinstalled:
  `require("playwright")` works from `.cjs`, but ESM `import` doesn't resolve the global install. Chromium is at `/opt/pw-browsers/chromium`.

---

## 11. Known issues

The full list with evidence and exact fixes is in [`AUDIT.md`](AUDIT.md). Index:

| Priority | IDs |
|---|---|
| **P0 data & trust** | A1 demo-mode loss · A2 dialog loses input · A3 double counting · A4 invisible future sessions · A5 durability (Safari eviction, shared origin, no backup reminder) |
| **P1 UX & a11y** | B1 search/IME/perf · B2 filter scope · B3 chart sizing · B4 mobile drawer · B5 mobile form · B6 mobile table · B7 sidebar clipping · B8 contrast · B9 text size · B10 focus loss · B11 danger styling · B12 category colours · B13 plurals · B14 money/time formatting · B15 first-run |
| **P2 health** | C1 storage size · C2 limit message · C3 import limits · C4 key literal · C5 duplicated constants · C6 CSS architecture · C7 semantics · C8 head/CSP · C9 x-axis · C10 all-time chart · C11 CSV · C12 CI/tests · C13 deps (Vite 8.3.5) · C14 repo hygiene |
| **Extension** | E1 icons · E2 packager · E3 alarm reset · E4 contrast · E5 brand mark · E6 popup history/link · E7 idle threshold · E8 site coverage · E9 distribution |
| **Roadmap** | D1 one-click sync · D2 PWA · D3 timer · D4 pricing · D5 insights · D6 goals · D7 schema v2 · D8 dark mode · D9 Wrapped · D10 keyboard · D11 undo · D12 URL filters · D13 auto-backup · D14 orbit visual |

---

## 12. Next steps

**Prepared feature: observed AI activity (`feat/observed-ai-usage`), synchronized with main `aaa4ff6`.** Review/merge the feature, then let Pages deploy. Download the new v1.1.0 extension ZIP, replace files in the existing folder, Reload the extension, refresh AI tabs, and enable **Track AI time & sends**. Updates intentionally pause tracking and preserve existing history. Export/import remains the transfer flow; one-click sync (D1) is still outstanding.

Validation: 38 automated tests and production build pass under Node 22. Browser fixtures cover trusted sends, pause, Stop controls, and no prompt-text retention across ChatGPT/Claude/Gemini/Perplexity/Copilot; production dashboard checks cover observed/unknown imports, chart gaps, edits, persistence, mobile width, and ZIP contents. Logged-in provider layouts and installation in a real user profile remain unverified here. Audit baseline checks were not rerun for this feature; no audit ID is claimed fixed. The main-sync verification re-ran all 38 tests and the production build under Node 22; both passed. The merge was already up to date and had no conflicts. The existing audit backlog below remains applicable.

**Sprint 1, "stop data loss, make it readable" (~1 day).** For each item: implement it, then run `npm test && npm run build && node docs/audit/check.cjs --only=<ID>`.

- [ ] **A1** save new demo-mode entries to the personal workspace (`src/main.js:442-453`)
- [ ] **A2** safe dialog dismissal + dirty flag (`src/main.js:579-592`, `:427`)
- [ ] **A4** show future-dated sessions in Sessions (`src/data.js:198`)
- [ ] **B8** apply `docs/audit/contrast-map.json` (one-liner in AUDIT.md B8) ✅ pre-verified
- [ ] **B9** 12px font floor (sed one-liner in AUDIT.md B9) + `.workspace small` ellipsis ✅ pre-verified
- [ ] **B5 / B6 / B7** mobile form grid, card rows, sidebar scroll (CSS in AUDIT.md) ✅ pre-verified
- [ ] **B11 · B12 · B13 · B14** danger button, category colours, plurals, money/time formatters
- [ ] **C4 · C9 · E3** storage-key constant, label today on the chart, don't recreate the alarm

**Sprint 2:** B1, B2, B3, B4 (JS half), B10, C1–C3, C5, C7, C11. **Sprint 3:** A3, A5, B15, C8 + D2 (PWA), C12 (CI), C13, C14, E1, E2, E4, E5.
**Sprint 4 (pick 2–3):** D1 one-click sync, D3 timer, D4 pricing, D5 insights, D6 goals, D8 dark mode (needs C6), D9 Wrapped, D14 orbit visual.

After each sprint, update §2 and §11 here and note the `check.cjs` pass count (baseline **0/26**).

---

## 13. Decisions only the owner can make

| Question | Recommendation |
|---|---|
| B2: where should search and the provider filter apply? | Provider filter global (next to the date range); search narrows only the table |
| A3: how to combine logged and tracked time | `max(logged, tracked)` per day × provider, with an optional setting |
| A5 / C14: give Orbit its own origin and rename the repo `web...` → `orbit`? | Yes. Same origin on rename keeps data; a custom domain or Cloudflare Pages isolates storage |
| C14: license | MIT if you want others to reuse it; otherwise state "all rights reserved" |
| E9: publish the extension to the Chrome Web Store (one-time developer fee) / Edge Add-ons (free)? | Yes once E1–E4 are done; auto-updates and no Developer-mode warning |
| Roadmap order | D1 → D2 → D3 → D5 |

---

## 14. Starting a new context

- **Claude Code:** [`CLAUDE.md`](CLAUDE.md) at the repo root loads automatically and points here.
- **Any assistant:** paste this:

```text
You are continuing work on "Orbit", a private, local-first AI-usage dashboard (static Vite SPA, vanilla JS)
with an optional MV3 Chrome/Edge extension for active time and observed send actions (no message text). Repo: MAHANTHADEEKSHA-SB/web...

1. Read WORK_STATUS.md (status, architecture, invariants, gotchas), then AUDIT.md (findings with exact fixes).
2. Continue the current user task and branch handoff first. feat/observed-ai-usage includes main aaa4ff6 and awaits review/merge; do not assume it is deployed. Sprint 1 in §12 is a backlog, not an automatic replacement for the user task.
3. For application changes run npm test && npm run build (38 tests currently). When fixing an audit ID, start `npx vite preview --host 127.0.0.1 --port 4173 --strictPort &`,
   then `node docs/audit/check.cjs --only=<ID>`. A claimed audit fix must pass its acceptance check; do not weaken assertions.
4. Never break the invariants in WORK_STATUS.md §9 (no network/analytics, esc() all user text, validateSession, tests for logic).
5. Don't weaken the assertions in docs/audit/check.cjs. If you choose a different design than AUDIT.md recommends, update the check and say why.
6. When done, update WORK_STATUS.md §2, §11 and §12 and report the check.cjs pass count.
```
