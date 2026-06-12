# CHANGELOG — Evolution Log

Every build prompt processed by the orchestrator becomes the next numbered
entry. Maintained by review-agent (format below); numbers are contiguous.

---

## #8 — 2026-06-12 — Community preset accounts: selectable iptv-org playlists in the account panel

- **Prompt:** Add iptv-org as a default account in an "other accounts" list users can select from — a community-provided playlist list.
- **Outcome:** Shipped. Both tasks completed and validated, first attempt each.
- **ADRs:** ADR-0015 (community preset accounts — a static, curated, all-M3U `S.psts` catalog of five iptv-org playlists under the durable `https://iptv-org.github.io/iptv/` path, a `Pst` typedef, and a pure `getPst()` helper; selecting a preset connects on the explicit M3U path (ADR-0008) and becomes an ordinary saved `Acct` (ADR-0013) deduped by `url+user+m3u` — no distinct account kind, no second store; introduces the CONVENTIONS `preset → pst` / `presets → psts` tokens) · ADR-0016 (community presets section in the account panel — a default, always-present `#acct-psts` block below the saved-accounts list and above "Add account", read-only catalog rows with no remove control, `is-active` marking the connected preset, one-click M3U connect reusing the `runSwitch`/`onSwOk` machinery; extends ADR-0014 without changing it).
- **Tasks:** 2 done, 0 failed, 0 blocked. TASK-0031 community presets data: `S.psts` curated list, `Pst` typedef, `getPst()` helper (`client/cfg.js`, `client/st.js`, `tests/unit/preset.test.js`) · TASK-0032 render the community presets section + wire selection to an M3U connect (`index.html`, `client/ui.js`, `client/app.css`, `tests/unit/acctui.test.js`, `tests/ui/acct.test.js`). Both first-attempt passes.
- **Tests:** 384 unit (Vitest) + 108 UI (Playwright, incl. the Community playlists section present with zero saved accounts, no-remove affordance, panel DOM order, and the active-preset-click no-op) — all passing. Integration tier (25, live network) last run green at TASK-0032 validation; no new integration command this run — every preset URL is an iptv-org M3U already covered end-to-end by the existing live tier (`tests/int/m3u.test.js` exercises `index.m3u`), and the unchanged M3U engine + proxy path adds no endpoints.
- **Rules earned:** none (no terminal failures).
- **Artifacts:** `client/cfg.js`, `client/st.js`, `client/ui.js`, `client/app.css`, `index.html`, `CONVENTIONS.md` (§1 `preset`/`presets` tokens), `specs/iptv-player.md`, `tests/unit/{preset,acctui}.test.js`, `tests/ui/acct.test.js`, `adrs/ADR-001{5,6}-*.md`, `tasks/TASK-003{1,2}-*.md`.
- **Notes:** this run branched from the E7 branch HEAD (`ai/e7-account-switcher-panel`, PR #8), not from `main`, because the feature extends E7's account panel which is not yet merged; PR #9 therefore includes E7's commits and depends on PR #8 merging first (or together).

---

## #7 — 2026-06-12 — Multiple saved accounts: top-right nav button + right slide-in account panel

- **Prompt:** Add an account feature that displays the connected account and server URL, allows switching and adding accounts, surfaced as a top-right nav button that opens a right-side panel.
- **Outcome:** Shipped. All 4 tasks completed and validated.
- **ADRs:** ADR-0013 (multiple saved accounts — an `iptv_accts` list of `Acct` records + an `iptv_act` active-pointer replace the single `iptv_creds` record; pure `st.js` helpers `loadAccts`/`getAct`/`addAcct` (dedupe by `url+user+m3u`)/`rmAcct`/`mkAcct`/`saveAccts`/`saveAct`/`clearAct`, plus a one-time read-time migration of any legacy `iptv_creds`; supersedes ADR-0003's credential-persistence portion only — `iptv_sel`/`iptv_favs` carry forward) · ADR-0014 (account nav button at the right of `.content-head` + a right slide-in `#acct-panel` aside with scrim, open/close driven solely by an `is-open` CSS class, no new ST phase).
- **Tasks:** 4 done, 0 failed, 0 blocked. TASK-0027 account store: `Acct` type, `S` keys, `st.js` helpers + legacy migration (`client/cfg.js`, `client/st.js`, `tests/unit/{acct,persist,cfg}.test.js`) — required 2 attempts: attempt 1 dropped the legacy `iptv_creds` runtime path before the rewiring task, breaking 6 UI persist tests; attempt 2 retained a compatibility shim that TASK-0029 then removed · TASK-0028 nav button + right slide-in panel shell, CSS, open/close (`index.html`, `client/app.css`, `client/ui.js`, `tests/unit/acctui.test.js`, `tests/ui/acct.test.js`) · TASK-0029 wire connect/reconnect/switch/disconnect through the account store, removing the legacy shim (`client/{cfg,st,main,ui}.js`) · TASK-0030 render panel contents: connected block, list, switch/remove/add (`client/{ui,main,app.css}.js/css`). TASK-0028/0029/0030 first-attempt passes.
- **Tests:** 363 unit (Vitest) + 104 UI (Playwright, incl. the account panel open/close, switch, add, and remove flows) — all passing. Integration tier (25, live network) last run green at TASK-0029 validation; no integration command added this run (reuses the existing `IptvApi.connect`/proxy path).
- **Rules earned:** none (no terminal failures).
- **Artifacts:** `client/cfg.js`, `client/st.js`, `client/main.js`, `client/ui.js`, `client/app.css`, `index.html`, `specs/iptv-player.md` (§13 Accounts + §5a/§9/§12 updates), `tests/unit/{acct,acctui,persist,cfg,foot,side}.test.js`, `tests/ui/{acct,persist}.test.js`, `adrs/ADR-001{3,4}-*.md`, `adrs/ADR-0003-persistence.md` (supersede note), `tasks/TASK-002{7,8,9}-*.md`, `tasks/TASK-0030-*.md`.

---

## #6 — 2026-06-12 — TS→HLS remux fallback for MSE-less devices (iOS Safari)

- **Prompt:** Fix "MPEG-TS not supported" when opening streams after login (MSE-less devices, e.g. iOS Safari).
- **Outcome:** Shipped. Both tasks completed and validated, first attempt each.
- **ADRs:** ADR-0012 (server-side TS→HLS live remux fallback — ffmpeg stream copy via the `ffmpeg-static` npm package, `/api/hls` endpoint with per-source sessions, idle reaping, and segment serving; client falls back to the remuxed HLS through the existing hls.js/native-HLS path when MSE is unavailable; extends ADR-0010/ADR-0011, both stay accepted).
- **Tasks:** 2 done, 0 failed, 0 blocked. TASK-0025 server remux endpoint (`server/hls.js`, mounted from `server/rtr.js`: SSRF-gated `GET /api/hls?url=`, session reuse, `+delete_segments` sliding window, 502 on ffmpeg failure/startup timeout, traversal-safe segment route, idle-reap teardown) · TASK-0026 client fallback (`client/play.js`: `hasTs()` false → `runHls(getRmx(url))` with the raw stream URL, HLS chip reflects the engine in use, "MPEG-TS not supported" only on double failure; MSE-capable behavior byte-identical to E5).
- **Tests:** 297 unit (Vitest) + 89 UI (Playwright, incl. MSE-less stubbed fallback) + 25 integration (Vitest, live network — incl. live remux of a real portal channel to a fetchable `#EXTM3U` playlist with valid TS segments, and the client-built fallback URL proven against the in-process server) — all passing.
- **Rules earned:** none.
- **Artifacts:** `server/hls.js` (new), `server/rtr.js`, `client/play.js`, `package.json` (`ffmpeg-static`), `specs/iptv-player.md`, `specs/integration-testing.md`, `tests/unit/{hls,play}.test.js`, `tests/ui/{fallback,chips}.test.js`, `tests/int/{remux,e2e}.test.js`, `adrs/ADR-0012-server-hls-remux-fallback.md`, `tasks/TASK-002{5,6}-*.md`.

---

## #5 — 2026-06-12 — Xtream connect + stream playback against a personal portal

- **Prompt:** iptv can't connect to the personal Xtream test portal `http://mymax.top:8080` — make it connect and play a stream.
- **Outcome:** Shipped. All 4 tasks completed and validated.
- **ADRs:** ADR-0009 (Xtream path normalizes portal objects into the canonical `Ch` schema, auth check + `allowed_output_formats`-driven stream-URL construction) · ADR-0010 (MPEG-TS playback via mpegts.js 1.7.x CDN, engine selected by stream-URL extension, HLS/TS chips become live engine indicators; refines ADR-0004) · ADR-0011 (proxy follows validated redirects up to 5 hops, pipes long-lived streams without size/timeout caps, aborts upstream on client disconnect; extends ADR-0002).
- **Tasks:** 4 done, 0 failed, 0 blocked. TASK-0021 Xtream normalization + stream-URL building (`client/api.js`, `tests/int/xtream.test.js`) · TASK-0022 proxy redirect-following + stream piping (`server/rtr.js`, `tests/{unit,int}/redir.test.js`) · TASK-0023 dual-engine player mpegts.js/hls.js (`client/play.js`, `client/ui.js`, `index.html`, `tests/unit/play.test.js`, `tests/ui/chips.test.js`) · TASK-0024 live end-to-end proof against mymax.top (`tests/int/e2e.test.js`, `tests/ui/live.test.js`). All first-attempt passes.
- **Tests:** 269 unit (Vitest) + 83 UI (Playwright) + 20 integration (Vitest, live network — including live connect, category/channel listing, and TS-byte playback through the redirect-following proxy) — all passing.
- **Rules earned:** none.
- **Artifacts:** `client/api.js`, `client/play.js`, `client/ui.js`, `index.html`, `server/rtr.js`, `specs/iptv-player.md` (§5a, §8, §10), `tests/unit/{play,side,redir}.test.js`, `tests/ui/{chips,live}.test.js`, `tests/int/{xtream,redir,e2e}.test.js`, `adrs/ADR-00{09,10,11}-*.md`, `tasks/TASK-002{1,2,3,4}-*.md`.
- **Notes:** entry #4 below was recorded retroactively during this review — the E4 run merged (PR #5) without its review-phase CHANGELOG entry, leaving a #3 → #5 gap that this evolution's review closed.

---

## #4 — 2026-06-11 — Explicit login-mode choice (recorded retroactively at E5 review)

- **Prompt:** Explicit login-mode choice — the user picks Xtream vs M3U; URL auto-detection removed.
- **Outcome:** Shipped (merged to `main` as PR #5). Recorded retroactively: the E4 run's review phase never appended this entry; the facts below come solely from the repository's files and git history.
- **ADRs:** ADR-0008 (explicit login-mode choice, supersedes ADR-0005's auto-detection).
- **Tasks:** 4 done, 0 failed, 0 blocked. TASK-0017 engine explicit `opts.m3u` connect routing · TASK-0018 footer login-mode selector UI · TASK-0019 persist login mode in `iptv_creds` + reconnect with stored mode · TASK-0020 remove the `isM3u` auto-detect heuristic.
- **Rules earned:** none recorded (no E4 failure records exist in `failures/`).
- **Artifacts:** `client/api.js`, `client/ui.js`, `index.html`, `adrs/ADR-0008-explicit-login-mode.md`, `tasks/TASK-00{17,18,19,20}-*.md` (per ADR-0008 `governs:` and the task files).

---

## #3 — 2026-06-11 — Live integration tests for the iptv-org M3U engine path

- **Prompt:** Write integration tests validating the engine can connect to and load `https://iptv-org.github.io/iptv/index.m3u` streams over the live network.
- **Outcome:** Shipped. All 3 tasks completed and validated.
- **ADRs:** ADR-0006 (integration-test tier — Vitest separate config `vitest.int.config.js`, in-process Express server on ephemeral ports, live network required, no mocks/auto-skip) · ADR-0007 (live iptv-org M3U validation — full engine-path load assertions plus sampled stream reachability with the ≥ 1-of-5 anti-flakiness criterion).
- **Tasks:** 3 done, 0 failed, 0 blocked. TASK-0014 harness scaffolding (`vitest.int.config.js`, `test:int` npm script, `tests/int/proxy.test.js` live proxy connectivity, 2 tests) · TASK-0015 live engine connect+load (`tests/int/m3u.test.js`, fetch shim + `IptvApi.connect` against the live playlist, 5 tests) · TASK-0016 sampled stream reachability (`tests/int/strm.test.js`, deterministic 5-stream sample, 15 s per-stream timeout, 3 tests). All first-attempt passes.
- **Tests:** 206 unit (Vitest) + 66 UI (Playwright) + 10 integration (Vitest, live network) — all passing.
- **Rules earned:** none.
- **Artifacts:** `vitest.int.config.js` (new), `tests/int/{proxy,m3u,strm}.test.js` (new), `package.json` (`test:int` script), `specs/project.md` (integration canonical command `npx vitest run --config vitest.int.config.js`), `specs/integration-testing.md` (new), `adrs/ADR-000{6,7}-*.md`, `tasks/TASK-001{4,5,6}-*.md`.
- **Notes:** mid-run, `origin/main` (PR #2 merge) was merged into the run branch at the human's request (merge commit 8d975cb).

---

## #2 — 2026-06-11 — M3U playlist URL support

- **Prompt:** Add M3U playlist URL support — users can paste any `.m3u` / `.m3u8` URL (e.g. `https://iptv-org.github.io/iptv/index.m3u`) and the app connects, browses, and plays channels with the same UX as Xtream portals.
- **Outcome:** Shipped. All 4 tasks completed and validated.
- **ADRs:** ADR-0005 (M3U playlist support — detection, parse, CORS proxy reuse, footer UI adaptation).
- **Tasks:** 4 done, 0 failed, 0 blocked. TASK-0001 hot-fix: `res.headersSent` guard in `server/rtr.js` preventing ERR_HTTP_HEADERS_SENT crash · TASK-0011 `isM3u()` + `parsM3u()` pure functions · TASK-0012 `loadM3u()` fetch+parse integration + `connect()` routing · TASK-0013 footer UI adaptation (hide username/password for M3U URLs). TASK-0013 required 3 attempts — initial unit tests incorrectly asserted `setAttribute('required')` on inputs that never carry `required` in the HTML; corrected to `removeAttribute('required')` in both M3U and non-M3U branches, earning R-0001.
- **Tests:** 206 unit (Vitest) + 66 UI (Playwright) — all passing.
- **Rules earned:** R-0001 (FAIL-0001): Before writing unit tests that assert DOM attribute mutations, check the baseline HTML to confirm which attributes are actually present on the element.
- **Artifacts:** `server/rtr.js` (headersSent guard), `client/api.js` (isM3u, parsM3u, loadM3u, connect routing), `client/ui.js` (updM3u, onUrlInput), `client/app.css` (`.is-m3u` hide rules), `index.html` (field-user/field-pass classes), `tests/unit/api.test.js` (extended), `tests/unit/rtr.test.js` (extended), `tests/unit/m3u-ui.test.js` (new), `tests/ui/m3u.test.js` (new), `tests/ui/m3u-ui.test.js` (new), `adrs/ADR-0005-m3u-playlist-support.md`, `tasks/TASK-0001-*.md`, `tasks/TASK-001{1,2,3}-*.md`.

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
