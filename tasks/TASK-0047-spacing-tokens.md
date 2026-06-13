---
id: TASK-0047
adr: ADR-0024
evolution: 14
status: done
attempts: 0
depends_on: []
---

# TASK-0047 — Declare the 4px-grid spacing/sizing/radius token contract

## Goal

`client/app.css` declares, once on `:root` (alongside the existing colour/font
tokens from ADR-0019), the twelve spacing/sizing/radius custom properties of the
contract. They are geometry, so they live on `:root` only and are **not**
re-declared in the `:root[data-theme="light"]` block. After this task the tokens
exist and resolve to the contracted px values; the rule rewrites in TASK-0048..
0050 consume them. No visual change is required by this task alone (it only adds
declarations), but the page must still render and all existing suites stay green.

## Acceptance criteria

- [ ] `:root` in `client/app.css` declares: `--s1:4px`, `--s2:8px`, `--s3:12px`,
      `--s4:16px`, `--s5:20px`, `--s6:24px`, `--gut:24px`, `--sgut:16px`,
      `--ctl:36px`, `--hd:56px`, `--r1:6px`, `--r2:8px`.
- [ ] None of these tokens is re-declared inside `:root[data-theme="light"]`
      (geometry is theme-agnostic).
- [ ] Each token resolves to its contracted px value in the running page
      (verifiable via `getComputedStyle(document.documentElement).getPropertyValue`).
- [ ] The existing colour/font tokens (`--bg`…`--live`, `--acc`, `--font-ui`,
      `--font-mono`) are unchanged and still present.
- [ ] `client/app.css` carries `ADR: ADR-0024` on its ADR comment line.

## Test requirements

- **Unit:** a CSS-source assertion (e.g. extend the existing CSS unit coverage,
  or a small new check) that `client/app.css` contains the twelve token
  declarations on `:root` with their exact values, and that none appears in the
  `[data-theme="light"]` block.
- **UI:** a Playwright check that `getComputedStyle(document.documentElement)`
  returns the contracted value for each of the twelve tokens (`--s1`=4px …
  `--r2`=8px), and that switching to the light theme leaves every geometry token
  unchanged. Page-renders-without-error smoke stays green.
- **Integration:** n/a — no external connectivity.

## Implementation notes

- `client/app.css`: added the twelve 4px-grid tokens (`--s1`..`--s6`, `--gut`,
  `--sgut`, `--ctl`, `--hd`, `--r1`, `--r2`) to the existing `:root` block,
  directly below the colour/font tokens, with their contracted px values. They
  are declared once on `:root` only and are **not** added to the
  `:root[data-theme="light"]` block (geometry is theme-agnostic). Appended
  `ADR-0024` to the file's top ADR comment line. No existing rule was rewired —
  TASK-0048..0050 consume the tokens; this task only declares them, so there is
  no visual change.
- `tests/unit/spacing.test.js` (new): CSS-source assertions — each of the twelve
  tokens is declared on `:root` with its exact value; none appears in the
  `[data-theme="light"]` block; the eight colour tokens, `--bg: #0E1216`, and
  both font tokens remain; the ADR comment carries `ADR-0024`. Mirrors the
  `app.css` coverage style in `tests/unit/theme.test.js`.
- `tests/ui/spacing.test.js` (new): Playwright — `getComputedStyle(
  document.documentElement)` returns each contracted px value in the running
  page; switching `data-theme="light"` leaves every geometry token unchanged;
  app-shell smoke (no pageerror) stays green.
- ADR-0024 `governs:` trued up to add the two new test files. `index.html` was
  left untouched (no markup geometry needed changing for token declaration), so
  it remains in `governs:` for the later consuming tasks per the ADR's own note.
- No JS touched; no new top-level browser globals introduced (CSS-only +
  test-local helpers). No new dependencies.
