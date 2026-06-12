---
id: TASK-0021
adr: ADR-0009
evolution: 5
status: done
attempts: 0
depends_on: []
---

# TASK-0021 — Normalize Xtream channels and build stream URLs

## Goal

`loadXtream()` in `client/api.js` returns the same normalized `Ch` objects
(`{ id, name, grp, url, img, cat, num }`) as the M3U and demo paths, with a
playable proxied-able `url`, instead of raw portal objects — so an Xtream
login produces channels the grid, sidebar, and player can actually use.

## Acceptance criteria

- [ ] Xtream path first calls no-action `player_api.php`; `user_info.auth`
      falsy → `{ ok: false, err }` with a human-readable message.
- [ ] Each `get_live_streams` entry maps to `Ch` per the table in
      `specs/iptv-player.md` §8: `id`←`stream_id`, `name`←`name`,
      `grp`←category name resolved via `get_live_categories` (unknown
      `category_id` → `"Uncategorized"`), `img`←`stream_icon`,
      `cat`←`category_id`, `num`←`num`.
- [ ] `url` is `<portal-base>/live/<user>/<pass>/<stream_id>.<ext>` with
      `<ext>` = `user_info.allowed_output_formats[0]` (fallback `"ts"`);
      trailing slashes on the portal base do not produce `//`.
- [ ] Categories in `val.categories` are normalized so the sidebar renders
      them exactly as in the M3U path.
- [ ] M3U and demo paths are byte-for-byte unaffected (existing tests pass).

## Test requirements

- **Unit:** mocked-fetch tests for the mapping table, auth-failure Result,
  allowed_output_formats fallback, unknown category → "Uncategorized", and
  base-URL trailing-slash handling.
- **UI:** n/a — not user-facing on its own (covered end-to-end by
  TASK-0024).
- **Integration:** against the live portal `http://mymax.top:8080`
  (user `1ymax5763dy` / pass `66537535`, per
  `specs/integration-testing.md` Xtream tier): `IptvApi.connect` in Xtream
  mode through the in-process proxy resolves ok with >1 category, >1
  channel, sampled channels schema-valid with non-empty `.ts` URLs.

## Implementation notes

- `client/api.js`: rewrote `loadXtream()` — now calls no-action
  `player_api.php` first (`mkInfUrl`), rejects falsy `user_info.auth` with
  `{ ok: false, err: 'Login failed – …' }`, reads
  `allowed_output_formats[0]` (fallback `"ts"`, `getExt`), then fetches
  categories + streams and normalizes via `getXtCats` / `mkCatMap` /
  `getXtChs` / `mkXtCh`. Stream URL:
  `<base>/live/<user>/<pass>/<stream_id>.<ext>`, with `getBase()` stripping
  trailing slashes (also applied in `mkPxUrl`). Categories normalized to
  `{ category_id: string, category_name: string }` — same shape as the M3U
  path. `category_id` keys are stringified so numeric portal ids match.
  `val` now also carries `server: <base>` per spec §8.
- `tests/unit/api.test.js`: Xtream-path tests updated to the new 3-call
  sequence (info → categories → streams) plus new tests for the §8 mapping
  table, auth failure, ext fallback, unknown category → "Uncategorized",
  trailing-slash handling, numeric category ids. M3U/demo tests untouched.
- `tests/int/xtream.test.js` (new): live-portal integration test through
  the in-process Express proxy — auth, >1 category, >1 channel, CH_DEF
  schema sample, non-empty `.ts` URLs. Verified passing against the live
  portal.
- ADR-0009 `governs:` trued up with the new integration test file.
