// ADR: ADR-0029
// Unit tests — the durable product-project memory file contract (TASK-0061).
// These assertions read the files from disk so the durable facts are enforced
// to live in docs/MEMORY.md itself (and the product-side pointer in
// docs/specs/project.md), never inside the source tree. The repo root is
// resolved from this test file's location, matching the path-resolution style
// of the other file-reading unit tests in src/tests/unit/.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const ROOT       = join(__dir, '../../..');           // repo root from src/tests/unit/
const MEM_SRC    = join(ROOT, 'docs/MEMORY.md');
const PROJ_SRC   = join(ROOT, 'docs/specs/project.md');

describe('docs/MEMORY.md — durable product-project memory file', () => {
  let mem;

  beforeAll(() => {
    mem = readFileSync(MEM_SRC, 'utf8');
  });

  it('exists and is non-empty', () => {
    expect(mem.trim().length).toBeGreaterThan(0);
  });

  it('begins with a top-level Markdown heading', () => {
    const first = mem.trimStart().split('\n', 1)[0];
    expect(first).toMatch(/^# \S/);
  });

  it('references the boundary artifacts (specs, ADRs, README, CHANGELOG)', () => {
    expect(mem).toContain('docs/specs/');
    expect(mem).toContain('docs/adrs/');
    expect(mem).toContain('README.md');
    expect(mem).toContain('CHANGELOG.md');
  });

  it('contains the seeded durable fact (the product codename `teeatr`)', () => {
    expect(mem).toContain('teeatr');
  });
});

describe('docs/specs/project.md — product-side memory pointer', () => {
  it('references docs/MEMORY.md', () => {
    const proj = readFileSync(PROJ_SRC, 'utf8');
    expect(proj).toContain('docs/MEMORY.md');
  });
});
