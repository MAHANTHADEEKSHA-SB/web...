# Orbit: notes for Claude

Orbit is a private, local-first AI-usage dashboard: a static Vite SPA in vanilla JS with no framework and no backend. An optional MV3 Chrome/Edge extension tracks active time and observed send actions on AI sites without reading message text.

**Start here:** [`WORK_STATUS.md`](WORK_STATUS.md) covers status, architecture, invariants, gotchas and next steps. [`AUDIT.md`](AUDIT.md) has the findings with exact fixes (IDs A1–A5, B1–B15, C1–C14, E1–E9, roadmap D1–D14).

## Current handoff

- Live: `main` @ `5c223cd` (PR #5: observed AI usage, extension v1.1.0). GitHub Pages deploy run #6 succeeded.
- Awaiting review, stacked (merge in order): `feature/sprint-1` (Sprint 1 + extension 1.1.1, 13/26 checks), then `feature/visual-polish` (chart, search, a11y, first run, demo story, brand assets, CSP; 23/26 checks, 51 tests). Check `git branch -r` for newer `feature/*` branches.
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
