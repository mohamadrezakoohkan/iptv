---
id: TASK-0011
adr: ADR-0005
evolution: 2
status: done
attempts: 1
depends_on: []
---

# TASK-0011 — `isM3u()` detection + `parsM3u(text)` pure parser in `client/api.js`

## Goal

Two pure, unit-testable functions are added to `client/api.js`:

- `isM3u(url, user, pass)` — returns `true` when the URL should be handled
  as an M3U playlist (pathname ends with `.m3u`/`.m3u8` case-insensitively,
  or both `user` and `pass` are absent/empty and the URL is a plain
  `http(s)://` URL that is not `"demo"`).

- `parsM3u(text)` — pure parser accepting a raw `#EXTM3U` text string;
  returns `{ ok: true, val: { categories, channels } }` on success or
  `{ ok: false, err: string }` on failure. Channels conform to the `CH_DEF`
  schema (CONVENTIONS.md §7). Categories have shape
  `{ category_id: string, category_name: string }`.

Neither function makes network calls, touches the DOM, or writes to `ST`.

## Acceptance criteria

- [ ] `isM3u("https://example.com/list.m3u", "", "")` returns `true`.
- [ ] `isM3u("https://example.com/list.M3U8", "", "")` returns `true`
      (case-insensitive).
- [ ] `isM3u("https://example.com/list.m3u", "user", "pass")` returns `true`
      (extension takes priority).
- [ ] `isM3u("http://portal.example.com", "", "")` returns `true` (no
      credentials, plain URL).
- [ ] `isM3u("demo", "", "")` returns `false`.
- [ ] `isM3u("http://portal.example.com", "admin", "1234")` returns `false`.
- [ ] `parsM3u` called with text that does not start with `#EXTM3U` returns
      `{ ok: false, err: 'not an M3U file' }`.
- [ ] `parsM3u` parses a minimal two-channel M3U fixture and returns exactly
      two channel objects with correct `name`, `url`, `img`, `grp`, `id`,
      `num` fields per `CH_DEF`.
- [ ] `parsM3u` derives `categories` as deduplicated, ordered `group-title`
      values shaped as `{ category_id, category_name }`.
- [ ] `parsM3u` skips `#EXTINF` entries whose following stream URL line is
      blank or absent.
- [ ] `parsM3u` defaults `grp` to `"Other"` when `group-title` is absent.
- [ ] `parsM3u` correctly handles `#EXTINF` lines where the channel name
      (after the last `,`) contains commas.
- [ ] All of the above are covered by unit tests in `tests/api.test.js` (or
      an equivalent Vitest test file). No network calls in tests.

## Test requirements

- **Unit:** `isM3u` — at least 6 cases covering extension match (`.m3u`,
  `.M3U8`), credential-absent path, demo bypass, Xtream bypass.
  `parsM3u` — at least: missing header, minimal 2-channel fixture, category
  dedup, missing group-title default, skipped entry with no URL, name with
  embedded comma.
- **UI:** n/a — these are pure functions with no user-facing behavior.

## Implementation notes

### Files changed
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/client/api.js` — Added six helper functions (`getM3uAttr`, `getChanName`, `mkM3uCh`, `parsInfLine`, `firstNonEmpty`, `parsM3uLines`, `getM3uCats`) plus the two exported functions `isM3u` and `parsM3u`. Updated ADR comment from `ADR-0001` to `ADR-0001, ADR-0005`. Added `URL` to globals comment. Exported `isM3u` and `parsM3u` on `window.IptvApi`.
- `/Users/mohammadreza/Desktop/Personal/vibe-coded-apps/iptv/tests/unit/api.test.js` — Appended two new `describe` blocks: `isM3u` (6 cases) and `parsM3u` (5 cases), all using the existing `loadApi` harness with `URL` injected as an additional global.

### Non-obvious choices
- `isM3u` wraps `new URL()` in try/catch per the task spec (ADR §Detection) despite RULE-ERR-4. This is the correct tradeoff: the function is a pure predicate that must degrade gracefully on unparseable URLs; it falls back to a raw string `.m3u`/`.m3u8` suffix check.
- `parsM3uLines` preserves `inf` across blank lines and non-EXTINF comment lines (`#EXTVLCOPT`, etc.), so a comment between `#EXTINF` and the stream URL does not silently drop the channel.
- `mkM3uCh` uses `tvgName || chanName` as `name`, honouring the precedence specified in the task: tvg-name attribute wins, then name-after-comma fallback.
- `stream_id`, `category_id`, and `categoryId` extra fields are emitted for downstream UI compatibility as specified in the task.
- All new helper functions are at IIFE scope (not nested), satisfying RULE-FN-6. All are ≤ 20 lines, satisfying RULE-FN-2.
