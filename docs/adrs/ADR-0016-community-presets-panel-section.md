---
id: ADR-0016
title: Community presets section in the account panel — a default, selectable list provided by the community
date: 2026-06-12
evolution: 8
status: accepted
governs:
  - src/index.html
  - src/client/app.css
  - src/client/ui.js
  - src/tests/unit/acctui.test.js
  - src/tests/ui/acct.test.js
---

# ADR-0016 — Community presets section in the account panel — a default, selectable list provided by the community

## Context

E8 prompt: add the iptv-org community playlists as a **default account list**
that *"user can select from … provided by community."* ADR-0015 decided the
data (a curated `S.psts` list of iptv-org M3U playlists) and the connect
semantics (selecting a preset connects on the M3U path and becomes an ordinary
saved `Acct`). This ADR decides the **UI surface**: where the community list
appears in the account panel (ADR-0014), how it is labelled, and how a
selection click drives the connect.

The account panel (ADR-0014, `#acct-panel`) currently renders, top to bottom: a
header, the connected-account block (`#acct-conn`), the saved-accounts list
(`#acct-list`, rendered by `rndList`/`mkRow`), and the "Add account" button
(`#acct-add`). The panel surfaces are produced by `rndAcct()` in `client/ui.js`
(the only file with `rnd*`/DOM access, CONVENTIONS.md §10), which is called
after every connect/disconnect/switch/add/remove. Selection of a saved account
is delegated in `onAcctList(evt)` via `[data-acct]`/`[data-rm]`; switching is
the async `goSwitch`→`runSwitch`→`onSwOk` path.

The prompt's "other accounts list provided by community" is distinct from the
user's own saved accounts: the community list is always present (default,
read-only catalog) and its rows are *connect shortcuts*, not removable saved
accounts. So it is a **separate section** in the panel, not merged into
`#acct-list`.

CONVENTIONS.md applies: all DOM writes via `rnd*` in `ui.js`, no inline styles
(visual state via CSS classes, §10), handlers `on*`, `EL` registry, kebab-case
ids, ≤ 20-line functions.

## Decision

### A "Community" section below the saved-accounts list

A new block `#acct-psts` is added to `#acct-panel` (in `index.html`), placed
**after** the saved-accounts list (`#acct-list`) and **before** the "Add
account" button. It has a small section heading (e.g. "Community playlists")
and a list of preset rows. It is always rendered — present even when the user
has zero saved accounts — so the community list is the "default" list the
prompt asks for.

### Preset rows

Each preset (from `S.psts`, ADR-0015) renders as one row showing the preset
`name` and its playlist `url`, carrying a select target `data-pst="<idx>"`
(the index into `S.psts`). A preset row has **no remove control** — the catalog
is static (ADR-0015 ruled out a second store). When a preset's URL matches the
currently active account's connection, its row is visually marked
(`is-active`), so the user sees which community playlist is connected.

### Selection drives an M3U connect

A click on a preset row (delegated, like `onAcctList`) resolves the preset via
`S.psts[idx]`, gets its connection identity (`getPst`, ADR-0015), and connects
on the M3U path, reusing the account machinery:

- It tears down any live session and connects with `connect(pst.url, { user:
  '', pass: '', m3u: true })` (the existing `runSwitch`-style async flow).
- On **success** it becomes a saved + active `Acct` (`mkAcct`→`addAcct`→
  `saveAccts`/`saveAct`, ADR-0015) and the panel/grid/sidebar/footer re-render
  (the existing `onSwOk`-style completion), so the selected preset now also
  appears as a saved account in `#acct-list`.
- On **failure** the store is untouched and the existing inline connect error
  shows (ADR-0008/ADR-0013 invariant).

Clicking a preset whose playlist is already the active account is a no-op (same
guard as `goSwitch`).

### Rendering & handlers (`ui.js`)

- `EL` gains `apst` (`#acct-psts`) — declared once, set in `mkEL`.
- `mkPst(opts)` — pure: one preset-row HTML string (`data-pst`, name + url,
  `is-active` marker when it is the active connection). Mirrors `mkRow`.
- `rndPsts()` — renders the community section from `S.psts` into `#acct-psts`,
  marking the row whose URL is the active account's. Called from `rndAcct()`
  (so the community section stays in sync with connect/switch/add/remove like
  the rest of the panel).
- `onPstList(evt)` — delegates a `[data-pst]` click to a select-preset connect
  (reusing the `runSwitch`/`onSwOk` machinery for a preset that may not yet be
  saved); no-op when that preset is already the active connection.
- Both wired in `mkEL` alongside the existing panel listeners;
  `rndPsts`/`onPstList` exported on `window.IptvUi` for tests.

### Styling & responsive

`#acct-psts` reuses the account-row visual language (`.acct-row*` with a
section heading), no new layout system; on the mobile breakpoint it behaves
like the rest of the full-width panel (ADR-0014). No inline styles — visual
state is CSS classes only (`is-active`).

## Consequences

**Easier:**
- The community playlists are discoverable and one-click connectable from the
  panel the user already knows, with no URL typing — exactly the prompt.
- Reuses the existing switch machinery (`runSwitch`/`onSwOk`) and `Acct` model,
  so a selected preset behaves like any saved account afterward — no new state.
- The community section is static and always present, so it is the natural
  "default account list" with zero extra persistence.

**Harder:**
- `rndAcct` now composes a fourth surface (community section); it must stay in
  sync with the others (already the pattern — one `rndAcct` call site per
  lifecycle event).
- Marking the active preset row requires comparing the active account's URL to
  each preset URL; cheap (≤ 5 presets) and pure.

**Ruled out:**
- Merging presets into `#acct-list` (they are a read-only catalog, not
  removable saved accounts — distinct affordance).
- A remove control on preset rows (the catalog is static — ADR-0015).
- A new state-machine phase for the section (presentational only — panel open
  state stays the single `is-open` class, CONVENTIONS.md §6, ADR-0014).

## Tasks derived

- TASK-0032 — Render the community presets section in the panel + wire
  selection to an M3U connect (depends on TASK-0031 data + ADR-0014 panel)

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0016` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
