---
status: draft
---

# VOD library (Movies & Series) on the Xtream path

## Purpose

Add an on-demand **VOD library** — **Movies** and **TV Series** — alongside the
existing **Live** channel browser, for Xtream-compatible portals. After a
successful Xtream connect the app additionally fetches VOD movie
categories/streams and TV series (best-effort, non-blocking), normalizes each
into a canonical **on-demand item** schema mirroring the live `Ch` shape, and
presents them through the **existing sidebar/category + channel-grid browse UX**
behind a new **Live | Movies | Series** content toggle. Selecting a movie — or a
series episode after drilling into its seasons/episodes — builds the Xtream
on-demand stream URL and plays it through the **existing dual-engine player and
select+play path** a live channel uses.

This feature adds **no new playback engine, no new state-machine phase, no new
server route, and no new localStorage key for playback**. It reuses the existing
`/api/xtream` CORS proxy, the existing Xtream fetch pattern (`mkXtCh` in
`src/client/api.js`), the canonical item schema, the existing select+play path
(`onGridClick` → `setCur` → `go('PLAY')` → `loadPlay`), and the existing
sidebar/grid render functions.

VOD is an **Xtream-only** capability:

- **Xtream path** — fetches movie VOD (`get_vod_categories` / `get_vod_streams`)
  and series (`get_series`, then `get_series_info` for seasons/episodes),
  best-effort through the existing proxy. Any portal that does not serve VOD
  (empty / error / timeout) degrades silently — the toggle simply shows no
  Movies/Series content for that source.
- **M3U path** and **Demo path** — show **no** VOD/Series surface and degrade
  silently. The **demo path may synthesize one offline-playable VOD entry**
  (mirroring the catch-up demo synthesis) purely so the feature is demonstrable
  without live network.

---

## 1. On-demand item schema (`Vod`)

VOD movies and series episodes are normalized into a canonical **on-demand item**
object that **mirrors the live `Ch` shape** so the existing grid/sidebar render
and select+play path can consume it unchanged. It is a **parallel item shape**
(not new optional fields on `Ch`): it carries the same render/play-relevant
fields (`id`, `name`, `grp`, `url`, `img`, `cat`, `num`) plus a `kind`
discriminator. This keeps the live `Ch` consumers untouched and keeps the
on-demand fields (which a live channel never has) off the `Ch` type.

```
/** @typedef {{ id:string, name:string, grp:string, url:string, img:string, cat:string, num:number, kind:'movie'|'episode' }} Vod */
```

| Field  | Meaning                                                                 |
|--------|-------------------------------------------------------------------------|
| `id`   | Xtream `stream_id` (movie) or episode `id` (series episode), stringified |
| `name` | movie `name`, or `"<series> · S<season>E<episode> <title>"` for an episode |
| `grp`  | category name resolved from the VOD/series category id (`"Uncategorized"` when unknown) |
| `url`  | the built Xtream on-demand stream URL (§3)                               |
| `img`  | poster URL — movie `stream_icon`/`cover`, or series `cover` (may be empty)|
| `cat`  | category id (so the grid filter `item.cat === id` matches the sidebar button) |
| `num`  | a numeric ordering hint (movie `num` when present, else 0)               |
| `kind` | `'movie'` or `'episode'` — the playback-URL form discriminator (§3)      |

- A **movie** item is a fully resolved, directly-playable on-demand item.
- A **series** item, in the **content list**, is a browse entry (a `Series`
  shape, §2) — *not* a `Vod`; only its **episodes** become `Vod` items once a
  series is opened (§5b). A `Vod` is always something with a built playback URL.
- The `Vod` shape is render-compatible with `Ch` for the grid card (`mkCard`
  reads `id`, `name`, `img`, `num`, `cat`) and the select+play path (`url`), so
  no card/grid code change is needed beyond what the toggle requires.

## 2. Series browse shape (`Series`)

A series listed in the Series content view is a **browse entry**, not a playable
item. It carries enough to render a poster card and to drill into seasons/episodes:

```
/** @typedef {{ id:string, name:string, grp:string, img:string, cat:string }} Series */
```

| Field  | Meaning                                                       |
|--------|--------------------------------------------------------------|
| `id`   | Xtream `series_id`, stringified                              |
| `name` | series `name`                                                |
| `grp`  | category name resolved from the series category id           |
| `img`  | series `cover` poster URL (may be empty)                     |
| `cat`  | series category id (matches the Series sidebar button)       |

Selecting a series card opens its **seasons/episodes drill-down** (§5b); it does
not play anything itself.

## 3. On-demand stream URL building (`src/client/api.js`)

On-demand stream URLs mirror the live form `mkXtCh` builds
(`<base>/live/<user>/<pass>/<stream_id>.<ext>`):

| Item kind | URL form                                                              |
|-----------|-----------------------------------------------------------------------|
| Movie     | `<base>/movie/<user>/<pass>/<stream_id>.<ext>`                        |
| Episode   | `<base>/series/<user>/<pass>/<episode_id>.<ext>`                     |

- **ext** — preserved from the source payload's `container_extension` for that
  item when present (e.g. `mp4`, `mkv`, `ts`, `m3u8`); fallback to the account's
  live extension (`getExt`, ADR-0009) when absent. The extension is preserved so
  `getEng` (`src/client/play.js`) resolves the **same** engine the live path uses
  (`.m3u8` → hls.js, else mpegts.js) — **no new engine, no new branch in
  `loadPlay`**.
- The builders are **pure** and side-effect-free, returning the absolute URL
  string. The caller hands it to the **unchanged** `loadPlay`, which proxies +
  engine-selects it exactly as for live (`getPrx` / `getRmx`).

## 4. Best-effort VOD fetch (`src/client/api.js`)

After a successful Xtream connect (live channels already returned and rendered),
the app fetches VOD **best-effort and non-blocking**, mirroring the EPG fetch
posture (ADR-0030): it never throws, never changes `ST.phase`, never blocks
browsing, and a failed / empty / timed-out fetch is swallowed (no Movies/Series
content for that source).

- **Movies.** `get_vod_categories` (→ `{category_id, category_name}` like
  `get_live_categories`) and `get_vod_streams`. Each stream is normalized into a
  `Vod` movie item (`kind:'movie'`) with its built movie URL (§3). Category names
  resolve via the VOD category map; unknown → `"Uncategorized"`.
- **Series.** `get_series` (→ `Series` browse entries, §2) plus the series
  categories from `get_series_categories` (fallback: derive from the series
  entries' `category_id`). Seasons/episodes are **not** fetched eagerly; they are
  fetched **on demand** when a series card is opened (§5b) via
  `get_series_info&series_id=<id>`, whose `episodes` map is normalized into `Vod`
  episode items (`kind:'episode'`) with built series-episode URLs (§3).
- The fetch is bounded the way the EPG fetch is (it does not hammer a large
  portal): a single `get_vod_streams` / `get_series` call each, and a single
  per-series `get_series_info` call when a series is opened. The proxy and the
  15 s `AbortController` timeout (`loadJson`) are reused unchanged.
- **Single-connection gate (ADR-0041).** Like the EPG fan-out (`epg.md` §3), the
  connect-time bulk VOD fan-out (`get_vod_categories`, `get_vod_streams`,
  `get_series_categories`, `get_series`) is **gated on the portal's advertised
  connection capacity** so it never starves live playback. The Xtream connect
  Result carries `maxConns` (`Number(user_info.max_connections)`, coerced;
  missing / `0` / unparseable = unknown). When `maxConns === 1` (single-connection
  portal) the bulk VOD fan-out is **skipped entirely** — the VOD store stays
  empty for that source and the Movies/Series tabs do not appear — so the single
  allowed connection stays free for live playback. When `maxConns > 1` or unknown
  (the conservative, non-regressing default) the bulk fan-out runs unchanged. The
  on-demand per-series `get_series_info` (an explicit user action on drill-down,
  §5b) is not part of the connect-time burst and is unaffected by the gate. The
  demo path synthesizes its movie offline and the M3U path leaves the store empty
  — neither issues a connect-time Xtream burst, so neither is gated.
- The connect Result for the Xtream path is unchanged in shape; VOD data is
  exposed through a dedicated store/global (`window.IptvVod`) the UI reads at
  render time, exactly as the EPG store (`window.IptvEpg`) is read. M3U/demo
  connect paths leave the VOD store empty.

## 5. Content toggle + browse UX

### 5a. Live | Movies | Series content toggle

A new **content toggle** (a small segmented control) lets the user switch the
browse surface between three content modes:

| Mode     | Sidebar categories        | Grid items                          |
|----------|---------------------------|-------------------------------------|
| `live`   | live channel categories   | live channels (`Ch`) — today's behavior |
| `movies` | VOD movie categories      | movie items (`Vod`, `kind:'movie'`) |
| `series` | series categories         | series cards (`Series`)             |

- The toggle is rendered in the content area (e.g. in the content-head / above
  the channel grid), keyboard-accessible, with the active mode visually distinct.
- Default mode is `live`. Switching mode re-renders the **sidebar category list**
  (`rndSide`, reused) and the **grid** (`rndGrid`, reused) for the selected
  mode's categories/items, resetting the active category filter to "All" for
  that mode. Search (`#search`) and the sort control behave as today within the
  active mode's item set.
- The active content mode is **transient UI state** (no new localStorage key) —
  it resets to `live` on reload, like the account-panel open/close state. It is
  **not** a state-machine phase (CONVENTIONS §6) — it is a render-mode flag held
  in the existing UI/state layer, exactly as `ST.flt` is.
- **Visibility / silent degrade.** The toggle's **Movies** and **Series** options
  are shown **only when** the connected source actually has VOD/series content
  (Xtream with a non-empty VOD store). On M3U / demo (no VOD), and on an Xtream
  portal that served no VOD, the toggle shows only **Live** (or is hidden
  entirely) — no empty Movies/Series tabs, consistent with the EPG/catch-up
  contextual-presence posture. The demo path's single synthesized VOD entry (§6)
  is the one exception that surfaces a Movies tab in demo mode.

### 5b. Series seasons/episodes drill-down

Selecting a **series** card (in `series` mode) opens that series'
**seasons/episodes drill-down** instead of playing:

- On open, `get_series_info` for that `series_id` is fetched on demand (best-
  effort, swallowed on failure) and its episodes normalized into `Vod` episode
  items grouped by season.
- The drill-down lists the seasons and, per season, the episodes as a list/grid
  of selectable episode entries. It reuses the existing grid/card surface where
  practical (an episode entry is a `Vod` item, so it renders and plays like any
  other on-demand item) plus a season grouping/header and a **back** affordance
  returning to the series list.
- Selecting an **episode** plays it through the select+play path (§5c).
- The drill-down is purely presentational navigation within `series` mode — no
  new state phase, no new localStorage key.

### 5c. Playing an on-demand item — reuse the existing select+play path

Selecting a movie card or a series episode drives the **existing select+play
transition** exactly like a live card click / the reminder Watch action
(`goRemWatch`) / Replay (`goReplay`):

1. resolve the `Vod` item (movie from the movies list, episode from the opened
   series' episode list) — no-op if gone;
2. its `url` is the already-built on-demand stream URL (§3);
3. `setCur(item)`, `saveSt('sel')`, `go('PLAY')` when `READY`, `rndHead()`, then
   `IptvPlay.loadPlay(item.url)`.

Because the on-demand URL preserves the source extension, `loadPlay` → `getEng`
selects the **same** engine (hls.js for `.m3u8`, mpegts.js / remux otherwise),
through the **same** `/api/xtream?url=` proxy — **no new engine, no new phase, no
new route**. The active-item marker (`ch-active`) reflects the on-demand item
being played, exactly as live selection does.

Live-only affordances that are meaningless for on-demand items (NOW/NEXT EPG
line, Remind, Replay) are simply absent on movie/episode cards — those read
`window.IptvEpg`, which has no entries for VOD ids, so they render nothing today
without special-casing.

## 6. Demo / offline demonstrability

So the feature is demonstrable without live network (and so the demo recording
can exercise it), the **demo connect path** synthesizes **one offline-playable
VOD movie entry** (mirroring the catch-up demo synthesis, ADR-0036
`docs/specs/catchup-archive.md` §6):

- a single demo `Vod` movie (`kind:'movie'`) under a demo VOD category, with a
  poster-less or placeholder `img`, and
- a `url` set to a public HLS test stream (the same kind the demo channels use),
  so activating it plays a real test stream through the normal engine path with
  **no live Xtream portal**.

The demo synthesis surfaces a **Movies** tab in the content toggle (§5a) in demo
mode so the toggle + a playable VOD item are demonstrable offline. The demo path
synthesizes **no** series (one movie entry is sufficient for the demo).

## 7. State, persistence, conventions

- **State machine.** No new phase, no new boolean control flag for playback
  (CONVENTIONS §6). The content mode (`live`/`movies`/`series`) is a render-mode
  flag in the existing state layer, not a phase; playing an on-demand item reuses
  the live PLAY transition.
- **Persistence.** No new localStorage key. The content mode is transient
  (resets to `live` on reload). VOD/series data is rebuilt on connect, never
  persisted (accounts persist credentials, not content; `docs/specs/iptv-player.md`
  §9 unchanged). `iptv_sel` may store an on-demand item id like any selected id,
  but no new key is introduced.
- **Proxy.** All VOD/series fetches and on-demand stream delivery go through the
  **existing** `/api/xtream?url=<encoded>` proxy — no new server route
  (`src/server/rtr.js` unchanged).
- **Schema.** A parallel `Vod` item shape and a `Series` browse shape are added;
  the live `Ch` type is **unchanged**. `Vod` is render/play-compatible with `Ch`.
- **Tokens.** `vod`, `mov`/`movie`, `ser`/`series`, `epi`/`episode`, `kind`,
  `seas`/`season` are conventionally-formed CONVENTIONS §1 tokens.

## 8. Accessibility & UX

- The content toggle is a keyboard-accessible segmented control; the active mode
  is announced (e.g. `aria-pressed` / `aria-selected`) and visually distinct.
  **R-0001 compliance:** any aria attribute a toggle option carries is present in
  the baseline HTML the builder emits; attributes that genuinely toggle
  (`aria-pressed`/`aria-selected` reflecting the active mode) start from the
  source-present baseline and are only flipped between values, never added where
  source had none.
- Movie cards, series cards, and episode entries are keyboard-focusable and
  selectable exactly like live channel cards (`role="button"`, `tabindex="0"`).
- The series drill-down's back affordance is a real focusable control.
- Movies/Series are offered only where they exist (Xtream with VOD, or the demo
  synthesized entry); everywhere else they are silently absent — no empty tabs,
  consistent with the EPG/catch-up contextual-presence posture.
- M3U/demo (beyond the one demo movie) and VOD-less Xtream portals degrade
  silently — no errors, no empty Movies/Series surfaces.
