---
id: TASK-0064
adr: ADR-0031
evolution: 19
status: done
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

Files touched:

- `src/client/ui.js` — added `mkNnRow(opts)` (one NOW/NEXT row, returns `''`
  when the program is absent) and `mkNowNext(ch)` (the whole `.ch-nn` line,
  reading `window.IptvEpg.getNowNext(ch.id)` at render time, returns `''` when
  both now and next are absent). `mkCard` appends the line only when
  `window.IptvEpg && window.IptvEpg.has(ch.id)` — guarded so the card still
  renders when the EPG module is absent (test isolation). Titles are
  HTML-escaped via the existing `escHtml`. Added `ADR-0031` to the file's ADR
  comment line.
- `src/client/app.css` — added `.ch-nn` / `.ch-nn-row` / `.ch-nn-mark` /
  `.ch-nn-title` plus the `.ch-nn-now`/`.ch-nn-nxt` modifiers. Reads ADR-0024
  spacing tokens (`--s1`) and ADR-0019 colour tokens (`--acc`, `--tx`, `--dim`)
  and the mono font (`--font-mono`); NOW marker uses `--acc`, NEXT title uses
  `--dim` (dimmer). Titles ellipsize to one line. Added `ADR-0031` to the file
  comment.
- `src/tests/unit/epgui.test.js` (new) — 10 unit tests over `mkCard`: line
  present with NOW/NEXT markers + titles from `getNowNext`, title escaping, the
  line is `aria-hidden` and adds no second click target, graceful degradation
  for a missing now/next/both, no line when the channel has no guide or the EPG
  module is absent, and byte-identical markup between the module-absent and
  guide-empty cases (R-0001: the assertions check actual rendered markup).
- `src/tests/ui/epg.test.js` (new) — 3 Playwright tests booting demo mode
  through the real footer login (the demo connect generates the synthetic guide
  and re-renders the grid): demo cards show a NOW/NEXT line with real program
  titles, the line is decorative (`aria-hidden`) and the card body still
  selects+plays (`#now-info` updates, body reaches `is-play`), and every demo
  card (31) carries a line.

Non-obvious notes for reviewers:

- The grid re-render after a guide arrives is already wired by ADR-0030
  (`goEpg` → `loadEpg` → `onDone: rndGuide`); this task only adds the
  presentational line to `mkCard`, so the now/next surfaces automatically as
  guides fill in.
- `onGridClick` does not re-render the grid on selection, so the card does not
  gain `ch-active` purely from a click (it gains it on the next grid render).
  The UI test verifies the click reached the select+play path via `#now-info`
  and the `is-play` body phase instead — the acceptance criterion is that the
  now/next line never steals the card's click target.
- ADR-0031 `governs:` already lists all four touched files; no true-up needed.
