---
id: TASK-0069
adr: ADR-0034
evolution: 20
status: pending
attempts: 0
depends_on: [TASK-0067, TASK-0068]
---

# TASK-0069 — Reminder firing surface: in-app toast, jump-to-channel, best-effort permission-gated Notification

## Goal

`src/client/ui.js` (+ `app.css`) gains a minimal transient toast surface and a
firing function that, for a due reminder, shows the toast (with a Watch/Jump
action and dismiss), fires a best-effort permission-gated browser Notification,
and wires the first-reminder permission request. When done, a fired reminder is
surfaced and the user can jump to the channel; everything degrades silently.

## Acceptance criteria

- [ ] A minimal toast surface is added (markup region in `src/index.html` or
      created on demand by `ui.js`, styled in `src/client/app.css`, announced
      via an `aria-live` region) consistent with the existing log/error UI
      posture. The toast carries the program/channel copy (local time via
      `fmtPrgTime`), a **Watch/Jump** action, and a dismiss control;
      auto-dismiss after a short timeout.
- [ ] A firing function takes a `Rem` and shows the toast; the Watch/Jump
      action resolves the `Ch` from `ST.chs` by `chId` and reuses the existing
      select+play path (`setCur` + `saveSt('sel')` + `go('PLAY')` when phase is
      READY) — exactly like a card click. Channel no longer loaded ⇒ silent
      dismiss, nothing plays.
- [ ] The browser Notification is best-effort and permission-gated: attempted
      only when `window.Notification` exists **and**
      `Notification.permission === 'granted'`; otherwise skipped silently. The
      toast still fires when the notification is skipped.
- [ ] Permission is never auto-requested on load; it is requested at most once,
      gated to the user's **first-reminder** gesture (wired from the ADR-0033
      toggle handler). A denied/unsupported result skips notifications and never
      throws.
- [ ] All firing degrades silently: missing `window.Notification`, missing
      timer/`IptvRem` globals, or a denied permission never throws and never
      blocks browsing. Touched files carry `ADR: ADR-0034`.

## Test requirements

- **Unit:** `src/tests/unit/remfire.test.js` — firing builds/shows the toast
  from a `Rem`; Watch/Jump routes to the select+play path (mocked `IptvSt`) and
  is a silent no-op for an unknown channel; Notification is created **only**
  when a mocked `window.Notification` exists with `permission === 'granted'`,
  and skipped (no throw) when absent / `permission === 'denied'`; the
  first-reminder permission request is invoked once and only via the toggle
  gesture (mocked `Notification.requestPermission`), never on load. Honor
  R-0001 for any DOM-attribute assertions on the toast markup.
- **UI:** `src/tests/ui/reminders.test.js` (shared) — on the demo fixture,
  drive a reminder to fire (set a reminder for an imminent program and let the
  timer fire it, or invoke the firing path) and assert the toast appears with a
  Watch action; activate Watch and assert the reminded channel becomes
  current/plays; assert the toast dismisses. Notification is mocked/granted in
  the harness so the granted branch is exercised without a real OS prompt.
- **Integration:** n/a — no external connectivity (client UI + browser APIs,
  mocked in tests).

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
