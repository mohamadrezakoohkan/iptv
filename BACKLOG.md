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

**user input:** # IPTV Player — Spacing & Sizing Unification Pass

The UI works but paddings are inconsistent and edges don't align. Apply this
spacing contract everywhere. Do not eyeball values — every padding/gap/size
must come from this contract. Replace hardcoded values with tokens.

## Tokens
--s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 24px;
--gut: 24px;   /* content column gutter */
--sgut: 16px;  /* sidebar gutter */
--ctl: 36px;   /* the ONE control height */
--hd: 56px;    /* header height */
--r1: 6px;     /* control radius */
--r2: 8px;     /* card radius */

## Rules
1. **4px base grid.** Every padding, gap, and margin is 4/8/12/16/20/24px.
   No 10px, 11px, 14px-style one-offs.

2. **One gutter per column, applied to every block in it.**
   - Sidebar: 16px horizontal padding on header, search block, and category
     list — their left/right edges must align perfectly. Inner insets (text
     inside controls): 12px.
   - Content column: 24px horizontal padding on header, player wrapper,
     channel grid, and footer — all vertical edges line up. (16px on mobile.)

3. **One control height: 36px** — search field, category rows, text inputs,
   buttons. Secondary controls (format chips; the number/logo/star row inside
   channel cards): 28px. Favourite star gets a real 28×28 hit box, not a bare
   glyph.

4. **Two radii only:** 6px for controls (inputs, buttons, chips, rows),
   8px for cards and the player. Small badges/counts: 4px.

5. **Both column headers are exactly 56px** with horizontal padding equal to
   their column's gutter, so their bottom borders form one continuous line
   across sidebar and content.

6. **Vertical rhythm in the content column:** player wrapper padding
   24px 24px 0; grid section-bar padding 20px 0 12px; grid gap 12px;
   card padding 12px; footer padding 16px 24px.

7. **Category list:** flex column with gap 2px; rows 36px with 12px inner
   padding; count badges min-width 26px, padding 3px 5px, tabular numerals.

8. **Footer form:** flex row, align-items flex-end, gap 12px; labels mono
   10px uppercase with 4px gap to a 36px input; button same 36px so
   everything sits on one baseline.

9. Numbers everywhere (channel numbers, counts) use the mono font with
   font-variant-numeric: tabular-nums.

10. Focus: a single global `:focus-visible { outline: 2px solid var(--acc);
    outline-offset: 1px; }` — no per-component focus styles.

Acceptance check: zoom out and draw vertical lines at the column gutters —
every block edge in a column must sit on its line; all interactive controls
in a row must share the same height and baseline.

**assumptions:**
- "everywhere" / scope: applies to the existing IPTV player UI only (sidebar, content column header, player wrapper, channel grid/cards, footer) — a styling refactor of current surfaces, not new screens or features.
- "Apply this spacing contract": the named tokens and the ten rules are taken verbatim as the authoritative contract; the build implements them exactly as written rather than re-deriving values.
- "Replace hardcoded values with tokens": existing CSS literals for padding/gap/size/radius/height are replaced with `var(--token)` references defined once; this is a CSS-level change with no functional/behavioral changes.
- "--acc" (accent color in the focus rule): assumed to be an already-defined accent CSS variable in the current theme — reused, not introduced by this pass.
- mono font (rules 8, 9): assumed to be the project's already-loaded monospace font stack — reused, not a new font dependency.
- "on mobile" (rule 2, 16px content gutter): assumed to hinge on the project's existing responsive breakpoint; the exact px threshold is left to spec/design since the idea doesn't state one — this could change layout behavior and is not invented here.
- the listed token deltas (badge padding 3px 5px, count badge min-width 26px) sit alongside the 4px-grid rule; treated as deliberate exceptions stated in the contract and applied as written, not snapped to the grid.
- "the player": the existing video/stream player wrapper element in the content column; radius 8px (card radius) per rule 4.
- acceptance check: a verification/review criterion (edge alignment + shared control baseline), not a deliverable artifact to build.
