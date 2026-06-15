// ADR: ADR-0001, ADR-0003, ADR-0008, ADR-0013, ADR-0015, ADR-0017, ADR-0019, ADR-0040
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
  sort:   'num-asc',
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
// ---------------------------------------------------------------------------
// Known sort tokens (ADR-0017) — the persistence guard. Mirrors IptvSrch.SORTS
// ids; kept here so loadSt validates without depending on a higher module
// (§12: srch.js loads after st.js). SORTS in srch.js stays the UI source.
// Named SRTS (not SORTS) to avoid colliding with srch.js's SORTS in the shared
// browser global scope — non-module client scripts share one scope.
// ---------------------------------------------------------------------------
const SRTS = ['num-asc', 'name-asc', 'name-desc', 'fav-first'];

// ---------------------------------------------------------------------------
// Theme tokens (ADR-0019) — the two valid theme values + the default. Theme is
// presentational chrome, NOT an ST phase field (§6 unaffected): it lives here
// only because st.js owns localStorage read/write. Named THMS / THM_DEF
// (unique across the shared non-module client scope) to avoid an "Identifier
// already declared" load error — the recurring shared-window-scope lesson.
// ADR: ADR-0019
// ---------------------------------------------------------------------------
const THMS    = ['light', 'dark'];
const THM_DEF = 'dark';

// ---------------------------------------------------------------------------
// Volume/mute preference defaults (ADR-0040) — the fallback applied when
// iptv_vol is absent, malformed, or out of range. Mirrors the ST.vol / ST.muted
// initial values. Volume/mute is presentational chrome, NOT an ST phase field
// (§6 unaffected): it lives here only because st.js owns localStorage
// read/write. Named VOL_DEF / MUT_DEF (unique across the shared non-module
// client scope) to avoid an "Identifier already declared" load error — the
// recurring shared-window-scope lesson.
// ADR: ADR-0040
// ---------------------------------------------------------------------------
const VOL_DEF = 1.0;
const MUT_DEF = false;

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

// ---------------------------------------------------------------------------
// setSort — the only writer of ST.sort (ADR-0017). Stores the token verbatim;
// getChs (srch.js) treats an unknown token as the num-asc default.
// ADR: ADR-0017
// ---------------------------------------------------------------------------
function setSort(tok) {
  ST.sort = tok;
}

// ---------------------------------------------------------------------------
// setVol — writes ST.vol then persists the client-wide volume/mute preference
// (ADR-0040), mirroring how sort persists on write. saveVol is guarded against
// localStorage exceptions, so this never throws.
// ADR: ADR-0040
// ---------------------------------------------------------------------------
function setVol(v) {
  ST.vol = v;
  saveVol();
}

// ---------------------------------------------------------------------------
// setMuted — writes ST.muted then persists the client-wide volume/mute
// preference (ADR-0040).
// ADR: ADR-0040
// ---------------------------------------------------------------------------
function setMuted(b) {
  ST.muted = b;
  saveVol();
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
// loadSt — reads the sel and favs localStorage keys; populates ST.favs and
// returns { sel } — called once on page load before any phase transition.
// Credential reconnect is owned by the accounts store (loadAccts, ADR-0013);
// the legacy single-record iptv_creds path was removed in TASK-0029. The
// iptv_sel + iptv_favs decisions remain in force under ADR-0003.
// ADR: ADR-0003
// ---------------------------------------------------------------------------
function loadSt() {
  const S     = window.S;
  const ls    = window.localStorage;
  let sel     = null;
  try { sel = ls.getItem(S.selKey); } catch (e) {}
  try {
    const f = JSON.parse(ls.getItem(S.favsKey));
    if (Array.isArray(f)) ST.favs = f;
  } catch (e) {}
  try {
    const srt = ls.getItem(S.sortKey);
    if (SRTS.indexOf(srt) !== -1) ST.sort = srt;
  } catch (e) {}
  return { sel: sel || null };
}

// ---------------------------------------------------------------------------
// saveSt — writes one localStorage key after a state mutation.
// field: 'favs' | 'sel' | 'sort'
// ADR: ADR-0003, ADR-0017
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
  if (fld === 'sort') {
    try { ls.setItem(S.sortKey, String(ST.sort)); } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// loadTheme — reads the persisted theme token from iptv_theme (ADR-0019).
// Returns the stored token only when it is exactly 'light' or 'dark';
// any absent, empty, unrecognised, or non-string value (and any localStorage
// access exception) falls back to the THM_DEF ('dark') default. Never throws.
// ADR: ADR-0019
// ---------------------------------------------------------------------------
function loadTheme() {
  const ls = window.localStorage;
  let val  = null;
  try { val = ls.getItem(window.S.themeKey); } catch (e) {}
  if (THMS.indexOf(val) !== -1) return val;
  return THM_DEF;
}

// ---------------------------------------------------------------------------
// saveTheme — persists a theme token (string) to iptv_theme (ADR-0019).
// Guarded against localStorage exceptions like the other writers. The caller
// (onTheme, TASK-0038) passes a valid 'light'/'dark' token.
// ADR: ADR-0019
// ---------------------------------------------------------------------------
function saveTheme(thm) {
  const ls = window.localStorage;
  try { ls.setItem(window.S.themeKey, String(thm)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// loadVol — reads the persisted volume/mute preference from iptv_vol
// (ADR-0040). Returns { vol, muted } only when the stored JSON is an object
// with a finite vol clamped to [0,1] and a boolean muted; any absent,
// malformed, out-of-range, or wrong-type value (and any localStorage / JSON
// access exception) falls back to the defaults (VOL_DEF 1.0, MUT_DEF false).
// Never throws. Volume/mute is chrome, not an ST phase field.
// ADR: ADR-0040
// ---------------------------------------------------------------------------
function loadVol() {
  const ls = window.localStorage;
  let pref = null;
  try { pref = JSON.parse(ls.getItem(window.S.volKey)); } catch (e) {}
  if (!pref || typeof pref !== 'object') return { vol: VOL_DEF, muted: MUT_DEF };
  const vol = pref.vol;
  const mut = pref.muted;
  if (typeof vol !== 'number' || !isFinite(vol) || vol < 0 || vol > 1) {
    return { vol: VOL_DEF, muted: MUT_DEF };
  }
  if (typeof mut !== 'boolean') return { vol: VOL_DEF, muted: MUT_DEF };
  return { vol: vol, muted: mut };
}

// ---------------------------------------------------------------------------
// saveVol — serialises the current ST.vol / ST.muted to iptv_vol as
// { vol, muted } JSON (ADR-0040). Guarded against localStorage exceptions like
// the other writers. Called by setVol / setMuted on every change.
// ADR: ADR-0040
// ---------------------------------------------------------------------------
function saveVol() {
  const ls  = window.localStorage;
  const out = { vol: ST.vol, muted: ST.muted };
  try { ls.setItem(window.S.volKey, JSON.stringify(out)); } catch (e) {}
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
// clearAct — removes the active account id key (iptv_act). Used on disconnect
// and when the active account is removed; the saved accounts list is left
// intact.
// ADR: ADR-0013
// ---------------------------------------------------------------------------
function clearAct() {
  const S  = window.S;
  const ls = window.localStorage;
  try { ls.removeItem(S.actKey); } catch (e) {}
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
// getPst — pure: a community preset's (ADR-0015) connection identity. Returns
// the M3U connection options shaped for both connect() (url/user/pass/m3u) and
// mkAcct() (adds host = the preset url). No side effects; input untouched.
// ADR: ADR-0015
// ---------------------------------------------------------------------------
function getPst(pst) {
  return { url: pst.url, user: '', pass: '', m3u: true, host: pst.url };
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
  setSort,
  setVol,
  setMuted,
  setFavs,
  getM3u,
  loadSt,
  saveSt,
  loadTheme,
  saveTheme,
  loadVol,
  saveVol,
  mkAcct,
  getAct,
  addAcct,
  rmAcct,
  saveAccts,
  saveAct,
  clearAct,
  loadAccts,
  getPst,
};
