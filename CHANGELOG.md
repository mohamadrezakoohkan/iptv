# CHANGELOG — Evolution Log

Every build prompt processed by the orchestrator becomes the next numbered
entry. Maintained by review-agent (format below); numbers are contiguous.

---

## #1 — 2026-06-11 — IPTV Player broadcast console (initial build)

- **Prompt:** Build an IPTV Player broadcast console — single-page web app connecting to Xtream-compatible portals with category browsing, channel search, favourites, HLS playback via hls.js, and localStorage persistence.
- **Outcome:** Shipped. All 10 tasks completed and validated.
- **ADRs:** ADR-0001 (client stack — vanilla JS + state machine), ADR-0002 (server stack — Node.js + Express, CORS proxy), ADR-0003 (persistence — localStorage), ADR-0004 (video playback — hls.js).
- **Tasks:** 10 done, 0 failed, 0 blocked. TASK-0001 scaffolding · TASK-0002 API client · TASK-0003 state machine · TASK-0004 CSS · TASK-0005 sidebar + search · TASK-0006 channel grid · TASK-0007 player (hls.js) · TASK-0008 footer · TASK-0009 entry point · TASK-0010 localStorage persistence.
- **Tests:** 178 unit (Vitest) + 60 UI (Playwright) — all passing.
- **Rules earned:** none.
- **Artifacts:** `index.html`, `client/{api,app.css,cfg,main,nav,play,srch,st,ui}.js`, `server/{cfg,rtr,srv}.js`, `specs/iptv-player.md`, `adrs/ADR-000{1,2,3,4}-*.md`, `tasks/TASK-000{1..10}-*.md`, `tests/unit/{api,cfg,foot,grid,persist,play,rtr,srch,st}.test.js`, `tests/ui/{css,foot,grid,persist,placeholder,player,sidebar,smoke}.test.js`.

---

## #0 — 2026-06-11 — Harness bootstrapped

- **Prompt:** Install the orchestration harness (orchestrator + spec /
  implement / validate / review agents, failure→rule learning loop).
- **Outcome:** Shipped. Harness installed; no product exists yet.
- **ADRs:** none (harness setup predates product decisions).
- **Tasks:** none.
- **Rules earned:** none.
- **Artifacts:** `CORE_FLOW.md`, `CLAUDE.md`, `.claude/agents/{spec,implement,validate,review}-agent.md`, templates in `adrs/`, `tasks/`, `failures/`, seed `specs/project.md`, this file, `README.md`.
