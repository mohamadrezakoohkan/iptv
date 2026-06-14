# Backlog

## 2026-06-13 — Product-project memory file under docs/ that Claude references

**user input:** Add to backlog a new feature to keep Memory.md of the product project on the docs folder and use it as memory for claude that references

**assumptions:**
- "Memory.md" (exact filename/casing): a single file named `docs/MEMORY.md` (uppercase, matching the repo's existing `README.md`/`CHANGELOG.md` casing convention), not lowercase `Memory.md`.
- location within `docs/`: directly at the `docs/` root as `docs/MEMORY.md`, alongside `docs/specs/` and `docs/adrs/`, rather than nested under a new subfolder such as `docs/notes/`.
- scope of "product project" memory: this is product-project memory, distinct from the orchestrator's user-level auto-memory and from the harness `CLAUDE.md`/`CORE_FLOW.md`; it lives on the product side and is owned/maintained through the pipeline, not by backlog- or coreflow-agent.
- what it captures: durable product-project facts, decisions, and context that are NOT derivable from the source code or git history (e.g. domain vocabulary, product codename, cross-cutting conventions, rationale that would otherwise be re-discovered each session).
- how Claude "references" it: Claude reads `docs/MEMORY.md` as durable, authoritative project memory when working on the product, treating it as a context source to consult — leaving the exact wiring (e.g. a pointer from `CLAUDE.md`, automatic load, or an explicit read step) to be decided at build time.
- relationship to existing files: it complements rather than replaces `docs/specs/project.md`, ADRs, and the Evolution Log — capturing the "why/what-to-remember" that those structured artifacts do not.

## 2026-06-15 — Electronic Program Guide (now/next + per-channel schedule)

**user input:** Add an Electronic Program Guide (EPG) showing what is on now and next per channel: a now/next line on each channel card plus an expandable per-channel schedule view. Source schedule data from the Xtream short-EPG endpoint (get_simple_data_table) through the existing CORS proxy on the Xtream path, and from an XMLTV guide via each M3U entry's tvg-id on the M3U path. Reuse the canonical Ch schema, the flat state machine, the sidebar/channel-grid layout, and the localStorage conventions; add no new playback engine — this is an added data-fetch and render surface only.

**assumptions:**
- origin: this entry originates from Phase 4 RESEARCH for evolution E18 — it is the scored winning next-feature candidate (demand 5, fit 4, differentiation 4, total 13/15), not a raw human idea; full report committed at `docs/research/E18-epg-program-guide.md`.
- "now and next": exactly two adjacent programmes — the currently-airing programme and the immediately-following one — derived from each programme's start/stop times against the current clock, not a longer N-up lookahead.
- "expandable per-channel schedule view": an inline expand/collapse panel on the channel card (or an adjacent detail surface) listing that single channel's upcoming programmes for the available window, reusing the existing sidebar/channel-grid layout rather than introducing a separate full-screen multi-channel grid.
- "Xtream short-EPG endpoint (get_simple_data_table)": fetched per channel via the same authenticated Xtream player_api path already used for streams, routed through the existing CORS proxy; base64-encoded title/description fields decoded on read.
- "XMLTV guide via tvg-id": the XMLTV source URL is taken from the M3U (e.g. `url-tvg`/`x-tvg-url` header or a user-provided guide URL), fetched once and parsed, with each M3U entry matched to its `<programme channel="...">` blocks by `tvg-id`; channels lacking a `tvg-id` simply show no EPG.
- "reuse the canonical Ch schema": EPG data attaches to / extends the existing `Ch` channel objects without forking the schema — left as a build-time decision whether via added optional fields on `Ch` or a parallel keyed-by-channel EPG store.
- caching/persistence: fetched EPG data is cached in memory and/or localStorage per the existing conventions to avoid refetching on every render; exact TTL and storage key left to build time.
- "no new playback engine": EPG is strictly a read-only data-fetch + render surface — it does not alter engine selection (hls.js / mpegts.js / TS→HLS remux), the player state machine, or playback behaviour.
