# Orbit: notes for Claude

Orbit is a private, local-first AI-usage dashboard: a static Vite SPA in vanilla JS with no framework and no backend. An optional MV3 Chrome/Edge extension tracks active time and observed send actions on AI sites without reading message text.

**Start here:** [`WORK_STATUS.md`](WORK_STATUS.md) covers status, architecture, invariants, gotchas and next steps. [`AUDIT.md`](AUDIT.md) has the findings with exact fixes (IDs A1–A5, B1–B15, C1–C14, E1–E9, roadmap D1–D14).

## Current handoff

- Verified 2026-11-03: local and upstream `main` are `a5719bb` (PR #6). Sprint 1 and visual polish are merged, including extension 1.1.1. Do not repeat those merges. Current Pages deployment has not been verified.
- Onboarding passed 51 tests and the production build; development/production HTTP and the extension ZIP were checked. Historical 23/26 acceptance and Lighthouse 100 results have not been rerun. Browser rendering timed out; real-profile extension behavior remains unverified. See WORK_STATUS.md §15 for corrections and evidence limits.
- Concurrent review `f7cc7b2` reports successful deploy run #7 and fresh 23/26 acceptance checks on main; see WORK_STATUS.md’s concurrent-review evidence for attribution. Branch new work from main rather than stale dev.
- The extension records active time and observed send actions. These are not provider-confirmed successful replies, tokens, billing, or remaining limits. Unknown metrics stay unavailable. Logged-in provider layouts and real-profile installation are not verified in this sandbox.
- Continue the user's current task; the backlog in `WORK_STATUS.md` §12 is not an instruction to switch tasks.

## Commands

- `npm ci` · `npm test` (51 automated `node:test` tests) · `npm run build` · `npm run preview`
- Brand assets: `node scripts/generate-brand-assets.cjs` regenerates every PNG from the logo
- Acceptance checks, one per audit ID: `npx vite preview --host 127.0.0.1 --port 4173 --strictPort &` then `node docs/audit/check.cjs [--only=A1,B3] [--strict]`

## Rules

- No network requests, analytics, accounts or servers. Data stays in `localStorage` or in files the user exports.
- Pass every user string through `esc()` before `innerHTML`, and every stored or imported record through `validateSession()`.
- Use the supported `node --test` command on Node >=22.12; do not reintroduce `--test-isolation=none`, which Node 22 rejects.
- Pure logic belongs in `src/data.js`, `src/format.js` (display formatters), `src/chart.js` (chart geometry) or `extension/core.js`, and each logic change gets a unit test.
- `package.json` is ESM, so CommonJS scripts must be `.cjs`. Name Playwright specs `*.spec.js`, not `*.test.js`.
- Hash routing: `href="#x"` for anything that isn't a view name re-routes to Overview. Use buttons for in-page jumps.
- `renderContent()` rewrites `innerHTML`; filtering uses `updateResults()`, which only touches `[data-region]` containers. Never re-render the search input or provider select.
- Production builds carry a CSP (`vite.config.js`): no inline scripts, no third-party origins.
- `main` auto-deploys to GitHub Pages, so work on a branch named `feature/<name>` (the owner's convention). After fixing an audit ID, run its check and update `WORK_STATUS.md` §2 and §12.
