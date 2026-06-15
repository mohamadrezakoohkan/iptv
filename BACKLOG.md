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

## 2026-06-15 — In-player controls: fullscreen, Picture-in-Picture, and keyboard shortcuts

**user input:** Add an in-player controls layer over the existing dual-engine <video> player: a Fullscreen toggle (native Fullscreen API), a Picture-in-Picture toggle (native HTMLVideoElement.requestPictureInPicture, feature-detected and hidden where unsupported e.g. iOS Safari), and keyboard shortcuts active only while a stream is playing — F = toggle fullscreen, P = toggle PiP, Space/K = play-pause, M = mute, ArrowUp/ArrowDown = volume — surfaced as accessible, keyboard-focusable controls on the player chrome alongside the existing format chip. Drive the already-resolved <video> element directly; reuse it for live, catch-up, and VOD playback alike since they share one player. Add no new server route, no new playback engine, no new state-machine phase, and no new playback localStorage key (a single client-wide volume/mute preference may persist, mirroring the theme/sort pattern). Degrade silently where the browser lacks Fullscreen or PiP; demo mode (which already plays a stream) must demonstrate the controls offline.

**assumptions:**
- origin: this entry originates from the Phase 4 RESEARCH winner for evolution E22 — score 13/15 (demand 5, fit 5, differentiation 3), beating continue-watching/resume-position (12/15) and a subtitle & multi-audio-track selector (12/15); full report committed at `docs/research/E22-in-player-fullscreen-pip-keyboard-controls.md`.
- "controls layer ... on the player chrome": a thin client-only overlay of focusable buttons rendered on the existing player surface beside the format chip — not a full replacement of the native controls bar nor a new component tree, mirroring how the format chip / EPG / Replay affordances were added additively.
- "feature-detected and hidden where unsupported": the PiP toggle is conditionally rendered (absent, not merely disabled) when `document.pictureInPictureEnabled` / `requestPictureInPicture` is unavailable, matching the product's contextual-presence pattern (tabs/affordances appear only when applicable).
- "keyboard shortcuts active only while a stream is playing": handlers are bound to the active-playback state and do not intercept keys while the user is in inputs/search or when no stream is loaded — global typing and existing shortcuts are unaffected.
- "a single client-wide volume/mute preference may persist": at most one new localStorage key holding volume + mute, applied across all playback (live/catch-up/VOD), following the existing theme/sort persistence pattern — and no per-stream or per-item playback persistence.
- "degrade silently": where the browser lacks Fullscreen or PiP, the corresponding control is absent/no-op with no error surfaced to the user or the failure log.
- "demo mode must demonstrate the controls offline": the offline demo stream is sufficient to exercise fullscreen, play-pause, mute, and volume shortcuts; PiP may legitimately be absent in environments that do not support it.
