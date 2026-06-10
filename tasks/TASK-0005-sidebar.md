---
id: TASK-0005
adr: ADR-0001
evolution: 1
status: pending
attempts: 0
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
