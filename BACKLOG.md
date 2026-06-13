# Backlog

## 2026-06-13 — Reorganize repo into harness/ and src/ top-level folders

**user input:** move harness files and folders to harness/ folder where adrs specs and generated product and project docs can be found and src/ folder where actual coded project will be found

**assumptions:**
- "harness files and folders": the orchestration-process artifacts and the documentation/decision artifacts they produce — `CORE_FLOW.md`, `CLAUDE.md`, `.claude/` (agents, skills, hooks, settings), plus `specs/`, `adrs/`, `tasks/`, `failures/`, `BACKLOG.md`, `CHANGELOG.md`, and `README.md`; assumed to be consolidated under a top-level `harness/` folder.
- "adrs specs and generated product and project docs": the existing `adrs/`, `specs/` (including `specs/project.md`), and any generated product/project documentation (e.g. `README.md`, `CHANGELOG.md`) move under `harness/`; treated as relocation of existing artifacts, not authoring new docs.
- "src/ folder where actual coded project will be found": all runtime/application source and its tests move under a top-level `src/` folder; assumed this is purely a relocation of existing code, leaving behavior unchanged.
- "move": a structural relocation that updates every path reference (build/test commands in `specs/project.md`, ADR `governs:` paths, agent and skill instructions, settings deny-rules, CI workflow paths) so the harness and tooling keep working after the move — not a raw `git mv` that breaks references.
- scope/ownership: this restructure spans both harness-owned files (routed via coreflow-agent) and product-owned files (the pipeline), so the build run will need to coordinate both; left to the run to sequence — this is a parked idea only.
- ".claude/ location": left open whether `.claude/` (tool-specific config Claude Code expects at repo root) physically moves under `harness/` or stays at root with only the docs/process artifacts relocated, since moving it may break tool discovery — flagged for the build run to decide.

## 2026-06-13 — Spacing & sizing unification pass (4px-grid token contract)

**user input:** Spacing & sizing unification pass for the IPTV player UI: replace all eyeballed/hardcoded paddings, gaps, sizes, and radii with a single 4px-grid token contract so every block edge and control baseline aligns.

Token contract — `--s1..--s6` = 4/8/12/16/20/24px; `--gut` 24px (content gutter), `--sgut` 16px (sidebar gutter); `--ctl` 36px (the one control height); `--hd` 56px (header height); `--r1` 6px (control radius), `--r2` 8px (card radius).

Ten rules (intent): (1) everything snaps to the 4px grid — no 10/11/14px one-offs. (2) one horizontal gutter per column applied to every block in it — sidebar 16px (12px inner insets), content 24px (16px on mobile) — so column edges align. (3) one 36px control height for primary controls; 28px for secondary controls (format chips, the card number/logo/star row) with a real 28×28 star hit box. (4) two radii only — 6px controls, 8px cards/player; 4px small badges. (5) both column headers exactly 56px, padded to their column gutter, so bottom borders form one line. (6) content-column vertical rhythm — player wrapper `24px 24px 0`, grid section-bar `20px 0 12px`, grid gap 12px, card padding 12px, footer `16px 24px`. (7) category list flex column, gap 2px, 36px rows, 12px inner padding, count badges min-width 26px / padding `3px 5px` / tabular nums. (8) footer form flex row, align-items flex-end, gap 12px, mono 10px uppercase labels with 4px gap to a 36px input, button same 36px on one baseline. (9) all numbers use the mono font with `font-variant-numeric: tabular-nums`. (10) one global `:focus-visible { outline: 2px solid var(--acc); outline-offset: 1px }` — no per-component focus.

Acceptance: vertical gutter lines catch every block edge; controls in a row share height and baseline.

**assumptions:**
- scope: a CSS-level restyle of the existing IPTV player surfaces (sidebar, content header, player wrapper, channel grid/cards, footer) — no new screens, features, or behavioral changes.
- `--acc` and the mono font (rules 8–10): reused from the project's existing theme — already-defined accent variable and already-loaded monospace stack, not introduced here.
- "16px on mobile" (rule 2): hinges on the project's existing responsive breakpoint; the exact px threshold is left to spec/design since the idea names none — not invented here.
- off-grid values in the contract (count badge min-width 26px, badge padding `3px 5px`): treated as deliberate stated exceptions to the 4px grid, applied as written rather than snapped.

## 2026-06-13 — HLS/TS format chips that appear on top instead of dead nav buttons

**user input:** HLS and TS are buttons in top navigation bar but upon click nothing happens, change this behavior make them a chip that will be added on top not something always there

**assumptions:**
- "HLS and TS": the two stream-format controls currently rendered as buttons in the top navigation bar; HLS = HTTP Live Streaming, TS = MPEG transport stream — the playable formats the player already understands.
- "buttons ... upon click nothing happens": these are existing controls that today are non-functional (no-op on click) — this is a fix-plus-rework of existing UI, not a brand-new feature.
- "change this behavior ... make them a chip that will be added on top": replace the always-present nav buttons with a chip affordance that is added/shown contextually at the top of the content area (e.g. only when a relevant format applies or is active), rather than persistent buttons that are always rendered.
- "a chip that will be added on top": "on top" means at the top of the main content/player region (a transient/contextual chip), not a persistent toolbar element — exact placement and trigger left to spec/design since the idea does not pin it down.
- chip behavior on click: assumed the chip should actually do something meaningful (e.g. indicate or switch the active stream format) rather than reproduce the current no-op — the idea's complaint is that clicking does nothing, so the chip is expected to be functional; the precise action is left to the build run.
- scope: a UI behavior change to the existing top navigation / player surface only — no new streaming backend or format support added beyond what HLS/TS already represent.
