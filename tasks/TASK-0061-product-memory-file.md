---
id: TASK-0061
adr: ADR-0029
evolution: 18
status: pending
attempts: 0
depends_on: []
---

# TASK-0061 — Create `docs/MEMORY.md` durable product-project memory + product-side reference

## Goal

When this task is done, `docs/MEMORY.md` exists as the product project's durable
memory file — a Markdown document with a self-describing header, an explicit
boundary section, and topical entries seeded with the durable, code-non-derivable
facts already known to be true. `docs/specs/project.md` already points to it (the
Product memory section added in Phase 1 stays), and a unit test enforces the file
contract so the memory file cannot silently become empty or malformed. None of
the harness-owned files (`CLAUDE.md`, `CORE_FLOW.md`) are touched.

## Acceptance criteria

- [ ] `docs/MEMORY.md` exists at the `docs/` root with an uppercase filename.
- [ ] It is a non-empty Markdown document whose first heading is a top-level
      `# ` heading naming it as the product project's memory.
- [ ] Its header states, in prose, that it is durable product-project memory that
      contributors (human or AI) should consult when working on the product.
- [ ] It contains an explicit boundary section distinguishing what belongs in
      memory from what belongs in `docs/specs/`, `docs/adrs/`, `README.md`,
      `CHANGELOG.md`, and `docs/notes/`.
- [ ] It is seeded with at least one concrete durable, code-non-derivable fact
      (e.g. the product codename / Fly.io deployment app name) — not an empty
      placeholder.
- [ ] `docs/specs/project.md` contains a Product memory pointer to
      `docs/MEMORY.md` (added in Phase 1; this task must not remove it).
- [ ] No change is made to `CLAUDE.md` or `CORE_FLOW.md`.
- [ ] The full unit suite (`npx vitest run`) and UI suite (`npx playwright test`)
      pass — i.e. nothing in the run regresses existing behaviour.

## Test requirements

- **Unit:** add `src/tests/unit/memory.test.js` (Vitest) carrying an
  `// ADR: ADR-0029` comment. It must, by reading the files from disk:
  1. assert `docs/MEMORY.md` exists and is non-empty;
  2. assert it begins with a top-level `# ` Markdown heading;
  3. assert its content references the boundary artifacts (it mentions specs,
     ADRs, README, and CHANGELOG so the boundary section is present);
  4. assert it contains the seeded durable fact (the product codename `teeatr`);
  5. assert `docs/specs/project.md` references `docs/MEMORY.md` (the product-side
     pointer is present).
  Resolve the repo root from the test file location the same way the existing
  doc-reading unit tests in `src/tests/unit/` do; do not hardcode an absolute
  path. Per Rule R-0001 this task asserts no DOM attribute mutations, so that
  rule does not apply here.
- **UI:** n/a — not user-facing. This run adds no interactive product behaviour;
  `docs/MEMORY.md` is documentation. The UI suite is still run as the regression
  gate but no new UI test is added.
- **Integration:** n/a — no external connectivity, API calls, or proxy behaviour.

## Implementation notes

_Filled by implement-agent: files touched, anything non-obvious for reviewers
or future tasks._

- Seed the durable facts from what is already known to be true and not derivable
  from the repo's code: the product codename is `teeatr` (its Fly.io deployment
  app name — a fact not present in the source tree, exactly the kind of
  code-non-derivable memory this file exists to hold), and the product/UI name is
  "IPTV Broadcast Console". Keep entries durable and de-duplicated against
  specs/ADRs. There is no `fly.toml` in the repo, so this codename is genuinely
  not recoverable from the source — record it here so it is not re-lost.
- Do NOT edit `README.md` here — its pointer to `docs/MEMORY.md` is review-agent's
  responsibility at REVIEW (per ADR-0029).
