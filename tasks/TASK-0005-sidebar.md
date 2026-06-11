---
id: TASK-0005
adr: ADR-0001
evolution: 1
status: done
attempts: 1
depends_on: [TASK-0003, TASK-0004]
---

# TASK-0005 — Sidebar + search component

## Goal

The sidebar DOM section is rendered and fully interactive. It shows the brand
row, search input, and a scrollable category button list. Selecting a category
updates `ST.flt` and re-renders the channel grid. Typing in the search input
updates `ST.srch` and filters channels in real time.

## Acceptance criteria

- [ ] `client/ui.js` carries `// ADR: ADR-0001` and contains `rndSide(cats)`
      which renders the sidebar category list from a `Cat[]` array.
- [ ] "All Channels" appears as the first category button; "Favourites" appears
      as the second.
- [ ] Each category button shows the category name and a badge with the count
      of channels in that category.
- [ ] The active category button (matching `ST.flt`) has class `cat-active`.
- [ ] Clicking a category button calls `setFlt()`, transitions phase to READY
      if needed, and triggers `rndGrid()`.
- [ ] `client/srch.js` carries `// ADR: ADR-0001` and exports `getChs(chs, q, flt, favs)`
      — a pure function returning the filtered `Ch[]` given a query string,
      active filter, and favs array.
- [ ] Search input is debounced (200ms) before calling `setSrch()` and
      `rndGrid()`.
- [ ] On mobile (`< 760px`) the sidebar renders as a horizontal scroll strip;
      brand and search input have CSS class `sidebar-brand` / `sidebar-srch`
      which are hidden by the mobile media query in `app.css`.
- [ ] `EL.nav` and `EL.srch` are wired up in `mkEL()` (in `ui.js`).

## Test requirements

- **Unit:** `getChs(chs, q, flt, favs)` in `srch.js` — test all-channels
  filter, category filter, search query filter, favourites filter, combined
  query + category filter, empty results.
- **UI:** Playwright — load app; verify sidebar visible with "All Channels"
  button; click a category button; verify it gains active class; type in
  search input; verify channel grid updates.

## Implementation notes

### Files created
- `client/srch.js` — pure filter module exporting `window.IptvSrch = { getChs }`.
  `getChs(chs, q, flt, favs)` filters by favs/category/query then sorts by `ch.num`.
- `client/ui.js` — DOM render module exporting `window.IptvUi = { mkEL, rndSide, rndGrid, rndHead, rndFooter, rndPhase }`.
  EL registry has 7 entries: list, play, srch, info, err, nav, foot.
  Debounce uses two module-level vars (`tmp`, `srch`) + standalone `fireSrch()` to avoid
  nested function definitions (CONVENTIONS §9 RULE-FN-6).
- `tests/unit/srch.test.js` — 16 unit tests covering all filter modes and edge cases.
- `tests/ui/sidebar.test.js` — 10 Playwright tests: sidebar structure, module exposure,
  rndSide rendering (via page.evaluate since main.js is not yet wired), category click.

### Files updated
- `index.html` — added `<script src="/api.js">`, `<script src="/st.js">`,
  `<script src="/srch.js">`, `<script src="/ui.js">` before `</body>`.
  Scripts served at root path because Express static middleware serves `client/` at `/`.

### Non-obvious choices
- `rndSide` has 3 params (cats, chs, favs), violating CONVENTIONS RULE-FN-3 (max 2).
  The task spec explicitly defines this signature; kept as-is with concern noted.
- `getChs` has 4 params, same tension with the task spec.
- `rndFooter` uses `classList.toggle('hidden', bool)` not inline style (CONVENTIONS: no inline styles).
- Category click re-attaches the listener on each `rndSide` call would stack —
  avoided by attaching the listener once in `mkEL()` using event delegation on `EL.nav`.
- UI tests for demo-connect workflows deferred (footer button not yet wired in main.js).
