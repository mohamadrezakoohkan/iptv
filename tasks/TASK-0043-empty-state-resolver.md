---
id: TASK-0043
adr: ADR-0021
evolution: 13
status: pending
attempts: 0
depends_on: []
---

# TASK-0043 — Empty-state resolver module (client/empty.js)

## Goal

A new client module `client/empty.js` exists, exposing `window.IptvEmpty` with
two pure resolvers that map plain state values to the structured `EmptyState`
shape (`specs/empty-states.md` §1). No DOM access, no globals beyond the export.
It is loaded in `index.html` before `client/ui.js`. After this task the message
logic for every empty/no-signal case is decided in one tested place; rendering
(TASK-0044, TASK-0045) consumes it.

## Acceptance criteria

- [ ] `client/empty.js` exists as an IIFE exposing `window.IptvEmpty` and carries
      an `// ADR: ADR-0021` comment near the top.
- [ ] `IptvEmpty.resolveContent({ total, shown, flt, srch, favs })` returns
      `null` when `shown > 0`, else the matching `EmptyState` per
      `specs/empty-states.md` §2 priority: active search (no matches) →
      `{ icon:'search', title:'No matches', action.kind:'clear-search' }` with
      the body containing the HTML-escaped query; favourites filter empty →
      `{ icon:'star', title:'No favourites yet', action.kind:'view-all' }`;
      specific category empty → `{ icon:'list', title:'Nothing in this category',
      action.kind:'view-all' }`; source with zero channels (`total === 0`) →
      `{ icon:'list', title:'No channels' }` with no action.
- [ ] `IptvEmpty.resolveSignal({ phase, cur })` returns the idle `EmptyState`
      (`specs/empty-states.md` §3a) — title "NO SIGNAL", body adapting to session
      presence, `action.kind:'connect'` only when there is no session — for the
      non-PLAY non-ERR case, and the stream-error `EmptyState`
      (`specs/empty-states.md` §3b) — title "This channel won't play", a friendly
      body, `action.kind:'retry'` — when `phase === 'ERR'` and `cur` is set.
- [ ] Both resolvers are pure: same inputs → same output, no DOM, no other
      globals read or written.
- [ ] Every `action.kind` value is one of the fixed set
      `clear-search | view-all | retry | connect`.

## Test requirements

- **Unit:** new `tests/unit/empty.test.js` covering, for `resolveContent`:
  non-empty (`null`), no-search-match (correct icon/title/action + escaped query),
  favourites-empty, category-empty, and zero-channel source; for `resolveSignal`:
  idle-with-session, idle-no-session (connect action present), and stream-error
  (retry action + constant headline). Assert returned plain objects field-by-field.
  Per R-0001, this task asserts pure-function return values, not DOM attribute
  mutations.
- **UI:** n/a — not user-facing on its own (pure module; rendered by TASK-0044/45).
- **Integration:** n/a — no external connectivity.

## Implementation notes

_Filled by implement-agent._
</content>
