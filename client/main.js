// ADR: ADR-0001, ADR-0003
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
  rndGrid(window.IptvSrch.getChs(ST.chs, ST.srch, ST.flt, ST.favs));
}

// ---------------------------------------------------------------------------
// goLoad — transition to LOAD, connect with stored creds, delegate to onConnRes
// ---------------------------------------------------------------------------
function goLoad(creds) {
  const { go } = window.IptvSt;
  const { rndFoot } = window.IptvUi;
  go('LOAD');
  rndFoot();
  window.IptvApi.connect(creds.url, { user: creds.user, pass: creds.pass })
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
  mkPlay(document.getElementById('player-video'));
  regPhase(rndPhase);
  rndPhase();
  rndFoot();
  rndSide([], [], []);
  rndGrid([]);
  const loadStFn = window.IptvSt.loadSt;
  _stored = loadStFn ? loadStFn() : null;
  if (_stored && _stored.creds) {
    goLoad(_stored.creds);
  }
}
