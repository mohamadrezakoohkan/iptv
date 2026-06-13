// ADR: ADR-0024
// Unit tests — content vertical rhythm, two-radii system, tabular numbers
// (TASK-0049, spacing-sizing.md rules 4 + 6 + 9). CSS-source assertions that
// the rewired rules in client/app.css read TASK-0047's tokens: the content
// column's vertical rhythm snaps to the grid (.player-wrap / .ch-bar / .ch-grid
// gap / .ch-card padding / .footer), controls use --r1, cards/player use --r2,
// small badges use --s1 (4px), and the three numeric selectors carry the mono
// font with font-variant-numeric: tabular-nums.

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

describe('app.css — content vertical rhythm reads grid tokens (rule 6)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('.player-wrap padding is var(--s6) var(--s6) 0 (24/24/0)', function () {
    expect(ruleBody(css, '.player-wrap')).toMatch(/padding:\s*var\(--s6\) var\(--s6\) 0/);
  });

  it('.ch-bar padding is var(--s5) 0 var(--s3) (20/0/12)', function () {
    expect(ruleBody(css, '.ch-bar')).toMatch(/padding:\s*var\(--s5\) 0 var\(--s3\)/);
  });

  it('.ch-grid gap is var(--s3) (12px)', function () {
    expect(ruleBody(css, '.ch-grid')).toMatch(/gap:\s*var\(--s3\)/);
  });

  it('.ch-card padding is var(--s3) (12px)', function () {
    expect(ruleBody(css, '.ch-card')).toMatch(/padding:\s*var\(--s3\)/);
  });

  it('.footer padding is var(--s4) var(--gut) (16/24)', function () {
    expect(ruleBody(css, '.footer')).toMatch(/padding:\s*var\(--s4\) var\(--gut\)/);
  });

  it('no surviving 11px card / 8px grid-gap / 10px wrap one-offs', function () {
    expect(ruleBody(css, '.ch-card')).not.toMatch(/padding:\s*11px/);
    expect(ruleBody(css, '.ch-grid')).not.toMatch(/gap:\s*8px/);
    expect(ruleBody(css, '.player-wrap')).not.toContain('16px var(--gut) 10px');
  });
});

describe('app.css — controls use --r1 (rule 4)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.btn', '.sig-btn', '.ch-empty-btn', '.field input', '.search-field',
   '.fmt-chip', '.ch-sort', '.icon-btn', '.login-mode', '.cat-btn',
   '.acct-btn', '.acct-close', '.acct-row', '.acct-row-rm', '.thm-toggle',
  ].forEach(function chk(sel) {
    it(sel + ' radius is var(--r1)', function () {
      expect(ruleBody(css, sel)).toMatch(/border-radius:\s*var\(--r1\)/);
    });
  });
});

describe('app.css — cards/player use --r2 (rule 4)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.ch-card', '.player-card', '.acct-conn'].forEach(function chk(sel) {
    it(sel + ' radius is var(--r2)', function () {
      expect(ruleBody(css, sel)).toMatch(/border-radius:\s*var\(--r2\)/);
    });
  });
});

describe('app.css — small badges use --s1 (4px) radius (rule 4)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.cat-count', '.on-air-badge', '.now-cat'].forEach(function chk(sel) {
    it(sel + ' radius is var(--s1)', function () {
      expect(ruleBody(css, sel)).toMatch(/border-radius:\s*var\(--s1\)/);
    });
  });
});

describe('app.css — no stray rectangular radius literals remain (rule 4)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('no 3px / 5px / 7px border-radius values survive', function () {
    expect(css).not.toMatch(/border-radius:\s*3px/);
    expect(css).not.toMatch(/border-radius:\s*5px/);
    expect(css).not.toMatch(/border-radius:\s*7px/);
  });

  it('every rectangular border-radius reads a token (only 50% circles are literal)', function () {
    const literals = css.match(/border-radius:\s*[^;]+;/g) || [];
    literals.forEach(function chk(decl) {
      const ok = decl.includes('var(') || decl.includes('50%');
      expect(ok, 'literal radius: ' + decl).toBe(true);
    });
  });
});

describe('app.css — numeric elements use mono + tabular-nums (rule 9)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.ch-num', '.cat-count', '.ch-bar-count'].forEach(function chk(sel) {
    it(sel + ' uses var(--font-mono)', function () {
      expect(ruleBody(css, sel)).toContain('var(--font-mono)');
    });
    it(sel + ' sets font-variant-numeric: tabular-nums', function () {
      expect(ruleBody(css, sel)).toMatch(/font-variant-numeric:\s*tabular-nums/);
    });
  });
});
