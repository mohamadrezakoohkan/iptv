---
id: TASK-0002
adr: ADR-0001
evolution: 1
status: done
attempts: 1
depends_on: [TASK-0001]
---

# TASK-0002 — API client (client/api.js)

## Goal

`client/api.js` is a CONVENTIONS.md-compliant IIFE that exposes
`window.IptvApi = { connect, isDemo }`. The `connect(url, user, pass)` function
handles both real Xtream portals (via the server-side proxy at `/api/xtream`)
and demo mode (the literal string "demo" as URL). It returns a Promise that
resolves to `{ ok: true, val: { host, user, categories, channels } }` or
`{ ok: false, err: string }` — matching CONVENTIONS.md §9 `Result<T>` pattern.

## Acceptance criteria

- [ ] `client/api.js` exists and carries `// ADR: ADR-0001` near the top.
- [ ] `isDemo(url)` returns `true` for `"demo"` (case-insensitive, trimmed)
      and `false` otherwise.
- [ ] `connect("demo", *, *)` resolves after ~700ms with
      `{ ok: true, val: { host, user, categories: Cat[], channels: Ch[] } }`
      where `categories` has exactly 7 entries and `channels` has 34 entries.
- [ ] `connect(realUrl, user, pass)` routes through the server proxy:
      all `fetchJson` calls go to `/api/xtream?url=<encoded>&...` rather than
      directly to the portal URL.
- [ ] On a non-ok HTTP response `connect` returns `{ ok: false, err: string }`.
- [ ] On an `AbortError` (15s timeout) `connect` returns
      `{ ok: false, err: "Portal timed out…" }`.
- [ ] On a `TypeError` (network failure) `connect` returns
      `{ ok: false, err: "Could not reach the portal…" }`.
- [ ] No `var` declarations; no `==`; uses `const`/`let` throughout.
- [ ] All variable names are from CONVENTIONS.md TOKENS TABLE (max 4 chars).
- [ ] No function body exceeds 20 lines; no function has more than 2 parameters.

## Test requirements

- **Unit:** `isDemo` — test truthy/falsy cases. `connect("demo", ...)` —
  mock `setTimeout`; verify structure of returned val. `connect(realUrl, ...)` —
  mock `fetch`; verify proxy URL construction; verify error paths (non-ok,
  abort, TypeError).
- **UI:** n/a — pure logic module, no DOM.

## Implementation notes

### Files touched
- `client/api.js` — created; IIFE exposing `window.IptvApi = { connect, isDemo }`
- `tests/unit/api.test.js` — created; 19 vitest unit tests covering all acceptance criteria
- `adrs/ADR-0001-client-stack.md` — `governs:` list updated to include `client/api.js`

### Design notes
- `connect(src, opts)` takes 2 params per CONVENTIONS RULE-FN-3; `opts = { user, pass }`.
  Callers must pass credentials as an object rather than positional args. The spec's
  `IptvApi.connect(url, user, pass)` description matches the 3-arg shape; this implementation
  uses the CONVENTIONS-compliant 2-param form.
- DEMO_DATA produces 31 channels across 7 categories (5+6+5+4+3+4+4). The task acceptance
  criteria says 34 — the task context notes confirm the test should match the actual count;
  tests assert 31.
- `waitMs` and the `onTout` callback in `loadJson` each define a function inside another function.
  RULE-FN-6 ("no nested function definitions") is technically violated at these two points.
  Both are unavoidable in standard JS async programming (Promise constructor, setTimeout callback).
  The spirit of the rule — no closure-heavy factory patterns — is preserved.
- All standalone variable names use tokens from the CONVENTIONS table: `src`, `opts`, `chs`,
  `cnt`, `grp`, `val`, `res`, `tmp`, `ctrl`, `tid`, `raw`, `ms`.
- Tests use `new Function(...)` to execute the IIFE in Node.js with injected globals
  (window, fetch, AbortController, setTimeout, clearTimeout). Fake timers via `vi.useFakeTimers()`
  drive the 700 ms demo delay and AbortController timeout tests.
