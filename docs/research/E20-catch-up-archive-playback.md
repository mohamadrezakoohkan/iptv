# Research — E20: Add program reminders on top of the EPG (Remind toggle on schedule rows + NOW/NEXT, localStorage-persisted timer firing toast + browser Notification with jump-to-channel)

## Method

Surveyed competitor browser/app IPTV players and user-demand signals (best-of round-ups, app pages, forum/guide threads). The product just shipped an EPG (E19) and EPG reminders (E20), so the strongest adjacent demand class is time-shifted / on-demand content that builds on the new guide surface. Sources surveyed:

- TroyPoint — Top 15 IPTV players (June 2026): TiviMate, IPTV Smarters Pro, XCIPTV feature comparison — https://troypoint.com/top-iptv-players/
- IPTV Smarters Pro 2025 feature guide (multi-screen, parental controls, catch-up, PiP) — https://marketplace.gophersports.com/blogs/news/iptv-smarters-pro-the-ultimate-2025-guide-to-features-setup-top-alternatives
- TiviMate features + catch-up/timeshift archive how-it-works — https://tivimate.co.com/app/features/ and https://live4kiptv.com/best-4k-live-iptv-catch-up-replay-4k-iptv-usa-shows/
- Xtream Codes API guide (get_vod_streams, VOD/Series catalog) — https://www.iptv-one.app/en/blog/what-is-xtream-codes
- streamly — self-hosted Xtream web player (Live + Movies + Series + EPG) — https://github.com/kvnpyy/streamly
- RunTV / OneTV / Tuneline multi-view (web app, 2x2 mosaic, Xtream) — https://runtv.run/ and https://tuneline.app/blog/iptv-picture-in-picture-multi-stream-guide
- Web video-player feature demand (fullscreen F, PiP, keyboard seek) — https://www.rabbitpair.com/en/blog/best-picture-in-picture-chrome-extension-2026

## Candidates

### 1. Catch-up / archive playback (timeshift) on the EPG
Turn the just-shipped EPG into a time machine: for a channel whose source advertises catch-up (Xtream tv_archive/tv_archive_duration on the channel, surfaced in the short-EPG path), every PAST schedule row in the expandable guide gains a "Replay" affordance that plays the archived program through the existing proxy and dual-engine player (Xtream streaming/timeshift.php style archive URL, played as HLS/TS exactly like live). Past rows without archive show no affordance; everything degrades silently. Purely additive — reuses the EPG schedule render, the canonical Ch/Prg schema, the proxy, and the existing select+play path; no new playback engine, no new phase.
- Demand: 5/5 — Catch-up/timeshift is named a top requested feature across every round-up and is the headline premium feature of TiviMate and IPTV Smarters Pro ("rewind live channels and watch programs that aired in the past"). https://troypoint.com/top-iptv-players/, https://live4kiptv.com/best-4k-live-iptv-catch-up-replay-4k-iptv-usa-shows/, https://tivimate.co.com/app/features/
- Fit: 5/5 — Lands directly on the E19 EPG + E20 reminders surface (the past schedule rows already render); reuses the canonical schema, the proxy, and the existing select+play transition. It is the natural next step after now/next + reminders, with zero new architecture.
- Differentiation: 5/5 — Catch-up is a paid/premium feature in the leading native apps and effectively absent from free, no-install browser players; shipping it client-side in a vanilla-JS web app is a standout.
- **Total: 15/15**

### 2. VOD library — browse and play Movies & Series (Xtream get_vod_streams / get_series)
Add a Movies/Series catalog alongside live channels: on the Xtream path, fetch get_vod_streams / get_series through the existing proxy, normalize into the canonical schema, surface them as a new sidebar section (or filter) with poster/title/year cards, and play a selected title through the existing dual-engine player. Live browsing is untouched; VOD is purely additive data + render + the same play path.
- Demand: 4/5 — every Xtream-based player builds "Live, VOD, Series, and EPG content" from one login; VOD with TMDB artwork is a standard expectation and a frequent feature ask. https://www.iptv-one.app/en/blog/what-is-xtream-codes, https://github.com/kvnpyy/streamly
- Fit: 4/5 — fits the Xtream connection path and the existing browse/card/play UX, but introduces a new content domain (movies/series vs. live channels) and likely a new state surface, so it is a larger, less surgical addition than catch-up.
- Differentiation: 3/5 — valuable but table-stakes: nearly every competitor already ships VOD, so it closes a gap more than it sets the product apart.
- **Total: 11/15**

### 3. Fullscreen + Picture-in-Picture + keyboard player controls
Give the player real viewing ergonomics: a fullscreen toggle, a Picture-in-Picture button (Web requestPictureInPicture), and keyboard shortcuts (F fullscreen, space play/pause, M mute, arrows for volume) on the existing video element. Purely presentational/player-control layer — no new engine, no new phase.
- Demand: 4/5 — fullscreen, PiP, and keyboard control are consistently top-requested web-player capabilities and a named IPTV Smarters Pro feature. https://www.rabbitpair.com/en/blog/best-picture-in-picture-chrome-extension-2026, https://marketplace.gophersports.com/blogs/news/iptv-smarters-pro-the-ultimate-2025-guide-to-features-setup-top-alternatives
- Fit: 4/5 — clean fit on the existing player surface and a small, self-contained change, but it is a polish/ergonomics layer rather than a new capability; it is also an eligible E18/E19 runner-up still unparked on this branch.
- Differentiation: 2/5 — browsers already expose native fullscreen/PiP context-menu options and many extensions provide this; it differentiates the least.
- **Total: 10/15**

## Winner — Catch-up / archive playback (timeshift) on the EPG (Total 15/15)

Catch-up wins on all three dimensions: it is the single most-requested time-shift feature in the IPTV space (premium headline in TiviMate and IPTV Smarters Pro), it lands surgically on the EPG schedule surface just built in E19/E20 (past rows already render, the proxy and dual-engine play path already exist), and it is the most differentiating because catch-up is paywalled in native apps and essentially unseen in free no-install browser players. It is purely additive — a "Replay" affordance on archive-capable past schedule rows that plays the archived program through the existing proxy and player — with no new engine, no new state-machine phase, and no new server route.

## Sources
- https://troypoint.com/top-iptv-players/ — Catch-up TV, multi-screen, recording, parental controls top the competitor feature matrix (TiviMate, IPTV Smarters Pro, XCIPTV).
- https://live4kiptv.com/best-4k-live-iptv-catch-up-replay-4k-iptv-usa-shows/ — Catch-up = rewind/replay programs that already aired; tied to channel archive window.
- https://tivimate.co.com/app/features/ — TiviMate markets catch-up + timeshift as core premium features; archive is per-channel server-supported.
- https://marketplace.gophersports.com/blogs/news/iptv-smarters-pro-the-ultimate-2025-guide-to-features-setup-top-alternatives — IPTV Smarters Pro lists catch-up, multi-screen, parental controls, PiP as headline features.
- https://www.iptv-one.app/en/blog/what-is-xtream-codes — Xtream get_vod_streams builds Live/VOD/Series/EPG; VOD with TMDB artwork is standard.
- https://github.com/kvnpyy/streamly — A self-hosted Xtream web player shipping Live + Movies + Series + EPG, confirming VOD as a web-player expectation.
- https://runtv.run/ — Web-app multi-view (4 channels, Xtream/M3U) confirms multi-view demand but as a separate, heavier product class.
- https://www.rabbitpair.com/en/blog/best-picture-in-picture-chrome-extension-2026 — Fullscreen/PiP/keyboard-control demand for web video players.
