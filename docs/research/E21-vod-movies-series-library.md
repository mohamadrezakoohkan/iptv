# Research — E21: Add catch-up (archive/timeshift) playback on top of the EPG (Replay affordance on past archive-capable schedule rows, Xtream timeshift URL through the existing proxy + dual-engine player).

## Method
Sources surveyed — competitor IPTV/streaming players and user-demand signals for the browser IPTV-player domain ("IPTV Broadcast Console" / teeatr: vanilla-JS Xtream + M3U player with category browse, search, favourites, sort, dual-engine playback, accounts, community playlists, theme, failure log, EPG now/next + schedule, reminders, and catch-up Replay):

- TiViMate feature list — multi-playlist, EPG, catch-up TV, recording, parental controls, multi-view, advanced search, and auto-resume of the most recently watched channel ("continue watching"). https://tivimate.co.com/app/features/
- OTT Navigator feature list — picture-in-picture, multi-view, program recording, EPG, quick search, timeshift/catch-up. https://iptvservice.pro/ott-navigator-vs-tivimate-comparing-top-iptv-players/
- IPTV Smarters feature list — multi-screen (up to 4 channels at once, "perfect for sports fans"), subtitle (SRT/ASS) + audio-track selection, parental control, catch-up, recording, PiP, VOD Movies & TV Shows. https://iptvsmartersofficial.com/iptvsmarterspro-features/
- Best-IPTV-players roundups — OTT Navigator "best browsing interface for VOD (movies and series)"; AmunTV "150,000+ movies and series on demand"; IBO Player emphasizes neatly arranged movies/TV/series with subcategories — confirming a VOD Movies & Series library is a baseline expectation. https://www.guru99.com/best-iptv-streaming-apps.html
- Xtream Codes API reference — one login exposes get_vod_categories / get_vod_streams / get_series (with posters, descriptions, season/episode lists) alongside the get_live_* endpoints this product already consumes; players "auto-build Live + VOD + Series + EPG from one connection." https://www.iptv-one.app/en/blog/what-is-xtream-codes
- Reddit/forum demand summary (2026 IPTV roundups) — users prioritize a comprehensive on-demand movies & TV-series library, neatly organized, alongside reliability and HD/4K. https://differ.blog/p/iptv-reddit-guide-2026-best-iptv-options-for-amazon-devices-cee69d

## Candidates

### 1. VOD library — Movies & Series browser (Xtream get_vod_streams / get_series)
Add an on-demand content surface alongside live channels: on the Xtream path, fetch VOD movie categories/streams (get_vod_categories / get_vod_streams) and TV series (get_series → seasons → episodes) through the existing CORS proxy, normalize each into the canonical schema (mirroring mkXtCh), and present them in the existing sidebar/category + grid browse UX with a toggle between Live and VOD/Series. Selecting a movie or an episode builds the Xtream movie/series stream URL (/movie/<u>/<p>/<id>.<ext> or /series/...) and plays it through the same dual-engine player and select+play path a live channel uses — no new engine, no new server route. M3U/demo degrade silently (synthesize a demo VOD entry for offline demonstrability), exactly as catch-up does.
- Demand: 5/5 — VOD Movies & Series is a baseline expectation across every surveyed competitor (IPTV Smarters, OTT Navigator "best for VOD", AmunTV "150k movies/series"); Reddit roundups explicitly list "extensive on-demand movies and TV series libraries, neatly organized."
- Fit: 5/5 — the product already proxies and normalizes Xtream get_live_* into the canonical Ch schema and plays through the dual-engine path; get_vod_streams/get_series are sibling endpoints on the same one-login API, reusing the proxy, the schema-normalization pattern, the grid/category UI, and the select+play path. It is the single largest content gap versus competitors.
- Differentiation: 4/5 — a polished browser-native VOD+Series browser with posters/seasons differentiates teeatr from a live-only player; competitors have it, so it is table-stakes rather than novel, but it closes the biggest competitive gap.
- **Total: 14/15**

### 2. Multi-view — watch up to 4 channels at once in a grid
Add a multi-view mode that tiles 2–4 live channels in a grid so the user can watch several at once (the classic sports use-case), each tile fed by the existing dual-engine player path through the existing proxy, with one tile designated the active-audio tile.
- Demand: 4/5 — multi-view/multi-screen is shipped by TiViMate (Premium), OTT Navigator, and IPTV Smarters ("up to 4 channels … perfect for sports fans"), a frequently-cited premium draw.
- Fit: 2/5 — the product's whole architecture is a single dual-engine player surface with one PLAY phase and a flat state machine (CONVENTIONS §6); running 2–4 concurrent hls.js/mpegts.js engines + concurrent proxy streams is a substantial departure from the established "no new playback engine / no new phase" posture every recent evolution (E15/E17/E19/E20/E21) deliberately preserved, and would strain a browser. Lower fit than the others.
- Differentiation: 5/5 — a browser-native multi-view is genuinely distinctive among lightweight web players and a marquee feature.
- **Total: 11/15**

### 3. Recently-watched / Continue-watching list
Record each successfully-played channel (and, once VOD lands, each movie/episode) into a localStorage-persisted "recently watched" list — newest-first, capped, deduped — surfaced as a pinned pseudo-category (like Favourites) or a panel, with one click to resume. Mirrors the favourites/reminders store pattern exactly; degrades silently when storage is unavailable.
- Demand: 4/5 — auto-resume of the last-watched channel is a named TiViMate feature and "continue watching" is a ubiquitous streaming convenience users expect; surveyed players resume the most recently watched channel on reopen.
- Fit: 5/5 — purely additive client store + render affordance + a single capture point on the successful-play path, mirroring the favourites store (ADR-0003), the failure-log store (ADR-0027), and the reminders store (ADR-0032/E20): a new localStorage key, a pinned pseudo-category in the existing sidebar/grid, no new playback engine, no new state-machine phase, no new server route — the lowest-risk possible fit, identical in shape to the last three shipped evolutions.
- Differentiation: 3/5 — a convenience feature competitors already have; valuable polish but not a standout.
- **Total: 12/15**

## Winner — VOD library — Movies & Series browser (Total 14/15)
VOD Movies & Series wins on the highest total (14/15): it is the most-demanded feature across every competitor surveyed and in Reddit/forum signals, it is the single largest content gap between teeatr and full-featured players, and it fits the product's existing architecture cleanly — the Xtream get_vod_streams / get_series endpoints sit on the same one-login API the product already proxies and normalizes, and on-demand playback reuses the existing dual-engine player and select+play path with no new engine, no new state-machine phase, and no new server route, exactly the additive posture E19/E20/E21 followed.

## Sources
- https://tivimate.co.com/app/features/ — TiViMate ships catch-up, recording, parental controls, multi-view, and auto-resume of the most recently watched channel.
- https://iptvservice.pro/ott-navigator-vs-tivimate-comparing-top-iptv-players/ — OTT Navigator offers picture-in-picture, multi-view, recording, EPG, and timeshift/catch-up; best browsing interface for VOD.
- https://iptvsmartersofficial.com/iptvsmarterspro-features/ — IPTV Smarters: multi-screen up to 4 channels (sports), subtitle/audio-track selection, parental control, catch-up, recording, PiP, and VOD Movies & TV Shows.
- https://www.guru99.com/best-iptv-streaming-apps.html — Roundup: OTT Navigator best for VOD movies/series; AmunTV 150k+ movies and series; IBO Player neatly arranged movies/TV/series.
- https://www.iptv-one.app/en/blog/what-is-xtream-codes — Xtream Codes one login exposes get_vod_categories/get_vod_streams/get_series alongside get_live_*, auto-building Live + VOD + Series + EPG.
- https://differ.blog/p/iptv-reddit-guide-2026-best-iptv-options-for-amazon-devices-cee69d — Reddit IPTV demand: users prioritize extensive, neatly-organized on-demand movies and TV-series libraries.
