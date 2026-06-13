---
id: TASK-0044
adr: ADR-0022
evolution: 13
status: done
attempts: 1
depends_on: [TASK-0043]
---

# TASK-0044 — Render contextual no-content grid placeholders + actions

## Goal

When the channel grid renders zero cards, it shows a structured placeholder
(icon + title + guidance + optional action button) chosen by
`IptvEmpty.resolveContent` (TASK-0043) instead of the flat `No channels found.`
string, per `specs/empty-states.md` §2. The action buttons clear the search or
switch to "All Channels" through the app's existing handlers. After this task the
user always sees why a list is empty and a one-tap way out where one exists.

## Acceptance criteria

- [ ] `rndGrid` in `client/ui.js` renders the empty grid from
      `IptvEmpty.resolveContent({ total, shown, flt, srch, favs })`, emitting the
      icon, title, body, and (when present) action button inside the `.ch-empty`
      block; `client/ui.js` ADR comment line includes `ADR-0022`.
- [ ] No-search-match shows "No matches", the escaped query in the body, and a
      "Clear search" button; clicking it clears the search input and re-renders
      the grid to the unfiltered (within current category) result.
- [ ] Empty favourites filter shows "No favourites yet" and a "Browse all
      channels" button that sets the active category to "All Channels" and
      re-renders.
- [ ] Empty specific category shows "Nothing in this category" + "Browse all
      channels" action; a zero-channel source shows "No channels" with no action.
- [ ] The placeholder container carries `role="status"`; the icon carries
      `aria-hidden="true"`; the action button is keyboard-focusable with a
      discernible accessible name.
- [ ] `.ch-empty` placeholder styling (icon, title, body, button) is added to
      `client/app.css` using existing CSS tokens and `index.html` is updated if
      any static hook is needed.

## Acceptance criteria — actions reuse existing navigation

- [ ] `clear-search` and `view-all` reuse the existing search/category-filter
      paths in `client/ui.js` — no new navigation mechanism is introduced.

## Test requirements

- **Unit:** extend `tests/unit/grid.test.js` (or a focused unit test) to assert
  `rndGrid` produces the contextual placeholder markup for each case
  (no-match / favourites / category / zero-source), including the `role="status"`
  container and the correct action button label/absence. Per R-0001, verify
  against the actual rendered markup, not assumed baseline attributes.
- **UI:** extend `tests/ui/grid.test.js` (Playwright) to drive demo mode, then:
  type a non-matching search → assert "No matches" placeholder + working "Clear
  search" button restores the grid; open the Favourites filter with no favourites
  → assert "No favourites yet" + "Browse all channels" restores all channels.
  Include at least one screenshot of a contextual empty placeholder written to the
  run-artifacts dir.
- **Integration:** n/a — no external connectivity.

## Implementation notes

**Files changed**

- `client/ui.js` — `rndGrid` now resolves the empty grid via
  `window.IptvEmpty.resolveContent({ total, shown, flt, srch, favs })` (reading
  the live `IptvSt.ST`, the same way the other `rnd*` functions read it) and
  emits a structured placeholder via the new `mkEmptyBox` helper:
  `<div class="ch-empty" role="status">` + decorative `aria-hidden` SVG icon
  (`mkEmptyIco`, glyphs in the `EMPTY_ICOS` map) + `.ch-empty-title` +
  `.ch-empty-body` + an optional `<button class="ch-empty-btn"
  data-empty-act="<kind>">` (`mkEmptyBtn`). `onGridClick` routes
  `[data-empty-act]` clicks through `onEmptyAct` → `goClrSrch` / `goViewAll`,
  which reuse the existing search path (`fireSrch`) and the existing
  category-filter path (`setFlt('all')` + `rndSide` + `rndGrid`) — no new
  navigation mechanism. ADR comment line extended with `ADR-0022`.
- `client/app.css` — `.ch-empty` reworked from the old flat `<p>` into a
  centred flex column spanning the grid (`grid-column: 1 / -1`) with styling for
  `.ch-empty-ico`, `.ch-empty-title`, `.ch-empty-body`, and `.ch-empty-btn`
  (hover + `:focus-visible`), all on existing CSS tokens so it themes
  automatically. ADR comment line extended with `ADR-0022`.

**Non-obvious / gotcha**

- empty.js and ui.js are both plain top-level `<script>` files, so their
  top-level `function` declarations share the browser global scope. empty.js
  already defines `mkEmpty(ico, title, body, action)`; the ui.js render helper
  therefore had to be named `mkEmptyBox` — an earlier `mkEmpty` name silently
  overwrote empty.js's resolver helper at runtime (rendered `undefined` title).
  The Vitest unit harness loads each file in an isolated `new Function` scope so
  it did **not** surface this collision; the real-DOM Playwright tier did, which
  is why both tiers are required here.
- No `index.html` static hook was needed (the placeholder renders into the
  existing `#ch-list`), so `index.html` was removed from ADR-0022's `governs:`
  list to keep traceability honest (no unreferenced governed path).

**Tests**

- Unit: extended `tests/unit/grid.test.js` with a `rndGrid — contextual empty
  placeholders` block (7 cases: no-match + escaped query + Clear search,
  empty-favourites + view-all, empty-category, zero-source no-action,
  role/aria-hidden, real `<button>` action, search-over-category precedence),
  asserted against the actual rendered markup per R-0001.
- Unit harness true-up: the synthetic `window` of every unit file that loads
  `client/ui.js` and triggers an empty `rndGrid` (`foot`, `acctui`, `persist`,
  `side`, `themetoggle`, `m3u-ui`, `sort`) now provides an `IptvEmpty` stub; the
  stale `No channels found.` assertion was replaced by the contextual cases.
- UI: extended `tests/ui/grid.test.js` with three Playwright tests driving real
  demo mode — no-match search shows "No matches" and "Clear search" restores the
  grid; empty-favourites shows "No favourites yet" and "Browse all channels"
  restores all 31 channels; placeholder icon is `aria-hidden`. Screenshot
  written to `test-results/task-0044-empty-no-match.png`.

**ADR traceability**

- `client/ui.js` + `client/app.css` carry `ADR-0022`; ADR-0022 `governs:`
  trued up to `[client/ui.js, client/app.css]`.
</content>
