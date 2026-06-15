---
id: TASK-0084
adr: ADR-0040
evolution: 23
status: pending
attempts: 0
depends_on: []
---

# TASK-0084 — Persist a single client-wide volume/mute preference (`iptv_vol`)

## Goal

When this task is done, the app persists a single client-wide volume/mute
preference under `localStorage['iptv_vol']`, following the theme/sort chrome
pattern. `src/client/cfg.js` declares `S.volKey = 'iptv_vol'`; `src/client/st.js`
gains `loadVol()` / `saveVol()` helpers; and the existing `setVol` / `setMuted`
writers persist via `saveVol()` on every change. No new phase, no `<video>`
wiring yet (ADR-0039 does the apply-to-element step).

## Acceptance criteria

- [ ] `src/client/cfg.js` declares `S.volKey === 'iptv_vol'` (carries an
      `ADR: ADR-0040` reference).
- [ ] `IptvSt.loadVol()` returns `{ vol, muted }`: parses `iptv_vol` JSON,
      clamps `vol` to `[0,1]`, requires `muted` boolean; falls back to
      `{ vol: 1.0, muted: false }` for absent / malformed JSON / out-of-range /
      wrong-type values, and never throws (localStorage/JSON exceptions
      guarded).
- [ ] `IptvSt.saveVol()` serialises the current `ST.vol` / `ST.muted` to
      `iptv_vol` as `{ vol, muted }` JSON, guarded against exceptions.
- [ ] `IptvSt.setVol(v)` and `IptvSt.setMuted(b)` persist via `saveVol()` after
      mutating `ST` (a round-trip `setVol(0.4)` then `loadVol()` returns
      `vol: 0.4`).
- [ ] `loadVol` / `saveVol` are exported on `window.IptvSt`.
- [ ] `iptv_vol` is NOT added to the phase machine (`ST` phase fields and
      transitions unchanged).

## Test requirements

- **Unit:** `src/tests/unit/st.test.js` — `loadVol` round-trip; defaults for
  absent key, malformed JSON, out-of-range `vol` (e.g. `2`, `-1`), non-boolean
  `muted`, non-object payload; `saveVol` writes the expected shape; `setVol` /
  `setMuted` persist on write; localStorage-throwing guards. Reuse the existing
  st.js test harness/mocks.
- **UI:** n/a — not user-facing on its own (persistence wiring; ADR-0039 carries
  the UI behavior).
- **Integration:** n/a — no external connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
