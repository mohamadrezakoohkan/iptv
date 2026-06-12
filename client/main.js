// ADR: ADR-0001, ADR-0003, ADR-0008, ADR-0013, ADR-0017, ADR-0018, ADR-0019
/* global window, document */

'use strict';

// Module-level stored state for auto-reconnect sel restoration (ADR-0003)
let _stored = null;

document.addEventListener('DOMContentLoaded', onReady);

// ---------------------------------------------------------------------------
// onConnRes — handle connect API result after auto-reconnect attempt
// ---------------------------------------------------------------------------
function onConnRes(res) {
  const { setChs, setErr, go, setCur, ST } = window.IptvSt;
  const { rndFoot, rndSide, rndGrid } = window.IptvUi;
  if (res.ok) {
    setChs(res.val.channels, res.val.categories, res.val.host, res.val.user);
    go('READY');
    if (_stored && _stored.sel) {
      const found = ST.chs.find(function bySel(ch) { return String(ch.id) === _stored.sel; });
      if (found) setCur(found);
    }
  } else {
    setErr(res.err);
    go('ERR');
  }
  rndFoot();
  rndSide(ST.cats, ST.chs, ST.favs);
  rndGrid(window.IptvSrch.getChs(ST.chs, ST.srch, ST.flt, ST.favs, ST.sort));
  window.IptvUi.rndHead();
}

// ---------------------------------------------------------------------------
// goLoad — transition to LOAD, connect with the active account's stored
// connection identity (incl. the stored m3u login mode — ADR-0008/ADR-0013:
// replay the chosen mode, never re-detect), delegate to onConnRes
// ---------------------------------------------------------------------------
function goLoad(acct) {
  const { go } = window.IptvSt;
  const { rndFoot } = window.IptvUi;
  go('LOAD');
  rndFoot();
  window.IptvApi.connect(acct.url, { user: acct.user, pass: acct.pass, m3u: acct.m3u })
    .then(onConnRes);
}

// ---------------------------------------------------------------------------
// onReady — DOMContentLoaded entry; initialises all modules
// ---------------------------------------------------------------------------
function onReady() {
  const { mkEL, onPhase, rndPhase, rndFoot, rndSide, rndGrid } = window.IptvUi;
  const { onPhase: regPhase, ST } = window.IptvSt;
  const { mkPlay } = window.IptvPlay;
  mkEL();
  // Reflect the persisted theme on <html> and the toggle before any connect
  // flow (ADR-0019). Default 'dark' is a visual no-op (baseline = no attribute).
  window.IptvUi.rndTheme(window.IptvSt.loadTheme());
  mkPlay(document.getElementById('player-video'));
  regPhase(rndPhase);
  rndPhase();
  rndFoot();
  rndSide([], [], []);
  rndGrid([]);
  window.IptvUi.rndAcct();
  const loadStFn = window.IptvSt.loadSt;
  _stored = loadStFn ? loadStFn() : null;
  window.IptvUi.rndSort();
  const { loadAccts, getAct } = window.IptvSt;
  const store = loadAccts ? loadAccts() : { accts: [], actId: null };
  const acct  = getAct ? getAct(store.accts, store.actId) : null;
  if (acct) {
    goLoad(acct);
  }
}
