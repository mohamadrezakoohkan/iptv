---
id: TASK-0032
adr: ADR-0016
evolution: 8
status: done
attempts: 1
depends_on: [TASK-0031, TASK-0030]
---

# TASK-0032 — Render the community presets section in the account panel + wire selection to an M3U connect

## Goal

After this task the account panel shows a **Community playlists** section
(below the saved-accounts list, above "Add account") listing the curated
iptv-org presets (`S.psts`, TASK-0031). The section is **always present** —
even with zero saved accounts — so it is the "default account list provided by
the community." Clicking a preset row connects to that playlist on the M3U path
with **no URL typing**; on success it becomes a saved + active account and the
whole panel/grid/sidebar/footer re-render (ADR-0015/ADR-0016).

## Acceptance criteria

- [ ] `index.html` adds a `#acct-psts` block inside `#acct-panel`, positioned
      **after** `#acct-list` and **before** `#acct-add`, with a section heading
      (e.g. "Community playlists"). HTML carries an `ADR: ADR-0016` comment.
- [ ] `client/ui.js`: `EL` gains `apst` (`#acct-psts`), set once in `mkEL`.
- [ ] `mkPst(opts)` — pure: returns one preset-row HTML string carrying
      `data-pst="<idx>"` (index into `S.psts`), the preset `name` + playlist
      `url`, and an `is-active` class **only** when that preset's url is the
      active account's connection. Mirrors `mkRow`; ≤ 20 lines, ≤ 2 params.
- [ ] `rndPsts()` renders all of `S.psts` into `#acct-psts`, marking the row
      whose url matches the active account (`getAct`/`loadAccts`). It is called
      from `rndAcct()` so the community section stays in sync with
      connect/disconnect/switch/add/remove like the rest of the panel.
- [ ] `onPstList(evt)` delegates a `[data-pst]` click: resolves `S.psts[idx]`,
      builds the connection identity via `getPst` (TASK-0031), and connects on
      the M3U path reusing the account-switch machinery
      (`goSwitch`/`runSwitch`-style tear-down + reconnect with `{ user:'',
      pass:'', m3u:true }`). Clicking the preset that is already the active
      connection is a **no-op** (same guard as `goSwitch`).
- [ ] On a **successful** preset connect, the preset becomes a saved + active
      `Acct` (`mkAcct(getPst(pst))` → `addAcct` dedupe by `url+user+m3u` →
      `saveAccts`/`saveAct`, via the existing `onSwOk`-style completion); it
      then also appears in `#acct-list`, and re-selecting it does not duplicate
      it. On **failure** the store is untouched and the existing inline connect
      error shows (ADR-0008/ADR-0013 invariant).
- [ ] Preset rows have **no remove control** (the catalog is static).
- [ ] `client/app.css` styles `#acct-psts` reusing the `.acct-row*` visual
      language + a section heading; `is-active` is a CSS class (no inline
      styles, §10); full-width on the mobile breakpoint like the rest of the
      panel (ADR-0014).
- [ ] `rndPsts` and `onPstList` are exported on `window.IptvUi` for tests; both
      listeners wired in `mkEL` alongside the existing panel listeners.

## Test requirements

- **Unit:** extend `tests/unit/acctui.test.js` (jsdom) — `rndPsts` renders one
      row per `S.psts` entry into `#acct-psts`, each with `data-pst="<idx>"`,
      the preset name + url, and `is-active` exactly on the row whose url equals
      the active account's (and none when no matching active account);
      `mkPst` emits the expected attributes; `onPstList` dispatches a select
      for a non-active preset and is a no-op for the already-active one. Per
      R-0001, confirm against the markup `mkPst` actually emits which attributes
      the rows carry before asserting attribute presence/mutation — do not
      assert an attribute is added that the emitted HTML never contains.
- **UI:** extend `tests/ui/acct.test.js` (Playwright) — opening the panel with
      zero saved accounts still shows the Community playlists section with the
      five preset rows (the default list is present without any saved account);
      a preset row shows its name + url and has no remove control; after
      switching/connecting, the panel stays coherent (community section + saved
      list rendered by the same `rndAcct` pass). The actual remote connect is
      not asserted in the UI tier (offline-deterministic) — assert the section's
      presence, contents, no-remove affordance, and that clicking the active
      preset is a no-op; selecting a preset to a live playlist is covered by the
      data round-trip (unit) + the existing live integration tier.
- **Integration:** n/a — no new external connectivity. The preset URLs are
      iptv-org M3U playlists already covered by the existing live integration
      tier (`tests/int/m3u.test.js` hits `index.m3u`); this task reuses the
      unchanged M3U engine + proxy path and adds no new endpoints, so no new
      integration test is warranted (state so in the implementation notes).

## Implementation notes

Implemented additively — no live symbol or storage key renamed/removed.

Files touched:
- `index.html` — added `#acct-psts` block (`.acct-psts-sec` heading +
  `.acct-psts` list) between `#acct-list` and `#acct-add`; added `ADR-0016`
  to the top HTML comment + an inline `ADR: ADR-0016` comment on the section.
- `client/ui.js` — `EL.apst` (`#acct-psts`); `mkPst(opts)` pure row builder
  (mirrors `mkRow`, `data-pst="<idx>"`, name + url, `is-active` only when the
  preset url is the active **M3U** account's connection, no remove control);
  `rndPsts(act)` renders all of `S.psts` into `#acct-psts`, now called from
  `rndAcct()`; `onPstList(evt)`/`goPst(idx)`/`runPst(pst)`/`onPstOk(pst,val)`
  drive the M3U connect by **reusing** the existing plumbing — `runPst` mirrors
  `runSwitch` (tearDown → go('LOAD') → connect with `{user:'',pass:'',m3u:true}`),
  and on success `onPstOk` persists via the existing `saveActive`
  (`mkAcct(getPst(pst))` → `addAcct` dedupe → `saveAccts`/`saveAct`) then
  delegates the full re-render to the existing `onSwOk`. No-op guard matches
  `goSwitch` (already-active preset). Listener wired in `mkEL`;
  `mkPst`/`rndPsts`/`onPstList` exported on `window.IptvUi`.
- `client/app.css` — `.acct-psts-sec`/`.acct-psts-title`/`.acct-psts` +
  `.acct-row.acct-pst`, reusing the `.acct-row*` language; `is-active` is a CSS
  class only (no inline styles); panel is already full-width at the 760px
  breakpoint (ADR-0014), so presets inherit it. Added `ADR-0016` to the header.

Tests:
- Unit (`tests/unit/acctui.test.js`): a `loadUiPst` harness registering
  `#acct-psts` + a `window.S.psts` catalog + `getPst`/`mkAcct`/`addAcct` stubs;
  covers `mkPst` markup (R-0001: asserts only attributes the emitted HTML
  carries — `data-pst`, class, role, tabindex; explicitly asserts **no**
  `data-rm`/`acct-row-rm`), `rndPsts` (one row per `S.psts`, present with zero
  saved accounts, `is-active` exactly on the matching active row, none when no
  match), and `onPstList` (M3U connect on select, no-op for active preset,
  ignores non-row clicks).
- UI (`tests/ui/acct.test.js`): section present with zero saved accounts and
  lists `window.S.psts.length` rows; each row shows name + url with no remove
  control; DOM order list < presets < Add account; clicking the active preset
  triggers no `connect` (no-op). Remote connect not asserted in the UI tier per
  the task (offline-deterministic).
- Integration: n/a — no new external connectivity. Preset URLs are iptv-org
  M3U playlists already covered by the existing live tier (`tests/int/m3u.test.js`
  hits `index.m3u`); this reuses the unchanged M3U engine + proxy path and adds
  no endpoints.

Full `npx vitest run` (384 unit) and `npx playwright test` (108 UI) both green.
ADR-0016 `governs:` already listed all touched/test files — no change needed;
no ADR newly emptied.

> Sequencing note (E7/E8 staged-migration lesson): this task **adds** a new
> panel section and new `ui.js` symbols (`apst`, `mkPst`, `rndPsts`,
> `onPstList`) and a single new `rndPsts()` call inside the existing `rndAcct`
> — it renames/removes no live symbol or storage key. Validate against the
> **full** UI suite (real modules), not just the jsdom unit suite that stubs
> the store, so the real `rndAcct`/`goSwitch`/`onSwOk` wiring is exercised.
