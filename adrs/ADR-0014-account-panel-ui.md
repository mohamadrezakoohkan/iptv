---
id: ADR-0014
title: Account navigation button + right slide-in account panel
date: 2026-06-12
evolution: 7
status: accepted
governs:
  - index.html
  - client/app.css
  - client/ui.js
  - tests/unit/acctui.test.js
  - tests/ui/acct.test.js
---

# ADR-0014 — Account navigation button + right slide-in account panel

## Context

E7 prompt: the account feature *"is appearing as a navigation button on top
right corner; when clicked it opens a side bar on right side of the screen"*,
and the panel must *"display connected account and server url, allow account
switching and adding a new account."*

The app has no top-right control today: `index.html`'s `.content-head` (56px
bar above the player) carries the ON AIR badge, channel title, and HLS/TS
chips, but its right edge is free. The footer (ADR-0008) is the only
account-adjacent surface and it shows a single connection. There is no
right-hand panel anywhere in the layout (the left `.sidebar` is the only aside).

The data model for accounts is decided in ADR-0013; this ADR decides only the
**UI surface**: where the button lives, how the panel opens, and what it
renders. CONVENTIONS.md applies: all DOM writes via `rnd*` in `ui.js`, no
inline styles (visual state via CSS class toggling, §10), handlers `on*`,
`EL` registry declared once, kebab-case ids.

## Decision

### Nav button (top-right)

A new account button mounts at the **right end of `.content-head`**
(`#acct-btn`, after the format chips, pushed right with `margin-left:auto`).
It is keyboard-focusable, has `aria-haspopup="dialog"`,
`aria-expanded` reflecting panel state, and `aria-controls="acct-panel"`. Its
label shows the active account name when connected (a person/account glyph +
name, truncated), or a generic "Account" label when no account is active.
Clicking it toggles the panel.

### Right slide-in panel

A new `#acct-panel` aside is added inside `.app`, fixed to the **right edge**,
full height, width ~320px, background `--sur`, left border `--ln`,
`z-index` above content. It is **off-screen by default** and slides in via a
`transform: translateX` transition driven solely by an `is-open` class on the
panel (no inline styles). A dimmed `#acct-scrim` overlay sits behind it; both
the scrim click and an in-panel close button (`#acct-close`) close the panel.
Escape also closes it. The panel is `role="dialog"`,
`aria-label="Accounts"`, `aria-hidden` toggled with `is-open`.

Panel contents (top to bottom):

1. **Header row** — "Accounts" title + close button.
2. **Connected account block** — when an account is active: its **name** and
   its **server URL** (the account `url`; for demo, the literal `demo`),
   plus a small "Connected" status dot. When none is active: a "Not connected"
   line.
3. **Account list** — one row per saved account (`Acct[]` from ADR-0013).
   Each row shows the account name + server URL, marks the active one
   (`is-active` class + a checkmark/dot), and is a switch control
   (`data-acct="<id>"`) — clicking a non-active row switches to it. Each row
   also carries a remove control (`data-rm="<id>"`) to delete that saved
   account.
4. **Add-account action** — a button (`#acct-add`) that closes the panel,
   resets the footer to the logged-out login form (so the user can enter a new
   connection), and focuses the URL field. Adding = connecting a new identity
   through the existing footer flow (ADR-0008); on success it becomes a new
   saved + active account (ADR-0013).

### Rendering & handlers (`ui.js`)

- `EL` gains `apnl` (`#acct-panel`), `abtn` (`#acct-btn`),
  `ascr` (`#acct-scrim`), `acls` (`#acct-close`), `aadd` (`#acct-add`),
  `alst` (`#acct-list`), `acon` (`#acct-conn`) — declared once, set in `mkEL`.
- `rndAcct()` — renders the nav button label, the connected-account block, and
  the account-list rows from the ADR-0013 store. Called after every connect,
  disconnect, switch, add, and remove.
- `onAcctBtn()` toggles the panel; `onAcctClose()` closes it; `onAcctList(evt)`
  delegates row clicks to switch (`data-acct`) or remove (`data-rm`);
  `onAcctAdd()` runs the add-account action. Panel open/close is a single
  `is-open` class toggle on `#acct-panel` and `#acct-scrim` plus the button's
  `aria-expanded` — no other state.
- All of these are wired in `mkEL` alongside the existing listeners; the
  switch/disconnect/add data operations call into the ADR-0013 store helpers
  via the wiring decided in TASK-0029.

### Responsive

On the mobile breakpoint (`< 760px`) the panel becomes full-width
(`width: 100%`); the nav button stays in `.content-head` (which is visible on
mobile). No change to the left sidebar's mobile behavior.

## Consequences

**Easier:**
- A single, discoverable surface names the connected account + server URL and
  hosts switching/adding — exactly the prompt.
- Panel state is one CSS class; no new ST phase, no boolean-flag control flow
  (CONVENTIONS §6 respected — panel visibility is presentational, not a phase).

**Harder:**
- A second aside + scrim + transitions add CSS; focus/escape handling must be
  correct for accessibility (§12).
- `rndAcct` must stay in sync with the footer's connected/disconnected
  rendering so the two surfaces never disagree about the active account.

**Ruled out:**
- A new state-machine phase for "panel open" (it is presentational; phases
  stay INIT/LOAD/READY/PLAY/SRCH/ERR — CONVENTIONS §6).
- Putting the button in the footer or left sidebar (prompt says top-right).
- A full modal that blocks the app (prompt says a right-side sidebar/panel).

## Tasks derived

- TASK-0028 — Account nav button + right slide-in panel markup, CSS, open/close
- TASK-0029 — Wire connect/reconnect/switch/disconnect through the account store
- TASK-0030 — Render account panel contents (connected block, list, switch/remove/add)

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0014` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
