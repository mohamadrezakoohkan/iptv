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

## 2026-06-15 — VOD (Movies & Series) library on the Xtream path

**user input:** Add a VOD (Movies & Series) library on the Xtream path: after connect, fetch VOD movie categories/streams (get_vod_categories / get_vod_streams) and TV series (get_series, then series-info seasons/episodes) best-effort through the existing /api/xtream CORS proxy, normalize each into a canonical on-demand item schema mirroring mkXtCh, and present them in the existing sidebar/category + channel-grid browse UX behind a Live | Movies | Series content toggle (with posters/title from the VOD payload). Selecting a movie or a series episode builds the Xtream on-demand stream URL (/movie/<user>/<pass>/<id>.<ext> for movies, /series/<user>/<pass>/<id>.<ext> for episodes, extension preserved so getEng resolves the same engine) and plays it through the EXISTING dual-engine player and select+play path a live channel uses — no new playback engine, no new state-machine phase, no new server route, no new localStorage key required for playback. The M3U and demo paths show no VOD/Series surface and degrade silently (the demo path may synthesize one offline-playable VOD entry purely so the feature is demonstrable without live network, mirroring the catch-up demo synthesis).

**assumptions:**
- origin: this entry is the Phase 4 RESEARCH winning feature for evolution E21 (score 14/15 — demand 5, fit 5, differentiation 4), not a raw human idea; full report committed at `docs/research/E21-vod-movies-series-library.md`.
- "VOD (Movies & Series) library": a single on-demand content surface covering both movie VOD streams and multi-season TV series (with seasons/episodes), not movies-only or series-only.
- "on the Xtream path": VOD/Series fetch and surface apply only when connected via Xtream credentials; M3U and demo connection paths expose no VOD/Series toggle and degrade silently.
- "best-effort through the existing /api/xtream CORS proxy": VOD/series fetches reuse the existing proxy with no new server route; partial or failed VOD/series fetches do not break the Live surface — missing content is simply absent rather than fatal.
- "canonical on-demand item schema mirroring mkXtCh": on-demand items are normalized into the same canonical Ch-shaped schema live channels use (extended with poster/title/series-episode metadata), reusing the existing grid/category render and select+play path rather than a parallel schema.
- "content toggle (Live | Movies | Series)": a three-way browse-mode toggle layered over the existing sidebar/category + channel-grid UX, switching which normalized item set is browsed; not three separate pages or routes.
- "extension preserved so getEng resolves the same engine": the on-demand stream URL keeps the payload-provided container extension so the existing dual-engine engine resolution picks the correct engine with no engine changes.
- "no new ... no new localStorage key required for playback": playback itself introduces no new persisted state; any browse/toggle state persistence (if needed) is out of scope for the playback path and left to build-time decision.
- "demo path may synthesize one offline-playable VOD entry": the demo path optionally fabricates a single offline-playable VOD item solely for demonstrability without live network, mirroring the existing catch-up demo synthesis — this is an allowance, not a requirement.
