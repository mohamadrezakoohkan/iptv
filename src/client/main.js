// ADR: ADR-0001, ADR-0003, ADR-0008, ADR-0013, ADR-0017, ADR-0019, ADR-0030, ADR-0034, ADR-0039
/* global window, document, setInterval */

'use strict';

// Module-level stored state for auto-reconnect sel restoration (ADR-0003)
let _stored = null;

// Module-level account being reconnected, so onConnRes can kick off its EPG
// fetch with the same stored connection identity (ADR-0030).
let _acct = null;

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
  // Best-effort, non-blocking EPG fetch after the channels are rendered
  // (ADR-0030). Guarded: a missing goEpg (test isolation) is a silent no-op.
  if (res.ok && _acct && window.IptvUi.goEpg) {
    window.IptvUi.goEpg({ src: _acct.url, user: _acct.user, pass: _acct.pass, m3u: _acct.m3u, chs: ST.chs, epgUrl: res.val.epgUrl });
  }
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
  _acct = acct;
  window.IptvApi.connect(acct.url, { user: acct.user, pass: acct.pass, m3u: acct.m3u })
    .then(onConnRes);
}

// ---------------------------------------------------------------------------
// onTick — one reminder-timer tick (ADR-0034, specs/reminders.md §5). Reads the
// newly-due reminders via the pure IptvRem.due(now) selector, fires each once
// through the firing surface (window.IptvUi.fireRem, TASK-0069), then removes it
// from the store so it never re-fires on a later tick. A guarded no-op when
// window.IptvRem is absent (test isolation) and a silent no-op when no guide is
// loaded / the store is empty (due returns []). Nothing throws, nothing blocks
// browsing.
// ---------------------------------------------------------------------------
function onTick() {
  const rem = window.IptvRem;
  if (!rem) return;
  const due  = rem.due(Date.now());
  const fire = window.IptvUi ? window.IptvUi.fireRem : null;
  for (let i = 0; i < due.length; i += 1) {
    if (fire) fire(due[i]);
    rem.rm(due[i].chId, due[i].start);
  }
}

// ---------------------------------------------------------------------------
// mkCtrls — initialise the in-player controls layer (ADR-0039,
// specs/player-controls.md §3). Wires IptvCtrl to the resolved <video> and the
// #player-card region with rndCtrls as the browser state-sync callback, applies
// the persisted volume/mute preference (loadVol) to ST and the <video>
// (video.volume / video.muted), then renders the controls chrome (feature-detect
// hide + current state) before any connect flow. Guarded so a missing IptvCtrl /
// IptvUi (test isolation) is a silent no-op.
// ---------------------------------------------------------------------------
function mkCtrls(vid) {
  const ctrl = window.IptvCtrl;
  if (!ctrl) return;
  const card = document.getElementById('player-card');
  ctrl.mkCtrl({ vid, card, rnd: window.IptvUi.rndCtrls });
  const pref = window.IptvSt.loadVol();
  window.IptvSt.setVol(pref.vol);
  window.IptvSt.setMuted(pref.muted);
  if (vid) { vid.volume = pref.vol; vid.muted = pref.muted; }
  window.IptvUi.rndCtrls();
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
  const vid = document.getElementById('player-video');
  mkPlay(vid);
  // In-player controls layer (ADR-0039, specs/player-controls.md §3): init
  // IptvCtrl over the resolved <video> / #player-card with rndCtrls as the
  // browser state-sync callback, apply the persisted volume/mute preference
  // (loadVol → ST + <video>), and render the controls chrome (feature-detect
  // hide + state) before any connect flow. All guarded for test isolation.
  mkCtrls(vid);
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
  // Reminders survive a page reload: restore the persisted store, then start
  // the single coarse reminder timer (ADR-0034, specs/reminders.md §5). Both
  // guarded: a missing IptvRem (test isolation) is a silent no-op.
  if (window.IptvRem) window.IptvRem.load();
  setInterval(onTick, window.S ? window.S.remTick : 20000);
}
