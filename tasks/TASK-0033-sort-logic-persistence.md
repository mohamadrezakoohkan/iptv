---
id: TASK-0033
adr: ADR-0017
evolution: 9
status: pending
attempts: 0
depends_on: []
---

# TASK-0033 — Channel sort tokens, comparator, and persistence

## Goal

`client/srch.js` exposes the four sort tokens and a pure comparator so the
channel grid can be ordered by user choice, and `client/st.js` + `client/cfg.js`
carry and persist the active token. After this task `getChs` accepts a `sort`
argument and applies it as the final ordering step; the preference survives a
reload. No UI control yet (TASK-0035) — but because `getChs` gains a required
new argument, every existing call site must be migrated in this same task so the
runtime is never half-migrated (E7 staged-migration lesson).

## Acceptance criteria

- [ ] `window.IptvSrch.SORTS` is an array of `{ id, label }` for exactly the
      four tokens `num-asc`, `name-asc`, `name-desc`, `fav-first`, with
      human-readable labels, in that order.
- [ ] `getChs(chs, q, flt, favs, sort)` orders its filtered result by `sort`:
      `num-asc` = `num` ascending; `name-asc`/`name-desc` = channel name
      case-insensitive `localeCompare` A→Z / Z→A with `num`-asc tiebreak;
      `fav-first` = channels whose `id` is in `favs` first then the rest, each
      partition `num`-asc.
- [ ] An unknown or omitted `sort` value falls back to `num-asc` (current
      behaviour preserved).
- [ ] `getChs` remains pure: no reads of `ST`, `window`, or the DOM.
- [ ] `ST.sort` exists with default `'num-asc'`; `setSort(token)` is the only
      writer and is exported from `IptvSt`.
- [ ] `S.sortKey === 'iptv_sort'` is declared in `client/cfg.js`.
- [ ] `saveSt('sort')` writes `ST.sort` to `iptv_sort`; `loadSt` reads
      `iptv_sort` and sets `ST.sort` only when the stored value is one of the
      four known tokens (unknown/absent → default retained).
- [ ] Every existing `getChs` call site passes the active sort token
      (`client/ui.js` `fireSrch`, `onCatClick`, `onOk`, and the disconnect/
      reset path; `client/main.js` restore path) — confirmed by the full UI
      suite loading the real modules, with grid rendering unchanged at the
      default sort.

## Test requirements

- **Unit:** `getChs` for each of the four tokens (correct order incl. tiebreaks
  and `fav-first` partitioning), unknown/omitted token → `num-asc`, purity
  (no `ST`/DOM). `SORTS` shape/content. `setSort` mutates only `ST.sort`.
  `saveSt('sort')`/`loadSt` round-trip including rejection of an unknown stored
  token. Follow R-0001: do not assert DOM attribute mutations not present in
  baseline HTML — these are non-DOM unit tests.
- **UI:** load the app (demo mode) and assert the default grid order is
  unchanged (regression: every call site migrated correctly, no runtime error
  from the new argument). No new visible control is required by this task.
- **Integration:** n/a — no external connectivity (pure logic + localStorage).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
