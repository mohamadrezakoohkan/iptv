---
id: ADR-0034
title: A lightweight client timer fires due reminders as an in-app toast plus a best-effort permission-gated browser Notification, with a jump-to-channel action, degrading silently
date: 2026-06-15
evolution: 20
status: accepted
governs:
  - src/client/ui.js
  - src/client/app.css
  - src/client/cfg.js
  - src/client/main.js
  - src/index.html
  - src/tests/unit/remfire.test.js
  - src/tests/ui/reminders.test.js
---

# ADR-0034 — A lightweight client timer fires due reminders as an in-app toast plus a best-effort permission-gated browser Notification, with a jump-to-channel action, degrading silently

## Context

E20 prompt: a **lightweight client timer checks pending reminders against
program start times** and, **when one fires, surfaces an in-app toast plus a
best-effort, permission-gated browser Notification** so the user can **jump to
that channel**; it must **degrade silently when no guide is loaded or
notifications are denied**, reusing **the existing toast/log UI posture**.
ADR-0032 supplies the store + the pure `due(now)` selector; ADR-0033 supplies
the toggles that create reminders; this ADR decides the **firing surface**.

Constraints already in the codebase:

- **No existing toast surface.** The product has a log panel and error
  placeholders (ADR-0027/ADR-0028) but no transient toast; one is added here,
  minimal, consistent with the existing log/error UI posture (a guarded
  `src/client/ui.js` render + `app.css`, an `aria-live`/`role` region).
- **The select+play path.** A card click in `onGridClick` does `setCur(ch)` +
  `saveSt('sel')` + `go('PLAY')` (when phase is READY). The jump-to-channel
  action reuses this exact path — no new playback engine, no new phase.
- **The Web Notifications API** is optional and permission-gated; it may be
  absent (test isolation / unsupported browser) and must be guarded.

## Decision

Add the reminder firing surface in `src/client/ui.js` (+ `src/client/app.css`)
with the timer wired on page load in `src/client/main.js`, all guarded against
missing globals (timer, `Notification`, `window.IptvRem`) for test isolation
and silent degradation.

### The timer

A lightweight repeating timer (started once on load via the existing
`onReady`/main wiring, interval in `src/client/cfg.js`, coarse — program-start
granularity needs only a check every ~15–30s) calls `IptvRem.due(Date.now())`
each tick. Each newly-due reminder **fires once**, then is removed from the
store (`IptvRem.rm`) so it never re-fires. The tick is a guarded no-op when
`window.IptvRem` is absent.

### Firing — toast + notification

For each fired reminder, both best-effort:

- **In-app toast** — a transient, dismissible toast (new minimal UI, consistent
  with the log/error posture) announcing the program is starting, carrying a
  **"Watch" / "Jump"** action and a dismiss control, auto-dismissing after a
  short timeout. Announced via an `aria-live` region.
- **Browser Notification** — attempted **only** when `window.Notification`
  exists and `Notification.permission === 'granted'`; otherwise skipped
  silently. Permission is **never** auto-requested on load; it may be requested
  at most once, in direct response to the user setting their first reminder (a
  user gesture, wired from the ADR-0033 toggle handler). A denied / unsupported
  result simply skips the notification — the toast still fires.

### Jump-to-channel

The toast's Watch/Jump action resolves the `Ch` from `ST.chs` by `chId` and
reuses the **existing** select+play path (`setCur` + `saveSt('sel')` +
`go('PLAY')` when READY), exactly like a card click. If the channel is no
longer loaded, the action degrades silently (toast dismisses, nothing plays).

### Degrade silently

No guide loaded ⇒ no reminders fire; notifications denied/unsupported ⇒ only
the toast fires; timer/`Notification`/`IptvRem` globals absent ⇒ guarded
no-op. Nothing throws, nothing blocks browsing. No new state-machine phase, no
new server route. Full behavior is specified in `docs/specs/reminders.md`
§5–§6, §8.

## Consequences

**Easier:**
- Reuses the pure `due(now)` selector (ADR-0032) and the existing select+play
  path — the timer and jump are thin wiring, fully testable with mocked
  timer/`Notification`.
- A minimal toast consistent with the existing log/error posture adds one small
  surface, no framework, no new dependency.

**Harder:**
- The Notification permission flow must be gated to a user gesture (first
  reminder) and never auto-prompt on load; both the granted and
  denied/unsupported branches need explicit guards and unit coverage with a
  mocked `Notification`.
- The timer must fire each due reminder exactly once and tolerate a reminder
  whose program is no longer in the live guide/channel list.

**Ruled out:**
- A server-pushed / service-worker notification (unrequested scope; the prompt
  says best-effort client-side, no new server route).
- Auto-requesting notification permission on load (hostile UX; permission is
  gated to the user's first-reminder gesture).
- A new playback engine or state phase for the jump (the prompt is explicit:
  reuse the existing select+play path).

## Tasks derived

- TASK-0069 — Reminder firing: the minimal toast surface (`ui.js` + `app.css`,
  `aria-live`), the jump-to-channel action (reuse select+play), and the
  best-effort permission-gated browser Notification (guarded), with the
  permission request gated to the first-reminder gesture.
- TASK-0070 — The client reminder timer wired on page load (`main.js` +
  interval in `cfg.js`): tick reads `due(now)`, fires each newly-due reminder
  once, removes it; guarded no-op when globals absent.
- TASK-0071 — Demo recording of the reminder set → fire → notify → clear arc on
  the demo fixture.

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0034` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes
the last governed code, this ADR is marked `status: deleted` — the file itself
is never removed; it is history.
