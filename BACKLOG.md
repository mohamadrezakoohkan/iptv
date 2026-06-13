# Backlog

## 2026-06-13 — Clearer, more helpful empty / no-signal state UI

**user input:** Improve the empty state / "no signal" user interface — make it clearer and more helpful to the user when there is no signal or no content to display.

**assumptions:**
- "empty state / no signal": treated as the existing in-app states where the player/grid has nothing to show — covers both no playable stream ("no signal") and no content/results to list (e.g. empty category, no search matches); these are existing UI states to improve, not a new feature.
- "Improve ... clearer and more helpful": refine the existing empty-state presentation (message copy, iconography, and guidance) rather than redesign the surrounding screens; the deliverable is better messaging and affordances within the current empty-state placeholders.
- "no signal": a stream that fails to load or produces no playable output, distinct from a content list being empty — both cases should be addressed but may warrant different copy/guidance.
- "no content to display": empty result/list states (empty category, no channels, no search results), shown where lists currently render nothing.
- "more helpful to the user": include actionable guidance (e.g. suggested next action / retry / how to find content) where appropriate — assumed in scope as part of "helpful", but the exact actions are left to spec/design since they depend on existing navigation affordances.
- target scope: this is a parked idea only; no decision on which screens ship first — left to the build run.

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
