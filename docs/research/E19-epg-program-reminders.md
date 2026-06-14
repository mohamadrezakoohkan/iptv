# Research — E19: Add an EPG showing now/next per channel plus an expandable per-channel schedule view

## Method
Surveyed competitor browser/native IPTV players and user-demand signals (app-store reviews, feature lists, EPG how-to threads) for in-demand features that fit a vanilla-JS, client-side, in-memory-EPG browser player. Sources:

- TiViMate feature list (https://tivimate.co.com/app/features/) — advertises Full EPG with reminders, Parental Controls (lock channels/categories by PIN), channel-group customization, favourites/custom lists; the de-facto reference IPTV player.
- TiViMate review/guide (https://litiptv.com/blog/tivimate-review-guide, https://tivimateiptvplayer.net/mastering-tivimate/) — "see what is on now, what is coming next, and set reminders"; reminders are set directly from the guide.
- IPTV Smarters Pro EPG guide (https://iptvhdprovider.com/epg-iptv-smarters-pro/) — "Set Reminder" on a program; the app notifies you when the show starts.
- Infomir set-top reminders article (https://infomir.store/never-miss-a-favorite-show-again-how-to-set-reminders-and-auto-recording-on-your-set-top-box/) — reminders + auto-record are the headline "never miss a show" features.
- Chillio IPTV Smart Player Pro (https://apps.apple.com/us/app/chillio-iptv-smart-player-pro/id6478813450) — ships "favorite channels and a recently watched list"; a "Continue watching" resume prompt is a noted update.
- App-store review complaints (https://apps.apple.com/us/app/iptv-smarters-player-expert/id1641944027, https://apps.apple.com/us/app/iptv-smart-player/id6448987395) — users ask for time/date sorting, alphabetical channel listing, and easier ways to find/return to channels.
- IPTV parental-control guides (https://www.theiptvguide.com/iptv-parental-controls/, https://en.f-player.ru/parental-control-in-iptv) — PIN-locking / hiding adult or restricted channels and categories is a built-in expectation across IPTV Smarters, TiViMate, GSE, IBO Player.

Dedup inputs: `BACKLOG.md` is empty (no parked ideas); `CHANGELOG.md` #1–#19 covers Xtream + M3U, category browse, search, favourites, sort, dual-engine playback, MSE-less remux, multiple accounts, community playlists, theme, contextual format chip, empty/no-signal states, playback-failure log, and the just-shipped EPG (E19). The two E18 research runner-ups — recently-watched/continue-watching and fullscreen+PiP+keyboard controls — are NOT parked in `BACKLOG.md`, so they remain eligible; preference given to fresh, EPG-synergistic candidates.

## Candidates

### 1. Program reminders on EPG entries ("remind me" + in-session notification)
Let the user set a reminder on any upcoming program in the just-shipped expandable schedule (and on the NOW/NEXT line): a small "Remind" toggle on each schedule row marks that program, and when its start time arrives the app surfaces an in-app toast plus a browser Notification (best-effort, permission-gated) so the user can jump to the channel. Reminders persist in `localStorage` (a new keyed store, mirroring favourites), are checked by a lightweight client timer against the in-memory `IptvEpg` store, and add no playback engine, no server route, and no new state-machine phase — a pure data + render + timer surface layered directly on E19's EPG.
- Demand: 5/5 — both reference players ship it: TiViMate "set reminders" from the guide and IPTV Smarters Pro "Set Reminder … notify you when the show starts"; framed as the headline "never miss a show" feature (TiViMate guide; iptvhdprovider EPG guide; Infomir reminders article).
- Fit: 5/5 — it is the most natural next step on top of the EPG just shipped (E19): it reuses the `Prg` schema, the `IptvEpg` now/next selectors, the schedule rows, `localStorage` favourites-style persistence, and the existing toast/log UI posture; no new engine, route, or phase — exactly the additive surface this codebase favours.
- Differentiation: 4/5 — reminders are common in native set-top apps but rare in lightweight browser-based players; building them on the brand-new in-browser EPG turns a read-only guide into an actionable one and is a clear moat for a no-install web player.
- **Total: 14/15**

### 2. Parental control: PIN-lock channels and categories
A user-set PIN (stored hashed-ish/obfuscated in `localStorage`) that locks selected channels or whole categories: locked items are hidden from the grid/sidebar (or require the PIN to play), with a settings affordance to set/change/clear the PIN and mark channels/categories restricted. Reuses the existing sidebar/grid, favourites-style per-item flags, and `localStorage`; no server state.
- Demand: 4/5 — a built-in expectation across IPTV Smarters Pro, TiViMate, GSE, IBO Player; guides describe PIN-locking and hiding adult/restricted channels as standard, and "hide adult content completely" is a recurring user need (TiViMate features; theiptvguide; f-player parental-control article).
- Fit: 4/5 — fits the per-channel/per-category flag model and `localStorage` conventions cleanly, but introduces a (light) security/obfuscation concern and a lock-gate in the play path that is slightly more invasive than a pure render layer; no multi-profile infra implied.
- Differentiation: 3/5 — table-stakes parity rather than a standout; nearly every competitor already ships it, so it closes a gap more than it differentiates.
- **Total: 11/15**

### 3. Recently-watched / continue-watching channel list
A session-and-persistence-backed list of the last channels the user actually played (most-recent-first, capped), surfaced as a pinned "Recent" entry in the sidebar (alongside All Channels / Favourites) so users can jump straight back to what they were watching. Reuses the existing last-selected-channel persistence and the failure-log store posture; play events are the single capture point.
- Demand: 4/5 — Chillio ships "a recently watched list" and a "Continue watching" resume prompt; app-store reviewers repeatedly complain that channels are hard to find/return to and ask for better ways back to recent content (Chillio listing; IPTV Smart Player / Smarters review complaints). Also the E18 research runner-up (eligible — not parked).
- Fit: 4/5 — the app already persists the last-selected channel and has a clean play choke point to hook; a pinned sidebar list mirrors the Favourites pattern exactly. Mild overlap with Favourites (manual) vs Recent (automatic) keeps it from a perfect fit.
- Differentiation: 3/5 — common in modern players; useful and expected, but not a standout versus competitors.
- **Total: 11/15**

## Winner — Program reminders on EPG entries (Total 14/15)
Program reminders win outright on the highest total. They ride directly on the Electronic Program Guide shipped this very run (E19) — converting a read-only now/next + schedule surface into an actionable one — which is both the strongest product-fit (reuse `IptvEpg`, `Prg`, schedule rows, `localStorage`, toast UI; no new engine/route/phase) and a top demand signal (TiViMate and IPTV Smarters both ship "set reminder / notify when it starts" as a marquee EPG feature). For a no-install browser player it is also genuinely differentiating, since native set-top apps own reminders but lightweight web players rarely do. It is concrete enough to hand to spec-agent as a self-contained additive build prompt.

## Sources
- https://tivimate.co.com/app/features/ — TiViMate advertises full EPG, reminders, PIN-based parental controls, channel-group customization, favourites/custom lists.
- https://litiptv.com/blog/tivimate-review-guide — TiViMate guide: see now/next and "set reminders" directly from the EPG.
- https://iptvhdprovider.com/epg-iptv-smarters-pro/ — IPTV Smarters Pro: select a program, "Set Reminder", app notifies you when the show starts.
- https://infomir.store/never-miss-a-favorite-show-again-how-to-set-reminders-and-auto-recording-on-your-set-top-box/ — reminders + auto-record positioned as the "never miss a show" features.
- https://apps.apple.com/us/app/chillio-iptv-smart-player-pro/id6478813450 — Chillio ships favourite channels + a recently-watched list; "Continue watching" resume prompt.
- https://apps.apple.com/us/app/iptv-smarters-player-expert/id1641944027 — reviewers ask for time/date sorting; replay/catch-up features.
- https://apps.apple.com/us/app/iptv-smart-player/id6448987395 — reviewers request alphabetical listing and easier ways to find channels.
- https://www.theiptvguide.com/iptv-parental-controls/ — PIN-locking and hiding restricted/adult channels is a standard built-in IPTV feature.
- https://en.f-player.ru/parental-control-in-iptv — parental-control PIN function across IPTV players, including hiding content from the lineup.
