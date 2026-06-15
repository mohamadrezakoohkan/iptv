---
status: draft
---

# Electronic Program Guide (EPG) — now/next + per-channel schedule

## Purpose

Surface **what is on now and next** for each channel, and let the user expand a
channel to see its upcoming schedule. The EPG is an **added data-fetch and
render surface only** — it reuses the canonical `Ch` schema, the flat state
machine, the sidebar/channel-grid layout, the CORS proxy, and the localStorage
conventions. It adds **no new playback engine** and changes no playback
behavior: it is purely informational metadata rendered alongside the existing
channel browsing UI.

The EPG data is sourced from two places, matched to the two existing connection
paths (`docs/specs/iptv-player.md` §8):

- **Xtream path** — the Xtream short-EPG endpoint
  `player_api.php?action=get_simple_data_table&stream_id=<id>`, fetched through
  the existing `/api/xtream?url=<encoded>` proxy.
- **M3U path** — an XMLTV guide, matched per channel via each M3U entry's
  `tvg-id`, fetched through the same proxy.
- **Demo path** — a small synthetic guide generated in-memory so the EPG is
  demonstrable out of the box (no network), consistent with demo mode
  (`docs/specs/iptv-player.md` §8).

---

## 1. Data model — `Prg`

The program type is the canonical `Prg` already declared in CONVENTIONS.md §7;
this feature is its first consumer:

```
/** @typedef {{ chId:string, title:string, start:number, stop:number, desc:string, cat:string }} Prg */
```

| Field   | Meaning                                                         |
|---------|----------------------------------------------------------------|
| `chId`  | the `Ch.id` the program belongs to (Xtream `stream_id`; M3U `tvg-id`) |
| `title` | program title                                                  |
| `start` | program start time, **unix ms**                               |
| `stop`  | program stop time, **unix ms**                                |
| `desc`  | description (may be empty)                                     |
| `cat`   | program category/genre (may be empty)                         |

- `start`/`stop` are stored as **unix milliseconds** (CONVENTIONS §7), regardless
  of the source's native time format. Parsers coerce on the way in.
- Programs for a channel are stored **sorted ascending by `start`**.
- Unknown / malformed entries are dropped during parse, never stored (CONVENTIONS §7).

## 2. EPG module — `window.IptvEpg` (`src/client/epg.js`)

A self-contained client IIFE module (mirroring `src/client/errlog.js`) holding an
**in-memory, session-scoped** EPG store keyed by channel id, plus the pure
parsers and the now/next selectors. The guide is **not persisted** — it is live
metadata for the current session, gone on reload (same posture as the failure
log, ADR-0027). It exposes:

| Member            | Kind  | Contract |
|-------------------|-------|----------|
| `parsXtEpg(raw, chId)` | pure | Parse a `get_simple_data_table` payload into `Prg[]` for `chId` (sorted by `start`). |
| `parsXmltv(text)` | pure | Parse XMLTV text into a `{ [tvgId]: Prg[] }` map (each list sorted by `start`). |
| `set(chId, prgs)` | side-effect | Store `Prg[]` for a channel id (replaces any prior list). |
| `setAll(map)`     | side-effect | Bulk-store a `{ [chId]: Prg[] }` map (used by the XMLTV path). |
| `get(chId)`       | pure  | Return the stored `Prg[]` for a channel (fresh copy; `[]` when none). |
| `getNowNext(chId, now)` | pure | Return `{ now: Prg|null, next: Prg|null }` for a channel at time `now` (unix ms; defaults to `Date.now()`). |
| `getSched(chId, now)` | pure | Return upcoming `Prg[]` (the current program plus those that have not yet stopped), for the expandable view. |
| `has(chId)`       | pure  | True when a non-empty guide is stored for the channel. |
| `count()`         | pure  | Total channels with a stored guide. |
| `clear()`         | side-effect | Empty the store. |

### 2a. Xtream short-EPG parse (`parsXtEpg`)

`get_simple_data_table` returns `{ epg_listings: [ { id, title, start,
end / stop, start_timestamp, stop_timestamp, description, ... } ] }`. The base64
encoding Xtream uses for `title`/`description` is decoded (when base64) to plain
text. Time is read from the `*_timestamp` fields (unix **seconds**) and converted
to **unix ms**; the human `start`/`end` strings are a fallback. Each listing maps
to a `Prg` with `chId` set to the requested stream id. Malformed listings drop.

### 2b. XMLTV parse (`parsXmltv`)

XMLTV `<programme channel="<tvg-id>" start="<ts>" stop="<ts>">` elements map to
`Prg` keyed by the `channel` attribute (the M3U `tvg-id`). XMLTV timestamps are
the form `YYYYMMDDHHMMSS ±HHMM`; they are parsed to unix ms honoring the offset.
`<title>` → `title`, `<desc>` → `desc`, `<category>` → `cat`. A `<programme>`
whose `channel` matches no loaded channel's `tvg-id` is still parsed into the map
(the map is consulted by id; non-matching ids are simply never read).

## 3. Fetch wiring (no new playback engine)

EPG data is fetched **after** a successful `IptvApi.connect` (the channels are
already loaded), through the same proxy, on whichever path matched:

- **Xtream path.** For each channel (sampled/batched to respect `S.retries`-style
  budgets and avoid hammering the portal), fetch
  `/api/xtream?url=<encoded player_api.php?...&action=get_simple_data_table&stream_id=<id>>`,
  parse with `parsXtEpg`, and `set(chId, prgs)`. EPG fetch is **best-effort and
  non-blocking**: a failed or empty EPG fetch never fails the connect and never
  blocks browsing — channels render immediately; now/next fills in as guides
  arrive.
- **M3U path.** Fetch the XMLTV guide URL through the proxy (the iptv-org
  companion guide for the community presets, or a guide URL associated with the
  playlist), parse with `parsXmltv`, then `setAll(map)`. Channels are matched by
  their `tvg-id` (the M3U `Ch.id` is the `tvg-id` when present — see
  `src/client/api.js` `mkM3uCh`).
- **Demo path.** Generate a synthetic guide in-memory (a handful of programs per
  demo channel around `Date.now()`) so now/next and the schedule view are
  demonstrable offline.

The fetch wiring lives alongside the existing connect flow and writes only to the
`IptvEpg` store; it does **not** add a state-machine phase (CONVENTIONS §6 — the
phases stay INIT/LOAD/READY/PLAY/SRCH/ERR). A re-render of the grid/schedule is
triggered as guides become available.

## 4. Now/next line on the channel card

Each channel card (`docs/specs/iptv-player.md` §6, `mkCard` in `src/client/ui.js`)
gains a **now/next line** below the channel name:

- **Now** — the title of the program currently airing for that channel
  (`getNowNext(ch.id).now`), prefixed with a subtle "NOW" marker.
- **Next** — the title of the program airing next (`getNowNext(ch.id).next`),
  prefixed with a "NEXT" marker, rendered dimmer than NOW.
- When no guide is loaded for the channel (`!IptvEpg.has(ch.id)`), the line is
  **absent** — the card looks exactly as it does today (no empty placeholder
  taking space, consistent with the contextual-chip "absent until resolved"
  posture, ADR-0025). Cards never break layout when a guide is missing.
- Titles are truncated to a single line each; long titles ellipsize.
- The now/next line reads ADR-0024 spacing/sizing tokens and ADR-0019 colour
  tokens; the NOW/NEXT markers use the mono font (IBM Plex Mono) like other
  card meta.

## 5. Expandable per-channel schedule view

The user can expand a channel to see its upcoming schedule:

- Each card carrying a guide exposes an **expand affordance** (a keyboard-
  focusable control on the card, e.g. a small "Guide" toggle) that **does not**
  trigger playback — clicking it toggles the schedule, clicking the card body
  still selects+plays the channel (`docs/specs/iptv-player.md` §6).
- Expanding renders the channel's upcoming programs (`getSched(ch.id)`) as a
  compact list: each row shows the program's **time range** (start–stop, local
  time), **title**, and optional category, with the currently-airing program
  visually marked.
- Expansion is **purely presentational** (a CSS `is-expanded` class on the card —
  no state-machine phase, mirroring the account/log panel open model,
  `docs/specs/iptv-player.md` §13c). Only one channel's schedule needs to be open
  at a time; opening another collapses the previous (or each toggles
  independently — either is acceptable as long as it is presentational only).
- The expand control is keyboard-accessible: focusable, `aria-expanded`
  reflecting open state, and an accessible label. The schedule list is hidden
  (`aria-hidden`) when collapsed.
- A channel with no loaded guide shows **no** expand affordance.
- **Catch-up (archive) Replay.** On archive-capable Xtream channels, each **past**
  schedule row also carries a keyboard-focusable **Replay** control that plays the
  program from the source's timeshift archive through the existing player. The
  Replay affordance, its gating (past + archive-capable + within window), and the
  archive-URL/playback wiring are specified separately in
  `docs/specs/catchup-archive.md` (ADR-0035/ADR-0036). Future rows carry the
  Remind toggle (`reminders.md`); the two are mutually exclusive by row time.

## 6. State, persistence, and conventions

- **State machine.** No new phase; no new boolean control flags (CONVENTIONS §6).
  EPG presence is read from the `IptvEpg` store at render time. Card expansion is
  a presentational class, not a phase.
- **Persistence.** The EPG store is in-memory only — **no new localStorage key**
  (§9 of `docs/specs/iptv-player.md` is unchanged). Reuse, don't reinvent.
- **Schema.** `Prg` / `PRG_DEF` are reused verbatim from CONVENTIONS §7; no new
  data type is introduced.
- **Proxy.** All EPG fetches go through the existing `/api/xtream?url=<encoded>`
  proxy (`src/server/rtr.js`); no new server route is added.
- **Tokens.** `epg`, `prg`/`prgs`, `nxt`, `cur` are existing CONVENTIONS §1
  tokens; no new abbreviations are coined.

## 7. Accessibility & UX

- The now/next line is decorative text within the card; it never steals the
  card's primary click target (selecting/playing the channel).
- The schedule expand control is a real focusable `<button>` with
  `aria-expanded` and an accessible label; the schedule list toggles
  `aria-hidden`.
- Times render in the user's local timezone.
- Missing-guide channels degrade silently to today's card (no errors, no empty
  rows) — the EPG never blocks or breaks browsing.
