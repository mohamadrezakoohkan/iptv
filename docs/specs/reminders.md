---
status: draft
---

# Program reminders — Remind toggle on the EPG + firing toast/notification

## Purpose

Let the user mark an **upcoming program** for a reminder directly on the EPG
(`docs/specs/epg.md`). A keyboard-focusable **"Remind" toggle** on each row of
the expandable per-channel schedule — and on the NOW/NEXT line — marks a
program; a lightweight client timer checks the pending reminders against
program start times and, when one fires, surfaces an **in-app toast** plus a
**best-effort, permission-gated browser Notification** so the user can jump to
that channel. Reminders can be cleared individually.

This feature is an **added persistence store + render affordance + client
timer only**. It builds directly on the E19 EPG and reuses:

- the canonical `Prg` schema and the in-memory `window.IptvEpg` store /
  now-next / schedule selectors (ADR-0030, `docs/specs/epg.md` §1–§2),
- the existing schedule-row render (`mkSchedRow`) and now/next line
  (`mkNowNext`) in `src/client/ui.js` (ADR-0031),
- the **favourites persistence pattern** (`ST.favs` + the `iptv_favs`
  localStorage key, ADR-0003) for a new localStorage-keyed reminder store,
- the existing toast/log UI posture (`src/client/errlog.js`, the log panel,
  ADR-0027/ADR-0028) for the in-app surface.

It adds **no new state-machine phase** (CONVENTIONS §6 — phases stay
INIT/LOAD/READY/PLAY/SRCH/ERR), **no new playback engine**, and **no new server
route**. It degrades silently when no guide is loaded or notifications are
denied/unsupported.

---

## 1. What a reminder is

A reminder marks a single upcoming program on a single channel. It is
identified by the program's stable coordinates so it can be matched back to the
live `IptvEpg` store and de-duplicated:

| Field   | Meaning                                                              |
|---------|----------------------------------------------------------------------|
| `chId`  | the `Ch.id` / `Prg.chId` the program belongs to                      |
| `start` | the program start time, **unix ms** (the `Prg.start` value)          |
| `title` | the program title at the time the reminder was set (for the toast/notification copy) |

- A reminder's identity is the **`chId` + `start`** pair: a given program
  start on a given channel can be reminded at most once (toggling off clears
  it). `title` is carried for display only.
- Reminders are stored as a plain array, mirroring `ST.favs` (an array of
  channel-id strings). Malformed / non-object entries are dropped on load.
- Only **upcoming** programs are markable: a row whose program has already
  started (`start <= now`) shows no toggle (or a disabled one) — you cannot set
  a reminder for something already airing or past.

## 2. Reminders store — `window.IptvRem` (`src/client/rem.js`)

A self-contained client IIFE module (mirroring `src/client/errlog.js` /
`src/client/epg.js`) holding the reminder list, its localStorage persistence,
and the pure builders/selectors. Unlike the EPG store, this store **is
persisted** to a new localStorage key, mirroring the favourites pattern
(ADR-0003). It exposes:

| Member             | Kind        | Contract |
|--------------------|-------------|----------|
| `mkRem(chId, prg)` | pure        | Build a normalized `Rem` `{ chId, start, title }` from a channel id and a `Prg`. |
| `key(chId, start)` | pure        | The canonical `chId + '|' + start` identity string for matching/de-dup. |
| `list()`           | pure        | Fresh copy of the stored reminders (never the internal array by reference). |
| `has(chId, start)` | pure        | True when a reminder for that `chId`+`start` is stored. |
| `add(rem)`         | side-effect | Store one reminder (de-duped by identity); persists. |
| `rm(chId, start)`  | side-effect | Remove the reminder for that identity; persists. |
| `toggle(chId, prg)`| side-effect | Add the reminder if absent, remove it if present; returns the resulting pressed state (boolean); persists. |
| `count()`          | pure        | Number of stored reminders. |
| `clear()`          | side-effect | Empty the store; persists. |
| `due(now)`         | pure        | Return the stored reminders whose `start` is at or before `now` and not yet older than a small grace window (so a reminder that just became due fires once, a long-past one is ignored). |
| `load()`           | side-effect | Read the localStorage key, validate, populate the store (drops malformed entries; never throws). |

- Persistence mirrors favourites: a single localStorage key (added to
  `src/client/cfg.js` `S`, e.g. `remsKey: 'iptv_rems'`), written through a
  guarded `try/catch` like `saveSt('favs')`, read on load through a guarded
  parse like `loadSt`. A localStorage exception is swallowed — the feature
  degrades to an in-memory-only store, never throws.
- `due(now)` is **pure** (no side effects): it only selects. The timer
  (ADR-0034) decides what to do with the due list and clears fired reminders.

## 3. Remind toggle on the EPG rows

The toggle is rendered by the existing EPG render in `src/client/ui.js`
(ADR-0031), reading `window.IptvRem` at render time, guarded so the card still
renders when the module is absent (test isolation, like the `IptvEpg` guard):

- **Schedule rows.** Each upcoming schedule row (`mkSchedRow`) gains a
  keyboard-focusable **Remind** `<button>` carrying:
  - `data-rem="<chId>|<start>"` so the click-delegated handler can resolve the
    program identity,
  - `aria-pressed` reflecting whether a reminder is currently set for that
    program (`"true"` when set, `"false"` when not) — the pressed state is the
    single source of truth for the toggle, mirroring the fav star's on/off,
  - an accessible label that flips with state ("Remind me when … starts" /
    "Clear reminder for …").
  Honor **R-0001**: `aria-pressed` is present in the baseline HTML (rendered as
  `"false"` for an unset reminder), so a test asserting the toggle flips it to
  `"true"`/`"false"` is asserting a mutation of an attribute that exists in the
  source — never asserting an attribute is added that was never present.
- **NOW/NEXT line.** The now/next line (`mkNowNext`) gains a Remind toggle on
  the **NEXT** part (the upcoming program), with the same `data-rem`,
  `aria-pressed`, and accessible-label contract. The NOW part (already airing)
  carries no toggle. When `getNowNext` has no `next`, no toggle is rendered.
- **Only upcoming programs.** A toggle is rendered only for a program whose
  `start` is in the future relative to render time. An already-started program
  (current/past) shows no Remind toggle.
- **Click isolation.** The toggle is interactive inside the card; its
  click-delegated handler in `onGridClick` **stops propagation** so toggling a
  reminder never selects/plays the channel and never toggles the schedule
  expansion (the same separation the expand control and fav star already use).
- **Degrade silently.** A channel with no loaded guide exposes no schedule and
  therefore no toggles (the card is unchanged). When `window.IptvRem` is
  absent, no toggle is rendered and the EPG row renders exactly as today.

## 4. Toggling a reminder

Clicking (or activating via keyboard) a Remind toggle:

1. resolves the `chId`+`start` from `data-rem` and the live `Prg` from the
   `IptvEpg` store/selectors,
2. calls `IptvRem.toggle(chId, prg)` (add when unset, remove when set; persists),
3. updates the toggle's `aria-pressed` and accessible label **in place**
   (mirroring `toggleFav`), without a full grid re-render,
4. is purely presentational with respect to the state machine — no phase
   transition, no boolean control flag.

Clearing an individual reminder is the same toggle in its set state (pressing
it again), exactly as un-favouriting works.

## 5. The client reminder timer + firing

A lightweight client timer (owned by the reminder wiring, started once on page
load) periodically checks pending reminders against program start times:

- On each tick it reads `IptvRem.due(Date.now())`. For each newly-due reminder
  it **fires once**, then removes that reminder from the store (a fired
  reminder does not re-fire on the next tick; the store shrinks).
- **Firing** does two things, both best-effort:
  - **In-app toast** — a transient, dismissible toast surface (new lightweight
    UI in `src/client/ui.js` + `app.css`, consistent with the existing
    log/error UI posture, ADR-0028) announcing the program is starting, with a
    **"Watch"/"Jump"** action that selects + plays that channel (reusing the
    existing select+play path that a card click uses — `setCur` +
    `go('PLAY')`), and a dismiss control. The toast auto-dismisses after a
    short timeout.
  - **Browser Notification** — a **best-effort, permission-gated** browser
    `Notification` (the Web Notifications API): only attempted when the API
    exists and permission is already `granted`; otherwise skipped silently. The
    feature never auto-requests permission on load; permission may be requested
    at most once, in direct response to the user setting their first reminder
    (a user gesture), and a denied/unsupported result simply means
    notifications are skipped — the in-app toast still fires.
- **Degrade silently:** when no guide is loaded there are no programs and no
  reminders fire; when notifications are denied or unsupported, only the toast
  fires; when the timer/Notification globals are absent (test isolation), the
  wiring is a guarded no-op. Nothing throws, nothing blocks browsing.
- The timer interval is coarse (e.g. a check every ~15–30s is sufficient for
  program-start granularity); the exact interval is an implementation detail in
  `src/client/cfg.js`/the wiring, not a spec contract.

## 6. Jump-to-channel

The toast's "Watch"/"Jump" action selects and plays the reminded channel using
the **existing** select+play path:

- resolve the `Ch` from `ST.chs` by `chId`,
- `setCur(ch)`, persist the selection (`saveSt('sel')`), and transition to
  `PLAY` exactly as `onGridClick` does for a card click,
- if the channel is no longer in the loaded list (guide/channels changed), the
  action degrades silently (toast dismisses, nothing plays).

No new playback engine, no new phase — it reuses the same transition a card
click already triggers.

## 7. State, persistence, and conventions

- **State machine.** No new phase, no new boolean control flag (CONVENTIONS
  §6). Reminder presence is read from the `IptvRem` store at render time; the
  toggle's `aria-pressed` is its presentational source of truth.
- **Persistence.** A **new** localStorage key (`iptv_rems`) holding the
  reminder array, mirroring the favourites pattern (ADR-0003). This is the only
  new persisted key; the EPG store stays in-memory (ADR-0030 unchanged).
- **Schema.** `Rem` is a small new persisted shape `{ chId, start, title }`
  derived from the canonical `Prg` (ADR-0030); it reuses `Prg` data, it does
  not redefine the program type.
- **Proxy / server.** No new server route — reminders are entirely client-side.
- **EPG store.** Read-only consumer of `window.IptvEpg` (its `Prg` store +
  `getNowNext`/`getSched` selectors); the EPG store is unchanged.

## 8. Accessibility & UX

- The Remind toggle is a real focusable `<button>` with `aria-pressed` and an
  accessible label that flips with state; it never steals the card's primary
  click target (select/play) or the expand control.
- The toast is announced to assistive tech (an `aria-live` region / `role`
  consistent with the existing log UI posture) and its actions are keyboard
  reachable; it auto-dismisses and is manually dismissible.
- Times in toast/notification copy render in the user's local timezone (reuse
  `fmtPrgTime`).
- All reminder UI degrades silently with no guide loaded, no localStorage, no
  Notification support, or notifications denied — never an error, never a
  blocked browse.
