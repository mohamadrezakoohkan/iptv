---
id: ADR-0008
title: Explicit login-mode choice — user-selected Xtream vs M3U, auto-detection removed
date: 2026-06-11
evolution: 4
status: accepted
supersedes: ADR-0005
governs:
  - client/api.js
  - client/ui.js
  - client/main.js
  - client/app.css
  - index.html
  - tests/unit/api.test.js
  - tests/unit/m3u-ui.test.js
  - tests/unit/persist.test.js
  - tests/ui/m3u-ui.test.js
  - tests/ui/m3u.test.js
  - tests/ui/foot.test.js
  - tests/ui/persist.test.js
  - tests/int/m3u.test.js
  - tests/int/strm.test.js
---

# ADR-0008 — Explicit login-mode choice — user-selected Xtream vs M3U, auto-detection removed

## Context

ADR-0005 (E2) added M3U playlist support with **auto-detection**: the pure
heuristic `isM3u(url, user, pass)` in `client/api.js` decided the connect
path (URL ends in `.m3u`/`.m3u8`, or credentials absent on a plain http(s)
URL), and `updM3u`/`onUrlInput` in `client/ui.js` hid the Username/Password
fields the moment the typed URL looked like a playlist.

The human now directs (E4 prompt): *"make login with username and password
user choice, don't auto detect — allow user to decide to login with user and
pass or without."* ADR-0005 itself flagged the heuristic's weakness ("a
future evolution can add explicit mode selection"); this is that evolution.

Constraints:

- ADR-0005's **parse strategy** (`parsM3u` + helpers) and **CORS proxy
  reuse** (`/api/xtream?url=` for M3U fetch, ADR-0002) are sound and must
  carry forward unchanged. Only the detection decision and the auto-driven
  footer UX are replaced.
- The integration tier (ADR-0006/0007, `tests/int/m3u.test.js`,
  `tests/int/strm.test.js`) calls `IptvApi.connect(LIVE_URL, { user: '',
  pass: '' })` and currently relies on the heuristic; those tests must be
  adapted to the explicit mode in the same evolution.
- Persistence (ADR-0003): `iptv_creds` auto-reconnect replays `connect()`
  on page load — it must replay the **chosen** mode, not re-detect.
- CONVENTIONS.md: `m3u` token precedent established at E2 (`isM3u`,
  `loadM3u`, `parsM3u`); handlers `on*`, renders `rnd*` in `ui.js` only;
  async Result type per RULE-FN-4; kebab-case DOM ids (RULE-ID-5).

## Decision

The connection mode is an **explicit user choice**, stated by the caller of
the engine and selected by the user in the footer. URL-shape auto-detection
is removed entirely.

### Engine: explicit mode flag

`IptvApi.connect(src, opts)` accepts `opts.m3u` (boolean, default `false`)
and routes **only** on explicit inputs:

1. `isDemo(src)` → demo playlist (works identically in both modes).
2. `opts.m3u === true` → M3U path (`loadM3u` via the ADR-0002 proxy).
3. otherwise → Xtream path (`loadXtream`).

The `isM3u()` heuristic is **deleted** — removed from routing, from the
`window.IptvApi` export surface, and from `client/api.js`. A `.m3u8` URL
with `m3u` unset is treated as an Xtream portal; a credential-less plain
URL with `m3u: true` is treated as a playlist. No caller may infer the mode
from the URL.

(Transitional note: tasks land sequentially; the heuristic may survive as a
default-only fallback between TASK-0017 and TASK-0020 so the full
regression suite stays green after each task, but the evolution's end state
contains no heuristic.)

### Footer: login-mode selector

`index.html` gains a two-option mode selector inside `#footer-login`
(container `#login-mode`, options `#mode-xtream` "Username & Password" and
`#mode-m3u` "Playlist URL only") — a radio group styled as a segmented
control, keyboard-accessible, default `xtream`.

In `client/ui.js`, `onMode` (selector change handler) and `rndMode`
(renderer) replace `updM3u`:

- mode `m3u` → add `is-m3u` class to `#footer-login` (existing `app.css`
  rule hides `.field-user`/`.field-pass`); hint text
  `Paste an .m3u / .m3u8 playlist URL — no login needed.`
- mode `xtream` → remove `is-m3u`; hint text
  `Type "demo" to try a sample playlist.`
- `onUrlInput` keeps only its Connect-button enable/disable duty; it no
  longer touches mode, class, or hint.

`runConn` passes the selected mode to `connect()` as `opts.m3u`.

### Persistence: the mode is part of the session

`iptv_creds` becomes `{ url, user, pass, m3u }`. Auto-reconnect
(`client/main.js`) passes the stored `m3u` to `connect()`. Legacy stored
values without `m3u` are migrated at read time, deterministically: `m3u =
(user === '' && pass === '' && url is not "demo")`. This migration applies
to stored data only — never to live form input.

### Integration tests state the mode

`tests/int/m3u.test.js` and `tests/int/strm.test.js` call
`connect(LIVE_URL, { user: '', pass: '', m3u: true })`.

## Consequences

**Easier:**
- No misrouting edge cases: credentialled `.m3u8` portals and
  extension-less playlist URLs both work — the user says what they mean.
- The engine API is fully explicit; tests document intent instead of
  relying on heuristic side effects.
- The footer UX is predictable: fields never appear/disappear while typing.

**Harder:**
- One extra click for M3U users (select "Playlist URL only" first).
- The mode must be threaded through persistence and reconnect; a missed
  call site silently falls back to Xtream and fails on playlists — covered
  by tests.
- `tests/unit/m3u-ui.test.js` / `tests/ui/m3u-ui.test.js` (auto-detect
  behavior) must be rewritten for the toggle-driven behavior, and
  `tests/unit/api.test.js` heuristic cases replaced with explicit-routing
  cases.

**Ruled out:**
- Any URL-shape inference at any layer (engine, UI, reconnect).
- A third "auto" mode option (explicitly against the prompt).
- Server-side changes (proxy reuse from ADR-0002/0005 is untouched).

## Supersedes

Supersedes **ADR-0005** (pointer there: `superseded (by ADR-0008)`). Its
M3U **parse strategy** (`parsM3u`, `mkM3uCh`, attribute extraction, CH_DEF
conformance, category derivation) and **CORS proxy reuse** decisions are
reaffirmed and carry forward unchanged under this ADR's governance; its
**detection heuristic** and **URL-driven footer adaptation** decisions are
replaced as decided above.

## Tasks derived

- TASK-0017 — Engine: explicit `opts.m3u` connect routing + integration-test adaptation
- TASK-0018 — Footer login-mode selector UI (markup, CSS, handlers, hint text)
- TASK-0019 — Persist login mode in `iptv_creds` + reconnect with stored mode
- TASK-0020 — Remove the `isM3u` auto-detect heuristic entirely

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0008` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change
removes the last governed code, this ADR is marked `status: deleted` — the
file itself is never removed; it is history.
