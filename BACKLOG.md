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

## 2026-06-15 — In-player subtitle (CC) & multi-audio-track selector

**user input:** Add an in-player subtitle (closed-caption) and multi-audio-track selector to the existing E23 in-player controls layer, alongside the Fullscreen/PiP buttons and format chip on the shared dual-engine <video>. On the hls.js path enumerate the alternate tracks the engine already exposes (subtitleTracks via SUBTITLE_TRACKS_UPDATED + audioTracks/audioTrack) and let the user pick a subtitle track including an explicit Off and switch the audio rendition; on the native-HLS (Safari) path drive video.textTracks / video.audioTracks equivalently. Surface them as accessible, keyboard-focusable controls (menus/toggles) that are feature-detected and hidden when the current stream carries no alternate subtitle/audio tracks, degrading silently; keep the chrome consistent with the format chip and theme tokens. Client-only over the existing player — no new server route, no new playback engine, no new state-machine phase; applies uniformly to live, catch-up, and VOD via the single shared <video>. Demo mode must demonstrate the selector offline. (The E23 Phase-4 research winner.)

**assumptions:**
- origin: this entry is a Phase 4 RESEARCH winner from evolution E23 (score 13/15 — demand 4, fit 5, differentiation 4), not a raw human idea; the full report is committed at `docs/research/E23-subtitle-audio-track-selector.md`.
- "selector": two distinct accessible controls — a subtitle/CC menu (with an explicit Off entry) and an audio-track menu — rendered into the existing E23 in-player controls layer next to the Fullscreen/PiP buttons and format chip, styled with the shared theme tokens.
- "dual-engine <video>": the single shared `<video>` element driven by hls.js on engines that support MSE and by native HLS on Safari; the selector must read/write tracks on whichever engine is active for the current stream.
- "feature-detected and hidden": each menu is shown only when the active stream actually exposes alternate tracks of that kind; a single-track live channel shows no subtitle/audio menu at all, and any enumeration/switch failure degrades silently without logging.
- "applies uniformly to live, catch-up, and VOD": one implementation on the shared `<video>` serves all three playback modes — no per-mode branching, no new state-machine phase.
- "Demo mode must demonstrate the selector offline": the offline/demo path must surface a stream (or fixture) carrying alternate subtitle and audio tracks so the demo recording can show both menus operating without network access.
