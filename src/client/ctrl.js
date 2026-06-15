// ADR: ADR-0039
/* global window, document, HTMLVideoElement */

'use strict';

// ---------------------------------------------------------------------------
// In-player controls layer (ADR-0039, specs/player-controls.md). Client-only
// control primitives over the resolved shared <video> (#player-video) and the
// #player-card region: feature-detection predicates, fullscreen / PiP toggles,
// media actions (play/pause, mute, volume up/down), and state-sync
// subscriptions. Introduces no server route, no engine, no state-machine phase.
//
// Pure-where-possible: hasFs / hasPip are pure predicates; every native API is
// reached through window / document / the element so unit tests can mock the
// Fullscreen / PiP surfaces and a fake <video>. Nothing throws when an API is
// absent — each toggle is a silent no-op where its capability is missing.
//
// Module-level element/callback refs use unique top-level binding names
// (leading _ctrl prefix) to avoid the recurring "Identifier already declared"
// shared-window-scope collision — the non-module client scripts share one
// global scope.
// ---------------------------------------------------------------------------
let _ctrlVid  = null;   // resolved <video> reference (#player-video)
let _ctrlCard = null;   // #player-card region (fullscreen target)
let _ctrlRnd  = null;   // render callback invoked on browser state change

// ---------------------------------------------------------------------------
// hasFs — pure predicate: the Fullscreen API is usable. True when the card
// element exposes requestFullscreen (or the webkit prefix) AND the document
// does not explicitly disable it (fullscreenEnabled !== false). Reached via
// the element / document so tests can mock it; false where the card is unset.
// ---------------------------------------------------------------------------
function hasFs() {
  const el = _ctrlCard;
  if (!el) return false;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  return Boolean(req) && document.fullscreenEnabled !== false;
}

// ---------------------------------------------------------------------------
// hasPip — pure predicate: Picture-in-Picture is usable. True only when the
// document advertises pictureInPictureEnabled === true AND the video prototype
// carries requestPictureInPicture. False otherwise (e.g. iOS Safari).
// ---------------------------------------------------------------------------
function hasPip() {
  return document.pictureInPictureEnabled === true
    && Boolean(window.HTMLVideoElement
      && window.HTMLVideoElement.prototype
      && window.HTMLVideoElement.prototype.requestPictureInPicture);
}

// ---------------------------------------------------------------------------
// isFs — pure predicate: a fullscreen element is currently active (the card or
// any element), via the standard or webkit accessor. Drives state sync.
// ---------------------------------------------------------------------------
function isFs() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

// ---------------------------------------------------------------------------
// isPip — pure predicate: the <video> is the active PiP element.
// ---------------------------------------------------------------------------
function isPip() {
  return Boolean(_ctrlVid && document.pictureInPictureElement === _ctrlVid);
}

// ---------------------------------------------------------------------------
// swallow — attaches a no-op rejection handler to a thenable so a rejected
// request/exit promise is silently absorbed (user-gesture missing, blocked,
// unsupported codec). Guarded for the prefixed paths that return undefined.
// ---------------------------------------------------------------------------
function swallow(p) {
  if (p && p.catch) p.catch(function noop() {});
}

// ---------------------------------------------------------------------------
// toggleFs — request/exit native fullscreen on #player-card, using the
// standard API with the webkit-prefixed fallback. No-op when hasFs() is false;
// a rejected promise is swallowed. State follows the fullscreenchange event,
// never an optimistic guess (ADR-0039, specs §2a).
// ---------------------------------------------------------------------------
function toggleFs() {
  if (!hasFs()) return;
  if (isFs()) {
    swallow((document.exitFullscreen || document.webkitExitFullscreen).call(document));
    return;
  }
  const el = _ctrlCard;
  swallow((el.requestFullscreen || el.webkitRequestFullscreen).call(el));
}

// ---------------------------------------------------------------------------
// togglePip — request/exit native PiP on the <video> (document exit). No-op
// when hasPip() is false; a rejected promise is swallowed. State follows the
// enter/leave picture-in-picture events (ADR-0039, specs §2b).
// ---------------------------------------------------------------------------
function togglePip() {
  if (!hasPip() || !_ctrlVid) return;
  if (isPip()) {
    swallow(document.exitPictureInPicture());
    return;
  }
  swallow(_ctrlVid.requestPictureInPicture());
}

// ---------------------------------------------------------------------------
// togglePlay — play when paused, pause when playing, on the shared <video>.
// A rejected play() promise (autoplay policy) is swallowed. No-op when the
// element is unset.
// ---------------------------------------------------------------------------
function togglePlay() {
  if (!_ctrlVid) return;
  if (_ctrlVid.paused) {
    swallow(_ctrlVid.play());
    return;
  }
  _ctrlVid.pause();
}

// ---------------------------------------------------------------------------
// toggleMute — flip the <video> muted flag and persist via IptvSt.setMuted
// (ADR-0040). No-op when the element is unset.
// ---------------------------------------------------------------------------
function toggleMute() {
  if (!_ctrlVid) return;
  const nxt = !_ctrlVid.muted;
  _ctrlVid.muted = nxt;
  window.IptvSt.setMuted(nxt);
}

// ---------------------------------------------------------------------------
// clamp — pure: bound a volume value to [0, 1].
// ---------------------------------------------------------------------------
function clamp(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// ---------------------------------------------------------------------------
// stepVol — apply a signed step (±S.volStp) to ST.vol, clamp to [0,1], write it
// to video.volume, and persist via IptvSt.setVol (ADR-0040). Shared by the two
// directional helpers. No-op when the element is unset.
// ---------------------------------------------------------------------------
function stepVol(dir) {
  if (!_ctrlVid) return;
  const cur = window.IptvSt.ST.vol;
  const nxt = clamp(cur + dir * window.S.volStp);
  _ctrlVid.volume = nxt;
  window.IptvSt.setVol(nxt);
}

// ---------------------------------------------------------------------------
// volUp — step the shared volume up by S.volStp, clamped to 1.
// ---------------------------------------------------------------------------
function volUp() {
  stepVol(1);
}

// ---------------------------------------------------------------------------
// volDn — step the shared volume down by S.volStp, clamped to 0.
// ---------------------------------------------------------------------------
function volDn() {
  stepVol(-1);
}

// ---------------------------------------------------------------------------
// onSync — the single change-event listener: invokes the render callback so the
// buttons' aria-pressed / visual state follows the ACTUAL browser fullscreen /
// PiP state (e.g. an Escape-driven fullscreen exit), never an optimistic guess.
// ---------------------------------------------------------------------------
function onSync() {
  if (_ctrlRnd) _ctrlRnd();
}

// ---------------------------------------------------------------------------
// mkCtrl — init entry: stores the element references + the render callback and
// subscribes to the browser state-change events that drive state sync —
// fullscreenchange (+ webkit prefix) on the document, and the <video>'s
// enterpictureinpicture / leavepictureinpicture events. Called once from
// main.js after mkEL and after the player video reference is established.
// opts: { vid:<video>, card:#player-card, rnd:function }
// ---------------------------------------------------------------------------
function mkCtrl(opts) {
  _ctrlVid  = opts.vid || null;
  _ctrlCard = opts.card || null;
  _ctrlRnd  = opts.rnd || null;
  document.addEventListener('fullscreenchange', onSync);
  document.addEventListener('webkitfullscreenchange', onSync);
  if (_ctrlVid) {
    _ctrlVid.addEventListener('enterpictureinpicture', onSync);
    _ctrlVid.addEventListener('leavepictureinpicture', onSync);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvCtrl = {
  mkCtrl,
  hasFs,
  hasPip,
  isFs,
  isPip,
  toggleFs,
  togglePip,
  togglePlay,
  toggleMute,
  volUp,
  volDn,
};
