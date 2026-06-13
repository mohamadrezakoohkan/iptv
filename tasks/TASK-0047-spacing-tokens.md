---
id: TASK-0047
adr: ADR-0024
evolution: 14
status: pending
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

_Filled by implement-agent._
