---
id: TASK-0069
adr: ADR-0034
evolution: 20
status: done
attempts: 1
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

Implemented the reminder firing surface (ADR-0034) — the timer that detects due
reminders is left to TASK-0070; this task exposes the entry point it will call.

Files touched:
- `src/index.html` — added the toast stack container `#rem-toasts`
  (`role="region" aria-live="polite"`), placed before `#acct-scrim`; added
  ADR-0034 to the file's HTML ADR comment.
- `src/client/app.css` — added the `.rem-toasts` / `.rem-toast*` styles (bottom-
  right transient stack, log/error UI posture: surface tokens, `--ln` border,
  `--r1` radius), plus a mobile full-width tweak inside the existing media query;
  added ADR-0034 to the file ADR comment.
- `src/client/cfg.js` — added `S.toastMs: 8000` (the toast auto-dismiss timeout,
  an implementation detail per the spec); added ADR-0034 to the ADR comment and
  to ADR-0034's `governs:`.
- `src/client/ui.js` — the firing surface:
  - `fireRem(rem)` — PUBLIC entry point (the TASK-0070 timer will call it per
    due reminder): builds + appends a toast, arms an auto-dismiss `setTimeout`
    (S.toastMs), and fires the best-effort permission-gated notification.
    Guarded: a null rem / missing `#rem-toasts` is a silent no-op returning null.
  - `mkToast` / `onToastClick` / `rmToast` — the toast markup, the delegated
    click handler (Watch jumps then dismisses; close dismisses), and removal.
  - `goRemWatch(chId)` — PUBLIC: resolves the `Ch` from `ST.chs` and reuses the
    EXACT select+play path (`setCur` + `saveSt('sel')` + `go('PLAY')` when READY,
    then `loadPlay`), exactly like `onGridClick`. Unknown channel ⇒ silent no-op.
  - `fireNote` / `mkNote` — the Notification, created ONLY when
    `window.Notification` exists and `permission === 'granted'`; otherwise skipped
    silently. The only `new N()` is isolated in `mkNote`, behind fireNote's guard
    and try/catch.
  - `askRemPerm` — the first-reminder permission request, called ONLY from the
    SET branch of `toggleRem` (a user gesture). It requests at most once by gating
    on `Notification.permission === 'default'` (after a grant/deny it is no longer
    default), so no separate boolean control flag is introduced (CONVENTIONS §6).
    Never called on load.
  - Registered `EL.rtst` + the toast click listener in `mkEL`; exported `fireRem`
    + `goRemWatch`; added ADR-0034 to the file ADR comment.

Tests:
- Unit `src/tests/unit/remfire.test.js` (17 tests, node env, synthetic
  window + minimal fake DOM): toast build/show + escaping + auto-dismiss (Vitest
  fake timers, since ui.js uses a bare `setTimeout`); goRemWatch select+play
  routing (READY→PLAY, no transition from PLAY, unknown-channel no-op) and the
  Watch/close click delegation; Notification granted-only / denied / absent /
  default branches; the first-reminder request fires once via the toggle SET
  gesture, never on clear, never when already granted/denied, never on load.
- UI `src/tests/ui/reminders.test.js` (+3 firing tests): on the demo fixture,
  invoke `fireRem` for a real NEXT program (Notification stubbed granted via
  addInitScript — no OS prompt) and assert the toast appears with a Watch action
  and the granted branch ran; Watch plays the reminded channel (is-play, now-info
  = channel name) and dismisses the toast; the dismiss control removes it without
  playing.

Non-obvious notes:
- ui.js reads `setTimeout` as a bare global (per its `/* global */` line), so the
  unit test exercises auto-dismiss via `vi.useFakeTimers()` rather than a window
  stub.
- `main.js` stays untouched: it is in ADR-0034's `governs:` for TASK-0070 (the
  timer wiring), keeping firing surface and timer cleanly separable as the task
  requires. main.js will gain its `ADR: ADR-0034` reference in TASK-0070.
