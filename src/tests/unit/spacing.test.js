// ADR: ADR-0024
// Unit tests — the 4px-grid spacing/sizing/radius token contract is declared
// once on :root in client/app.css (TASK-0047), with the exact contracted px
// values, and is NOT re-declared inside the :root[data-theme="light"] block
// (geometry is theme-agnostic). Source-string assertions mirror the
// app.css coverage in tests/unit/theme.test.js.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CSS_SRC    = join(__dir, '../../client/app.css');

// The twelve declared tokens of the contract → their contracted px values.
const TOKENS = {
  '--s1': '4px',
  '--s2': '8px',
  '--s3': '12px',
  '--s4': '16px',
  '--s5': '20px',
  '--s6': '24px',
  '--gut': '24px',
  '--sgut': '16px',
  '--ctl': '36px',
  '--hd': '56px',
  '--r1': '6px',
  '--r2': '8px',
};

/** Returns the body of the first plain `:root { ... }` rule (not the
 *  attribute-qualified light rule). */
function rootBody(css) {
  const m = css.match(/:root\s*\{([\s\S]*?)\}/);
  expect(m).not.toBeNull();
  return m[1];
}

/** Returns the body of the `:root[data-theme="light"] { ... }` rule. */
function lightBody(css) {
  const m = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
  expect(m).not.toBeNull();
  return m[1];
}

describe('app.css — 4px-grid token contract on :root (ADR-0024)', function () {
  let css, root;
  beforeEach(function () {
    css  = readFileSync(CSS_SRC, 'utf8');
    root = rootBody(css);
  });

  Object.keys(TOKENS).forEach(function chk(tok) {
    const val = TOKENS[tok];
    it('declares ' + tok + ': ' + val + ' on :root', function () {
      const re = new RegExp(tok.replace(/[-]/g, '\\$&') + '\\s*:\\s*' + val.replace('px', 'px') + '\\s*;');
      expect(re.test(root)).toBe(true);
    });
  });

  it('all twelve tokens are present on :root', function () {
    Object.keys(TOKENS).forEach(function tok(t) {
      expect(root).toContain(t + ':');
    });
  });

  it('app.css carries ADR-0024 on its ADR comment line', function () {
    expect(css).toMatch(/ADR:[^\n]*ADR-0024/);
  });
});

describe('app.css — geometry tokens are NOT in the light theme block', function () {
  let light;
  beforeEach(function () {
    light = lightBody(readFileSync(CSS_SRC, 'utf8'));
  });

  Object.keys(TOKENS).forEach(function chk(tok) {
    it('does not re-declare ' + tok + ' inside [data-theme="light"]', function () {
      expect(light).not.toContain(tok + ':');
    });
  });
});

describe('app.css — existing colour/font tokens are unchanged', function () {
  let css, root;
  beforeEach(function () {
    css  = readFileSync(CSS_SRC, 'utf8');
    root = rootBody(css);
  });

  it('keeps all eight colour tokens on :root', function () {
    ['--bg', '--sur', '--sur2', '--ln', '--tx', '--dim', '--acc', '--live'].forEach(function tok(t) {
      expect(root).toContain(t + ':');
    });
  });

  it('keeps the dark --bg value (#0E1216)', function () {
    expect(root).toMatch(/--bg:\s*#0E1216/);
  });

  it('keeps both font tokens', function () {
    expect(root).toContain('--font-ui:');
    expect(root).toContain('--font-mono:');
  });
});
