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
