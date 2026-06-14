---
id: TASK-0062
adr: ADR-0030
evolution: 19
status: pending
attempts: 0
depends_on: []
---

# TASK-0062 — `epg.js` store + parsers + now/next/schedule selectors

## Goal

A new self-contained client module `src/client/epg.js` exposes
`window.IptvEpg`: an in-memory, session-scoped program-guide store keyed by
channel id, the two pure parsers (`parsXtEpg`, `parsXmltv`), the store mutators
(`set`/`setAll`/`clear`), and the pure read selectors (`get`/`has`/`count`/
`getNowNext`/`getSched`). It is loaded in `src/index.html` before `ui.js`. No
fetch wiring and no UI render are in this task — only the store, parsers, and
selectors (the data layer of ADR-0030).

## Acceptance criteria

- [ ] `src/client/epg.js` exists, carries `// ADR: ADR-0030`, is a self-contained
      IIFE exposing `window.IptvEpg`, and follows CONVENTIONS (tokens only, no
      `class`/`this`/`new` except built-ins, functions ≤ 20 lines / ≤ 2 params,
      named declarations).
- [ ] `parsXtEpg(raw, chId)` parses a `get_simple_data_table`-shaped payload
      (`{ epg_listings: [...] }`) into a `Prg[]` for `chId`: base64-decodes
      base64 `title`/`description`, reads `start_timestamp`/`stop_timestamp`
      (unix **seconds**) → `start`/`stop` in **unix ms**, drops malformed
      listings, and returns the list **sorted ascending by `start`**. Tolerates a
      missing/empty `epg_listings`.
- [ ] `parsXmltv(text)` parses XMLTV text into a `{ [tvgId]: Prg[] }` map keyed by
      each `<programme channel="…">`; parses `YYYYMMDDHHMMSS ±HHMM` start/stop to
      **unix ms** honoring the offset; maps `<title>`→`title`, `<desc>`→`desc`,
      `<category>`→`cat`; sets `chId` to the channel id; drops malformed entries;
      each per-id list is **sorted ascending by `start`**.
- [ ] Every produced object conforms to `PRG_DEF` (CONVENTIONS §7): `chId`,
      `title`, `start`, `stop`, `desc`, `cat` with correct types.
- [ ] `set(chId, prgs)` stores (replacing any prior list); `setAll(map)` bulk
      stores; `get(chId)` returns a **fresh copy** (`[]` when none, never the
      internal reference); `has(chId)` is true only for a non-empty stored guide;
      `count()` returns the number of channels with a stored guide; `clear()`
      empties the store.
- [ ] `getNowNext(chId, now)` returns `{ now: Prg|null, next: Prg|null }` for the
      given time (defaults to `Date.now()`): `now` is the program whose
      `start <= now < stop`, `next` is the earliest program with `start >= now`
      (or `start > now.stop`); both `null` when nothing matches or no guide.
- [ ] `getSched(chId, now)` returns the upcoming `Prg[]` (the current program plus
      those not yet stopped), ascending by `start`; `[]` when no guide.
- [ ] `src/index.html` loads `/epg.js` before `/ui.js` (mirroring `errlog.js`
      placement) and carries an HTML-comment ADR reference for ADR-0030.

## Test requirements

- **Unit:** `src/tests/unit/epg.test.js` — `parsXtEpg` (timestamp seconds→ms,
  base64 decode, sort, malformed drop, empty payload), `parsXmltv` (XMLTV
  timestamp+offset parse, per-id map, sort, malformed drop), store
  set/setAll/get-copy-isolation/has/count/clear, `getNowNext` (now-only,
  next-only, both, neither, gap between programs), `getSched` (filters past,
  includes current, ascending). Run under `npx vitest run`.
- **UI:** n/a — no user-facing render in this task.
- **Integration:** n/a — pure parse/selector logic; live fetching is TASK-0063.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._
