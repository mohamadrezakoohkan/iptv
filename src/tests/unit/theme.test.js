// ADR: ADR-0019
// Unit tests — theme key (cfg.js), loadTheme()/saveTheme() persistence helpers
// (st.js), and the light-theme token override existence (app.css) for
// TASK-0037. Theme is presentational chrome: NOT an ST phase field. The
// localStorage mock mirrors persist.test.js / st.test.js.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const ST_SRC     = join(__dir, '../../client/st.js');
const CSS_SRC    = join(__dir, '../../client/app.css');

/**
 * Build a fresh window with a mocked localStorage + window.S + window.IptvSt.
 * opts.throws === true makes every localStorage access throw (the guarded
 * path). Returns { win, store }.
 */
function mkWin(opts) {
  const throws = Boolean(opts && opts.throws);
  const store  = {};
  const ls = {
    getItem:    function getItem(k)    { if (throws) throw new Error('blocked'); return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { if (throws) throw new Error('blocked'); store[k] = String(v); },
    removeItem: function removeItem(k) { if (throws) throw new Error('blocked'); delete store[k]; },
  };
  const win = { localStorage: ls };
  const cfgSrc = readFileSync(CFG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + cfgSrc)(win);
  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + stSrc)(win);
  return { win, store };
}

// ---------------------------------------------------------------------------
// cfg.js — S.themeKey
// ---------------------------------------------------------------------------
describe('S.themeKey config key', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('S.themeKey is "iptv_theme"', function () {
    expect(win.S.themeKey).toBe('iptv_theme');
  });

  it('S stays frozen with the new key present', function () {
    expect(Object.isFrozen(win.S)).toBe(true);
  });

  it('frozen S rejects mutation of themeKey', function () {
    const before = win.S.themeKey;
    try { win.S.themeKey = 'other'; } catch (_) { /* strict mode throws */ }
    expect(win.S.themeKey).toBe(before);
  });

  it('the existing keys are unchanged', function () {
    expect(win.S.acctsKey).toBe('iptv_accts');
    expect(win.S.actKey).toBe('iptv_act');
    expect(win.S.selKey).toBe('iptv_sel');
    expect(win.S.favsKey).toBe('iptv_favs');
    expect(win.S.sortKey).toBe('iptv_sort');
  });
});

// ---------------------------------------------------------------------------
// loadTheme — stored token resolution + default fallback
// ---------------------------------------------------------------------------
describe('loadTheme() — stored value resolution', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('returns "light" when iptv_theme is exactly "light"', function () {
    store['iptv_theme'] = 'light';
    expect(win.IptvSt.loadTheme()).toBe('light');
  });

  it('returns "dark" when iptv_theme is exactly "dark"', function () {
    store['iptv_theme'] = 'dark';
    expect(win.IptvSt.loadTheme()).toBe('dark');
  });

  it('returns the "dark" default when iptv_theme is absent', function () {
    expect(win.IptvSt.loadTheme()).toBe('dark');
  });

  it('returns the "dark" default for an empty string', function () {
    store['iptv_theme'] = '';
    expect(win.IptvSt.loadTheme()).toBe('dark');
  });

  it('returns the "dark" default for an unrecognised value', function () {
    store['iptv_theme'] = 'sepia';
    expect(win.IptvSt.loadTheme()).toBe('dark');
  });

  it('does not return a value that merely contains "light"/"dark"', function () {
    store['iptv_theme'] = 'lightish';
    expect(win.IptvSt.loadTheme()).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// loadTheme — never throws when localStorage access throws
// ---------------------------------------------------------------------------
describe('loadTheme() — guarded against localStorage exceptions', function () {
  it('returns "dark" and does not throw when getItem throws', function () {
    const win = mkWin({ throws: true }).win;
    let err = null;
    let val = null;
    try { val = win.IptvSt.loadTheme(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(val).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// saveTheme — persists the token under iptv_theme, round-trips via loadTheme
// ---------------------------------------------------------------------------
describe('saveTheme() — persistence', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('writes "light" to iptv_theme', function () {
    win.IptvSt.saveTheme('light');
    expect(store['iptv_theme']).toBe('light');
  });

  it('writes "dark" to iptv_theme', function () {
    win.IptvSt.saveTheme('dark');
    expect(store['iptv_theme']).toBe('dark');
  });

  it('round-trips both tokens through loadTheme', function () {
    ['light', 'dark'].forEach(function chk(thm) {
      const w = mkWin();
      w.win.IptvSt.saveTheme(thm);
      const w2 = mkWin();
      w2.store['iptv_theme'] = w.store['iptv_theme'];
      expect(w2.win.IptvSt.loadTheme()).toBe(thm);
    });
  });

  it('does not throw when setItem throws', function () {
    const w = mkWin({ throws: true });
    let err = null;
    try { w.win.IptvSt.saveTheme('light'); } catch (e) { err = e; }
    expect(err).toBeNull();
  });

  it('both helpers are exposed on the IptvSt public API', function () {
    expect(typeof win.IptvSt.loadTheme).toBe('function');
    expect(typeof win.IptvSt.saveTheme).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// app.css — light-theme token override rule (ADR-0019). The dark :root values
// stay; the light rule re-defines all eight colour tokens.
// ---------------------------------------------------------------------------
describe('app.css — :root[data-theme="light"] token override', function () {
  let css;
  beforeEach(function () { css = readFileSync(CSS_SRC, 'utf8'); });

  it('declares a :root[data-theme="light"] rule', function () {
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{/);
  });

  it('re-defines all eight colour tokens inside the light rule', function () {
    const m = css.match(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m[1];
    ['--bg', '--sur', '--sur2', '--ln', '--tx', '--dim', '--acc', '--live'].forEach(function tok(t) {
      expect(body).toContain(t + ':');
    });
  });

  it('keeps the dark :root --bg value (#0E1216) unchanged', function () {
    expect(css).toMatch(/:root\s*\{[\s\S]*?--bg:\s*#0E1216/);
  });
});
