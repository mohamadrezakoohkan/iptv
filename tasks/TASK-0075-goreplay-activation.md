---
id: TASK-0075
adr: ADR-0036
evolution: 21
status: pending
attempts: 0
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

_Filled by implement-agent._
