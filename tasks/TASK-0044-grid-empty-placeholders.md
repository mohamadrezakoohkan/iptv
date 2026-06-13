---
id: TASK-0044
adr: ADR-0022
evolution: 13
status: pending
attempts: 0
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

_Filled by implement-agent._
</content>
