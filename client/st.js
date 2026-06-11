// ADR: ADR-0001, ADR-0003
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// State object — fully initialized; no property may be added after declaration
// ---------------------------------------------------------------------------
const ST = {
  phase:  'INIT',
  chs:    [],
  cats:   [],
  cur:    null,
  srch:   '',
  flt:    'all',
  vol:    1.0,
  muted:  false,
  err:    null,
  favs:   [],
  host:   '',
  user:   '',
};

// ---------------------------------------------------------------------------
// Phase transition map — SCREAMING_SNAKE, never mutated
// ---------------------------------------------------------------------------
const PHASES = {
  INIT:  ['LOAD'],
  LOAD:  ['READY', 'ERR'],
  READY: ['PLAY', 'SRCH', 'ERR'],
  PLAY:  ['READY', 'ERR'],
  SRCH:  ['READY'],
  ERR:   ['INIT'],
};

// ---------------------------------------------------------------------------
// Internal phase callback registry — replaced by onPhase(cb)
// ---------------------------------------------------------------------------
let _phaseCb = null;

// ---------------------------------------------------------------------------
// go — only writer of ST.phase
// ---------------------------------------------------------------------------
function go(nxt) {
  const ok = PHASES[ST.phase];
  if (!ok || !ok.includes(nxt)) {
    throw new Error('bad: ' + ST.phase + '->' + nxt);
  }
  ST.phase = nxt;
  if (_phaseCb) _phaseCb();
}

// ---------------------------------------------------------------------------
// onPhase — registers (replaces) the single phase callback
// ---------------------------------------------------------------------------
function onPhase(cb) {
  _phaseCb = cb;
}

// ---------------------------------------------------------------------------
// Setter functions — each mutates only its relevant ST properties
// ---------------------------------------------------------------------------

function setErr(msg) {
  ST.err = msg;
}

function setChs(chs, cats, host, user) {
  ST.chs  = chs;
  ST.cats = cats;
  ST.host = host;
  ST.user = user;
}

function setCur(ch) {
  ST.cur = ch;
}

function setSrch(q) {
  ST.srch = q;
}

function setFlt(cat) {
  ST.flt = cat;
}

function setVol(v) {
  ST.vol = v;
}

function setMuted(b) {
  ST.muted = b;
}

function setFavs(arr) {
  ST.favs = arr;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvSt = {
  ST,
  go,
  onPhase,
  setErr,
  setChs,
  setCur,
  setSrch,
  setFlt,
  setVol,
  setMuted,
  setFavs,
};
