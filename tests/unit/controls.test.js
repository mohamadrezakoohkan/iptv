// ADR: ADR-0024
// Unit tests — control heights, category list, footer baseline, one global
// focus ring (TASK-0050, spacing-sizing.md rules 3 + 7 + 8 + 10). CSS-source
// assertions that the rewired rules in client/app.css read TASK-0047's tokens:
// primary controls (.field input / .btn / .login-mode) are var(--ctl) (36px);
// secondary controls (.fmt-chip / .ch-sort / .ch-fav) are 28px
// (calc(var(--s6) + var(--s1))) with a real 28x28 .ch-fav hit box; the sidebar
// category list is a flex column with gap 2px and var(--ctl) rows; .cat-count
// carries the verbatim off-grid 26px min-width + 3px 5px padding; the footer
// form is flex / align-items: flex-end / gap var(--s3); and exactly one global
// :focus-visible outline rule exists with every listed per-component
// :focus-visible outline rule removed.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CSS_SRC    = join(__dir, '../../client/app.css');

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Declaration body of the FIRST rule whose selector is exactly `sel` in file
 *  order — the desktop (top-level) rule, before any breakpoint override. */
function ruleBody(css, sel) {
  const re = new RegExp(
    '(?:^|\\}|,|\\*/|\\n)\\s*' + esc(sel) + '\\s*\\{([^}]*)\\}', 'g'
  );
  const m = re.exec(css);
  expect(m, 'rule for ' + sel).not.toBeNull();
  return m[1];
}

// 28px secondary-control height, expressed as the contracted token calc.
const SEC = /calc\(var\(--s6\)\s*\+\s*var\(--s1\)\)/;

describe('app.css — primary controls are --ctl (36px) (rule 3)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.field input', '.btn', '.login-mode'].forEach(function chk(sel) {
    it(sel + ' height reads var(--ctl)', function () {
      expect(ruleBody(css, sel)).toMatch(/height:\s*var\(--ctl\)/);
    });
  });
});

describe('app.css — secondary controls are 28px (rule 3)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.fmt-chip', '.ch-sort'].forEach(function chk(sel) {
    it(sel + ' height is calc(var(--s6) + var(--s1)) (28px)', function () {
      expect(ruleBody(css, sel)).toMatch(new RegExp('height:\\s*' + SEC.source));
    });
  });

  it('.ch-fav is a real 28x28 hit box (calc(--s6 + --s1) wide and tall)', function () {
    const b = ruleBody(css, '.ch-fav');
    expect(b).toMatch(new RegExp('width:\\s*' + SEC.source));
    expect(b).toMatch(new RegExp('height:\\s*' + SEC.source));
  });
});

describe('app.css — category list is a flex column (rule 7)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('.sidebar-list is display: flex; flex-direction: column; gap: 2px', function () {
    const b = ruleBody(css, '.sidebar-list');
    expect(b).toMatch(/display:\s*flex/);
    expect(b).toMatch(/flex-direction:\s*column/);
    expect(b).toMatch(/gap:\s*2px/);
  });

  it('.sidebar-list keeps the --sgut horizontal gutter', function () {
    expect(ruleBody(css, '.sidebar-list')).toContain('var(--sgut)');
  });

  it('.cat-btn height reads var(--ctl) (36px rows)', function () {
    expect(ruleBody(css, '.cat-btn')).toMatch(/height:\s*var\(--ctl\)/);
  });

  it('.cat-btn keeps the --s3 inner inset', function () {
    expect(ruleBody(css, '.cat-btn')).toContain('var(--s3)');
  });

  it('.cat-count uses the verbatim off-grid exceptions (min-width 26px, padding 3px 5px)', function () {
    const b = ruleBody(css, '.cat-count');
    expect(b).toMatch(/min-width:\s*26px/);
    expect(b).toMatch(/padding:\s*3px 5px/);
    expect(b).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it('the existing max-width: 760px horizontal-strip rule is preserved', function () {
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)/);
    // the mobile .sidebar-list flips to a row strip
    expect(css).toMatch(/\.sidebar-list\s*\{[^}]*flex-direction:\s*row/);
  });
});

describe('app.css — footer form is one flex-end baseline (rule 8)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('.footer-form is flex, align-items: flex-end, gap var(--s3)', function () {
    const b = ruleBody(css, '.footer-form');
    expect(b).toMatch(/display:\s*flex/);
    expect(b).toMatch(/align-items:\s*flex-end/);
    expect(b).toMatch(/gap:\s*var\(--s3\)/);
  });

  it('.field stacks a mono 10px label with a var(--s1) gap to its input', function () {
    expect(ruleBody(css, '.field')).toMatch(/gap:\s*var\(--s1\)/);
    const lbl = ruleBody(css, '.field label');
    expect(lbl).toContain('var(--font-mono)');
    expect(lbl).toMatch(/10px/);
    expect(lbl).toMatch(/text-transform:\s*uppercase/);
  });
});

describe('app.css — one global focus ring (rule 10)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('declares exactly one :focus-visible outline rule (the global one)', function () {
    // strip comments so the documentation mention of :focus-visible is ignored
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = code.match(/:focus-visible\s*\{[^}]*\}/g) || [];
    expect(rules.length).toBe(1);
    expect(rules[0]).toMatch(/outline:\s*2px solid var\(--acc\)/);
    expect(rules[0]).toMatch(/outline-offset:\s*1px/);
  });

  it('the global rule applies to bare :focus-visible (no component prefix)', function () {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).toMatch(/(?:^|\}|\n)\s*:focus-visible\s*\{/);
  });

  it('every listed per-component :focus-visible outline rule is gone', function () {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    [
      '.thm-toggle', '.acct-btn', '.acct-close', '.acct-row', '.acct-row-rm',
      '.ch-sort', '.sig-btn', '.ch-empty-btn', '.mode-opt input',
    ].forEach(function chk(sel) {
      expect(code).not.toContain(sel + ':focus-visible');
    });
  });

  it('per-component :focus / :focus-within border-colour cues on inputs may remain', function () {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    // the input border cues are not outline rules — they survive
    expect(code).toMatch(/\.field input:focus\s*\{[^}]*border-color:\s*var\(--acc\)/);
    expect(code).toMatch(/\.search-field:focus-within\s*\{[^}]*border-color:\s*var\(--acc\)/);
  });
});
