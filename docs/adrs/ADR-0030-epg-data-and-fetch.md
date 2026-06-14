---
id: ADR-0030
title: EPG is a client-side, in-memory program-guide store fed by Xtream short-EPG and XMLTV through the existing proxy
date: 2026-06-15
evolution: 19
status: accepted
governs:
  - src/client/epg.js
  - src/client/api.js
  - src/index.html
  - src/tests/unit/epg.test.js
  - src/tests/int/epg.test.js
---

# ADR-0030 — EPG is a client-side, in-memory program-guide store fed by Xtream short-EPG and XMLTV through the existing proxy

## Context

E19 prompt (the E18 Phase-4 research winner): add an Electronic Program Guide
showing what is on **now and next** per channel plus an expandable per-channel
schedule, sourcing schedule data from the **Xtream short-EPG endpoint
(`get_simple_data_table`)** through the existing CORS proxy on the Xtream path,
and from an **XMLTV guide via each M3U entry's `tvg-id`** on the M3U path. It must
reuse the canonical `Ch` schema, the flat state machine, the sidebar/channel-grid
layout, and the localStorage conventions, and add **no new playback engine** — it
is an added data-fetch and render surface only.

Constraints already in the codebase:

- The canonical `Prg` type and `PRG_DEF` schema **already exist** in
  CONVENTIONS.md §7 (unix-ms `start`/`stop`), declared but unused until now. EPG
  is their first consumer; no new type is introduced.
- The CORS-avoiding proxy is the single generic route `/api/xtream?url=<encoded>`
  in `src/server/rtr.js` (ADR-0002/ADR-0011), already used client-side for all
  Xtream JSON and remote M3U text fetches via `src/client/api.js`. Both the
  Xtream short-EPG JSON and the XMLTV guide text are ordinary GETs that fit that
  proxy unchanged — no new server route is needed.
- M3U channels already carry `tvg-id` as their `Ch.id` when present (`mkM3uCh` in
  `src/client/api.js`), so XMLTV's per-`<programme channel="…">` id matches the
  loaded channel id directly.
- The failure-log feature (ADR-0027) established the pattern this decision
  mirrors: a small self-contained client IIFE (`src/client/errlog.js`) holding an
  in-memory, session-scoped, non-persisted store with pure builders + a guarded
  global. EPG fits the same shape and posture.

## Decision

Add a self-contained client module **`src/client/epg.js`** exposing
`window.IptvEpg`: an **in-memory, session-scoped** program-guide store keyed by
channel id, plus the pure parsers and now/next/schedule selectors. It is **not
persisted** (no new localStorage key) — the guide is live session metadata, gone
on reload, exactly like the failure log (ADR-0027), keeping it out of the
account/localStorage model entirely.

Data shape, store API, and parse rules are specified in `docs/specs/epg.md` §1–§2.
In summary:

- `Prg` (CONVENTIONS §7) is the stored unit; lists are sorted ascending by
  `start` (unix ms); malformed entries drop.
- Parsers: `parsXtEpg(raw, chId)` (Xtream `get_simple_data_table` →
  `Prg[]`, base64-decoding title/description, reading `*_timestamp` seconds →
  ms) and `parsXmltv(text)` (XMLTV `<programme>` → `{ [tvgId]: Prg[] }`, parsing
  `YYYYMMDDHHMMSS ±HHMM` timestamps).
- Store: `set` / `setAll` / `get` / `has` / `count` / `clear`.
- Selectors: `getNowNext(chId, now)` → `{ now, next }`; `getSched(chId, now)` →
  upcoming `Prg[]`.

**Fetch wiring (best-effort, non-blocking).** After a successful
`IptvApi.connect`, EPG data is fetched through the **existing
`/api/xtream?url=<encoded>` proxy**, on whichever path matched:

- **Xtream** — per-channel (batched to respect a fetch budget so the portal is
  not hammered) `action=get_simple_data_table&stream_id=<id>`, parsed with
  `parsXtEpg`, `set(chId, prgs)`.
- **M3U** — the XMLTV guide URL fetched through the proxy, parsed with
  `parsXmltv`, then `setAll(map)`; channels matched by `tvg-id`.
- **Demo** — a synthetic in-memory guide so now/next + schedule are demonstrable
  offline.

EPG fetch **never fails or blocks the connect** and adds **no state-machine
phase** (CONVENTIONS §6 unchanged): channels render immediately; guides fill in
as they arrive, triggering a re-render of the now/next surface (ADR-0031). The
new module is loaded in `src/index.html` before `ui.js` (which reads it),
mirroring `errlog.js` load order, and callers guard `window.IptvEpg` for test
isolation.

## Consequences

**Easier:**
- Reuses the already-declared `Prg`/`PRG_DEF` schema and the single generic
  proxy — no new type, no new server route, no new dependency.
- In-memory only ⇒ no localStorage key, no migration, no account coupling; the
  failure-log (ADR-0027) pattern is proven and copyable.
- Best-effort/non-blocking fetch keeps browsing instant and the state machine
  untouched.

**Harder:**
- The Xtream path issues one short-EPG request per channel; batching/budgeting is
  required so a large portal is not hammered (handled in the fetch task).
- Two distinct source formats (Xtream JSON, XMLTV) need two parsers with careful
  timestamp coercion to unix ms.

**Ruled out:**
- A server-side EPG cache/route (the prompt scopes this to the existing proxy +
  client render; a server route is unrequested scope).
- Persisting the guide to localStorage (it is live session metadata; persistence
  would entangle the account store, against the prompt's "reuse localStorage
  conventions").
- Any change to the playback engines (the prompt is explicit: no new playback
  engine).

## Tasks derived

- TASK-0062 — `epg.js` store + parsers (`parsXtEpg`, `parsXmltv`) + selectors
  (`getNowNext`, `getSched`); `index.html` load order
- TASK-0063 — Wire best-effort EPG fetch into the connect flow (Xtream
  short-EPG; M3U XMLTV via `tvg-id`; demo synthetic), through the existing proxy

## Traceability

Every file in `governs:` must carry an `ADR: ADR-0030` comment near the top
(native comment syntax; `index.html` via HTML comment). When a change removes the
last governed code, this ADR is marked `status: deleted` — the file itself is
never removed; it is history.
