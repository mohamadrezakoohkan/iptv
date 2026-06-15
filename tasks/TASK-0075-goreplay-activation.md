---
id: TASK-0075
adr: ADR-0036
evolution: 21
status: done
attempts: 1
depends_on: [TASK-0073, TASK-0074]
---

# TASK-0075 — goReplay activation through onGridClick + demo archive synthesis

## Goal

Activating a Replay control plays the program's archive stream through the
existing player. `onGridClick` (`src/client/ui.js`) routes a `[data-replay]`
click (before the card-select branch, with `stopPropagation`) to a
`goReplay(chId, start)` action that resolves the channel + program, builds the
archive URL via `IptvPlay.getArchUrl`, and drives the existing select+play
transition exactly like `goRemWatch` / a card click — reusing the dual-engine
player and the existing proxy with no new engine, phase, or route. The demo EPG
path is extended to synthesize at least one archive-capable channel with a past
program so the flow is demonstrable offline.

## Acceptance criteria

- [ ] `onGridClick` handles `[data-replay]` with `evt.stopPropagation()` and
      routes to `goReplay`, BEFORE the card-select branch, so activating Replay
      never selects/plays the live stream and never toggles schedule expansion.
- [ ] `goReplay(chId, start)` resolves the `Ch` from `ST.chs` (no-op when absent
      or `arch !== true`), resolves the `Prg` from `IptvEpg.get(chId)` by `start`
      (no-op when absent), builds the archive URL, then runs `setCur(ch)`,
      `saveSt('sel')`, `go('PLAY')` when phase is `READY`, `rndHead()`,
      `IptvPlay.loadPlay(archUrl)` — the same arc as `goRemWatch`.
- [ ] The played URL is the archive (timeshift) URL, not the live URL; the active
      channel marker reflects the channel.
- [ ] The demo EPG path (`runDemoEpg`/demo guide generation in `src/client/api.js`)
      synthesizes ≥1 demo channel flagged `arch:true` (non-zero `archDur`) whose
      synthetic guide includes ≥1 past program (`stop <= Date.now()`), so a past
      archive-capable Replay row renders in demo mode offline.
- [ ] Replay degrades silently for non-archive / missing channels and on M3U
      (no `[data-replay]` rendered there at all — TASK-0074).

## Test requirements

- **Unit:** `goReplay` builds the archive URL and calls the select+play path with
  it (mock `IptvPlay.loadPlay` / `IptvSt`), no-ops for an unknown channel, a
  non-archive channel, and a program not in the guide; the demo guide produces an
  archive-capable channel with a past program (assert on the generated guide /
  `Ch` flags). Mock fetch/URL building — no live network.
- **UI:** In demo mode, expand an archive-capable channel's guide, activate the
  past row's Replay, and assert the player transitions to PLAY for that channel
  (and that the live-stream select was NOT triggered by the same click).
- **Integration:** Optionally, against the live Xtream portal, if any sampled
  channel advertises archive, build its archive URL and confirm the proxy path
  accepts the request shape (status/headers) — tolerant of a portal with no
  archive content (skip the assertion when no archive-capable channel is found).
  Live-network tier is environment-red in this sandbox — document, do not fight
  it. Otherwise n/a if no archive-capable sample exists.

## Implementation notes

### Activation wiring (`src/client/ui.js`)
- `onGridClick` gains a `[data-replay]` branch placed **after** `[data-rem]` and
  **before** the `[data-fav]` / card-select branches: `evt.stopPropagation()`
  then `onReplay(rep)`. So activating Replay never selects/plays the live stream
  and never toggles schedule expansion (mirrors `[data-exp]`/`[data-rem]`).
- `onGridKey` now also early-returns on `[data-replay]` so the real `<button>`
  activates itself once (no double-fire), exactly like `[data-exp]`/`[data-rem]`.
- `onReplay(btn)` splits `data-replay="<chId>|<start>"` at the last `|` (mirrors
  `toggleRem`'s key parse) and calls `goReplay`.
- `getReplayPrg(chId, start)` resolves the PAST program from the FULL stored
  guide via `IptvEpg.get(chId)` (not the upcoming-only `getSched` `getRemPrg`
  uses), matching by `start`; null when no guide/match (stale `data-replay` →
  no-op).
- `goReplay(chId, start)` is the new `go*` action: resolves the `Ch` from
  `ST.chs` (no-op when gone or `arch !== true`), resolves the `Prg` (no-op when
  absent), builds the archive URL via `IptvPlay.getArchUrl`, then runs the same
  arc as `goRemWatch`: `setCur(ch)` → `saveSt('sel')` → `go('PLAY')` when READY →
  `rndHead()` → `loadPlay(archUrl)`. The played URL is the archive URL, the
  active-channel marker reflects the channel. Exported on `window.IptvUi`.

### Archive-URL builder fallback (`src/client/play.js`)
- `getArchUrl` now returns `ch.url` unchanged when the url has no `/live/`
  segment (the offline demo path — a public HLS test stream, not an Xtream live
  url, has no timeshift form). Purely additive: all existing `/live/`-form tests
  (TASK-0073) are unaffected; this lets demo Replay play the demo test stream
  through the normal engine path (spec §6).

### Demo demonstrability (`src/client/api.js`)
- `mkDemoCh` flags every `DEMO_ARCH`th (4th, `cnt % 4 === 1`) demo channel
  `arch:true` with `archDur: ARCH_DUR` (7 days); the rest stay `arch:false`,
  `archDur:0`. The existing uniform demo guide (`getDemoPrgs`, base = now − 1h)
  already includes a clearly-PAST program (slot 0: now−60m..now−30m), so an
  arch-capable channel surfaces a past Replay row offline. Two new file-global
  constants `DEMO_ARCH` / `ARCH_DUR` (RULE-ID-7). Channel `url`s are unchanged.

### Tests
- Unit (`src/tests/unit/epgui.test.js`): a `goReplay` describe block with a
  dedicated `loadGoReplay` harness recording the select+play arc — asserts the
  archive URL (not the live url) is played, the full READY arc runs, no `go()`
  from a non-READY phase, and no-ops for unknown / non-archive / missing-program
  / no-`arch`-field channels.
- Unit (`src/tests/unit/api.test.js`): replaced the now-false "every demo
  channel arch:false" test with "synthesizes ≥1 archive-capable channel" +
  "every demo channel well-formed (boolean arch; non-arch keeps archDur:0)".
- Unit (`src/tests/unit/epgfetch.test.js`): demo guide synthesizes ≥1 PAST
  program (`stop <= now`) so a Replay row renders offline (ADR-0036 §6).
- UI (`src/tests/ui/catchup-demo.test.js`, new): boots demo, seeds two channels
  (`/live/`-form urls) + a guide, spies `loadPlay`, clicks the past row's Replay,
  and asserts PLAY for that channel (`#now-info`), the played URL is the
  timeshift form (not the live url), the guide stays expanded (stopPropagation),
  and a non-archive channel surfaces no Replay.

### Traceability
- `src/client/api.js`, `src/tests/unit/api.test.js`, `src/tests/unit/epgfetch.test.js`
  added to ADR-0036 `governs:` and each carries the `ADR: ADR-0036` comment
  (`epgui.test.js`/`epgfetch.test.js` carry it alongside their prior ADR).

### Out of scope / notes for validation
- Three full-suite UI failures are environment-class, NOT this change:
  `live.test.js` ×2 (live-network tier — needs a real portal, environment-red in
  this sandbox), and `log-demo.test.js` (HLS CDN/headless: detail line is
  `levelLoadError` vs expected `HLS not supported`). The `log-demo` failure was
  reproduced on a clean checkout with these changes stashed, confirming it is
  pre-existing. `fmtchip-demo.test.js:150` flaked once under full-suite
  parallelism (documented "stray headless media-error re-render") and passes in
  isolation. Unit suite: 833/833 pass; catchup + catchup-demo UI: 6/6 pass.
