---
id: TASK-0087
adr: ADR-0039
evolution: 23
status: done
attempts: 1
depends_on: [TASK-0086]
---

# TASK-0087 — Keyboard shortcuts (active only while playing, collision-safe)

## Goal

When this task is done, a single document-level `keydown` handler `onPlayKey`
(in `src/client/ui.js`, wired in `mkEL`) maps player shortcuts to `IptvCtrl`
actions, **active only while a stream is playing** (`ST.phase === 'PLAY'`), never
when the event target is a typing context, and never intercepting `Escape`
(which stays with the existing panel-close handler).

## Acceptance criteria

- [ ] `onPlayKey(evt)` returns immediately (does nothing, no `preventDefault`)
      unless `IptvSt.ST.phase === 'PLAY'`.
- [ ] It returns immediately when the event target is a typing context (`INPUT`,
      `TEXTAREA`, `SELECT`, or `isContentEditable`), so search/login typing is
      never hijacked.
- [ ] In `PLAY`, non-typing target, it maps: `F` → `IptvCtrl.toggleFs`,
      `P` → `IptvCtrl.togglePip`, `Space`/`K` → `IptvCtrl.togglePlay`,
      `M` → `IptvCtrl.toggleMute`, `ArrowUp` → `IptvCtrl.volUp`,
      `ArrowDown` → `IptvCtrl.volDn`.
- [ ] `Space`, `ArrowUp`, `ArrowDown` (and any other consumed key) are
      `preventDefault`-ed **only** when actually consumed (in PLAY, non-typing) —
      page scroll and button activation elsewhere are unaffected.
- [ ] `onPlayKey` never handles `Escape`; the existing `onAcctKey` Escape
      panel-close behavior (ADR-0014/ADR-0028) is unchanged and still closes open
      panels.
- [ ] The handler is registered as a separate `document` `keydown` listener in
      `mkEL` (does not replace or merge into `onAcctKey`).
- [ ] `P` is a silent no-op where PiP is unsupported (delegates to
      `IptvCtrl.togglePip`, which no-ops).

## Test requirements

- **Unit:** `src/tests/unit/ctrl.test.js` (extend) or a focused keydown test —
  with `IptvCtrl` mocked: each key in `PLAY` calls the right `IptvCtrl` action;
  no action fires when `phase !== 'PLAY'`; no action fires when the target is an
  input/textarea/select/contenteditable; `preventDefault` is called for
  Space/Arrow only when consumed and not otherwise; `Escape` is ignored by
  `onPlayKey`.
- **UI:** `src/tests/ui/ctrl.test.js` (extend) — in demo playback, pressing M
  toggles mute, ArrowUp/ArrowDown change volume, Space toggles play/pause, and
  typing in the search input does NOT trigger shortcuts; Escape still closes an
  open panel. Verify a shortcut does nothing before a stream is playing.
- **Integration:** n/a — no external connectivity.

## Implementation notes

Implemented entirely in `src/client/ui.js` (already governed by ADR-0039, no new
files — `governs:` unchanged):

- **`onPlayKey(evt)`** — the new, SEPARATE document `keydown` handler. Returns
  immediately (no `preventDefault`) unless `window.IptvSt.ST.phase === 'PLAY'`,
  unless the target is a typing context, when `IptvCtrl` is absent (test
  isolation), or when the key is unmapped. Only on a consumed key does it call
  `evt.preventDefault()` and then the mapped `IptvCtrl` action — so page scroll
  (Space) and caret/scroll movement (Arrows) are unaffected elsewhere.
- **`getPlayAct(evt)`** — pure key→action map: `f/F`→`toggleFs`, `p/P`→`togglePip`,
  `Space (' '/'Spacebar')`/`k/K`→`togglePlay`, `m/M`→`toggleMute`,
  `ArrowUp`→`volUp`, `ArrowDown`→`volDn`. `Escape` is deliberately NOT mapped,
  so the existing `onAcctKey` panel-close (ADR-0014/0028) remains the sole
  Escape owner. Letter keys are matched case-insensitively (Shift/CapsLock).
- **`isTyping(tgt)`** — pure predicate: `INPUT`/`TEXTAREA`/`SELECT` or
  `isContentEditable`.
- **Wiring:** `mkEL` adds an unconditional `document.addEventListener('keydown',
  onPlayKey)` — a second, independent document keydown listener registered
  alongside (never merged into) the `onAcctKey` registration. `onPlayKey` is
  exported on `window.IptvUi`.

Non-obvious for reviewers/future tasks:
- The unconditional `document.addEventListener('keydown', onPlayKey)` in `mkEL`
  required three pre-existing unit harnesses (`foot.test.js`, `m3u-ui.test.js`,
  `persist.test.js`) to gain an `addEventListener` stub on their fabricated
  `document` — they previously never reached a `document.addEventListener` call
  because the only prior one (`onAcctKey`) was guarded by panel presence those
  harnesses omitted. This is a harness-completeness fix, not a test-logic change.
- Tests: `src/tests/unit/ctrl.test.js` extended (the `loadUi` mock gained
  `togglePlay`/`toggleMute`/`volUp`/`volDn` spies, a `phase` opt, the account/log
  panel elements so `onAcctKey` registers, and now returns `docListeners`); a
  `mkKeyEvt` helper simulates keydown. `src/tests/ui/keys.test.js` (new) drives
  the real `onPlayKey` in demo PLAY via `page.keyboard`.
