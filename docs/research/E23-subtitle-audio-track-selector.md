# Research — E23: In-player controls layer (fullscreen + PiP + keyboard shortcuts + persisted volume) over the dual-engine <video>

## Method
Sources surveyed (competitor IPTV/streaming players + user-demand signals):
- Competitor feature comparisons (TiviMate, IPTV Smarters Pro, XCIPTV, GSE) — recording, catch-up, multi-view, EPG, continue-watching, parental PIN.
- App Store listings (homeTV, IPTV Smart Player Pro, Simple IPTV, iStreamX) — "last watched / continue watching / recently added" home rows are now common.
- hls.js API docs + issues — native WebVTT subtitle + multiple-audio-track support already available in the engine this product uses.
- Forum / knowledge-base threads — parental-PIN guides across most players; "clear recently watched" thread (IPTVTalk) confirms recently-watched is a real, used surface.

## Candidates

### 1. In-player subtitle & multi-audio-track selector
Add a client-only subtitles/CC menu and an audio-track menu to the in-player controls layer shipped in E23, alongside the Fullscreen/PiP buttons and format chip. On the hls.js path, enumerate the tracks the engine already exposes (SUBTITLE_TRACKS_UPDATED / subtitleTracks + audioTracks/audioTrack) and let the user pick a subtitle track (incl. Off) and switch the audio rendition (e.g. language / descriptive audio); on the native-HLS (Safari) path drive video.textTracks / video.audioTracks equivalently. Feature-detected and hidden when a stream carries no alternate tracks (so live single-track channels show nothing), degrading silently — no new server route, no new engine, no new state phase. Applies uniformly to live, catch-up, and VOD since they share one <video>.
- Demand: 4/5 — hls.js exposes alternate audio + WebVTT/CEA-608/708 subtitles as a first-class, frequently-requested capability (hls.js API + issue #5532 "API enhancements for audio (and subtitle) track selection"); multi-language audio/subtitles is a recurring expectation in "complete HLS player" guidance.
- Fit: 5/5 — sits directly on the existing hls.js engine and the just-shipped E23 in-player controls chrome (#fs-btn/#pip-btn + format chip), client-only, no new route/engine/phase; fits the product's "thin layer over the shared <video>" identity exactly.
- Differentiation: 4/5 — a clean in-player track selector is uncommon in browser/vanilla-JS IPTV players (most lean on the native <video> UI); it leverages a capability the product's engine already has but does not surface.
- **Total: 13/15**

### 2. Continue-watching (resume position) for VOD movies & episodes
Persist per-item playback position for the E22 VOD library so reopening a movie or series episode offers Resume (and a small progress indicator on the poster), mirroring IPTV Smarters Pro's "continue watching" + Resume. Client-only localStorage store keyed by VOD item id (mirroring favourites/iptv_vol), written on pause/timeupdate-throttle/stop, applied as a currentTime seek on the existing select+play path; Xtream VOD only, M3U/demo degrade silently. No new server route, engine, or state phase.
- Demand: 4/5 — IPTV Smarters Pro ships "continue watching" + Resume for VOD and tracks movie/series progress; App-Store players (Simple IPTV) feature "Continue Watching Movies & Series" home rows — a widely expected VOD behavior.
- Fit: 4/5 — builds naturally on the E22 VOD library and the existing localStorage chrome-persistence pattern; client-only and additive, but scoped to the VOD path rather than the whole product.
- Differentiation: 3/5 — strong table-stakes, but competitors already ship it, so it matches rather than sets the product apart.
- **Total: 11/15**

### 3. Recently-watched channels quick-access list
Add a session-and-reload-persisted Recently watched pseudo-category (pinned in the sidebar next to "Favourites"/"All Channels") that surfaces the last N channels/VOD items the user actually played, newest first, for one-tap return — the "last watched / recently watched" home surface modern IPTV apps now ship. Client-only localStorage ring buffer recorded on each successful select+play, rendered through the existing rndSide/rndGrid; degrades to empty silently and never logs failures.
- Demand: 3/5 — "Last Watched / Recently Added / recently watched" surfaces appear across current App-Store players (homeTV, IPTV Smart Player Pro, Simple IPTV, iStreamX) and a live IPTVTalk "recently watched" thread, but it is a convenience feature, not a headline ask.
- Fit: 4/5 — reuses the existing pinned-category sidebar + grid + select+play path and the localStorage pattern; purely additive, client-only.
- Differentiation: 2/5 — overlaps with the existing favourites + last-selected-channel persistence and is common across competitors; modest distinctiveness.
- **Total: 9/15**

## Winner — In-player subtitle & multi-audio-track selector (Total 13/15)
It wins on the highest total and is the strongest fit: it extends the exact in-player controls layer just shipped in E23, lives entirely on the hls.js/native-HLS engines the product already runs, and surfaces a capability (alternate audio + WebVTT/CEA subtitles) those engines expose but the UI does not. It is client-only (no new server route, engine, or state-machine phase), degrades silently when a stream has no alternate tracks, and applies uniformly to live, catch-up, and VOD via the single shared <video> — directly continuing the product's additive-layer identity while differentiating it from browser IPTV players that rely on the bare native <video> UI.

## Sources
- https://github.com/video-dev/hls.js/blob/master/docs/API.md — hls.js exposes alternate audio tracks (audioTracks/audioTrack) and WebVTT/CEA-608/708 subtitle tracks switchable by index.
- https://github.com/video-dev/hls.js/issues/5532 — open request: "API enhancements for audio (and subtitle) track selection," confirming demand for first-class track switching.
- https://m3u8-player.net/blog/hls-player-advanced-features-guide/ — a "complete HLS player" is expected to support multi-language subtitles/audio-track switching plus enhanced controls.
- https://www.wedostreaming.com/iptv-smarters-pro/ — IPTV Smarters Pro ships a "continue watching" entry + Resume button for unfinished VOD; tracks movie/series progress.
- https://apps.apple.com/th/app/simple-iptv-live-player/id6740256381 — Simple IPTV's home screen surfaces "Last Watched Live TV, Continue Watching Movies & Series, Recently Added."
- https://apps.apple.com/app/hometv-iptv-player/id1636701357 — homeTV advertises quick access to recently watched content + favourites for fast return.
- https://iptvtalk.net/threads/clear-recently-watched.46181/ — user thread about managing a "recently watched" list, confirming it is a real, used surface.
- https://apps.tousecurity.com/xciptv-vs-iptv-smarters-vs-tivimate/ — competitor comparison: TiviMate multi-view/recording, Smarters cross-platform; parental PIN + multi-view positioned as differentiators.
- https://iptv-ca.ca/what-is-iptv-parental-control-password/ — parental-PIN channel-locking is a built-in feature across IPTV Smarters/TiviMate/GSE (table-stakes, lower differentiation).
