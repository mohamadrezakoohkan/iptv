---
id: ADR-0005
title: M3U playlist support — detection, parse, CORS proxy reuse, footer UI adaptation
date: 2026-06-11
evolution: 2
status: superseded (by ADR-0008)
governs:
  - client/api.js
  - client/ui.js
  - client/app.css
  - index.html
  - tests/unit/api.test.js
  - tests/unit/m3u-ui.test.js
  - tests/ui/m3u.test.js
  - tests/ui/m3u-ui.test.js
---

# ADR-0005 — M3U playlist support — detection, parse, CORS proxy reuse, footer UI adaptation

> **Superseded by [ADR-0008](ADR-0008-explicit-login-mode.md)** (E4). The
> detection heuristic (`isM3u`) and the URL-driven footer adaptation are
> replaced by an explicit user-selected login mode. The M3U parse strategy
> and CORS proxy reuse decisions are reaffirmed by ADR-0008 and carry
> forward unchanged under its governance.

## Context

The app currently connects only to **Xtream-compatible portals** via
`player_api.php` (ADR-0002). A user tried `https://iptv-org.github.io/iptv/index.m3u`
— a standard `#EXTM3U` playlist — and got a connection failure because
`IptvApi.connect()` attempted to call `player_api.php` on that host.

Standard M3U playlists are the most common way to distribute IPTV channel
lists publicly (e.g. the iptv-org community repository). Supporting them
means users can paste any `.m3u` URL and get the same browse / play UX.

Four concerns must be resolved:

1. **Detection**: how does `IptvApi.connect()` know to use the M3U path vs
   the Xtream path?
2. **CORS**: M3U files on remote hosts do not emit CORS headers; the browser
   cannot fetch them directly.
3. **Parse**: `#EXTM3U` / `#EXTINF` is a line-oriented text format that must
   be parsed into the same `{ categories, channels }` shape the rest of the
   UI consumes.
4. **Footer UX**: the login form currently always shows URL + Username +
   Password; for M3U URLs the credential fields are irrelevant and confusing.

Constraints from existing ADRs and CONVENTIONS.md:

- ADR-0002 established the `/api/xtream?url=<encoded>` proxy on the server.
  `server/rtr.js` already streams the proxied response; no server changes are
  needed for ordinary M3U files.
- ADR-0001 mandates vanilla JS + CONVENTIONS.md-conformant identifiers. All
  new functions must follow §2 naming rules (`isM3u`, `loadM3u`, `parseM3u`
  are acceptable: `is*` pure predicate, `load*` async fetch, `parse*`
  transformed to `pars*` by convention — but `parse` is not a reserved verb
  in CONVENTIONS.md §9 RULE-FN-3; the closest allowed verb is `get`. However
  CONVENTIONS.md §1 lists `parser → pars` as a token, and §3 maps `pl.js` as
  the parse module on the server side. On the client, parsing lives inside
  `api.js` as private helpers — function names `isM3u`, `loadM3u`, and
  `parsM3u` (using the `pars` token) are compliant).
- CONVENTIONS.md §9 RULE-FN-4 requires async functions to return
  `{ ok, val }` / `{ ok, err }` — `loadM3u` must honour this.
- CONVENTIONS.md §7 `CH_DEF` is the authoritative channel schema. `parsM3u`
  must produce objects that conform to it.

## Decision

### Detection heuristic (`isM3u`)

A URL is treated as an M3U URL when **either** condition holds:

- The URL pathname ends with `.m3u` or `.m3u8` (case-insensitive), **or**
- `user` and `pass` are both absent/empty **and** the URL is a plain
  `http(s)://` URL (not `"demo"`).

This heuristic is encoded in a pure function `isM3u(url, user, pass)` inside
`client/api.js`. `IptvApi.connect()` calls `isM3u` at the top and branches
accordingly.

Rationale: a URL ending in `.m3u` / `.m3u8` is unambiguously a playlist
file. The second condition covers URLs like `https://example.com/playlist`
that serve M3U content but lack a file extension — requiring that credentials
be absent ensures no Xtream portal is misidentified (Xtream portals always
require credentials in the design).

### CORS proxy reuse

The M3U file is fetched via the **existing** `/api/xtream?url=<encoded>`
proxy endpoint (ADR-0002). No new server route is needed. The proxy already
streams the response body through `pipe()` / passthrough, which handles large
M3U files correctly without buffering.

The client constructs the proxy URL as:
```
/api/xtream?url=<encodeURIComponent(m3uUrl)>
```
and issues a plain `fetch()` call, reading the response as text.

### M3U parse strategy (`parsM3u`)

`parsM3u(text)` is a **pure function** (no network, no DOM) that accepts the
raw M3U text and returns `{ ok: true, val: { categories, channels } }` or
`{ ok: false, err: string }`.

Algorithm:

1. Split on `\n`. Trim each line.
2. First non-empty line must be `#EXTM3U`; if not, return
   `{ ok: false, err: 'not an M3U file' }`.
3. Iterate lines. When a line starts with `#EXTINF`:
   - Extract `tvg-id`, `tvg-logo`, `group-title` via regex on the attribute
     portion (everything before the final `,`).
   - Extract `name` as the substring after the last `,`.
   - The **next** non-blank, non-`#` line is the stream URL.
4. Build a `Ch`-conformant object per channel (see §7 of CONVENTIONS.md):
   `{ id, name, grp, url, img, cat, num }`.
   - `id` ← `tvg-id` (fallback: empty string).
   - `name` ← display name (fallback: `tvg-name` attribute if present).
   - `grp` ← `group-title` (fallback: `"Other"`).
   - `url` ← stream URL.
   - `img` ← `tvg-logo` (fallback: `""`).
   - `cat` ← same as `grp` (M3U has no separate category ID).
   - `num` ← sequential 1-based index.
5. Derive `categories` as the ordered deduplicated list of `grp` values,
   shaped as `{ category_id: grp, category_name: grp }` to match the Xtream
   category object shape consumed by the sidebar.
6. Skip channels with a blank `url`. Cap total channels at `S.maxChs` if that
   constant exists; otherwise no hard cap at parse time.

### Footer UI adaptation

In `client/ui.js`, an `input` event listener on the Portal URL field calls
`isM3u(val, "", "")`. When it returns `true`:

- Username and Password inputs are hidden via CSS class `is-m3u` on the
  footer element (`display: none` in `app.css`).
- Their `required` attribute is removed to allow form submission.
- Hint text is set to `"M3U URL detected — username and password not needed."`.

When `isM3u` returns `false`, the `is-m3u` class is removed, `required` is
restored, and hint text reverts to `"Type 'demo' to try a sample playlist."`.

This logic lives in `ui.js` (`rndFtr` or a new `rndM3uMode` helper) and is
triggered by `onUrlInp` — an event handler in `ui.js` wired to the URL
`<input>` element's `input` event.

## Consequences

**Easier:**
- Any public `.m3u` URL works out of the box — users paste and click Connect.
- No server changes required; the proxy already handles the fetch correctly.
- `parsM3u` is pure and fully unit-testable without network or DOM.
- Categories and channels arrive in the same shape as Xtream; no downstream
  UI code changes are needed beyond the footer adaptation.

**Harder:**
- M3U files from large public providers (iptv-org: ~10 000+ entries) can be
  several megabytes. `parsM3u` runs synchronously on the main thread; a very
  large file may cause a brief UI freeze. This is accepted at Evolution 2 —
  a Web Worker offload is deferred.
- The detection heuristic has an edge case: a credentialled portal URL that
  also ends in `.m3u8` would be misidentified as M3U. This is considered
  unlikely in practice; a future evolution can add explicit mode selection.
- `tvg-logo` URLs on public M3U files are often broken or rate-limited; the
  existing channel card fallback (letter-tile on `img` load error) already
  handles this.

**Ruled out:**
- A new server route for M3U fetching (unnecessary — proxy already works).
- Client-side direct fetch of M3U URLs (CORS restrictions).
- Streaming / chunked parse on the client (deferred).

## Tasks derived

- TASK-0011 — `isM3u()` detection + `parsM3u(text)` pure parser in `client/api.js`
- TASK-0012 — `loadM3u(url)` fetch+parse integration in `client/api.js`
- TASK-0013 — Footer UI adaptation — hide username/password when URL is M3U

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0005` near the top
(added to the existing `ADR:` comment lines by implement-agent).
