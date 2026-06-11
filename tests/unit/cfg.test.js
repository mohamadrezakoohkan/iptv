// ADR: ADR-0001, ADR-0003
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');

/** Execute client/cfg.js against a fresh window, return window.S. */
function loadCfg() {
  const win = {};
  const src = readFileSync(CFG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.S;');
  return fn(win);
}

// ---------------------------------------------------------------------------
// S contract
// ---------------------------------------------------------------------------
describe('S config object', function () {
  let s;
  beforeEach(function () { s = loadCfg(); });

  it('S is frozen after module load', function () {
    expect(Object.isFrozen(s)).toBe(true);
  });

  it('S.credsKey is "iptv_creds"', function () {
    expect(s.credsKey).toBe('iptv_creds');
  });

  it('S.selKey is "iptv_sel"', function () {
    expect(s.selKey).toBe('iptv_sel');
  });

  it('S.favsKey is "iptv_favs"', function () {
    expect(s.favsKey).toBe('iptv_favs');
  });

  it('S.debMs is 200', function () {
    expect(s.debMs).toBe(200);
  });

  it('S.base is "/api"', function () {
    expect(s.base).toBe('/api');
  });

  it('S.pgSz is 50', function () {
    expect(s.pgSz).toBe(50);
  });

  it('S.retries is 3', function () {
    expect(s.retries).toBe(3);
  });

  it('S.volStp is 0.1', function () {
    expect(s.volStp).toBe(0.1);
  });

  it('S.skpSec is 10', function () {
    expect(s.skpSec).toBe(10);
  });

  it('frozen S rejects property mutation silently', function () {
    const before = s.debMs;
    try { s.debMs = 999; } catch (_) { /* strict mode throws */ }
    expect(s.debMs).toBe(before);
  });
});
