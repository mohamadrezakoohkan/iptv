---
id: TASK-0019
adr: ADR-0008
evolution: 4
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
