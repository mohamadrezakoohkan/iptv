// ADR: ADR-0024
// Unit tests — column gutters + both 56px headers on one line (TASK-0048,
// spacing-sizing.md rules 2 + 5). CSS-source assertions that the sidebar
// blocks read --sgut, the content blocks read --gut (and --s4 at the
// max-width:760px breakpoint), the inner controls read --s3, and both column
// headers read --hd. No surviving 0 14px / 10px 12px / 0 20px one-offs on
// these blocks.

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
 *  order — the desktop (top-level) rule, since breakpoint overrides come later.
 *  A selector boundary is start-of-string, `}`, `,`, `*​/` (end of comment), or
 *  a newline; the selector must be followed only by whitespace then `{` so
 *  compound selectors like `.footer-form` never match `.footer`. */
function ruleBody(css, sel) {
  const re = new RegExp(
    '(?:^|\\}|,|\\*/|\\n)\\s*' + esc(sel) + '\\s*\\{([^}]*)\\}', 'g'
  );
  const m = re.exec(css);
  expect(m, 'rule for ' + sel).not.toBeNull();
  return m[1];
}

/** Body of the existing max-width:760px media block. */
function mobileBlock(css) {
  const m = css.match(/@media\s*\(\s*max-width:\s*760px\s*\)\s*\{([\s\S]*?)\n\}/);
  expect(m, 'max-width:760px block').not.toBeNull();
  return m[1];
}

describe('app.css — sidebar gutter = --sgut (rule 2)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  ['.sidebar-head', '.sidebar-search', '.sidebar-list'].forEach(function chk(sel) {
    it(sel + ' applies the --sgut horizontal gutter', function () {
      expect(ruleBody(css, sel)).toContain('var(--sgut)');
    });
  });

  it('.search-field uses --s3 inner inset (12px controls)', function () {
    expect(ruleBody(css, '.search-field')).toContain('var(--s3)');
  });

  it('.cat-btn uses --s3 inner inset (12px controls)', function () {
    expect(ruleBody(css, '.cat-btn')).toContain('var(--s3)');
  });
});

describe('app.css — content gutter = --gut (rule 2)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  // .content-head / .ch-section / .footer carry the content gutter as --gut
  // (24px). .player-wrap's vertical rhythm (TASK-0049, rule 6) makes its
  // horizontal gutter read --s6 — identical 24px, so column-left alignment is
  // unchanged; it is asserted separately below.
  ['.content-head', '.ch-section', '.footer'].forEach(function chk(sel) {
    it(sel + ' applies the --gut horizontal gutter', function () {
      expect(ruleBody(css, sel)).toContain('var(--gut)');
    });
  });

  it('.player-wrap applies the 24px content gutter via --s6 (rule 6 rhythm)', function () {
    expect(ruleBody(css, '.player-wrap')).toMatch(/padding:\s*var\(--s6\) var\(--s6\) 0/);
  });

  it('the max-width:760px block narrows content blocks to --s4 (16px)', function () {
    const m = mobileBlock(css);
    ['.content-head', '.player-wrap', '.ch-section', '.footer'].forEach(function chk(sel) {
      const sub = m.match(new RegExp(sel.replace('.', '\\.') + '\\s*\\{([^}]*)\\}'));
      expect(sub, sel + ' in mobile block').not.toBeNull();
      expect(sub[1]).toContain('var(--s4)');
    });
  });
});

describe('app.css — both column headers are --hd, one line (rule 5)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('.sidebar-head height is var(--hd)', function () {
    expect(ruleBody(css, '.sidebar-head')).toMatch(/height:\s*var\(--hd\)/);
  });

  it('.content-head height is var(--hd)', function () {
    expect(ruleBody(css, '.content-head')).toMatch(/height:\s*var\(--hd\)/);
  });

  it('.sidebar-head is padded to --sgut, .content-head to --gut', function () {
    expect(ruleBody(css, '.sidebar-head')).toMatch(/padding:\s*0 var\(--sgut\)/);
    expect(ruleBody(css, '.content-head')).toMatch(/padding:\s*0 var\(--gut\)/);
  });
});

describe('app.css — no surviving gutter/header one-offs (rule 1)', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('.sidebar-head has no 0 14px / 56px literals', function () {
    const b = ruleBody(css, '.sidebar-head');
    expect(b).not.toContain('0 14px');
    expect(b).not.toMatch(/height:\s*56px/);
  });

  it('.content-head has no 0 20px / 56px literals', function () {
    const b = ruleBody(css, '.content-head');
    expect(b).not.toContain('0 20px');
    expect(b).not.toMatch(/height:\s*56px/);
  });

  it('.player-wrap / .ch-section / .footer have no 20px gutter literals', function () {
    expect(ruleBody(css, '.player-wrap')).not.toContain('20px 10px');
    expect(ruleBody(css, '.ch-section')).not.toContain('20px 16px');
    expect(ruleBody(css, '.footer')).not.toContain('12px 20px');
  });
});
