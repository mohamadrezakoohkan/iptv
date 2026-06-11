---
id: FAIL-0001
date: 2026-06-11
evolution: 2
phase: validate
related: [TASK-0013, ADR-0005]
---

# FAIL-0001 — Unit tests asserted setAttribute('required') on inputs that never had the attribute

## Symptom

TASK-0013 validate attempt 2 failed with 3 unit errors:

```
updM3u — non-M3U input > empty URL: restores required on username input
  — expected setAttribute to be called with ('required', '') but was never called (0 calls)
updM3u — non-M3U input > empty URL: restores required on password input
  — expected setAttribute to be called with ('required', '') but was never called (0 calls)
updM3u — non-M3U input > demo keyword: restores required on username input
  — expected setAttribute to be called with ('required', '') but was never called (0 calls)
```

## Root cause

The `#f-user` and `#f-pass` inputs in `index.html` never carried a `required` attribute. The implement-agent wrote unit tests that asserted `setAttribute('required', '')` would be called when exiting M3U mode ("restoring" an attribute that was never there). The correct implementation calls `removeAttribute('required')` in both branches — a no-op when absent. The unit test assertions were wrong, not the production code.

## Attempts

1. **Attempt 1** — implement-agent wrote `updM3u` with `setAttribute('required')` in the else-branch. UI tests failed: demo form blocked by browser native validation on empty required fields.
2. **Attempt 2** — orchestrator directed fix: change else-branch to `removeAttribute`. Unit tests started failing because they asserted `setAttribute`. UI tests passed.
3. **Attempt 3** — orchestrator directed fix: update unit tests to assert `removeAttribute` (correct behavior). All 205 unit + 66 UI tests passed.

## Rule earned

> **R-0001:** Before writing unit tests that assert DOM attribute mutations (`setAttribute` / `removeAttribute`), check the baseline HTML to confirm which attributes are actually present on the element — never assert that an attribute is added back if it was never in the source HTML.
