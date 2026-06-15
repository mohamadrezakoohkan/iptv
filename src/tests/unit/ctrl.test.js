// ADR: ADR-0039
// Unit tests — the in-player controls module src/client/ctrl.js
// (window.IptvCtrl) for TASK-0085. Loads ctrl.js into a fabricated window with
// a mocked document (Fullscreen / PiP surfaces), a fake <video>, and the real
// cfg.js + st.js (for S.volStp and IptvSt.setVol / setMuted). Covers feature
// detection true/false branches (incl. an iOS-Safari-like no-PiP), the toggles
// dispatching the right request/exit and swallowing rejected promises, the
// media actions, volume stepping + clamping, and the state-sync subscription.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const CFG_SRC    = join(__dir, '../../client/cfg.js');
const ST_SRC     = join(__dir, '../../client/st.js');
const CTRL_SRC   = join(__dir, '../../client/ctrl.js');

// ---------------------------------------------------------------------------
// mkVid — a fake <video> recording calls. paused/muted/volume are plain fields
// so the toggles read/write them like the real element; play/pause/PiP methods
// record invocation and return a resolved (or, when asked, rejected) promise so
// the swallow path is exercised. Carries an addEventListener spy.
// ---------------------------------------------------------------------------
function mkVid(opts) {
  const o = opts || {};
  const calls = { play: 0, pause: 0, reqPip: 0 };
  const listeners = {};
  return {
    paused: 'paused' in o ? o.paused : true,
    muted:  'muted' in o ? o.muted : false,
    volume: 'volume' in o ? o.volume : 1,
    calls,
    listeners,
    play: function play() {
      calls.play += 1;
      return o.playRejects ? Promise.reject(new Error('autoplay')) : Promise.resolve();
    },
    pause: function pause() { calls.pause += 1; },
    requestPictureInPicture: function reqPip() {
      calls.reqPip += 1;
      return o.pipRejects ? Promise.reject(new Error('blocked')) : Promise.resolve({});
    },
    addEventListener: function addEventListener(type, cb) { listeners[type] = cb; },
  };
}

// ---------------------------------------------------------------------------
// mkCard — a fake #player-card recording requestFullscreen calls. Presence of
// requestFullscreen (or webkitRequestFullscreen, when prefixed:true) drives
// hasFs; fsRejects makes the request reject so the swallow path runs.
// ---------------------------------------------------------------------------
function mkCard(opts) {
  const o = opts || {};
  const calls = { req: 0, webkitReq: 0 };
  const card = { calls };
  function req() {
    calls.req += 1;
    return o.fsRejects ? Promise.reject(new Error('gesture')) : Promise.resolve();
  }
  function webkitReq() {
    calls.webkitReq += 1;
    return Promise.resolve();
  }
  if (o.none) return card;            // neither method — Fullscreen unavailable
  if (o.prefixed) card.webkitRequestFullscreen = webkitReq;
  else card.requestFullscreen = req;
  return card;
}

// ---------------------------------------------------------------------------
// mkDoc — a fake document with the Fullscreen / PiP surfaces under test and an
// addEventListener spy. opts toggles each capability and the current state.
// ---------------------------------------------------------------------------
function mkDoc(opts) {
  const o = opts || {};
  const calls = { exitFs: 0, exitPip: 0 };
  const listeners = {};
  const doc = {
    fullscreenEnabled: 'fullscreenEnabled' in o ? o.fullscreenEnabled : true,
    pictureInPictureEnabled: 'pip' in o ? o.pip : true,
    fullscreenElement: o.fsEl || null,
    webkitFullscreenElement: o.webkitFsEl || null,
    pictureInPictureElement: o.pipEl || null,
    calls,
    listeners,
    exitFullscreen: function exitFullscreen() {
      calls.exitFs += 1;
      return o.exitFsRejects ? Promise.reject(new Error('x')) : Promise.resolve();
    },
    exitPictureInPicture: function exitPictureInPicture() {
      calls.exitPip += 1;
      return o.exitPipRejects ? Promise.reject(new Error('x')) : Promise.resolve();
    },
    addEventListener: function addEventListener(type, cb) { listeners[type] = cb; },
  };
  return doc;
}

// ---------------------------------------------------------------------------
// mkWin — fabricate a window with cfg.js + st.js loaded (real S / IptvSt), a
// mocked document, an HTMLVideoElement carrying (or lacking) the PiP prototype
// method, then load ctrl.js. opts.noPipProto omits requestPictureInPicture from
// the prototype (the iOS-Safari-like no-PiP shape). Returns { win, doc }.
// ---------------------------------------------------------------------------
function mkWin(opts) {
  const o   = opts || {};
  const doc = o.doc || mkDoc();
  const store = {};
  const ls = {
    getItem:    function getItem(k)    { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function setItem(k, v) { store[k] = String(v); },
    removeItem: function removeItem(k) { delete store[k]; },
  };
  const proto = {};
  if (!o.noPipProto) proto.requestPictureInPicture = function reqPip() { return Promise.resolve({}); };
  const win = {
    localStorage: ls,
    document: doc,
    HTMLVideoElement: { prototype: proto },
  };
  const cfgSrc = readFileSync(CFG_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + cfgSrc)(win);
  const stSrc = readFileSync(ST_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + stSrc)(win);
  const ctrlSrc = readFileSync(CTRL_SRC, 'utf8');
  // ctrl.js references bare `document` and `HTMLVideoElement`; supply both.
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'HTMLVideoElement', '"use strict";\n' + ctrlSrc)(win, doc, win.HTMLVideoElement);
  return { win, doc };
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------
describe('IptvCtrl — public API', function () {
  it('exposes window.IptvCtrl with the documented members', function () {
    const win = mkWin().win;
    const c = win.IptvCtrl;
    ['mkCtrl', 'hasFs', 'hasPip', 'toggleFs', 'togglePip', 'togglePlay',
      'toggleMute', 'volUp', 'volDn'].forEach(function chk(name) {
      expect(typeof c[name]).toBe('function');
    });
  });
});

// ---------------------------------------------------------------------------
// hasFs — feature detection true / false branches
// ---------------------------------------------------------------------------
describe('hasFs() — Fullscreen feature detection', function () {
  it('is true when the card has requestFullscreen and fullscreenEnabled is not false', function () {
    const win = mkWin().win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    expect(win.IptvCtrl.hasFs()).toBe(true);
  });

  it('is true via the webkit-prefixed request method', function () {
    const win = mkWin().win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard({ prefixed: true }) });
    expect(win.IptvCtrl.hasFs()).toBe(true);
  });

  it('is false when the card exposes no request method', function () {
    const win = mkWin().win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard({ none: true }) });
    expect(win.IptvCtrl.hasFs()).toBe(false);
  });

  it('is false when document.fullscreenEnabled is explicitly false', function () {
    const win = mkWin({ doc: mkDoc({ fullscreenEnabled: false }) }).win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    expect(win.IptvCtrl.hasFs()).toBe(false);
  });

  it('is false before mkCtrl establishes the card reference', function () {
    const win = mkWin().win;
    expect(win.IptvCtrl.hasFs()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasPip — feature detection true / false branches (incl. iOS-Safari-like)
// ---------------------------------------------------------------------------
describe('hasPip() — PiP feature detection', function () {
  it('is true when pictureInPictureEnabled and the prototype method are present', function () {
    const win = mkWin().win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    expect(win.IptvCtrl.hasPip()).toBe(true);
  });

  it('is false when pictureInPictureEnabled is not true', function () {
    const win = mkWin({ doc: mkDoc({ pip: false }) }).win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    expect(win.IptvCtrl.hasPip()).toBe(false);
  });

  it('is false when the prototype lacks requestPictureInPicture (iOS Safari)', function () {
    const win = mkWin({ noPipProto: true }).win;
    win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    expect(win.IptvCtrl.hasPip()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleFs — request vs exit by current state, prefixed paths, no-op, swallow
// ---------------------------------------------------------------------------
describe('toggleFs()', function () {
  it('requests fullscreen on the card when not currently fullscreen', function () {
    const r = mkWin();
    const card = mkCard();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card });
    r.win.IptvCtrl.toggleFs();
    expect(card.calls.req).toBe(1);
    expect(r.doc.calls.exitFs).toBe(0);
  });

  it('exits fullscreen when the card is the active fullscreen element', function () {
    const card = mkCard();
    const doc = mkDoc({ fsEl: card });
    const r = mkWin({ doc });
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card });
    r.win.IptvCtrl.toggleFs();
    expect(doc.calls.exitFs).toBe(1);
    expect(card.calls.req).toBe(0);
  });

  it('uses the webkit-prefixed request method when only it is present', function () {
    const card = mkCard({ prefixed: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card });
    r.win.IptvCtrl.toggleFs();
    expect(card.calls.webkitReq).toBe(1);
  });

  it('is a no-op when hasFs() is false', function () {
    const card = mkCard({ none: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card });
    r.win.IptvCtrl.toggleFs();
    expect(card.calls.req).toBe(0);
    expect(r.doc.calls.exitFs).toBe(0);
  });

  it('swallows a rejected requestFullscreen promise', function () {
    const card = mkCard({ fsRejects: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card });
    let err = null;
    try { r.win.IptvCtrl.toggleFs(); } catch (e) { err = e; }
    expect(err).toBeNull();
    return Promise.resolve();
  });
});

// ---------------------------------------------------------------------------
// togglePip — request vs exit by current state, no-op, swallow
// ---------------------------------------------------------------------------
describe('togglePip()', function () {
  it('requests PiP on the <video> when not currently in PiP', function () {
    const vid = mkVid();
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.togglePip();
    expect(vid.calls.reqPip).toBe(1);
    expect(r.doc.calls.exitPip).toBe(0);
  });

  it('exits PiP when the <video> is the active PiP element', function () {
    const vid = mkVid();
    const doc = mkDoc({ pipEl: vid });
    const r = mkWin({ doc });
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.togglePip();
    expect(doc.calls.exitPip).toBe(1);
    expect(vid.calls.reqPip).toBe(0);
  });

  it('is a no-op when hasPip() is false (no prototype method)', function () {
    const vid = mkVid();
    const r = mkWin({ noPipProto: true });
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.togglePip();
    expect(vid.calls.reqPip).toBe(0);
    expect(r.doc.calls.exitPip).toBe(0);
  });

  it('swallows a rejected requestPictureInPicture promise', function () {
    const vid = mkVid({ pipRejects: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    let err = null;
    try { r.win.IptvCtrl.togglePip(); } catch (e) { err = e; }
    expect(err).toBeNull();
    return Promise.resolve();
  });
});

// ---------------------------------------------------------------------------
// togglePlay — play when paused, pause when playing, swallow play rejection
// ---------------------------------------------------------------------------
describe('togglePlay()', function () {
  it('plays when the <video> is paused', function () {
    const vid = mkVid({ paused: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.togglePlay();
    expect(vid.calls.play).toBe(1);
    expect(vid.calls.pause).toBe(0);
  });

  it('pauses when the <video> is playing', function () {
    const vid = mkVid({ paused: false });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.togglePlay();
    expect(vid.calls.pause).toBe(1);
    expect(vid.calls.play).toBe(0);
  });

  it('swallows a rejected play() promise', function () {
    const vid = mkVid({ paused: true, playRejects: true });
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    let err = null;
    try { r.win.IptvCtrl.togglePlay(); } catch (e) { err = e; }
    expect(err).toBeNull();
    return Promise.resolve();
  });
});

// ---------------------------------------------------------------------------
// toggleMute — flips video.muted and persists via IptvSt.setMuted
// ---------------------------------------------------------------------------
describe('toggleMute()', function () {
  let r, vid;
  beforeEach(function () {
    r = mkWin();
    vid = mkVid({ muted: false });
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
  });

  it('mutes an unmuted video and writes ST.muted true', function () {
    r.win.IptvCtrl.toggleMute();
    expect(vid.muted).toBe(true);
    expect(r.win.IptvSt.ST.muted).toBe(true);
  });

  it('unmutes a muted video and writes ST.muted false', function () {
    vid.muted = true;
    r.win.IptvCtrl.toggleMute();
    expect(vid.muted).toBe(false);
    expect(r.win.IptvSt.ST.muted).toBe(false);
  });

  it('persists through IptvSt (round-trips via loadVol)', function () {
    r.win.IptvCtrl.toggleMute();
    expect(r.win.IptvSt.loadVol().muted).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// volUp / volDn — step by S.volStp, clamp at 1 and 0, persist via setVol
// ---------------------------------------------------------------------------
describe('volUp() / volDn()', function () {
  it('volUp steps ST.vol up by S.volStp and applies to video.volume', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvSt.ST.vol = 0.5;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.volUp();
    expect(r.win.IptvSt.ST.vol).toBeCloseTo(0.6, 5);
    expect(vid.volume).toBeCloseTo(0.6, 5);
  });

  it('volDn steps ST.vol down by S.volStp and applies to video.volume', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvSt.ST.vol = 0.5;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.volDn();
    expect(r.win.IptvSt.ST.vol).toBeCloseTo(0.4, 5);
    expect(vid.volume).toBeCloseTo(0.4, 5);
  });

  it('volUp clamps to 1 (does not exceed the ceiling)', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvSt.ST.vol = 0.95;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.volUp();
    expect(r.win.IptvSt.ST.vol).toBe(1);
    expect(vid.volume).toBe(1);
  });

  it('volDn clamps to 0 (does not go below the floor)', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvSt.ST.vol = 0.05;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.volDn();
    expect(r.win.IptvSt.ST.vol).toBe(0);
    expect(vid.volume).toBe(0);
  });

  it('volUp persists the new volume through IptvSt (round-trips via loadVol)', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvSt.ST.vol = 0.5;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard() });
    r.win.IptvCtrl.volUp();
    expect(r.win.IptvSt.loadVol().vol).toBeCloseTo(0.6, 5);
  });
});

// ---------------------------------------------------------------------------
// State sync — mkCtrl subscribes and the callback fires on browser-state events
// ---------------------------------------------------------------------------
describe('mkCtrl() state-sync subscription', function () {
  it('subscribes to fullscreenchange (+ webkit) on the document', function () {
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard(), rnd: function rnd() {} });
    expect(typeof r.doc.listeners.fullscreenchange).toBe('function');
    expect(typeof r.doc.listeners.webkitfullscreenchange).toBe('function');
  });

  it('subscribes to enter/leave picture-in-picture on the <video>', function () {
    const r = mkWin();
    const vid = mkVid();
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard(), rnd: function rnd() {} });
    expect(typeof vid.listeners.enterpictureinpicture).toBe('function');
    expect(typeof vid.listeners.leavepictureinpicture).toBe('function');
  });

  it('invokes the render callback on a simulated fullscreenchange', function () {
    const r = mkWin();
    let n = 0;
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard(), rnd: function rnd() { n += 1; } });
    r.doc.listeners.fullscreenchange();
    expect(n).toBe(1);
  });

  it('invokes the render callback on a simulated enterpictureinpicture', function () {
    const r = mkWin();
    const vid = mkVid();
    let n = 0;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard(), rnd: function rnd() { n += 1; } });
    vid.listeners.enterpictureinpicture();
    expect(n).toBe(1);
  });

  it('invokes the render callback on a simulated leavepictureinpicture', function () {
    const r = mkWin();
    const vid = mkVid();
    let n = 0;
    r.win.IptvCtrl.mkCtrl({ vid, card: mkCard(), rnd: function rnd() { n += 1; } });
    vid.listeners.leavepictureinpicture();
    expect(n).toBe(1);
  });

  it('does not throw on a state-change event when no render callback was given', function () {
    const r = mkWin();
    r.win.IptvCtrl.mkCtrl({ vid: mkVid(), card: mkCard() });
    let err = null;
    try { r.doc.listeners.fullscreenchange(); } catch (e) { err = e; }
    expect(err).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Nothing throws when APIs are absent / element unset
// ---------------------------------------------------------------------------
describe('IptvCtrl — silent degrade when element/APIs absent', function () {
  it('every action is a safe no-op before mkCtrl runs', function () {
    const win = mkWin().win;
    let err = null;
    try {
      win.IptvCtrl.toggleFs();
      win.IptvCtrl.togglePip();
      win.IptvCtrl.togglePlay();
      win.IptvCtrl.toggleMute();
      win.IptvCtrl.volUp();
      win.IptvCtrl.volDn();
    } catch (e) { err = e; }
    expect(err).toBeNull();
  });
});
