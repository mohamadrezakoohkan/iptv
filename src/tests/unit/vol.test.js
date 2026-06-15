// ADR: ADR-0040
// Unit tests — volume key (cfg.js), loadVol()/saveVol() persistence helpers
// (st.js), and setVol/setMuted persist-on-write (st.js) for TASK-0084. The
// single client-wide volume/mute preference is presentational chrome: NOT an
// ST phase field. The localStorage mock mirrors theme.test.js / persist.test.js.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const ST_SRC     = join(__dir, '../../client/st.js');

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
// cfg.js — S.volKey
// ---------------------------------------------------------------------------
describe('S.volKey config key', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('S.volKey is "iptv_vol"', function () {
    expect(win.S.volKey).toBe('iptv_vol');
  });

  it('S stays frozen with the new key present', function () {
    expect(Object.isFrozen(win.S)).toBe(true);
  });

  it('frozen S rejects mutation of volKey', function () {
    const before = win.S.volKey;
    try { win.S.volKey = 'other'; } catch (_) { /* strict mode throws */ }
    expect(win.S.volKey).toBe(before);
  });

  it('the existing keys are unchanged', function () {
    expect(win.S.themeKey).toBe('iptv_theme');
    expect(win.S.sortKey).toBe('iptv_sort');
    expect(win.S.favsKey).toBe('iptv_favs');
  });
});

// ---------------------------------------------------------------------------
// loadVol — stored value resolution + default fallback
// ---------------------------------------------------------------------------
describe('loadVol() — stored value resolution', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('returns the stored { vol, muted } for a valid payload', function () {
    store['iptv_vol'] = JSON.stringify({ vol: 0.4, muted: true });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 0.4, muted: true });
  });

  it('accepts the boundary value vol: 0', function () {
    store['iptv_vol'] = JSON.stringify({ vol: 0, muted: false });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 0, muted: false });
  });

  it('accepts the boundary value vol: 1', function () {
    store['iptv_vol'] = JSON.stringify({ vol: 1, muted: true });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1, muted: true });
  });

  it('returns the defaults when iptv_vol is absent', function () {
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults for malformed JSON', function () {
    store['iptv_vol'] = '{not json';
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults for a non-object payload (number)', function () {
    store['iptv_vol'] = JSON.stringify(5);
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults for a null payload', function () {
    store['iptv_vol'] = JSON.stringify(null);
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults when vol is above range (2)', function () {
    store['iptv_vol'] = JSON.stringify({ vol: 2, muted: false });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults when vol is below range (-1)', function () {
    store['iptv_vol'] = JSON.stringify({ vol: -1, muted: false });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults when vol is not a number', function () {
    store['iptv_vol'] = JSON.stringify({ vol: '0.5', muted: false });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults when vol is NaN/Infinity (non-finite)', function () {
    store['iptv_vol'] = '{"vol":null,"muted":false}';
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });

  it('returns the defaults when muted is not a boolean', function () {
    store['iptv_vol'] = JSON.stringify({ vol: 0.5, muted: 'yes' });
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: false });
  });
});

// ---------------------------------------------------------------------------
// loadVol — never throws when localStorage access throws
// ---------------------------------------------------------------------------
describe('loadVol() — guarded against localStorage exceptions', function () {
  it('returns the defaults and does not throw when getItem throws', function () {
    const win = mkWin({ throws: true }).win;
    let err = null;
    let val = null;
    try { val = win.IptvSt.loadVol(); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(val).toEqual({ vol: 1.0, muted: false });
  });
});

// ---------------------------------------------------------------------------
// saveVol — serialises ST.vol / ST.muted to iptv_vol
// ---------------------------------------------------------------------------
describe('saveVol() — persistence', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('writes the current ST.vol / ST.muted as { vol, muted } JSON', function () {
    win.IptvSt.ST.vol   = 0.6;
    win.IptvSt.ST.muted = true;
    win.IptvSt.saveVol();
    expect(JSON.parse(store['iptv_vol'])).toEqual({ vol: 0.6, muted: true });
  });

  it('writes the defaults when ST is untouched', function () {
    win.IptvSt.saveVol();
    expect(JSON.parse(store['iptv_vol'])).toEqual({ vol: 1.0, muted: false });
  });

  it('does not throw when setItem throws', function () {
    const w = mkWin({ throws: true });
    let err = null;
    try { w.win.IptvSt.saveVol(); } catch (e) { err = e; }
    expect(err).toBeNull();
  });

  it('both helpers are exposed on the IptvSt public API', function () {
    expect(typeof win.IptvSt.loadVol).toBe('function');
    expect(typeof win.IptvSt.saveVol).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// setVol / setMuted — persist on write, round-trip via loadVol
// ---------------------------------------------------------------------------
describe('setVol / setMuted — persist on write', function () {
  let win, store;
  beforeEach(function () {
    const w = mkWin();
    win   = w.win;
    store = w.store;
  });

  it('setVol mutates ST.vol and persists', function () {
    win.IptvSt.setVol(0.4);
    expect(win.IptvSt.ST.vol).toBe(0.4);
    expect(JSON.parse(store['iptv_vol']).vol).toBe(0.4);
  });

  it('setVol round-trips: setVol(0.4) then loadVol() returns vol 0.4', function () {
    win.IptvSt.setVol(0.4);
    expect(win.IptvSt.loadVol()).toEqual({ vol: 0.4, muted: false });
  });

  it('setMuted mutates ST.muted and persists', function () {
    win.IptvSt.setMuted(true);
    expect(win.IptvSt.ST.muted).toBe(true);
    expect(JSON.parse(store['iptv_vol']).muted).toBe(true);
  });

  it('setMuted round-trips through loadVol', function () {
    win.IptvSt.setMuted(true);
    expect(win.IptvSt.loadVol()).toEqual({ vol: 1.0, muted: true });
  });

  it('successive setVol / setMuted reflect the latest of both fields', function () {
    win.IptvSt.setVol(0.2);
    win.IptvSt.setMuted(true);
    expect(win.IptvSt.loadVol()).toEqual({ vol: 0.2, muted: true });
  });

  it('setVol does not throw when localStorage write throws', function () {
    const w = mkWin({ throws: true });
    let err = null;
    try { w.win.IptvSt.setVol(0.5); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(w.win.IptvSt.ST.vol).toBe(0.5);
  });

  it('setMuted does not throw when localStorage write throws', function () {
    const w = mkWin({ throws: true });
    let err = null;
    try { w.win.IptvSt.setMuted(true); } catch (e) { err = e; }
    expect(err).toBeNull();
    expect(w.win.IptvSt.ST.muted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// iptv_vol is NOT in the phase machine — phase fields/transitions unchanged
// ---------------------------------------------------------------------------
describe('volume preference is chrome, not a phase field', function () {
  let win;
  beforeEach(function () { win = mkWin().win; });

  it('ST.phase is unaffected by setVol / setMuted', function () {
    const before = win.IptvSt.ST.phase;
    win.IptvSt.setVol(0.3);
    win.IptvSt.setMuted(true);
    expect(win.IptvSt.ST.phase).toBe(before);
  });

  it('the phase transition map still rejects an INIT->PLAY jump', function () {
    expect(function () { win.IptvSt.go('PLAY'); }).toThrow('bad: INIT->PLAY');
  });
});
