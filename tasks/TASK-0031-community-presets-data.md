---
id: TASK-0031
adr: ADR-0015
evolution: 8
status: pending
attempts: 0
depends_on: [TASK-0027]
---

# TASK-0031 — Community presets data: `S.psts` curated list, `Pst` typedef, `getPst()` helper

## Goal

After this task the client carries the static, curated community-playlist
catalog and the pure helper that turns a preset into a connection identity — the
data layer behind the "default account list provided by the community"
(ADR-0015). No UI yet (that is TASK-0032); this task is the data + helper +
CONVENTIONS token that TASK-0032 builds on.

## Acceptance criteria

- [ ] `client/cfg.js` `S` carries a frozen `psts` array — exactly the five
      ADR-0015 entries, each `{ name, url }`, all under
      `https://iptv-org.github.io/iptv/`:
      `iptv-org · All` → `…/index.m3u`,
      `iptv-org · English` → `…/languages/eng.m3u`,
      `iptv-org · News` → `…/categories/news.m3u`,
      `iptv-org · Sports` → `…/categories/sports.m3u`,
      `iptv-org · Music` → `…/categories/music.m3u`.
      `S` remains frozen (CONVENTIONS §4) and `S.psts` carries no credentials.
- [ ] A `Pst` typedef (`{ name:string, url:string }`) is declared
      (CONVENTIONS RULE-ID-4 PascalCase typedef).
- [ ] `client/st.js` exports a pure helper `getPst(pst)` returning the preset's
      connection identity `{ url, user:'', pass:'', m3u:true, host: pst.url }`
      — ready for both `connect()` (`url`/`user`/`pass`/`m3u`) and `mkAcct()`
      (`host`). ≤ 20 lines, 1 param (RULE-FN-2/3), no side effects, `get` prefix
      (CONVENTIONS §9 / RULE-FN-1).
- [ ] CONVENTIONS.md §1 contains the `preset → pst` and `presets → psts` token
      rows (added in this evolution's spec phase — verify they are present and
      that the new symbols comply: `S.psts`, `Pst`, `getPst`).
- [ ] `mkAcct`/`addAcct`/`saveAccts`/`saveAct`/`getAct`/`loadAccts` (TASK-0027)
      are unchanged in shape — this task adds, it does not alter them.
- [ ] Governed files carry their `ADR: ADR-0015` comment near the top
      (`client/cfg.js`, `client/st.js`, `tests/unit/preset.test.js`).

## Test requirements

- **Unit:** new `tests/unit/preset.test.js` — assert `S.psts` is a frozen array
      of the five expected `{ name, url }` entries with the exact iptv-org URLs;
      assert each url is a non-empty `https://iptv-org.github.io/iptv/…` string;
      assert `getPst(pst)` returns `{ url, user:'', pass:'', m3u:true,
      host: pst.url }` for a sample preset, is pure (input not mutated), and
      that the object it returns is shaped for both `connect` and `mkAcct`
      (round-trip: `mkAcct(getPst(S.psts[0]))` yields a valid `Acct` deduping
      by `url+user+m3u`). Confirm `Object.isFrozen(S)` still holds.
- **UI:** n/a — not user-facing (pure data + helper; the panel surface is
      TASK-0032).
- **Integration:** n/a — no new external connectivity. Every preset URL is an
      iptv-org M3U already covered end-to-end by the existing live integration
      tier (`tests/int/m3u.test.js` exercises `index.m3u`); this task adds no
      new endpoints, so no new integration test is warranted.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
