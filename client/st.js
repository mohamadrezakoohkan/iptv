// ADR: ADR-0001, ADR-0003, ADR-0008
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
// getM3u — login mode of stored creds; migrates legacy iptv_creds lacking
// the m3u flag at read time: true exactly when user and pass are empty
// strings and url is not "demo" (case-insensitive). Stored-data migration
// only — never applied to live form input.
// ADR: ADR-0008
// ---------------------------------------------------------------------------
function getM3u(creds) {
  if (typeof creds.m3u === 'boolean') return creds.m3u;
  const demo = typeof creds.url === 'string' && creds.url.trim().toLowerCase() === 'demo';
  return creds.user === '' && creds.pass === '' && !demo;
}

// ---------------------------------------------------------------------------
// loadSt — reads all three localStorage keys; populates ST.favs; returns
// { creds, sel } — called once on page load before any phase transition.
// ADR: ADR-0003, ADR-0008
// ---------------------------------------------------------------------------
function loadSt() {
  const S  = window.S;
  const ls = window.localStorage;
  let creds = null;
  let sel   = null;
  try { creds = JSON.parse(ls.getItem(S.credsKey)); } catch (e) {}
  if (creds && typeof creds === 'object') creds.m3u = getM3u(creds);
  try { sel   = ls.getItem(S.selKey); } catch (e) {}
  try {
    const f = JSON.parse(ls.getItem(S.favsKey));
    if (Array.isArray(f)) ST.favs = f;
  } catch (e) {}
  return { creds: creds || null, sel: sel || null };
}

// ---------------------------------------------------------------------------
// saveSt — writes one localStorage key after a state mutation.
// field: 'creds' | 'favs' | 'sel'
// ADR: ADR-0003
// ---------------------------------------------------------------------------
function saveSt(fld) {
  const S  = window.S;
  const ls = window.localStorage;
  if (fld === 'creds') return;
  if (fld === 'favs') {
    try { ls.setItem(S.favsKey, JSON.stringify(ST.favs)); } catch (e) {}
  }
  if (fld === 'sel') {
    if (!ST.cur) return;
    try { ls.setItem(S.selKey, String(ST.cur.id)); } catch (e) {}
  }
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
  getM3u,
  loadSt,
  saveSt,
};
