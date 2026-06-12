---
id: TASK-0019
adr: ADR-0008
evolution: 4
status: done
attempts: 1
depends_on: [TASK-0018]
---

# TASK-0019 — Persist login mode in `iptv_creds` + reconnect with stored mode

## Goal

The chosen login mode is part of the persisted session: a successful connect
stores `{ url, user, pass, m3u }` in `iptv_creds`, and the page-load
auto-reconnect in `client/main.js` replays `connect()` with the stored
`m3u` flag instead of relying on any detection. Legacy stored creds without
the flag are migrated deterministically at read time.

## Acceptance criteria

- [ ] After a successful connect in `m3u` mode, `iptv_creds` contains
      `m3u: true`; after a successful connect in `xtream` (or demo) mode it
      contains `m3u: false`.
- [ ] Auto-reconnect passes the stored `m3u` value to
      `IptvApi.connect(url, { user, pass, m3u })`.
- [ ] A legacy `iptv_creds` value without `m3u` is interpreted at read time
      as `m3u: true` exactly when `user === '' && pass === ''` and `url` is
      not `"demo"` (case-insensitive), else `m3u: false` — stored-data
      migration only, never applied to live form input.
- [ ] After reconnect into an `m3u` session, the footer mode selector
      reflects `m3u` if the user disconnects (logged-out form shows the
      stored session's mode is not required — default `xtream` after
      disconnect is acceptable; the requirement is only that reconnect
      itself uses the stored flag).
- [ ] Touched files carry `ADR: ADR-0008`; ADR-0008 `governs:` trued up.

## Test requirements

- **Unit:** stored-creds shape after `onOk` includes the correct `m3u` for
  both modes; legacy migration rule (all three derive cases: empty creds +
  http URL → true, non-empty user/pass → false, `demo` → false); reconnect
  call receives the stored flag (connect mocked).
- **UI:** Playwright (extend `tests/ui/persist.test.js` patterns) — connect
  with `demo`, reload, session restores; seed localStorage with an
  `m3u: true` creds object (and a legacy credential-less object) and verify
  reload triggers reconnect through the M3U path (route-mock the proxy
  fetch so no live network is needed in the UI tier).
- **Integration:** n/a — no external connectivity change (persistence +
  reconnect wiring only; full integration suite still runs as the
  regression gate).

## Implementation notes

- `client/ui.js` — `onOk` now stores `{ url, user, pass, m3u }` in
  `iptv_creds`, with `m3u = getMode() === 'm3u'` read from the footer
  selector at success time. Failed connects still write nothing.
- `client/st.js` — new pure helper `getM3u(creds)` (exported on
  `window.IptvSt`): returns an explicit boolean `m3u` untouched; for legacy
  values lacking the flag it derives `user === '' && pass === '' && url is
  not "demo"` (trimmed, case-insensitive). `loadSt()` applies it at read
  time to any parsed creds object, so every consumer downstream sees a
  boolean `m3u`. Migration is read-time only — nothing is written back and
  live form input is never routed through it.
- `client/main.js` — `goLoad` passes `m3u: creds.m3u` to
  `IptvApi.connect`, so auto-reconnect replays the chosen mode (with the
  ADR-0008 transitional heuristic still in `api.js` until TASK-0020, the
  explicit boolean short-circuits before it).
- ADR-0008 `governs:` gained `client/st.js`; `st.js` and `main.js` headers
  now carry `ADR: ADR-0008`.
- Tests: `tests/unit/persist.test.js` extended (29 tests total) — `getM3u`
  derive cases, `loadSt` flag preservation + all three legacy migrations,
  `onOk` stored shape in both modes via a ui.js harness with mocked
  `localStorage`, and main.js reconnect with `connect` mocked. One existing
  expectation updated to the new creds shape (legacy fixture now migrates
  to `m3u: false` — contract change, not a weakening).
  `tests/ui/persist.test.js` extended (6 tests total) — demo connect stores
  `m3u: false` + reload restores; seeded `m3u: true` creds with non-empty
  user/pass reconnect through the M3U proxy path (route-mocked, asserts the
  proxied URL is the playlist and never `player_api.php`); legacy
  credential-less object migrates to the M3U path on reload.
- Non-obvious: the UI m3u-reconnect test deliberately seeds non-empty
  user/pass with `m3u: true` so the transitional heuristic alone could not
  produce the observed M3U routing — the test stays meaningful after
  TASK-0020 removes the heuristic.
