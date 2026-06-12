// ADR: ADR-0001, ADR-0003, ADR-0008, ADR-0013
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
// loadSt — reads the sel, favs, and legacy creds localStorage keys; populates
// ST.favs; returns { sel, creds } — called once on page load before any phase
// transition. The accounts store (loadAccts, ADR-0013) is the forward model;
// until the connect/reconnect wiring moves to it (TASK-0029), this helper
// carries the legacy iptv_creds reconnect path so the runtime keeps working.
// creds resolves its login mode via getM3u (ADR-0008) so legacy records
// missing the m3u flag still replay correctly.
// ADR: ADR-0003, ADR-0008
// ---------------------------------------------------------------------------
function loadSt() {
  const S     = window.S;
  const ls    = window.localStorage;
  let sel     = null;
  let creds   = null;
  try { sel = ls.getItem(S.selKey); } catch (e) {}
  try {
    const f = JSON.parse(ls.getItem(S.favsKey));
    if (Array.isArray(f)) ST.favs = f;
  } catch (e) {}
  try { creds = getCreds(JSON.parse(ls.getItem(S.credsKey))); } catch (e) {}
  return { sel: sel || null, creds };
}

// ---------------------------------------------------------------------------
// getCreds — pure: a stored creds record with its m3u mode resolved via
// getM3u (ADR-0008), or null when the value is not a usable object.
// ADR: ADR-0003, ADR-0008
// ---------------------------------------------------------------------------
function getCreds(creds) {
  if (!creds || typeof creds !== 'object') return null;
  return { url: creds.url, user: creds.user, pass: creds.pass, m3u: getM3u(creds) };
}

// ---------------------------------------------------------------------------
// saveSt — writes one localStorage key after a state mutation.
// field: 'favs' | 'sel'
// ADR: ADR-0003
// ---------------------------------------------------------------------------
function saveSt(fld) {
  const S  = window.S;
  const ls = window.localStorage;
  if (fld === 'favs') {
    try { ls.setItem(S.favsKey, JSON.stringify(ST.favs)); } catch (e) {}
  }
  if (fld === 'sel') {
    if (!ST.cur) return;
    try { ls.setItem(S.selKey, String(ST.cur.id)); } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// Account store (ADR-0013) — accounts list + active pointer replace the
// single iptv_creds record. All helpers below own iptv_accts / iptv_act.
// ADR: ADR-0013
// ---------------------------------------------------------------------------

/** @typedef {{ id:string, name:string, url:string, user:string, pass:string, m3u:boolean }} Acct */

// ---------------------------------------------------------------------------
// getName — pure: derives a non-blank display name for a connection. Xtream:
// "host · user"; playlist: host; demo url: "Demo".
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function getName(opts) {
  const url  = typeof opts.url === 'string' ? opts.url.trim() : '';
  const host = (opts.host || url || '').trim();
  if (url.toLowerCase() === 'demo') return 'Demo';
  if (opts.user) return host + ' · ' + opts.user;
  return host || 'Account';
}

// ---------------------------------------------------------------------------
// mkAcct — pure: builds an Acct from a connection. Mints id when absent,
// derives a non-blank name, carries the resolved m3u mode.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function mkAcct(opts) {
  return {
    id:   opts.id || String(Date.now()),
    name: getName(opts),
    url:  opts.url || '',
    user: opts.user || '',
    pass: opts.pass || '',
    m3u:  getM3u(opts),
  };
}

// ---------------------------------------------------------------------------
// getAct — pure: the active Acct for the given id, or null.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function getAct(accts, actId) {
  if (!actId) return null;
  const hit = accts.find(function byId(a) { return a.id === actId; });
  return hit || null;
}

// ---------------------------------------------------------------------------
// isSame — pure predicate: two connections share identity (url+user+m3u).
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function isSame(a, b) {
  return a.url === b.url && a.user === b.user && a.m3u === b.m3u;
}

// ---------------------------------------------------------------------------
// addAcct — pure: a new array with acct appended, or with the existing
// same-identity account replaced (dedupe by url+user+m3u) — never a duplicate.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function addAcct(accts, acct) {
  const idx = accts.findIndex(function bySame(a) { return isSame(a, acct); });
  if (idx === -1) return accts.concat([acct]);
  const out = accts.slice();
  out[idx] = acct;
  return out;
}

// ---------------------------------------------------------------------------
// rmAcct — pure: a new array without the account carrying that id.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function rmAcct(accts, id) {
  return accts.filter(function notId(a) { return a.id !== id; });
}

// ---------------------------------------------------------------------------
// saveAccts — writes the accounts list to iptv_accts.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function saveAccts(accts) {
  const S  = window.S;
  const ls = window.localStorage;
  try { ls.setItem(S.acctsKey, JSON.stringify(accts)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// saveAct — writes the active account id to iptv_act.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function saveAct(actId) {
  const S  = window.S;
  const ls = window.localStorage;
  try { ls.setItem(S.actKey, String(actId)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// getOld — pure: legacy iptv_creds value → a one-account { accts, actId }
// store, or null when the value is not a usable object. Mints an Acct with
// the m3u mode resolved via getM3u (ADR-0008).
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function getOld(creds) {
  if (!creds || typeof creds !== 'object') return null;
  const acct = mkAcct(creds);
  return { accts: [acct], actId: acct.id };
}

// ---------------------------------------------------------------------------
// loadAccts — read of iptv_accts + iptv_act → { accts, actId }. Values
// failing JSON.parse are treated as absent ([] / null). When no accounts
// exist but a valid legacy iptv_creds does, it is migrated once: wrapped into
// one saved + active account, the new keys written, and iptv_creds removed.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function loadAccts() {
  const ls = window.localStorage;
  let accts = [];
  let actId = null;
  try {
    const a = JSON.parse(ls.getItem(window.S.acctsKey));
    if (Array.isArray(a)) accts = a;
  } catch (e) {}
  try { actId = ls.getItem(window.S.actKey); } catch (e) {}
  if (accts.length > 0) return { accts, actId: actId || null };
  return runMig(ls);
}

// ---------------------------------------------------------------------------
// runMig — runs legacy iptv_creds migration when accounts are empty;
// persists the new keys and clears iptv_creds, or returns the empty store.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function runMig(ls) {
  let creds = null;
  try { creds = JSON.parse(ls.getItem('iptv_creds')); } catch (e) {}
  const old = getOld(creds);
  if (!old) return { accts: [], actId: null };
  saveAccts(old.accts);
  saveAct(old.actId);
  try { ls.removeItem('iptv_creds'); } catch (e) {}
  return old;
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
  mkAcct,
  getAct,
  addAcct,
  rmAcct,
  saveAccts,
  saveAct,
  loadAccts,
};
