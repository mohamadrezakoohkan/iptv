// ADR: ADR-0001, ADR-0003
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const ST_SRC     = join(__dir, '../../client/st.js');

/** Execute client/st.js against a fresh window, return window.IptvSt. */
function loadSt() {
  const win = {};
  const src = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvSt;');
  return fn(win);
}

// ---------------------------------------------------------------------------
// go() — valid transitions
// ---------------------------------------------------------------------------
describe('go() — valid transitions', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('transitions from INIT to LOAD', function () {
    st.go('LOAD');
    expect(st.ST.phase).toBe('LOAD');
  });

  it('transitions from LOAD to READY', function () {
    st.go('LOAD');
    st.go('READY');
    expect(st.ST.phase).toBe('READY');
  });

  it('transitions from LOAD to ERR', function () {
    st.go('LOAD');
    st.go('ERR');
    expect(st.ST.phase).toBe('ERR');
  });

  it('transitions from READY to PLAY', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('PLAY');
    expect(st.ST.phase).toBe('PLAY');
  });

  it('transitions from READY to SRCH', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('SRCH');
    expect(st.ST.phase).toBe('SRCH');
  });

  it('transitions from READY to ERR', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('ERR');
    expect(st.ST.phase).toBe('ERR');
  });

  it('transitions from PLAY to READY', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('PLAY');
    st.go('READY');
    expect(st.ST.phase).toBe('READY');
  });

  it('transitions from PLAY to ERR', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('PLAY');
    st.go('ERR');
    expect(st.ST.phase).toBe('ERR');
  });

  it('transitions from SRCH to READY', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('SRCH');
    st.go('READY');
    expect(st.ST.phase).toBe('READY');
  });

  it('transitions from ERR to INIT', function () {
    st.go('LOAD');
    st.go('ERR');
    st.go('INIT');
    expect(st.ST.phase).toBe('INIT');
  });
});

// ---------------------------------------------------------------------------
// go() — invalid transitions throw
// ---------------------------------------------------------------------------
describe('go() — invalid transitions', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('throws bad: INIT->READY', function () {
    expect(function () { st.go('READY'); }).toThrow('bad: INIT->READY');
  });

  it('throws bad: INIT->ERR', function () {
    expect(function () { st.go('ERR'); }).toThrow('bad: INIT->ERR');
  });

  it('throws bad: INIT->PLAY', function () {
    expect(function () { st.go('PLAY'); }).toThrow('bad: INIT->PLAY');
  });

  it('throws bad: LOAD->INIT', function () {
    st.go('LOAD');
    expect(function () { st.go('INIT'); }).toThrow('bad: LOAD->INIT');
  });

  it('throws bad: LOAD->PLAY', function () {
    st.go('LOAD');
    expect(function () { st.go('PLAY'); }).toThrow('bad: LOAD->PLAY');
  });

  it('throws bad: READY->INIT', function () {
    st.go('LOAD');
    st.go('READY');
    expect(function () { st.go('INIT'); }).toThrow('bad: READY->INIT');
  });

  it('throws bad: SRCH->PLAY', function () {
    st.go('LOAD');
    st.go('READY');
    st.go('SRCH');
    expect(function () { st.go('PLAY'); }).toThrow('bad: SRCH->PLAY');
  });

  it('throws bad: ERR->READY', function () {
    st.go('LOAD');
    st.go('ERR');
    expect(function () { st.go('READY'); }).toThrow('bad: ERR->READY');
  });

  it('throws for completely unknown phase target', function () {
    expect(function () { st.go('BOGUS'); }).toThrow('bad: INIT->BOGUS');
  });
});

// ---------------------------------------------------------------------------
// go() — ST.phase updated on valid call
// ---------------------------------------------------------------------------
describe('go() — ST.phase mutation', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('ST.phase starts as INIT', function () {
    expect(st.ST.phase).toBe('INIT');
  });

  it('ST.phase is updated synchronously', function () {
    st.go('LOAD');
    expect(st.ST.phase).toBe('LOAD');
    st.go('READY');
    expect(st.ST.phase).toBe('READY');
  });

  it('ST.phase is not mutated on invalid go() call', function () {
    try { st.go('BOGUS'); } catch (_) { /* expected */ }
    expect(st.ST.phase).toBe('INIT');
  });
});

// ---------------------------------------------------------------------------
// onPhase — callback invoked after go()
// ---------------------------------------------------------------------------
describe('onPhase(cb)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('callback is invoked after a valid go()', function () {
    let cnt = 0;
    st.onPhase(function () { cnt += 1; });
    st.go('LOAD');
    expect(cnt).toBe(1);
  });

  it('callback receives updated ST.phase (called after phase change)', function () {
    const phases = [];
    st.onPhase(function () { phases.push(st.ST.phase); });
    st.go('LOAD');
    st.go('READY');
    expect(phases).toEqual(['LOAD', 'READY']);
  });

  it('replaces previous callback registration', function () {
    let first = 0;
    let second = 0;
    st.onPhase(function () { first += 1; });
    st.onPhase(function () { second += 1; });
    st.go('LOAD');
    expect(first).toBe(0);
    expect(second).toBe(1);
  });

  it('callback not called when go() throws', function () {
    let cnt = 0;
    st.onPhase(function () { cnt += 1; });
    try { st.go('BOGUS'); } catch (_) { /* expected */ }
    expect(cnt).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setErr
// ---------------------------------------------------------------------------
describe('setErr(msg)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.err to the given message', function () {
    st.setErr('connection lost');
    expect(st.ST.err).toBe('connection lost');
  });

  it('sets ST.err to null', function () {
    st.setErr('something');
    st.setErr(null);
    expect(st.ST.err).toBeNull();
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setErr('x');
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.chs).toBe(before.chs);
    expect(st.ST.cur).toBe(before.cur);
  });
});

// ---------------------------------------------------------------------------
// setChs
// ---------------------------------------------------------------------------
describe('setChs(chs, cats, host, user)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.chs', function () {
    const chs = [{ id: '1', name: 'World News' }];
    st.setChs(chs, [], 'http://portal', 'alice');
    expect(st.ST.chs).toBe(chs);
  });

  it('sets ST.cats', function () {
    const cats = [{ id: 'news', name: 'News' }];
    st.setChs([], cats, 'http://portal', 'alice');
    expect(st.ST.cats).toBe(cats);
  });

  it('sets ST.host', function () {
    st.setChs([], [], 'http://portal.example.com', 'bob');
    expect(st.ST.host).toBe('http://portal.example.com');
  });

  it('sets ST.user', function () {
    st.setChs([], [], '', 'charlie');
    expect(st.ST.user).toBe('charlie');
  });

  it('does not mutate unrelated ST properties', function () {
    const before = { ...st.ST };
    st.setChs([], [], '', '');
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.cur).toBe(before.cur);
    expect(st.ST.srch).toBe(before.srch);
  });
});

// ---------------------------------------------------------------------------
// setCur
// ---------------------------------------------------------------------------
describe('setCur(ch)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.cur to the given channel', function () {
    const ch = { id: '5', name: 'Sports Arena HD' };
    st.setCur(ch);
    expect(st.ST.cur).toBe(ch);
  });

  it('sets ST.cur to null', function () {
    st.setCur({ id: '1', name: 'x' });
    st.setCur(null);
    expect(st.ST.cur).toBeNull();
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setCur({ id: '1', name: 'x' });
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.chs).toBe(before.chs);
    expect(st.ST.srch).toBe(before.srch);
  });
});

// ---------------------------------------------------------------------------
// setSrch
// ---------------------------------------------------------------------------
describe('setSrch(q)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.srch to the given query', function () {
    st.setSrch('football');
    expect(st.ST.srch).toBe('football');
  });

  it('sets ST.srch to empty string', function () {
    st.setSrch('x');
    st.setSrch('');
    expect(st.ST.srch).toBe('');
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setSrch('test');
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.chs).toBe(before.chs);
    expect(st.ST.flt).toBe(before.flt);
  });
});

// ---------------------------------------------------------------------------
// setFlt
// ---------------------------------------------------------------------------
describe('setFlt(cat)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.flt to the given category', function () {
    st.setFlt('news');
    expect(st.ST.flt).toBe('news');
  });

  it('sets ST.flt to "all"', function () {
    st.setFlt('sports');
    st.setFlt('all');
    expect(st.ST.flt).toBe('all');
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setFlt('movies');
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.srch).toBe(before.srch);
    expect(st.ST.cur).toBe(before.cur);
  });
});

// ---------------------------------------------------------------------------
// setVol
// ---------------------------------------------------------------------------
describe('setVol(v)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.vol to 0.5', function () {
    st.setVol(0.5);
    expect(st.ST.vol).toBe(0.5);
  });

  it('sets ST.vol to 0.0', function () {
    st.setVol(0.0);
    expect(st.ST.vol).toBe(0.0);
  });

  it('sets ST.vol to 1.0', function () {
    st.setVol(0.3);
    st.setVol(1.0);
    expect(st.ST.vol).toBe(1.0);
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setVol(0.7);
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.muted).toBe(before.muted);
    expect(st.ST.chs).toBe(before.chs);
  });
});

// ---------------------------------------------------------------------------
// setMuted
// ---------------------------------------------------------------------------
describe('setMuted(b)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.muted to true', function () {
    st.setMuted(true);
    expect(st.ST.muted).toBe(true);
  });

  it('sets ST.muted to false', function () {
    st.setMuted(true);
    st.setMuted(false);
    expect(st.ST.muted).toBe(false);
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setMuted(true);
    expect(st.ST.vol).toBe(before.vol);
    expect(st.ST.phase).toBe(before.phase);
  });
});

// ---------------------------------------------------------------------------
// setFavs
// ---------------------------------------------------------------------------
describe('setFavs(arr)', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('sets ST.favs to the given array', function () {
    const arr = ['1', '5', '12'];
    st.setFavs(arr);
    expect(st.ST.favs).toBe(arr);
  });

  it('sets ST.favs to empty array', function () {
    st.setFavs(['1']);
    st.setFavs([]);
    expect(st.ST.favs).toEqual([]);
  });

  it('does not mutate other ST properties', function () {
    const before = { ...st.ST };
    st.setFavs(['1', '2']);
    expect(st.ST.phase).toBe(before.phase);
    expect(st.ST.cur).toBe(before.cur);
    expect(st.ST.chs).toBe(before.chs);
  });
});

// ---------------------------------------------------------------------------
// ST initial state
// ---------------------------------------------------------------------------
describe('ST initial state', function () {
  let st;
  beforeEach(function () { st = loadSt(); });

  it('phase is INIT', function () { expect(st.ST.phase).toBe('INIT'); });
  it('chs is []', function () { expect(st.ST.chs).toEqual([]); });
  it('cats is []', function () { expect(st.ST.cats).toEqual([]); });
  it('cur is null', function () { expect(st.ST.cur).toBeNull(); });
  it('srch is empty string', function () { expect(st.ST.srch).toBe(''); });
  it('flt is "all"', function () { expect(st.ST.flt).toBe('all'); });
  it('vol is 1.0', function () { expect(st.ST.vol).toBe(1.0); });
  it('muted is false', function () { expect(st.ST.muted).toBe(false); });
  it('err is null', function () { expect(st.ST.err).toBeNull(); });
  it('favs is []', function () { expect(st.ST.favs).toEqual([]); });
  it('host is empty string', function () { expect(st.ST.host).toBe(''); });
  it('user is empty string', function () { expect(st.ST.user).toBe(''); });
});
