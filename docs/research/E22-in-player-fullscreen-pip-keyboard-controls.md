# Research — E22: Add a VOD (Movies & Series) library on the Xtream path (Live | Movies | Series content toggle, poster cards, series seasons/episodes drill-down, on-demand playback through the existing player)

> Non-blocking Phase-4 RESEARCH for the next product feature, run alongside REVIEW. Researches this product (the "teeatr" / IPTV Broadcast Console vanilla-JS browser IPTV player) only. Commits nothing; spawns nothing.

## Method

Surveyed competitor IPTV/streaming players and user-demand signals (app-store listings, competitor feature pages, IPTV how-to/forum content), then narrowed to 3 product features that fit this product's identity (a single-page vanilla-JS browser player: Xtream + M3U, category browse / search / favourites / sort, dual-engine <video> playback, multiple accounts, community playlists, theme toggle, failure log, EPG now/next + schedule, reminders, catch-up Replay, and the just-shipped VOD Movies & Series library).

Sources surveyed:
- TroyPoint — Top 15 IPTV Players (June 2026): https://troypoint.com/top-iptv-players/ — TiViMate / IPTV Smarters dominate; EPG, recording, time-shifting, multi-screen, hardware decode are the recurring feature set.
- TiViMate features page: https://tivimate.co.com/app/features/ — Picture-in-Picture, multi-view (up to 4), recording, parental controls, catch-up, advanced search listed as the headline premium features.
- bocaletto-luca/IPTV-Web-Player (GitHub): https://github.com/bocaletto-luca/IPTV-Web-Player — a web HLS.js player whose keyboard controls (F = fullscreen, P = PiP, Space = play/pause, +/- volume, M = mute, arrows = navigate) are a stated headline feature — direct evidence that in-browser players ship exactly this.
- Tuneline — PiP & Multi-Stream guide (2026): https://tuneline.app/blog/iptv-picture-in-picture-multi-stream-guide — PiP framed as a standard expectation; click PiP icon or Ctrl/Cmd+Shift+P.
- Tuneline — Subtitles & Multi-Audio guide (2026): https://tuneline.app/blog/iptv-subtitles-multi-audio-track-setup-guide — multi-track selection called "the most under-documented topic in the IPTV world"; widespread, under-served demand.
- Webnexs — Continue Watching for VOD: https://www.webnexs.com/blog/continue-watching-video-feature-on-video-on-demand-vod/ — resume-from-where-you-left-off with a progress bar is a core modern-VOD expectation.
- StreamVault-IPTV (GitHub): https://github.com/Davidona/StreamVault-IPTV — ships continue-watching, playback history, and detail-screen resume actions with saved position.
- EngPlayer (GitHub): https://github.com/Falldaemon/EngPlayer — auto-saves playback progress for movies / series / local media and resumes exactly where left off.

_Dedup inputs:_ CHANGELOG.md #1–#22 (shipped: Xtream/M3U, browse/search/favourites/sort, dual-engine + remux fallback, multi-account, community playlists, theme, failure log, EPG, reminders, catch-up Replay, VOD Movies & Series) and BACKLOG.md (empty on this run branch). Eligible prior runner-ups noted by the orchestrator (fullscreen+PiP+keyboard, parental PIN-lock, recently-watched/continue-watching, multi-view) are NOT parked on this branch and are therefore eligible candidates.

## Candidates

### 1. In-player controls — fullscreen, Picture-in-Picture, and keyboard shortcuts
Add a thin, client-only control layer over the existing dual-engine <video>: a Fullscreen toggle (native Fullscreen API), a Picture-in-Picture toggle (native requestPictureInPicture, feature-detected), and keyboard shortcuts while a stream plays — F fullscreen, P PiP, Space/K play-pause, M mute, ↑/↓ volume — surfaced as accessible, focusable controls on the player chrome (alongside the existing format chip). It touches no server route, no playback engine, and no state-machine phase: it drives the already-resolved <video> element directly and degrades gracefully where the browser lacks PiP (iOS Safari). Demo mode already plays a stream, so it is fully demonstrable offline.
- Demand: 5/5 — A top-tier competitor staple: TiViMate ships PiP as a headline premium feature, and the closest analog (a browser HLS.js IPTV player) ships exactly the F/P/Space/M/arrow keyboard set as a stated feature.
- Fit: 5/5 — Pure client, uses native browser Fullscreen/PiP APIs on the existing <video>; no new server route, engine, phase, or persistence — an exact match for this product's additive-client posture (mirrors how the format chip, EPG, reminders, and VOD were all built). Works for live channels, catch-up, and VOD playback alike since they share one player.
- Differentiation: 3/5 — Expected baseline more than a unique edge; it brings the browser player to parity with native players rather than ahead of them, but PiP specifically still distinguishes a browser player that lets you keep watching while doing other work.
- **Total: 13/15**

### 2. Continue-watching — resume-position for VOD movies & series
Persist a per-item playback position for on-demand content (the E22 Vod movie / episode items) in a new localStorage store mirroring the favourites/reminders pattern, and a Continue watching affordance: when you reopen a movie or episode you previously stopped mid-stream, resume from the saved offset (seek the <video> currentTime on play), and surface a small resume row/marker for recently-watched VOD items. Live channels are excluded (no resume semantics); the store is VOD-only and degrades silently when storage is unavailable.
- Demand: 4/5 — A core modern-VOD expectation: StreamVault, EngPlayer, and HotPlayer all auto-save VOD progress and resume; "continue watching" with a progress bar is treated as a standard VOD UX.
- Fit: 5/5 — Builds directly on the VOD library shipped this very evolution; a localStorage store mirroring favourites (ADR-0003) / reminders (ADR-0032), reusing the existing select+play path with a single seek-on-load step. No new engine, phase, or server route.
- Differentiation: 3/5 — Standard across VOD-capable players; valuable but not uniquely setting the product apart.
- **Total: 12/15**

### 3. Subtitle & multi-audio-track selector on the player
Expose the audio and subtitle/caption tracks the stream already carries — read from hls.js (hls.audioTracks / hls.subtitleTracks) and from the native <video>.audioTracks / textTracks on the Safari/native path — as a small, accessible track picker on the player chrome, letting the user switch audio language or toggle subtitles, with the choice remembered per session. Client-only, feature-detected, and absent when a stream carries no extra tracks (contextual presence, matching how EPG / Replay / VOD tabs only appear when available).
- Demand: 4/5 — Described as "the most under-documented topic in the IPTV world": users widely expect multi-audio / subtitle switching, yet it is poorly served by existing players.
- Fit: 4/5 — Client-only and reuses the existing player surface; hls.js and native <video> both expose the track APIs. Slightly lower than the others because real track availability depends on what the provider/stream carries (often stripped during transcoding), and an offline demo stream may carry no alternate tracks — making demoability harder.
- Differentiation: 4/5 — Genuinely under-served across the field; a browser player that surfaces audio + subtitle tracks cleanly stands out more than PiP or resume do.
- **Total: 12/15**

## Winner — In-player controls: fullscreen, Picture-in-Picture, and keyboard shortcuts (Total 13/15)
It wins on the highest total. It pairs the loudest, most consistently shipped demand signal (PiP + keyboard control is a competitor staple and is literally a headline feature of the closest browser-HLS analog) with the best possible product-fit: it is a thin, purely client-side control layer over the existing dual-engine <video> element — native Fullscreen/PiP APIs plus keyboard handlers — adding no new server route, no new playback engine, no new state-machine phase, and no playback persistence, exactly matching the additive-client posture every recent evolution (format chip, EPG, reminders, catch-up, VOD) has followed. It benefits live, catch-up, and the just-shipped VOD playback uniformly because they all share one player, and it is fully demonstrable in demo mode. It is ready to hand to spec-agent as a concrete build prompt.

## Sources
- https://troypoint.com/top-iptv-players/ — TiViMate/IPTV Smarters dominate; EPG, recording, time-shift, multi-screen, hardware decode are the recurring competitor feature set.
- https://tivimate.co.com/app/features/ — PiP, multi-view, recording, parental controls, catch-up are TiViMate's headline premium features.
- https://github.com/bocaletto-luca/IPTV-Web-Player — a web HLS.js IPTV player whose keyboard set (F fullscreen, P PiP, Space play/pause, +/- volume, M mute, arrows navigate) is a stated headline feature.
- https://tuneline.app/blog/iptv-picture-in-picture-multi-stream-guide — PiP is a standard expectation; invoked by icon or Ctrl/Cmd+Shift+P.
- https://tuneline.app/blog/iptv-subtitles-multi-audio-track-setup-guide — multi-audio/subtitle selection is widely expected yet "the most under-documented topic in the IPTV world."
- https://www.webnexs.com/blog/continue-watching-video-feature-on-video-on-demand-vod/ — continue-watching / resume-with-progress-bar is a core modern-VOD expectation.
- https://github.com/Davidona/StreamVault-IPTV — ships continue-watching, playback history, and detail-screen resume with saved position.
- https://github.com/Falldaemon/EngPlayer — auto-saves and resumes playback progress for movies/series/local media.
