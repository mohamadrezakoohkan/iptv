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

## 2026-06-15 — Catch-up/archive (timeshift) playback on the EPG

**user input:** Add catch-up (archive/timeshift) playback on top of the EPG: detect per-channel archive support from the Xtream source (the channel's tv_archive / tv_archive_duration, surfaced via the existing EPG/short-EPG fetch path) and, for archive-capable channels, render a keyboard-focusable 'Replay' affordance on each PAST schedule row of the expandable per-channel guide; activating it builds the Xtream timeshift archive URL for that program (start + duration) and plays it through the existing CORS proxy and dual-engine player (HLS via hls.js / TS via mpegts.js, same engine resolution as live) by reusing the existing select+play path; past rows on channels without archive — and the whole feature on the M3U/demo paths — show no Replay affordance and degrade silently; reuse the canonical Ch/Prg schema, the existing /api/xtream proxy, the EPG schedule render (mkSchedRow), and the existing play transition; add NO new playback engine, NO new state-machine phase, and NO new server route.

**assumptions:**
- origin: this entry originates from the Phase 4 RESEARCH winner for evolution E20 — score 15/15 (demand 5, fit 5, differentiation 5); full report committed at `docs/research/E20-catch-up-archive-playback.md`.
- "catch-up (archive/timeshift)": replaying programs that already aired (PAST rows) using the channel's server-advertised archive window — not live-rewind/pause-buffer of the currently playing stream and not seeking within the live edge.
- "archive support detection": read from the channel's `tv_archive` (capability flag) and `tv_archive_duration` (window length, days) surfaced by the existing EPG/short-EPG fetch path; a channel is archive-capable when `tv_archive` is truthy, and only programs whose start falls inside the `tv_archive_duration` window are replayable.
- "'Replay' affordance": a per-row interactive control on each PAST schedule row, keyboard-focusable in the existing tab/focus order, rendered through the existing `mkSchedRow` path rather than a new render surface.
- "Xtream timeshift archive URL": the standard Xtream timeshift/archive URL form (base + stream id + program start + duration in minutes), played through the existing `/api/xtream` CORS proxy.
- "dual-engine player / same engine resolution as live": the archive stream reuses the existing select+play path and the existing HLS (hls.js) / TS (mpegts.js) engine-resolution logic — no new engine, no new state-machine phase, no new server route.
- "degrade silently": PAST rows on non-archive channels, now/future rows, and the entire M3U/demo paths render with no Replay affordance and no error/empty state — the feature is simply absent there.
- scope: Xtream source path only; additive on top of the E19 EPG + E20 reminders surface, reusing the canonical Ch/Prg schema and existing artifacts.
