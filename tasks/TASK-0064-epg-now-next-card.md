---
id: TASK-0064
adr: ADR-0031
evolution: 19
status: pending
attempts: 0
depends_on: [TASK-0062]
---

# TASK-0064 — Now/next line on the channel card

## Goal

Each channel card renders a **now/next line** (current program + next program
titles) below the channel name when a guide is loaded for that channel, reading
`window.IptvEpg.getNowNext(ch.id)` at render time. A channel with no loaded guide
renders exactly as today — no placeholder, no layout change (ADR-0025 contextual
presence). Styling reads ADR-0024 spacing/sizing and ADR-0019 colour tokens.

## Acceptance criteria

- [ ] `mkCard(ch)` in `src/client/ui.js` appends a now/next line **only when**
      `window.IptvEpg && window.IptvEpg.has(ch.id)` (guarded so the card still
      renders when the EPG module is absent — test isolation).
- [ ] The line shows a "NOW" marker + the current program title and a "NEXT"
      marker + the next program title from `getNowNext(ch.id)`; a missing `now` or
      `next` is handled gracefully (the corresponding part is omitted, not
      rendered as "null"/"undefined").
- [ ] Titles are single-line and ellipsized; markers use the mono font; the line
      uses ADR-0024 tokens (spacing/radius) and ADR-0019 colour tokens, with NEXT
      dimmer than NOW.
- [ ] A channel with **no loaded guide** produces the exact same card markup as
      before this task (no now/next node, no empty placeholder).
- [ ] The now/next line is decorative within the card and does **not** change the
      card's click target — clicking the card still selects + plays the channel
      (`docs/specs/iptv-player.md` §6).
- [ ] `src/client/ui.js` and `src/client/app.css` carry `ADR: ADR-0031`
      references; `app.css` styles for the now/next line read existing token
      layers (no hard-coded magic colours/spacings).

## Test requirements

- **Unit:** `src/tests/unit/epgui.test.js` — `mkCard` renders the now/next line
  when a guide is present and omits it entirely when absent; NOW/NEXT titles come
  from `getNowNext`; missing now/next parts degrade gracefully; markup is
  unchanged for guide-less channels. (May share the `epgui.test.js` file with
  TASK-0065's unit assertions.) Run under `npx vitest run`.
- **UI:** `src/tests/ui/epg.test.js` — boot in demo mode (synthetic guide,
  TASK-0063), assert demo channel cards show a "NOW"/"NEXT" line with real
  program titles, and that the card remains clickable to play. (May share the
  `epg.test.js` UI file with TASK-0065.)
- **Integration:** n/a — render reads the in-memory store; no external
  connectivity.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
