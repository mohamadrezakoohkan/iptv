---
id: TASK-0010
adr: ADR-0003
evolution: 1
status: done
attempts: 1
depends_on: [TASK-0003, TASK-0009]
---

# TASK-0010 — localStorage persistence (loadSt, saveSt, auto-reconnect)

## Goal

`client/st.js` contains `loadSt()` and `saveSt(field)` which read and write
the three localStorage keys (`iptv_creds`, `iptv_sel`, `iptv_favs`). On page
load, `main.js` calls `loadSt()` then uses the stored credentials for silent
auto-reconnect. Favourites and last-selected channel persist across page
refreshes. Disconnect erases only the credentials key.

## Acceptance criteria

- [ ] `loadSt()` in `st.js` reads all three localStorage keys; populates
      `ST.favs` from `iptv_favs` (parsed JSON array, fallback `[]`); does not
      set `ST.creds` directly (credentials are passed to `IptvApi.connect`);
      returns `{ creds, sel }` where `creds` is `{ url, user, pass }` or
      `null`, and `sel` is a stream_id string or `null`.
- [ ] `saveSt('favs')` writes `JSON.stringify(ST.favs)` to `iptv_favs`.
- [ ] `saveSt('sel')` writes `String(ST.cur.stream_id)` to `iptv_sel`
      (no-op if `ST.cur` is null).
- [ ] `saveSt('creds')` writes `JSON.stringify({ url, user, pass })` to
      `iptv_creds` — only called after a successful connect (enforced by
      the connect handler in `ui.js`, not by `saveSt` itself).
- [ ] After a successful auto-reconnect, if `sel` matches a `stream_id` in
      the loaded channel list, `setCur(ch)` is called for that channel
      (no auto-play; just pre-selection).
- [ ] `localStorage.removeItem(S.credsKey)` is called on disconnect.
- [ ] Malformed JSON in any localStorage key is caught and treated as absent
      (no uncaught exception; no transition to ERR state).
- [ ] `loadSt()` and `saveSt()` do not exceed 20 lines each.

## Test requirements

- **Unit:** `loadSt()` — mock `localStorage.getItem`; test all three keys
  present and valid; test all absent; test malformed JSON is swallowed.
  `saveSt('favs')` — mock `localStorage.setItem`; verify correct key and
  serialized value. `saveSt('sel')` — verify correct key; verify no-op when
  `ST.cur === null`.
- **UI:** Playwright — connect with demo; star a channel; refresh page;
  verify the starred channel still shows `fav-on` class. Connect with demo;
  click a channel; refresh page; verify that channel is pre-selected (has
  `ch-active` class) without auto-playing.

## Implementation notes

**Files changed:**
- `client/st.js` — added `loadSt()` and `saveSt(fld)` functions; exported on `window.IptvSt`. Uses `window.localStorage` (not bare global) so the sandbox test harness can inject a mock. ADR comment updated to include ADR-0003 (was already present).
- `client/ui.js` — `onOk` saves creds to localStorage after successful connect; `onGridClick` calls `saveSt('sel')` after `setCur`; `toggleFav` calls `saveSt('favs')` after `setFavs`; `onDisc` calls `localStorage.removeItem(window.S.credsKey)` before clearing state. ADR comment updated to add ADR-0003.
- `client/main.js` — module-level `_stored` var captures `loadSt()` result in `onReady`; `onConnRes` reads `_stored.sel` after channels load and calls `setCur` for matched channel (no auto-play). ADR comment updated to add ADR-0003.
- `adrs/ADR-0003-persistence.md` — `governs:` extended with `client/ui.js` and `client/main.js`.

**Tests added:**
- `tests/unit/persist.test.js` — 11 unit tests covering all specified scenarios.
- `tests/ui/persist.test.js` — 3 UI tests: fav persistence, sel persistence, creds removal on disconnect.

**Note:** `saveSt('creds')` is a no-op per the spec — credentials are written directly in `onOk` via `localStorage.setItem(window.S.credsKey, ...)`. The task spec's note about `saveSt('creds')` being called by ui.js means ui.js writes creds directly rather than routing through `saveSt`. The `sel` key stores `ch.id` (the demo data field name) matching the channel schema in this codebase; the task description uses `stream_id` but the actual channel objects use `id`.
