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

## 2026-06-15 — Program reminders on EPG entries

**user input:** Add program reminders on top of the EPG: a keyboard-focusable "Remind" toggle on each row of the expandable per-channel schedule (and on the NOW/NEXT line) lets the user mark an upcoming program; reminders persist in a new localStorage-keyed store (mirroring the favourites pattern, no new state-machine phase, no new playback engine, no new server route) and read the in-memory IptvEpg Prg store/now-next selectors. A lightweight client timer checks pending reminders against program start times and, when one fires, surfaces an in-app toast plus a best-effort, permission-gated browser Notification so the user can jump to that channel; reminders can be cleared individually, and the toggle reflects state with aria-pressed. Reuse the canonical Prg schema, the existing schedule-row render, localStorage conventions, and the existing toast/log UI posture; degrade silently when no guide is loaded or notifications are denied.

**assumptions:**
- origin: this is the Phase 4 RESEARCH winning feature for evolution E19 — score 14/15 (demand 5, fit 5, differentiation 4), beating parental-control PIN-lock (11/15) and recently-watched/continue-watching (11/15); full report committed at `docs/research/E19-epg-program-reminders.md`.
- "new localStorage-keyed store (mirroring the favourites pattern)": a single new localStorage key holding the set of pending reminders (keyed by program identity from the canonical `Prg` schema), separate from the favourites key, read/written via the same persistence helpers/conventions favourites already use — not a reuse of the favourites key itself.
- "program start times" + "lightweight client timer": a single periodic poll (e.g. an interval, not one timer per reminder) that compares `Date.now()` against each pending reminder's `Prg` start time and fires when start time is reached or just passed, so reminders set while the tab was closed still fire on next load if still relevant.
- "best-effort, permission-gated browser Notification": the in-app toast is always shown on fire; the browser Notification is attempted only when `Notification.permission === 'granted'`, permission is requested via a user-gesture-triggered prompt (e.g. when first toggling a reminder), and a denied/unsupported state degrades silently to toast-only.
- "jump to that channel": firing a reminder lets the user navigate to and play the program's channel (via the toast action and/or the Notification click), reusing the existing channel-select/play path — no new playback engine or route.
- "cleared individually": each reminder can be removed on its own (re-toggling the row's "Remind" control or dismissing it), with no requirement for a bulk clear-all in this scope.
- "degrade silently when no guide is loaded": when the `IptvEpg`/`Prg` store is empty the Remind toggles are absent or inert and the timer is a no-op — no errors, no UI surfaced.
