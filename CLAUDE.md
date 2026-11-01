# Orbit: notes for Claude

Orbit is a private, local-first AI-usage dashboard: a static Vite SPA in vanilla JS with no framework and no backend. An optional MV3 Chrome/Edge extension tracks active time and observed send actions on AI sites without reading message text.

**Start here:** [`WORK_STATUS.md`](WORK_STATUS.md) covers status, architecture, invariants, gotchas and next steps. [`AUDIT.md`](AUDIT.md) has the findings with exact fixes (IDs A1–A5, B1–B15, C1–C14, E1–E9, roadmap D1–D14).

## Current handoff

- `feat/observed-ai-usage` includes fetched `origin/main` at `aaa4ff6`; merging main again reported already up to date, with no conflicts.
- Extension v1.1.0 adds active time and observed send actions. These are not provider-confirmed successful replies, tokens, billing, or remaining limits. Unknown metrics stay unavailable.
- 38 automated tests (13 data + 13 accounting + 9 worker + 3 observer) and the production build pass under Node 22. Browser fixtures passed; logged-in provider layouts and real-profile installation are not verified here.
- The feature is pushed for review and is not confirmed deployed. `41fc42a` is only the last deployment reported by the imported audit. GitHub API restrictions prevented automatic PR creation.
- Continue the user's current task; the audit sprint in `WORK_STATUS.md` is a backlog, not an instruction to switch tasks.

## Commands

- `npm ci` · `npm test` (38 automated `node:test` tests) · `npm run build` · `npm run preview`
- Acceptance checks, one per audit ID: `npx vite preview --host 127.0.0.1 --port 4173 --strictPort &` then `node docs/audit/check.cjs [--only=A1,B3] [--strict]`

## Rules

- No network requests, analytics, accounts or servers. Data stays in `localStorage` or in files the user exports.
- Pass every user string through `esc()` before `innerHTML`, and every stored or imported record through `validateSession()`.
- Use the supported `node --test` command on Node >=22.12; do not reintroduce `--test-isolation=none`, which Node 22 rejects.
- Pure logic belongs in `src/data.js` / `extension/core.js`, and each logic change gets a unit test.
- `package.json` is ESM, so CommonJS scripts must be `.cjs`. Name Playwright specs `*.spec.js`, not `*.test.js`.
- Hash routing: `href="#x"` for anything that isn't a view name re-routes to Overview. Use buttons for in-page jumps.
- `renderContent()` rewrites `innerHTML`. Keep inputs outside re-rendered regions.
- `main` auto-deploys to GitHub Pages, so work on a branch. After fixing an audit ID, run its check and update `WORK_STATUS.md` §2 and §12.
