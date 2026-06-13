---
status: current
---

# IPTV Player Broadcast Console

## Purpose

A dark-themed, single-page IPTV channel browser and live-stream player for
Xtream-compatible portals. The user authenticates once, browses channels by
category, searches by name, and plays a selected channel via HLS directly in
the browser. Credentials, last-selected channel, and favourites persist across
sessions via localStorage.

---

## 1. Layout

```
┌──────────────────────────────────────────────────────┐
│ Header bar (56px)                                    │
├──────────────┬───────────────────────────────────────┤
│ Sidebar      │ Content area                          │
│ (240px)      │   content-head bar                    │
│              │   player card (16:9, max-h 35vh)      │
│              │   channel grid                        │
├──────────────┴───────────────────────────────────────┤
│ Footer                                               │
└──────────────────────────────────────────────────────┘
```

- Root container: `height: 100vh; display: flex; flex-direction: column`.
- `app-main` is a CSS grid: sidebar (240px fixed) | content (1fr).
- Mobile breakpoint `< 760px`: sidebar collapses to a horizontal scroll strip;
  brand/search are hidden; player max-height becomes 40vw.

---

## 2. Design tokens

All colours are CSS custom properties on `:root`:

| Token    | Value     | Usage                        |
|----------|-----------|------------------------------|
| `--bg`   | `#0E1216` | page background              |
| `--sur`  | `#161C22` | sidebar, header surfaces     |
| `--sur2` | `#1D252D` | cards, inputs                |
| `--ln`   | `#28323C` | borders, dividers            |
| `--tx`   | `#E9EEF3` | primary text                 |
| `--dim`  | `#8C99A6` | secondary / dimmed text      |
| `--acc`  | `#F2A33C` | accent (amber) — CTA, active |
| `--live` | `#E5484D` | live indicator red dot       |

Fonts: `Space Grotesk` for UI text; `IBM Plex Mono` for channel numbers and
mono labels.

The values above are the **dark** theme (the default). The same eight colour
tokens are re-defined for a **light** theme, selected by a `data-theme`
attribute on the document root; see `specs/theme.md` and ADR-0019. Every rule
in this spec reads tokens, so it recolours automatically under either theme.

---

## 3. Header bar

There is no separate top header bar; the top-of-content bar is the
**content-head** (§5a, 56px). Its right edge hosts the **account navigation
button** (§13): an account glyph + the connected account name (or "Account"
when none is connected), opening the right-side account panel on click.

---

## 4. Sidebar

- 240px wide, full height, background `--sur`, right border `--ln`.
- **Brand row**: amber dot + "IPTV" label in Space Grotesk bold.
- **Search input**: icon + placeholder "Search channels…". Filters channel
  grid in real time using the `srch` module.
- **Category list**: a fixed "All Channels" entry, a "Favourites" entry (shown
  only when favourites exist), then a scrollable list of buttons — one per
  category derived from the connected source — each showing the category name
  and a channel-count badge. Categories come from the source's own grouping in
  the source's own order: **Xtream** from `get_live_categories` (ADR-0009),
  **demo** from its curated category set. **M3U / playlist sources (including
  the community presets, which all connect via the M3U path) derive categories
  from the first-level segment of `group-title`** — the text before the first
  `;`, trimmed and deduped (ADR-0020). Public M3U files pack a hierarchical,
  semicolon-joined path (`category;subcategory;…`, e.g.
  `Classic;Comedy;Public;Series`) into one `group-title`; only the first-level
  segment is a real category, so `Classic;Comedy`, `Classic;Series`, and
  `Classic;Music` all collapse to a single `Classic` category button. Clicking
  a category button filters the channel grid by `ch.cat`. There is no
  genre-filter input and no alphabetical re-ordering — the list is the source's
  categories as delivered.
- Active category button has `--acc` left border + text colour.
- Mobile: sidebar becomes horizontal strip (overflow-x: auto, no wrapping);
  brand and search input are hidden.

---

## 5. Content area

### 5a. Content-head bar

- Slim bar (40px) above the player.
- Left: "ON AIR" badge (red, visible only when a channel is playing) and the
  channel name (`#now-info`, set when a channel is selected, empty otherwise).
- Right: a single **contextual format chip** (§5f). It is **not** an
  always-present pair of "HLS"/"TS" pills; instead one chip is shown only when
  a channel is actively playing and an engine has resolved, reflecting the
  engine actually in use (hls.js vs mpegts.js — a `.ts` channel remuxed to HLS
  surfaces "HLS"), and it is **functional on click**. See §5f.
- Far right (pushed to the bar's right edge): the **account navigation
  button** (§13).

### 5f. Contextual format chip

The stream format is surfaced by a **single contextual chip** at the right of
the content-head bar (ADR-0025), replacing the previous always-present pair of
inert "HLS" and "TS" pills (which were rendered at all times and did nothing on
click).

- **Contextual presence.** The chip is **absent (not rendered / hidden) until a
  channel is actively playing** and an engine has resolved. When no channel is
  playing (idle, error, logged-out, or while connecting) the content-head shows
  **no** format chip — nothing inert sits there. When playback resolves an
  engine the chip appears "on top" at the right of the content-head, above the
  player region.
- **Label = resolved engine.** The chip's label is the engine **actually in
  use**: `"HLS"` for the hls.js / native-HLS path, `"TS"` for the mpegts.js
  path. Consistent with ADR-0010/ADR-0012, a `.ts` channel played through the
  server TS→HLS remux fallback shows `"HLS"` (the engine that is really
  running), not `"TS"`.
- **Functional click.** The chip is a real `<button>` (keyboard-focusable),
  not a static span. Clicking it is **not a no-op**: it toggles a small inline
  format detail next to/under the chip naming the active engine (e.g. "Playing
  via hls.js" / "Playing via mpegts.js") so the user learns what the resolved
  format means. Clicking again hides the detail. Toggling the detail is purely
  presentational — it does not change the state-machine phase or the running
  engine.
- **Styling.** The chip is a secondary control: 28px tall, `--r1` radius, mono
  label, reading ADR-0024 spacing/sizing tokens and ADR-0019 colour tokens; its
  active/accent treatment reuses the existing `--acc` chip styling. The
  toggled-detail affordance also reads the same token layer.

### 5b. Player card

- Aspect ratio 16:9, max-height 35vh (40vw on mobile).
- Background `--sur2`, border `--ln`, rounded corners.
- **Idle state** ("NO SIGNAL"): centred antenna SVG icon + "NO SIGNAL" text in
  `--dim`. Visible when no channel is selected.
- **Active state**: `<video>` element fills the card; hls.js attaches to it
  when a channel is selected.
- **Error overlay**: dim overlay + error message text centred in card.
- Volume and playback controls are handled by the native browser video element.

### 5c. Channel grid

- CSS grid with `auto-fill minmax(148px, 1fr)`, gap 12px.
- A toolbar (`.ch-bar`) above the grid shows the channel count and a **sort
  control** (§5d).
- Shows channels filtered by active category + search query, ordered by the
  active sort.
- Each **channel card** (see §6) is one grid cell.

### 5d. Channel sort control

- A labelled native `<select id="ch-sort">` in the `.ch-bar` toolbar lets the
  user order the channel grid (ADR-0017). Options come from `IptvSrch.SORTS`:

  | Token       | Label                | Order                                    |
  |-------------|----------------------|------------------------------------------|
  | `num-asc`   | "Number"             | channel number ascending (default)       |
  | `name-asc`  | "Name A→Z"           | name ascending, case-insensitive locale  |
  | `name-desc` | "Name Z→A"           | name descending                          |
  | `fav-first` | "Favourites first"   | favourites first, then number ascending  |

- The sort applies to whatever set is currently shown (after category filter +
  search) — it is the final ordering step inside `IptvSrch.getChs`.
- The chosen sort persists in localStorage (`iptv_sort`, §9) and is restored on
  reload; it is global, not per-account.

---

## 6. Channel card

- Background `--sur2`, border `--ln`, rounded corners (8px).
- **Number**: 3-digit zero-padded, top-left, IBM Plex Mono, `--dim`.
- **Logo**: square logo from `stream_icon` URL. On load error or empty URL,
  falls back to a coloured letter-tile (first letter of channel name, amber
  background).
- **Favourite star**: top-right toggle icon. Filled amber when channel is in
  favourites; outline when not. Click toggles and persists to localStorage.
- **Name**: channel name, bottom, Space Grotesk, 2-line truncation.
- Clicking the card selects the channel, starts HLS playback, and scrolls the
  page to the player.
- Active channel card has `--acc` border highlight.

---

## 7. Footer

### Logged-out state

Flex row: login-mode selector, Portal URL field (flex-grow 2), Username
field, Password field, Connect button (amber fill), hint text.

#### Login-mode selector (explicit user choice — no auto-detection)

The user **explicitly chooses** how to log in via a two-option mode
selector rendered inside the login form:

| Mode     | Label                  | Fields shown                  |
|----------|------------------------|-------------------------------|
| `xtream` | "Username & Password"  | URL + Username + Password     |
| `m3u`    | "Playlist URL only"    | URL only                      |

- Default mode on load: `xtream`.
- Selecting `m3u` hides the Username and Password fields (CSS class
  `is-m3u` on `#footer-login`); selecting `xtream` shows them again.
- The selector is keyboard-accessible and its active option is visually
  distinct.
- **The URL input never changes the mode.** Typing a `.m3u`/`.m3u8` URL in
  `xtream` mode does not hide the credential fields; typing a portal URL in
  `m3u` mode does not reveal them. Auto-detection of M3U URLs is removed.
- Hint text per mode:
  - `xtream`: `Type "demo" to try a sample playlist.`
  - `m3u`: `Paste an .m3u / .m3u8 playlist URL — no login needed.`

#### Connect behavior

- Portal URL: in `xtream` mode accepts any `http(s)://host` Xtream URL; in
  `m3u` mode accepts any `http(s)://` playlist URL. The literal string
  `"demo"` loads the built-in demo playlist in **either** mode.
- On Connect click: show loading state (button disabled, spinner), call
  `IptvApi.connect()` with the selected mode, transition to logged-in state
  on success or show inline error on failure.

### Logged-in state

Green status dot + "Connected to {host} as {user} · {N} channels ·
{M} categories" + Disconnect button (outline). Clicking Disconnect clears
session, removes stored credentials, resets state to INIT.

---

## 8. Connection engine (Xtream + M3U)

The design ships `client/api.js` as a self-contained IIFE that exposes
`window.IptvApi`. The server-side proxy in `server/rtr.js` forwards
`/api/xtream?url=<encoded>` requests to the target host, so browser CORS is
never an issue for portals or remote M3U files.

**Proxy stream delivery.** The same `/api/xtream` proxy also carries live
media: API JSON, M3U text, HLS manifests/segments, and continuous raw
MPEG-TS streams. Required proxy behavior:

- **Follows redirects** (301/302/303/307/308) up to 5 hops; each redirect
  target is re-validated against the same URL validation/blocklist before
  being followed; exceeding 5 hops returns 502.
- **Long-lived piping**: no response-size cap and no idle timeout that
  would cut a continuous TS stream; upstream bytes are piped to the client
  as they arrive.
- **Client-disconnect cleanup**: when the browser closes the response, the
  upstream request is aborted immediately.

`IptvApi.connect(src, opts)` — `opts: { user, pass, m3u }` — returns a
Promise resolving to a Result (`{ ok, val }` / `{ ok, err }`, RULE-FN-4)
whose `val` is:
```
{ server, host, user, categories: Cat[], channels: Ch[] }
```

**Routing is explicit, never inferred from the URL:**

1. `src === "demo"` (case-insensitive) → demo playlist, in either mode.
2. `opts.m3u === true` → M3U path: fetch `src` through the proxy, parse
   `#EXTM3U` text into channels. The M3U path returns `categories` derived from
   the **first-level segment** of each channel's `group-title` — the text
   before the first `;`, trimmed and deduped in first-seen order (ADR-0020);
   `Classic;Comedy`, `Classic;Series`, `Classic;Music` collapse to one
   `Classic`. Each parsed channel's `grp` and `cat` are that first-level
   segment (fallback `"Other"` when `group-title` is absent/empty), so the grid
   filter `ch.cat === id` matches the sidebar button.
3. otherwise → Xtream path: `player_api.php` categories + live streams.

**Xtream normalization.** The Xtream path must return the same normalized
`Ch` objects as the M3U and demo paths — `{ id, name, grp, url, img, cat,
num }` — never raw portal objects. Mapping from `get_live_streams` entries:

| Ch field | Source                                                        |
|----------|---------------------------------------------------------------|
| `id`     | `stream_id`                                                   |
| `name`   | `name`                                                        |
| `grp`    | category name resolved from `category_id` via `get_live_categories` (`{category_id, category_name}`); unknown id → `"Uncategorized"` |
| `url`    | `<portal-base>/live/<user>/<pass>/<stream_id>.<ext>` where `<ext>` is the first entry of `user_info.allowed_output_formats` (fallback `"ts"`) |
| `img`    | `stream_icon` (may be empty)                                  |
| `cat`    | `category_id`                                                 |
| `num`    | `num`                                                         |

The Xtream path therefore also calls
`player_api.php?username=…&password=…` (no action) to read
`user_info.allowed_output_formats` and verify `auth`; auth failure is a
`{ ok: false, err }` Result with a human-readable message.

There is **no URL-shape heuristic**: a `.m3u8` URL with `m3u: false` is
treated as an Xtream portal, and a credential-less plain URL with
`m3u: true` is treated as a playlist. The caller (footer mode selector,
stored-session reconnect, or a test) always states the mode.

**Demo mode**: when `src === "demo"` (case-insensitive), `IptvApi.connect()`
returns a synthetic playlist of 7 categories / 34 channels routed to two
public HLS test streams after a 700ms simulated delay. Each demo channel's
`cat` is the category **id** (the slug of its group name) so it matches the
demo category's `id`, keeping the id-based grid filter consistent with the
Xtream/M3U normalization (ADR-0009); `grp` stays the human-readable name.

---

## 9. Persistence (localStorage)

| Key                 | Type   | Contents                                              |
|---------------------|--------|-------------------------------------------------------|
| `iptv_accts`        | JSON   | `Acct[]` — all saved accounts (see §13)               |
| `iptv_act`          | string | `id` of the active account                            |
| `iptv_sel`          | string | last selected `stream_id`                             |
| `iptv_favs`         | JSON   | array of `stream_id` numbers (favourites)             |
| `iptv_sort`         | string | active channel sort token (§5d); one of the four known tokens, else default `num-asc` |

Multiple **accounts** are persisted (§13). On page load, if an active account
resolves, the app silently calls `IptvApi.connect()` with that account's
stored `{ url, user, pass }` **and its stored `m3u` mode flag** (replayed,
never re-detected). On success the session is restored (including
last-selected channel and favourites). If no accounts exist, the app starts at
INIT with the footer login.

An account is stored/updated only after a **successful** connect (footer login
or "add account"); a failed connect never writes to the accounts store.
Switching accounts replays the chosen account's stored connection. Removing
an account deletes it from `iptv_accts`; disconnecting clears the active
session but preserves the saved accounts, `iptv_sel`, and `iptv_favs`.

**Legacy migration** (one-time, read-time): a pre-account install has
`iptv_creds` = `{ url, user, pass, m3u? }` but no `iptv_accts`. On first load
it is wrapped into a single saved + active account (id minted, name derived,
`m3u` resolved by the legacy rule: `true` when both `user` and `pass` are
empty and `url` is not `"demo"`, else the stored flag); the new keys are
written and `iptv_creds` is removed. Migration applies to stored data only.

---

## 10. Video playback

1. When a channel card is clicked, `client/play.js` is called with the
   channel's normalized `url`.
2. **Engine selection by stream type** — decided from the URL path
   extension (query string ignored):
   - `.m3u8` → HLS engine (hls.js, native fallback as below);
   - anything else (notably `.ts`, the Xtream live format) → MPEG-TS
     engine (mpegts.js 1.7+ via CDN, loaded in `index.html` alongside
     hls.js).
3. **Proxied delivery**: both engines fetch via XHR, so stream URLs are
   always routed through the local proxy
   (`/api/xtream?url=<encoded>`) before being handed to the engine —
   third-party stream hosts never need CORS headers.
4. HLS engine: if hls.js is supported (`Hls.isSupported()`) the stream is
   loaded via `new Hls()`; else if the browser plays HLS natively (Safari),
   `video.src` is set directly; else error overlay "HLS not supported."
5. MPEG-TS engine: if `mpegts.getFeatureList().mseLivePlayback` is true,
   play via `mpegts.createPlayer({ type: 'mpegts', isLive: true, url })`.
   (`new` only for library built-ins, per CONVENTIONS.md §13 carve-out.)
6. **MSE-less fallback (server remux)**: if `window.mpegts` is missing or
   `mseLivePlayback` is false (iOS Safari — no usable MSE), the client does
   **not** error. It instead plays the stream through the server's live
   remux endpoint: `/api/hls?url=<encoded raw stream URL>` handed to the
   HLS engine path (hls.js where supported, else native HLS — the iOS
   case). Only when this fallback itself cannot play (no hls.js, no native
   HLS) does the error overlay "MPEG-TS not supported" appear.
7. On fatal engine errors (hls.js `ERROR` type FATAL, mpegts.js
   `ERROR` event), show the error overlay.
8. Switching channels fully destroys the previous engine instance
   (whichever type) before attaching the new one — no orphaned XHRs.
9. The contextual format chip reflects the engine actually in use (§5f):
   a `.ts` channel played through the remux fallback shows **HLS**. The chip
   is shown only while a channel is playing and is removed when playback stops.

### Server-side TS→HLS remux endpoint

`server/hls.js` (mounted from `server/rtr.js`) converts a raw MPEG-TS
stream to live HLS on demand using ffmpeg **stream copy** (`-c copy`,
remux not transcode); the binary comes from the `ffmpeg-static` npm
package — no system install.

- `GET /api/hls?url=<encoded>` — `url` is validated against the same
  validation/blocklist as `/api/xtream`; invalid → 400. A valid request
  starts (or reuses) a remux session keyed by source URL and responds with
  the live `.m3u8` playlist once produced; ffmpeg failure or startup
  timeout → 502.
- `GET /api/hls/<session>/<segment>.ts` — serves session segments; unknown
  session/segment or path traversal → 404/rejection.
- One ffmpeg process per source URL (concurrent requests share a session).
  Short segments, small sliding window, `+delete_segments` keep the
  per-session temp dir bounded. Sessions idle beyond a reap window are
  destroyed: ffmpeg killed, temp dir removed.

---

## 11. State machine phases (client)

Phases are defined in `client/st.js` per CONVENTIONS.md §6:

| Phase  | Meaning                                    |
|--------|--------------------------------------------|
| INIT   | App loaded, no session                     |
| LOAD   | Connecting to portal / loading playlist    |
| READY  | Session active, channel grid shown         |
| PLAY   | Channel selected and streaming             |
| SRCH   | Active search query filtering grid         |
| ERR    | Fatal error; user must retry               |

Valid transitions: INIT→LOAD, LOAD→READY, LOAD→ERR, READY→PLAY, READY→SRCH,
READY→ERR, PLAY→READY, PLAY→ERR, SRCH→READY, ERR→INIT.

---

## 12. Accessibility and UX

- All interactive elements are keyboard-focusable.
- Channel cards use `role="button"` and `tabindex="0"`.
- Favourite star uses `aria-label="Add to favourites"` / `"Remove from favourites"`.
- Error messages are surfaced as visible text (not console-only).
- Loading spinner in the Connect button while connecting.
- On mobile, the channel grid min-width adapts so cards remain tappable.
- The account nav button exposes `aria-haspopup="dialog"`,
  `aria-expanded`, and `aria-controls`; the account panel is
  `role="dialog"` with an accessible label and is closable by its close
  button, the backdrop scrim, and the Escape key (§13).

---

## 13. Accounts

The app remembers **multiple connection identities** (accounts) and lets the
user see which one is connected, switch between saved accounts, and add a new
one. An account is the connection identity from §7–§8 plus a stable id and a
display name.

### 13a. Account record

```
/** @typedef {{ id, name, url, user, pass, m3u }} Acct */
```

| Field  | Meaning                                                            |
|--------|--------------------------------------------------------------------|
| `id`   | stable unique string (e.g. `String(Date.now())`); switch/remove key |
| `name` | display label, derived at save time from the connection — Xtream `host · user`, or playlist `host`, or `"Demo"` for the demo playlist; never blank |
| `url`  | portal/playlist URL (or the literal `demo`)                        |
| `user` | username (empty in M3U / demo)                                     |
| `pass` | password (empty in M3U / demo)                                     |
| `m3u`  | login mode flag (§7) — preserved per account, replayed on reconnect |

Saved accounts and the active-account id persist in localStorage (§9).
Re-saving an existing identity (same `url` + `user` + `m3u`) updates that
account in place rather than creating a duplicate.

### 13b. Account navigation button (top-right)

- Lives at the right edge of the content-head bar (§5a).
- Shows an account glyph + the **active account's name** when connected, or a
  generic "Account" label when no account is active. The name is truncated to
  fit.
- Keyboard-focusable; `aria-haspopup="dialog"`, `aria-controls="acct-panel"`,
  `aria-expanded` mirroring the panel's open state.
- Clicking it toggles the account panel.

### 13c. Account panel (right slide-in)

- A right-edge, full-height panel (~320px wide; full-width on mobile
  `< 760px`) that is **off-screen by default** and slides in from the right
  when opened. A dimmed backdrop scrim sits behind it.
- Opening/closing is purely presentational (an `is-open` CSS class — no state
  machine phase). It is closed by: the panel's close button, a click on the
  scrim, or the Escape key.
- `role="dialog"`, accessible label "Accounts", `aria-hidden` toggled with
  open state.

Panel contents, top to bottom:

1. **Header** — "Accounts" title + close button.
2. **Connected account** — when an account is active: its **name** and its
   **server URL** (the account `url`; `demo` for the demo playlist) plus a
   green "Connected" status dot. When none is active: a "Not connected" line.
3. **Account list** — one row per saved account showing name + server URL.
   The active account is visually marked. Clicking a **non-active** row
   switches to that account (reconnects with its stored connection, replaying
   its `m3u` mode). Each row has a remove control that deletes that saved
   account; removing the active account also clears the active session.
4. **Add account** — a button that closes the panel, resets the footer to the
   logged-out login form, and focuses the URL field. Completing the footer
   connect (§7) for a new identity saves it as a new active account.

### 13d. Switching, adding, removing

- **Switch**: clicking a saved account replays its stored connection through
  `IptvApi.connect()` exactly like load-time reconnect; on success it becomes
  the active account and the grid/sidebar/footer/panel re-render. A switch
  while a channel is playing first tears the current stream down.
- **Add**: handled by the existing footer login flow (§7). A successful
  connect of a not-yet-saved identity appends a new account (§13a) and makes
  it active.
- **Remove**: deletes the account from the store. Removing the currently
  connected account also disconnects (clears the session, returns to the
  footer login); removing a non-active account leaves the session untouched.
- A failed connect (switch or add) never mutates the saved-accounts store and
  surfaces the existing inline connect error (§7).

### 13e. Community playlists (presets)

The app ships a small, curated **default account list provided by the
community**: public IPTV playlists from the [iptv-org](https://github.com/iptv-org/iptv)
project. The user can connect to any of them with **one click — no URL typing**.

- The list is a static, frozen catalog (no runtime fetch). It is **always
  present** in the account panel, even when the user has saved zero accounts of
  their own — it is the "default" account list the user can pick from.
- Entries are all standard M3U playlists served from
  `https://iptv-org.github.io/iptv/`. The curated set is deliberately small (a
  handful — the iptv-org index plus a few popular themed lists) so it does not
  become a maintenance or flakiness burden:

  | Name               | Playlist URL                                            |
  |--------------------|---------------------------------------------------------|
  | iptv-org · All     | `https://iptv-org.github.io/iptv/index.m3u`             |
  | iptv-org · English | `https://iptv-org.github.io/iptv/languages/eng.m3u`     |
  | iptv-org · News    | `https://iptv-org.github.io/iptv/categories/news.m3u`   |
  | iptv-org · Sports  | `https://iptv-org.github.io/iptv/categories/sports.m3u` |
  | iptv-org · Music   | `https://iptv-org.github.io/iptv/categories/music.m3u`  |

- The community list renders as its own **section** in the account panel,
  below the saved-accounts list (§13c) and above "Add account". Each row shows
  the preset name and its playlist URL and is a one-click **connect shortcut**.
  Community rows have **no remove control** — the catalog is static.
- **Selecting a preset** connects on the M3U path (the explicit `m3u` login
  mode, §7 — never auto-detected) exactly like a saved-account switch (§13d):
  any live session is torn down first, then `IptvApi.connect()` runs with the
  preset URL and `m3u: true`.
  - On **success** the preset becomes an ordinary saved + active account (§13a)
    — appended to `iptv_accts` (deduped by `url + user + m3u`, so re-selecting a
    preset never duplicates it) and made active — and it then also appears in
    the saved-accounts list and can be switched to or removed thereafter. The
    panel/grid/sidebar/footer re-render.
  - On **failure** nothing is written to the store (§13d invariant) and the
    existing inline connect error shows (§7).
- When a preset's playlist is the currently active account's connection, its
  community-section row is **visually marked** so the user sees which community
  playlist is connected. Clicking the already-active preset is a no-op.
