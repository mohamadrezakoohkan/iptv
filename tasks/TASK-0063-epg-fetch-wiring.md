---
id: TASK-0063
adr: ADR-0030
evolution: 19
status: done
attempts: 1
depends_on: [TASK-0062]
---

# TASK-0063 — Wire best-effort EPG fetch into the connect flow (Xtream short-EPG, M3U XMLTV, demo)

## Goal

After a successful connection, the app fetches program-guide data through the
**existing `/api/xtream?url=<encoded>` proxy** and populates `window.IptvEpg`
(TASK-0062), on whichever path matched: Xtream short-EPG per channel
(`get_simple_data_table`), M3U XMLTV via `tvg-id`, and a synthetic in-memory
guide for demo mode. The fetch is **best-effort and non-blocking**: it never
fails or delays the connect/browse, and it triggers a re-render of the now/next
surface as guides arrive. No new server route and no new playback engine.

## Acceptance criteria

- [ ] A guide-fetch function (e.g. exposed from `src/client/api.js` as
      `IptvApi.loadEpg(...)`, or a dedicated `IptvEpg` fetch helper — implement
      against CONVENTIONS) fetches EPG through the existing
      `/api/xtream?url=<encoded>` proxy only; **no new server route** is added to
      `src/server/rtr.js`.
- [ ] **Xtream path:** builds proxied
      `player_api.php?username=…&password=…&action=get_simple_data_table&stream_id=<id>`
      URLs, fetches per channel **batched/budgeted** (a bounded number of
      concurrent requests so a large portal is not hammered), parses each with
      `IptvEpg.parsXtEpg`, and `set(chId, prgs)`.
- [ ] **M3U path:** fetches the XMLTV guide URL through the proxy, parses with
      `IptvEpg.parsXmltv`, then `setAll(map)`; channels match by `tvg-id`
      (the M3U `Ch.id`).
- [ ] **Demo path:** generates a synthetic in-memory guide (a few programs per
      demo channel spanning `Date.now()`) so now/next + schedule are demonstrable
      offline, with **no** network call.
- [ ] EPG fetch is **non-blocking**: connect resolves and channels render before
      any guide is required; a failed/empty/timed-out EPG fetch is swallowed
      (Result-style, RULE-FN-4) and never transitions to `ERR`, never fails
      connect, never blocks browsing.
- [ ] When guides become available the now/next render surface is refreshed
      (a re-render is triggered — coordinated with ADR-0031's render; this task
      may stub the render call behind a guarded `window.IptvUi`/callback so it is
      testable without the UI loaded).
- [ ] No new state-machine phase, no new localStorage key (CONVENTIONS §6, §9
      unchanged).

## Test requirements

- **Unit:** `src/tests/unit/epgfetch.test.js` — with mocked `fetch`: Xtream path
  builds correct proxied `get_simple_data_table` URLs and populates the store;
  batching does not exceed the configured concurrency; M3U path fetches+parses
  XMLTV into the store keyed by tvg-id; demo path populates synthetically with no
  fetch; a rejected/non-ok EPG fetch is swallowed (store stays empty, no throw,
  no phase change). Run under `npx vitest run`.
- **UI:** n/a — render is TASK-0064/0065; this task is the fetch layer.
- **Integration:** `src/tests/int/epg.test.js` (live network, run via
  `npx vitest run --config vitest.int.config.js`) — against the in-process proxy:
  (1) **Xtream tier** — for the personal testing portal
  (`docs/specs/integration-testing.md` Xtream tier), `get_simple_data_table`
  through the proxy returns a parseable payload for at least one sampled live
  channel, yielding ≥ 0 `Prg` (the endpoint responds 200 and parses without
  throwing; EPG availability per channel is best-effort, so the always-up bar is
  "the proxied endpoint responds and parses", not "every channel has listings");
  (2) **XMLTV tier** — fetching a public XMLTV guide URL through the proxy returns
  XML that `parsXmltv` parses into a non-empty `{ [id]: Prg[] }` map. Follow the
  existing tier's flake policy (sample, bounded reads, generous timeouts) from
  `docs/specs/integration-testing.md`.

## Implementation notes

### Files touched

- `src/client/api.js` — added the best-effort, non-blocking EPG fetch layer
  exposed as `IptvApi.loadEpg(opts)` plus `IptvApi.getTvgUrl(text)`:
  - `loadEpg({ src, user, pass, m3u, chs, epgUrl, onDone })` dispatches the
    matched path, populates `window.IptvEpg`, fires `onDone` (the guarded
    re-render hook), and returns a RULE-FN-4 Result. It never throws; per-path
    failures are swallowed so connect/browse are never affected.
  - **Xtream** (`runXtEpg`→`runBatch`→`runXtCh`): builds proxied
    `player_api.php?...&action=get_simple_data_table&stream_id=<id>` URLs via
    `mkEpgUrl`, fetched through the existing `/api/xtream` proxy (no new server
    route), batched `EPG_BATCH=6` concurrent, capped at `EPG_CAP=120` channels,
    parsed with `IptvEpg.parsXtEpg`, stored via `set`.
  - **M3U** (`runM3uEpg`): fetches the XMLTV guide URL through the proxy,
    `parsXmltv` → `setAll`. The guide URL is the playlist's `url-tvg` /
    `x-tvg-url` header attribute, now extracted by `getTvgUrl` and carried on
    `loadM3u`'s `val.epgUrl`.
  - **Demo** (`runDemoEpg`): synthesizes `DEMO_PRGS=4` programs per channel
    spanning `Date.now()` (in-memory, no network).
- `src/client/ui.js` — added `goEpg(opts)` (kicks off the best-effort fetch
  after a successful connect, guarded on `IptvApi.loadEpg`) and `rndGuide()`
  (re-renders the grid from current ST when a guide arrives; passed as the
  `onDone` callback). Wired into `onOk` (footer connect) and `onSwOk`
  (account switch / preset, via `onPstOk`→`onSwOk`). Both exported on
  `window.IptvUi`.
- `src/client/main.js` — auto-reconnect path: `onConnRes` now kicks off
  `IptvUi.goEpg` on success, using the reconnected account's stored identity
  (threaded via module-level `_acct`).
- `src/tests/unit/epgfetch.test.js` — new unit suite (16 tests).
- `src/tests/int/epg.test.js` — new integration suite (5 tests): live Xtream
  short-EPG through the proxy + live XMLTV guide parse.
- `src/tests/unit/api.test.js` — updated the one export-surface assertion to
  include the legitimately added `loadEpg` / `getTvgUrl` (its companion
  "heuristic removed" assertion is unchanged).
- `docs/adrs/ADR-0030-...md` — trued up `governs:` (added `ui.js`, `main.js`,
  `epgfetch.test.js`); ADR decision content untouched.

### Non-obvious notes for reviewers / future tasks

- **No new state-machine phase, no localStorage key, no server route** — the
  fetch goes through the existing `/api/xtream?url=<encoded>` proxy and writes
  only to the in-memory `IptvEpg` store. CONVENTIONS §6/§9 unchanged.
- **Render coupling (ADR-0031, TASK-0064/0065).** `rndGuide()` re-renders the
  grid so the now/next line (added by ADR-0031) surfaces as guides arrive.
  Until ADR-0031 adds that line to `mkCard`, the re-render is a harmless full
  grid re-render; the render-trigger is intentionally a guarded callback
  (`onDone`) so the fetch layer is testable without the UI loaded.
- **XMLTV reference endpoint.** The integration test declares the public XMLTV
  guide as a test-local constant `XMLTV_URL =
  'https://i.mjh.nz/PlutoTV/us.xml'` (a live, well-populated XMLTV mirror in
  the canonical `YYYYMMDDHHMMSS ±HHMM` form), declared once at the top of
  `src/tests/int/epg.test.js` exactly as the M3U/Xtream tiers declare their
  endpoints in their own int files. `docs/specs/integration-testing.md` was
  not edited — editing `docs/specs/` is outside implement-agent's allowed
  writes; spec-agent should mirror this constant into the spec's XMLTV-tier
  table on a later spec pass if a spec-side declaration is desired.
