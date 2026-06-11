---
id: TASK-0015
adr: ADR-0007
evolution: 3
status: pending
attempts: 0
depends_on: [TASK-0014]
---

# TASK-0015 — Live engine connect+load integration test (iptv-org index.m3u)

## Goal

`tests/int/m3u.test.js` exists and proves the complete client engine path —
`IptvApi.connect` → `isM3u` routing → `loadM3u` → proxy fetch → `parsM3u` —
works against the live `https://iptv-org.github.io/iptv/index.m3u` playlist,
not fixtures. The test boots the in-process server (TASK-0014 pattern),
loads `client/api.js` under a `global.window` stub (the existing
`tests/unit/api.test.js` pattern), and installs a named fetch shim that
resolves the engine's relative `/api/xtream?...` path against the ephemeral
server base URL.

## Acceptance criteria

- [ ] `tests/int/m3u.test.js` exists, carries `// ADR: ADR-0007` near the
      top, declares `https://iptv-org.github.io/iptv/index.m3u` and
      `iptv-org.github.io` as file-level SCREAMING_SNAKE constants, and
      tears down the in-process server in `afterAll`.
- [ ] The fetch shim is a named function (RULE-FN-5) that prefixes
      relative URLs (starting with `/`) with `http://127.0.0.1:<port>` and
      delegates to native fetch unchanged otherwise.
- [ ] `window.IptvApi.connect(LIVE_URL, { user: '', pass: '' })` resolves
      to `{ ok: true, val }` — the Result shape of RULE-FN-4.
- [ ] `val.host === 'iptv-org.github.io'`, `val.user === ''`, and
      `val.server === null`.
- [ ] `val.channels.length > 100` and `val.categories.length > 1`.
- [ ] A deterministic sample of channels (first, middle, last) conforms to
      `CH_DEF` (CONVENTIONS.md §7): `id`, `name`, `grp`, `url`, `img`,
      `cat` are strings, `num` is a number, `name` is non-empty, and `url`
      matches `^https?://`.
- [ ] Every category object in `val.categories` has string `category_id`
      and `category_name` (the sidebar contract from ADR-0005).
- [ ] The full unit, UI, and integration suites pass (live network
      required for the integration suite).

## Test requirements

- **Unit:** none new — engine logic is already unit-tested
  (TASK-0011/0012); this task adds live coverage only. Existing unit suite
  must stay green.
- **UI:** n/a — not user-facing.
- **Integration:** `tests/int/m3u.test.js` as specified in the acceptance
  criteria — the live engine connect+load assertions.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
