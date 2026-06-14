---
status: current
---

# Integration Testing — Live-Network Tier

## Purpose

The unit suite (Vitest, mocked fetch) and the UI suite (Playwright, local
server) prove the engine's logic. Neither proves that the engine actually
**connects to and loads a real public M3U playlist over the real network**.
The integration tier closes that gap: it exercises the live path —
server proxy → public endpoint → M3U parse → stream manifests — against
`https://iptv-org.github.io/iptv/index.m3u`, the canonical public iptv-org
community playlist (10 000+ channels).

## Reference endpoints

### M3U tier

| Name           | Value                                              |
|----------------|----------------------------------------------------|
| Playlist URL   | `https://iptv-org.github.io/iptv/index.m3u`        |
| Expected host  | `iptv-org.github.io`                               |
| Expected body  | text starting with `#EXTM3U`                       |
| Expected scale | well over 100 channels, more than one category     |

The endpoint is a stable, CDN-hosted GitHub Pages artifact — the most
reliable public M3U source available. It is declared once as a constant in
the integration tests, never scattered.

### Xtream tier (personal testing portal)

| Name        | Value                          |
|-------------|--------------------------------|
| Portal URL  | `http://mymax.top:8080`        |
| Username    | `1ymax5763dy`                  |
| Password    | `66537535`                     |
| Live format | raw MPEG-TS (`allowed_output_formats: ["ts"]`); `.m3u8` requests return 405 |
| Stream URL  | `<portal>/live/<user>/<pass>/<stream_id>.ts`, 302-redirects to a tokenized URL on another host |

### EPG tier (XMLTV guide reference)

| Name          | Value                                              |
|---------------|----------------------------------------------------|
| XMLTV guide   | `https://i.mjh.nz/PlutoTV/us.xml`                  |
| Expected host | `i.mjh.nz`                                         |
| Expected body | XML containing `<programme>` elements              |
| Used by       | `src/tests/int/epg.test.js` (EPG over the live proxy) |

A live, well-populated public XMLTV mirror (matthuisman.nz PlutoTV US),
used to exercise the M3U-path EPG: fetch the guide through the proxy and
parse it with `parsXmltv`. The Xtream-path EPG is exercised against the
personal Xtream portal above via `get_simple_data_table`. Like every other
reference endpoint, the URL is declared **once** as a constant in the
integration tests (`src/tests/int/epg.test.js`), never scattered.

This is the project owner's **personal testing environment**, explicitly
provided for integration testing. Credentials are declared once as
constants in the integration tests. Behavior under test for this tier:

1. **Auth + listing.** `IptvApi.connect` in Xtream mode against the live
   portal (through the in-process proxy) resolves `{ ok: true, val }` with
   more than one category and more than one channel, every sampled channel
   conforming to the `CH_DEF` schema with a non-empty proxied-playable
   `url`.
2. **Proxy redirect-following.** Fetching a live channel's `.ts` stream URL
   through the proxy returns HTTP 200 (redirects followed server-side) and
   yields MPEG-TS bytes (first body byte of a 188-byte-aligned read is the
   sync byte `0x47`); the read is bounded (e.g. first 64 KB) then aborted —
   tests never download a stream indefinitely.
3. **TS→HLS remux endpoint.** Requesting `/api/hls?url=<encoded>` for a
   sampled live channel's `.ts` URL against the in-process server returns
   HTTP 200 with a body starting `#EXTM3U`, and at least one listed
   segment fetches with 200 and the TS sync byte `0x47` at offset 0; reads
   are bounded and the remux session is torn down at test end.
4. Stream-level flake policy: as with public streams, at least one of a
   sample of live channels must produce valid TS bytes (or a valid remuxed
   playlist); the portal API itself (auth, categories, streams listing) is
   held to an always-up standard.

## Behavior under test

1. **Proxy connectivity.** The Express app's `/api/xtream?url=<encoded>`
   proxy (ADR-0002), booted in-process on an ephemeral port, successfully
   fetches the live playlist: HTTP 200, body begins with `#EXTM3U`.
2. **Engine connect + load.** The client engine's M3U path
   (`IptvApi.connect` with the explicit `m3u: true` mode flag → `loadM3u` →
   `parsM3u`, ADR-0008; parse mechanics per ADR-0005), driven against the
   live body, resolves `{ ok: true, val }` with: `val.host` equal to the
   expected host, `val.user === ''`, `val.server === null`, more than 100
   channels, more than one category, and sampled channels conforming to the
   `CH_DEF` schema (CONVENTIONS.md §7) with non-empty `name` and an
   `http(s)://` `url`.
3. **Stream loadability.** A deterministic sample of stream URLs taken from
   the live playlist is fetched; at least one must return an HTTP 2xx
   response whose body begins with `#EXTM3U` (a real HLS manifest) — proof
   that the engine's output URLs are playable streams, not dead text.

## Network-dependence policy

- The integration suite **requires live outbound network**. If the network
  or the reference endpoint is down, the suite fails — that is the signal
  the tier exists to produce. There is no mock fallback and no auto-skip.
- The suite is **not** part of the unit command (`npx vitest run`); it runs
  only via its own canonical command (see `docs/specs/project.md`).
- Public IPTV **streams** churn constantly; individual channels die daily.
  Tests therefore never depend on one specific channel being alive: stream
  loadability passes when **at least one of a sample of five** responds with
  a valid HLS manifest. The playlist endpoint itself (GitHub Pages) is held
  to a strict always-up standard.
- Timeouts are generous (the playlist is ~20 MB): per-test timeout of at
  least 120 s, per-stream fetch timeout of 15 s.
- Test files run sequentially (no file parallelism) to avoid hammering the
  public endpoint with concurrent multi-megabyte downloads.

## Canonical command

```
npx vitest run --config vitest.int.config.js
```

Defined in `docs/specs/project.md` (single source of truth). The config includes
only `src/tests/int/**/*.test.js`.
