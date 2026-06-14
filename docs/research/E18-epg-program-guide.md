# Research — E18: Keep a Memory.md of the product project in the docs folder and use it as memory that Claude references.

> RESEARCH phase (non-blocking) for the run that ships the `docs/MEMORY.md` product-memory feature. Below are the three scored candidate **product** features proposed for the *next* build, surveyed against the competitive IPTV/streaming-player landscape and user-demand signals. Winner is handed to backlog-agent.

## Method

Product grounded from `docs/specs/project.md`, `docs/specs/iptv-player.md`, `README.md`, `CHANGELOG.md` (#1–#17), and `BACKLOG.md`. The product (codename *teeatr* / IPTV Broadcast Console) is a vanilla-JS, browser-based live-IPTV player supporting Xtream portals and M3U playlists, with category browse, search, favourites, sort, dual-engine playback (hls.js + mpegts.js, server-side TS→HLS remux for MSE-less browsers), multiple saved accounts, community playlists, light/dark theme, contextual format chip, guided empty/no-signal states, and a session playback-failure log.

Sources surveyed (competitors + demand signals):
- TiviMate / IPTV Smarters Pro / GSE / XCIPTV feature comparisons (Smarter8k, Hungary IPTV, tvimate4k, iptvbyte) — EPG is the headline differentiator; catch-up, multi-view/PiP, recording, reminders follow.
- Best-EPG-for-IPTV guides (Alibaba electronics guide, TROYPOINT) — EPG named the single most-demanded, habit-forming feature; "a stable EPG turns IPTV from a utility into a habit."
- App-store listings & reviews (Apple App Store: OPUS Smart IPTV Player, One IPTV Player, Smart TV Club, iPTV Player+) — "Continue Watching", "Recently Played", "Last Watched Live TV", "remembers which episode to watch next" recur as standard, reviewed-positively features.
- Browser/web-IPTV-player surveys (PositionIsEverything, GeekChamp, IPTV Owl, Chrome Web Store: Fast IPTV Player, VideoPlayer MPD/M3U8/IPTV/EPG, M3U IPTV) — web players increasingly fetch XMLTV EPG; M3U `tvg-id` + XMLTV URL is the standard web EPG wiring.
- HTML5 video-player feature write-ups (OpenReplay PiP guide, Video.js, bocaletto-luca/IPTV-Web-Player) — fullscreen, Picture-in-Picture, and F/P/Space keyboard shortcuts are expected baseline controls for browser video.

## Candidates

### 1. EPG / now-and-next program guide (XMLTV + Xtream)
Add an Electronic Program Guide so each channel shows what is on **now** and **next**, with a per-channel schedule view. Data sources fit the existing two login paths: Xtream portals already expose `get_simple_data_table` / short-EPG endpoints (proxiable through the existing CORS proxy), and M3U entries carry `tvg-id` that maps into an XMLTV guide URL. Surface it minimally first — a now/next line on the channel card and an expandable schedule panel — reusing the canonical `Ch` schema, the sidebar/grid layout, and the state-machine + localStorage conventions. No new playback engine; purely an added data + render surface.
- Demand: 5/5 — EPG is named the #1 most-requested feature in every competitor comparison surveyed and the defining feature of TiviMate/Smarters; "a stable EPG turns IPTV from a utility into a habit" (Alibaba EPG guide, Smarter8k, Hungary IPTV).
- Fit: 4/5 — both supported sources expose EPG (Xtream short-EPG endpoint via the existing proxy; M3U `tvg-id`→XMLTV), and it extends the existing channel-grid/sidebar/canonical-schema model; the new external fetch + parse surface is the only architectural addition, and the proxy already handles cross-origin fetches.
- Differentiation: 4/5 — most lightweight web/M3U players ship no real now/next guide; a working EPG would clearly set teeatr apart from the simple browser players it competes with.
- **Total: 13/15**

### 2. Recently-watched / continue-watching channel list
Keep a short, persisted list of recently-played channels and surface it as a pinned "Recent" entry in the sidebar (alongside the existing pinned "Favourites"), so users can jump straight back to what they were watching. The app already persists the last-selected channel and favourites in localStorage and already has the pinned-virtual-category pattern; this generalizes that to an ordered, capped recent list per the existing flat-state + persistence conventions.
- Demand: 4/5 — "Continue Watching", "Recently Played", "Last Watched Live TV" recur across modern players and app-store listings/reviews (OPUS, One IPTV Player, Smart TV Club); standard and well-reviewed, though more table-stakes than loudly-demanded.
- Fit: 5/5 — near-perfect extension of shipped patterns (last-selected-channel persistence, the pinned "Favourites" virtual category, localStorage store, capped in-memory lists like the 50-cap failure log); lowest architectural risk of the three.
- Differentiation: 3/5 — common across players, so the competitive edge is modest.
- **Total: 12/15**

### 3. Fullscreen + Picture-in-Picture + keyboard player controls
Add native fullscreen, Picture-in-Picture (floating always-on-top window), and keyboard shortcuts (F fullscreen, P PiP, Space play/pause, M mute) to the existing dual-engine player, layered presentationally over the current `<video>` element without touching engine selection or the state machine.
- Demand: 4/5 — fullscreen and PiP, plus F/P/Space shortcuts, are repeatedly cited as expected baseline controls for browser/HTML5 IPTV players (OpenReplay PiP guide, bocaletto-luca/IPTV-Web-Player, web-player surveys).
- Fit: 4/5 — purely presentational over the existing `<video>` element using native browser APIs (Fullscreen API, `requestPictureInPicture`); no backend or engine change, consistent with the playing/idle/error player states already in place.
- Differentiation: 3/5 — table-stakes for video players; raises parity rather than creating a standout edge.
- **Total: 11/15**

## Winner — EPG / now-and-next program guide (Total 13/15)
EPG wins decisively on the strongest demand signal in the entire survey — it is the single most-requested IPTV-player feature and the headline differentiator of the market leaders — while still fitting teeatr's architecture: both of its supported source paths (Xtream short-EPG and M3U `tvg-id`→XMLTV) expose schedule data the existing CORS proxy can fetch, and it extends the canonical `Ch` schema and sidebar/grid surfaces rather than introducing a new playback path. It is not shipped (E1–E17) and not parked in `BACKLOG.md`.

## Sources
- https://electronics.alibaba.com/buyingguides/best-epg-for-iptv-practical-guide-2026 — EPG named the most-demanded, habit-forming IPTV feature.
- https://smarter8k.app/blog/best-iptv-players — EPG is the headline differentiator across TiviMate/Smarters/XCIPTV; multi-view/PiP and recording are premium add-ons.
- https://hungaryiptv.net/en/blog/best-iptv-player — TiviMate's industry-leading multi-day grid EPG with now/next and reminders vs Smarters' lighter 7-day EPG.
- https://tvimate4k.com/tivimate-vs-iptv-smarters-pro-comparison/ — confirms EPG, recording (USB/DVR), multi-view, and PiP as the top feature axes.
- https://www.positioniseverything.net/10-best-online-iptv-players-web-browser-iptv/ — web IPTV players decode M3U + XMLTV guides to show what's airing now/next.
- https://chromewebstore.google.com/detail/fast-iptv-player-hlsm3u8e/dbdgibnjfnomhihldbjcdbgddamjmboi — browser HLS/M3U8 player advertising M3U + EPG support as a core feature.
- https://apps.apple.com/us/app/iptv-m3u-xtream-player-opus/id1592313576 — OPUS player reviewed for remembering watch progress / continue-watching.
- https://apps.apple.com/gd/app/iptv-player/id6738142386 — listing featuring Last Watched Live TV / Continue Watching / Recently Added home rows.
- https://blog.openreplay.com/picture-in-picture-video-with-html5-and-javascript/ — HTML5 PiP API for floating always-on-top video, a sought-after web-player control.
- https://github.com/bocaletto-luca/IPTV-Web-Player — open-source web IPTV player documenting fullscreen + F/P/Space keyboard controls as expected baseline.
