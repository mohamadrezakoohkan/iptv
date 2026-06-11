---
id: TASK-0012
adr: ADR-0005
evolution: 2
status: done
attempts: 1
depends_on: [TASK-0011]
---

# TASK-0012 — `loadM3u(url)` fetch+parse integration in `client/api.js`

## Goal

`client/api.js` gains a `loadM3u(url)` async function that fetches the M3U
file through the existing `/api/xtream?url=<encoded>` proxy, passes the
response text to `parsM3u`, and returns
`{ ok: true, val: { server, host, user, categories, channels } }` on success
or `{ ok: false, err: string }` on failure.

`IptvApi.connect(url, user, pass)` is updated: when `isM3u(url, user, pass)`
returns `true`, execution is routed through `loadM3u(url)` instead of the
Xtream path. The public return shape is the same in both modes so callers
(including `client/ui.js`) need no changes.

## Acceptance criteria

- [ ] `IptvApi.connect("https://iptv-org.github.io/iptv/index.m3u", "", "")`
      resolves to `{ ok: true, val: { ... } }` (verified with a mock fetch
      that returns a valid M3U fixture — no live network call in tests).
- [ ] On a proxy fetch that returns HTTP ≥ 400, `connect` resolves to
      `{ ok: false, err: <message> }` and does not throw.
- [ ] On a proxy fetch that returns valid HTTP 200 but non-M3U body,
      `connect` resolves to `{ ok: false, err: 'not an M3U file' }`.
- [ ] The proxy URL constructed is
      `/api/xtream?url=<encodeURIComponent(m3uUrl)>` — verified in a unit
      test by spying on the fetch call.
- [ ] `val.host` equals the hostname of the M3U URL.
- [ ] `val.user` is an empty string.
- [ ] `val.server` is `null`.
- [ ] `val.categories` and `val.channels` are arrays (non-empty for a
      valid fixture).
- [ ] All of the above are covered by unit tests in `tests/api.test.js`
      using Vitest's `vi.fn()` / `global.fetch` mock — no live network.

## Test requirements

- **Unit:** mock `global.fetch` (or `window.fetch`) in the test to return a
  canned M3U text fixture. Test: success path, HTTP error path, non-M3U
  body path, correct proxy URL construction.
- **UI:** Playwright test that loads the app, enters
  `https://iptv-org.github.io/iptv/index.m3u` into the Portal URL field
  (with Username and Password empty), clicks Connect, and asserts that
  either the channel grid becomes visible (happy path, requires live network)
  **or** — if live network is unavailable in CI — that the footer shows an
  error message rather than a JS exception. The test must not be skipped; it
  must handle both outcomes gracefully.

## Implementation notes

### Files touched

- `client/api.js` — Added `fetchTxt(src)` helper (raw text fetch, same 15s timeout+abort pattern as `loadJson`), `hostOf(url)` pure helper (extracts hostname via `new URL`), `loadM3u(url)` async function (builds proxy URL, calls `fetchTxt`, passes text to `parsM3u`, maps result to `{server:null, host, user:'', categories, channels}`), and `loadXtream(src, opts)` (extracted from original `connect` body). Updated `connect(src, opts)` to dispatch: demo → `loadDemo`, M3U → `loadM3u`, else → `loadXtream`. Added `loadM3u` to `window.IptvApi` exports.
- `tests/unit/api.test.js` — Added `describe('connect(m3uUrl) — loadM3u integration')` with 4 tests: success path, HTTP 404 path, non-M3U body path, proxy URL construction verification.
- `tests/ui/m3u.test.js` — New Playwright test: navigates to localhost:3000, fills M3U URL with empty credentials, clicks Connect, races `#footer-conn` vs `#footer-err` within 15s, asserts either visible outcome and no JS exceptions.
- `adrs/ADR-0005-m3u-playlist-support.md` — Updated `governs:` to add `tests/unit/api.test.js` and `tests/ui/m3u.test.js`.

### Non-obvious choices

- `parsM3u` is declared after `loadM3u` in the source file, but function declarations inside an IIFE are hoisted, so forward reference is safe.
- `connect()` previously used `opts.user` / `opts.pass` directly without null-guarding opts. The new implementation guards `(opts && opts.user) || ''` since the M3U path may be called with `{}` (empty opts).
- The UI test uses `Promise.race` to handle both network-available and network-unavailable CI environments; either outcome is acceptable as long as no JS exception fires.
