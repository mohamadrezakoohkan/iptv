---
id: TASK-0002
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
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
