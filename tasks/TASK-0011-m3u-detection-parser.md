---
id: TASK-0011
adr: ADR-0005
evolution: 2
status: pending
attempts: 0
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

_Filled by implement-agent._
