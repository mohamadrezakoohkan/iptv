---
id: ADR-0007
title: Live iptv-org M3U validation — engine load assertions and sampled stream reachability
date: 2026-06-11
evolution: 3
status: accepted
governs:
  - tests/int/m3u.test.js
  - tests/int/strm.test.js
---

# ADR-0007 — Live iptv-org M3U validation — engine load assertions and sampled stream reachability

## Context

ADR-0005 shipped M3U support (`isM3u` / `parsM3u` / `loadM3u` in
`client/api.js`, routed through the ADR-0002 proxy), validated only with
mocked fetches and a both-outcomes-pass Playwright test. The E3 prompt asks
for integration tests proving the engine **actually** connects to and loads
`https://iptv-org.github.io/iptv/index.m3u` streams over the live network.

Decisions this forces, beyond the tier infrastructure (ADR-0006):

- **What "the engine" means in a Node test.** `client/api.js` is a browser
  IIFE that assigns `window.IptvApi` and calls `fetch` with the relative
  proxy path `/api/xtream?url=…`. Existing unit tests already load it in
  Node by stubbing `global.window`; relative-URL fetch, however, fails in
  Node, so the live test needs a fetch shim that resolves relative paths
  against the in-process server's ephemeral base URL.
- **What "streams load" means.** The playlist carries 10 000+ channel URLs
  of which a meaningful fraction is dead at any moment — public IPTV
  channels churn daily. Asserting any specific channel is alive would be
  permanently flaky; asserting none is needed would test nothing.

## Decision

Two integration test files validate the live path on top of the ADR-0006
harness. The endpoint `https://iptv-org.github.io/iptv/index.m3u` and the
expected host `iptv-org.github.io` are file-level constants
(CONVENTIONS.md RULE-ID-7).

### 1. Engine connect + load (`tests/int/m3u.test.js`)

Boot the in-process server (ADR-0006). Load `client/api.js` with a
`global.window` stub (the existing unit-test pattern) and install a named
fetch shim that prefixes relative URLs with `http://127.0.0.1:<port>`,
delegating to native fetch. Then call
`window.IptvApi.connect(LIVE_URL, { user: '', pass: '' })` and assert:

- result is `{ ok: true, val }` (RULE-FN-4 Result shape);
- `val.host === 'iptv-org.github.io'`, `val.user === ''`,
  `val.server === null`;
- `val.channels.length > 100` and `val.categories.length > 1` (scale
  thresholds far below the real ~10 000, so playlist shrinkage never
  false-fails);
- a deterministic sample of channels (first, middle, last) conforms to
  `CH_DEF` (CONVENTIONS.md §7): string `id`/`name`/`grp`/`url`/`img`/`cat`,
  number `num`, non-empty `name`, `url` matching `^https?://`.

This exercises the complete engine path — `connect` routing → `isM3u` →
`loadM3u` → proxy fetch → `parsM3u` — against live bytes, not fixtures.

### 2. Sampled stream reachability (`tests/int/strm.test.js`)

From the live-parsed channel list, take a **deterministic sample of 5
stream URLs** (indices spread evenly across the list: first, 25 %, 50 %,
75 %, last). Fetch each directly with native fetch (Node has no CORS;
the proxy adds nothing for this check), 15 s per-stream timeout via
`AbortController`, failures caught per stream.

**PASS criterion: at least 1 of the 5 sampled streams** returns an HTTP 2xx
response whose body begins with `#EXTM3U` — a genuine HLS manifest, the
exact content type the player (ADR-0004) consumes. The test report lists
the per-stream outcomes for diagnosis.

Rationale: requiring all 5 (or any fixed one) to be alive is flaky by the
nature of public IPTV; requiring ≥ 1 of an evenly-spread 5 still proves the
engine's parsed URLs are real, loadable HLS streams. The playlist endpoint
itself is held to the strict standard (test 1 fails hard if it is down).

## Consequences

**Easier:**
- A regression anywhere in the live chain — proxy URL validation, header
  handling, M3U parsing against real-world `#EXTINF` variants, channel
  shaping — now fails validation instead of reaching users.
- The both-outcomes-pass Playwright test from TASK-0012 is no longer the
  only live-URL coverage.

**Harder:**
- The ≥ 1-of-5 criterion means stream checking is a smoke signal, not a
  guarantee that most channels work — accepted, since channel liveness is
  iptv-org's concern, not the engine's.
- The fetch shim couples the test to `client/api.js`'s relative-proxy-path
  convention; if the proxy path changes, the shim assertion surfaces it
  (which is desirable).

**Ruled out:**
- Pinning specific channels/URLs as always-alive (permanently flaky).
- Headless-browser playback of streams via hls.js (belongs to the UI tier;
  network playback in CI is unreliable and slow).
- Fetching the playlist without the proxy in test 1 (the proxy is part of
  the engine path under test).

## Tasks derived

- TASK-0015 — Live engine connect+load integration test (iptv-org index.m3u)
- TASK-0016 — Sampled stream reachability integration test

## Traceability

Every file listed in `governs:` must carry `// ADR: ADR-0007` near the top.
