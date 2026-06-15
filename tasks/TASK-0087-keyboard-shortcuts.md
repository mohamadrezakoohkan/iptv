---
id: TASK-0087
adr: ADR-0039
evolution: 23
status: pending
attempts: 0
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

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
