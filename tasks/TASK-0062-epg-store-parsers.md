---
id: TASK-0062
adr: ADR-0030
evolution: 19
status: done
attempts: 1
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

**Files touched**

- `src/client/epg.js` (new) — self-contained IIFE exposing `window.IptvEpg`,
  mirroring `errlog.js` (ADR-0027): in-memory `EPG = {}` keyed by chId, the two
  pure parsers, the store mutators (`set`/`setAll`/`clear`), the pure reads
  (`get`/`has`/`count`), and the selectors (`getNowNext`/`getSched`). Carries
  `// ADR: ADR-0030`.
- `src/index.html` — loads `/epg.js` immediately after `/errlog.js` and before
  `/ui.js`; ADR-0030 added to the top HTML-comment list.
- `src/tests/unit/epg.test.js` (new) — 31 unit tests; loads the IIFE against a
  fresh `window` via `new Function` (per the `errlog.test.js` pattern) so each
  test gets an isolated store.

**Non-obvious decisions**

- **No `DOMParser` for XMLTV.** The unit suite runs under Vitest's default
  `node` environment (no jsdom dependency, and introducing one is out of scope /
  forbidden), so `parsXmltv` is a regex parser over `<programme …>…</programme>`
  blocks rather than a DOM parse. It runs identically in the browser. This keeps
  the data layer dependency-free and deterministically testable in Node.
- **Base64 decode.** `parsXtEpg` decodes `title`/`description` only when the
  value looks like base64 (`isB64`), using `decodeURIComponent(escape(atob(s)))`
  for UTF-8 safety; non-base64 values pass through verbatim. `atob`/`escape`/
  `decodeURIComponent` are globals in both the browser and Node 18+.
- **`getNowNext` boundary.** `next` is computed from a lower bound of the current
  program's `stop` (or `now` when nothing airs), so a program starting exactly at
  `now` is reported as `now` and never doubles as its own `next`.
- **Malformed-drop rule.** `isPrg` requires a non-empty string `chId`, finite
  numeric `start`/`stop`, and `start < stop`; failing entries drop during parse
  (CONVENTIONS §7). Every produced object conforms to `PRG_DEF`
  (`chId/title/start/stop/desc/cat` with correct types). Xtream listings set
  `cat: ''` (the short-EPG payload carries no category).

**Traceability** — ADR-0030's `governs:` already listed all three touched files
(`src/client/epg.js`, `src/index.html`, `src/tests/unit/epg.test.js`); no
`governs:` change was required. `api.js` and `src/tests/int/epg.test.js` in that
list belong to TASK-0063 (fetch wiring).

**Tests** — `npx vitest run src/tests/unit/epg.test.js` → 31 passing; full unit
suite `npx vitest run` → 693 passing (no regressions).
