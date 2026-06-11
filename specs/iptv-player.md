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

---

## 3. Header bar

- Fixed 56px height, background `--sur`, bottom border `--ln`.
- Left: red live dot + "LIVE" label.
- Center: optional (empty on first load).
- Right: reserved for future controls.

---

## 4. Sidebar

- 240px wide, full height, background `--sur`, right border `--ln`.
- **Brand row**: amber dot + "IPTV" label in Space Grotesk bold.
- **Search input**: icon + placeholder "Search channels…". Filters channel
  grid in real time using the `srch` module.
- **Category list**: scrollable list of buttons, one per category returned by
  the Xtream API plus a fixed "All Channels" entry and a "Favourites" entry.
  Each button shows the category name and a channel-count badge.
- Active category button has `--acc` left border + text colour.
- Mobile: sidebar becomes horizontal strip (overflow-x: auto, no wrapping);
  brand and search input are hidden.

---

## 5. Content area

### 5a. Content-head bar

- Slim bar (40px) above the player.
- Left: "ON AIR" badge (red, visible only when a channel is playing), channel
  name, category chip.
- Right: format chips — "HLS" (active by default) and "TS" (disabled; planned
  mpegts.js integration). Clicking HLS/TS chip reloads the player with the
  appropriate stream URL.

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
- Shows channels filtered by active category + search query.
- Each **channel card** (see §6) is one grid cell.

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

`IptvApi.connect(src, opts)` — `opts: { user, pass, m3u }` — returns a
Promise resolving to a Result (`{ ok, val }` / `{ ok, err }`, RULE-FN-4)
whose `val` is:
```
{ server, host, user, categories: Cat[], channels: Ch[] }
```

**Routing is explicit, never inferred from the URL:**

1. `src === "demo"` (case-insensitive) → demo playlist, in either mode.
2. `opts.m3u === true` → M3U path: fetch `src` through the proxy, parse
   `#EXTM3U` text into categories + channels.
3. otherwise → Xtream path: `player_api.php` categories + live streams.

There is **no URL-shape heuristic**: a `.m3u8` URL with `m3u: false` is
treated as an Xtream portal, and a credential-less plain URL with
`m3u: true` is treated as a playlist. The caller (footer mode selector,
stored-session reconnect, or a test) always states the mode.

**Demo mode**: when `src === "demo"` (case-insensitive), `IptvApi.connect()`
returns a synthetic playlist of 7 categories / 34 channels routed to two
public HLS test streams after a 700ms simulated delay.

---

## 9. Persistence (localStorage)

| Key                 | Type   | Contents                                              |
|---------------------|--------|-------------------------------------------------------|
| `iptv_creds`        | JSON   | `{ url, user, pass, m3u }` — auto-reconnect on load   |
| `iptv_sel`          | string | last selected `stream_id`                             |
| `iptv_favs`         | JSON   | array of `stream_id` numbers (favourites)             |

On page load, if `iptv_creds` is present, the app silently calls
`IptvApi.connect()` with stored credentials **and the stored `m3u` mode
flag**. On success the session is restored (including last-selected channel
and favourites).

Legacy migration: a stored `iptv_creds` value written before the mode flag
existed has no `m3u` property. It is interpreted once, deterministically:
`m3u` is `true` when both `user` and `pass` are empty and `url` is not
`"demo"`, else `false`. This is a read-time migration of stored data only —
never applied to live form input.

Credentials are stored only after a successful connect; a failed connect
never writes to localStorage. Disconnect removes `iptv_creds` but preserves
`iptv_sel` and `iptv_favs`.

---

## 10. Video playback

1. When a channel card is clicked, `client/play.js` is called with the
   channel's `streamUrl`.
2. If hls.js is supported (`Hls.isSupported()`) the stream is loaded via
   `new Hls()` — this is the CDN-loaded library; `play.js` does not use
   `new` for application objects, only for the hls.js built-in.
3. If hls.js is not supported but the browser can play HLS natively (Safari),
   `video.src` is set directly.
4. If neither is available, show the error overlay with "HLS not supported."
5. On hls.js `ERROR` events of type `FATAL`, show the error overlay.
6. The TS format chip is rendered but disabled (placeholder for future
   mpegts.js integration).

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
