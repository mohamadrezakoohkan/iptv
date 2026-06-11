---
id: ADR-0004
title: Video playback — hls.js with native HLS fallback
date: 2026-06-11
evolution: 1
status: accepted
governs:
  - client/play.js
  - client/ui.js
  - client/app.css
  - index.html
---

# ADR-0004 — Video playback — hls.js with native HLS fallback

## Context

IPTV live streams from Xtream-compatible portals are delivered as HLS
(`.m3u8` + `.ts` segments). Browsers do not natively support HLS except
Safari on macOS/iOS.

The design uses hls.js 1.5 loaded from CDN
(`cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js`). hls.js attaches to
a `<video>` element and handles segment fetching, buffering, and adaptive
bitrate switching in JavaScript.

The design also mentions a "TS" format chip as a placeholder for future
mpegts.js integration (direct MPEG-TS stream playback without HLS
segmentation). This is not implemented at Evolution 1 — the chip is rendered
but disabled.

CONVENTIONS.md §13 forbids `new Foo()` for application objects but allows
`new` for built-ins (Date, Map, Set, Error). hls.js is an external library,
not an application class, so `new Hls()` is permitted under the same
"built-in / external library" carve-out.

## Decision

**hls.js 1.5 via CDN + native HLS fallback for Safari + disabled TS chip.**

`client/play.js` exposes three functions:

- `mkPlay(el)` — binds `play.js` to a `<video>` DOM element; stores the
  reference; must be called once from `main.js`.
- `loadPlay(url)` — loads a new HLS URL: (1) if `Hls.isSupported()` →
  attach hls.js; (2) else if `el.canPlayType('application/vnd.apple.mpegurl')`
  → set `el.src` directly (Safari native HLS); (3) else → return
  `{ ok: false, err: 'HLS not supported' }`. Returns `{ ok: true, val: null }`
  on successful setup.
- `stopPlay()` — destroys the hls.js instance and clears `el.src`.

Error handling: hls.js `Hls.Events.ERROR` events with `data.fatal === true`
propagate to the state machine via `go('ERR')` and set `ST.err`.

The `<video>` element uses `autoplay muted playsinline` attributes to allow
autoplay without a user gesture on most browsers.

hls.js is loaded via a `<script>` tag in `index.html` before `client/main.js`.
The global `Hls` is accessed as `window.Hls` in `play.js` to make the
dependency explicit without an import statement.

**TS format chip**: rendered in the content-head bar by `ui.js` as a disabled
button. No playback logic is wired up. A future ADR will add mpegts.js when
that feature is implemented.

## Consequences

**Easier:**
- hls.js handles adaptive bitrate, segment buffering, and error recovery
  automatically.
- Safari users get playback via the native engine without extra code.
- The CDN URL pins the exact hls.js version (1.5.20) for reproducibility.

**Harder:**
- A Content Security Policy that blocks CDN scripts would need to allow
  `cdn.jsdelivr.net`. This is documented in the README but not enforced by
  the server at Evolution 1.
- `play.js` must handle concurrent `loadPlay()` calls (rapid channel
  switching) by destroying the previous hls.js instance before creating a
  new one.

**Ruled out:**
- mpegts.js / MPEG-TS direct playback (deferred to a future evolution).
- dash.js or any MPEG-DASH player (no DASH streams in Xtream portals).
- MediaSource Extensions manual implementation (hls.js already does this).

## Tasks derived

- TASK-0007 — Player component (hls.js, idle state, error overlay)

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0004` near the top.
