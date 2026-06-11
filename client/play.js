// ADR: ADR-0004
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// Module-level state — no ST mutation from this file except via IptvSt calls
// ---------------------------------------------------------------------------
let _vid = null;   // video element reference
let _hls = null;   // current Hls instance

// ---------------------------------------------------------------------------
// mkPlay — stores video element reference; called once from main.js
// ---------------------------------------------------------------------------
function mkPlay(el) {
  _vid = el;
}

// ---------------------------------------------------------------------------
// onHlsErr — fatal HLS error handler; transitions state to ERR
// ---------------------------------------------------------------------------
function onHlsErr(evt, data) {
  if (!data.fatal) return;
  window.IptvSt.setErr(data.details);
  window.IptvSt.go('ERR');
  stopPlay();
}

// ---------------------------------------------------------------------------
// onManifest — autoplay after manifest is parsed
// ---------------------------------------------------------------------------
function onManifest() {
  _vid.play().catch(function noop() {});
}

// ---------------------------------------------------------------------------
// loadHls — attach hls.js to the video element
// ---------------------------------------------------------------------------
function loadHls(url) {
  const hls = new window.Hls({ maxBufferLength: 30 });
  hls.loadSource(url);
  hls.attachMedia(_vid);
  hls.on(window.Hls.Events.MANIFEST_PARSED, onManifest);
  hls.on(window.Hls.Events.ERROR, onHlsErr);
  _hls = hls;
  return { ok: true, val: null };
}

// ---------------------------------------------------------------------------
// loadNative — set src directly for Safari native HLS
// ---------------------------------------------------------------------------
function loadNative(url) {
  _vid.src = url;
  _vid.play().catch(function noop() {});
  return { ok: true, val: null };
}

// ---------------------------------------------------------------------------
// stopPlay — destroys hls instance, clears video src
// ---------------------------------------------------------------------------
function stopPlay() {
  if (_hls) {
    _hls.destroy();
    _hls = null;
  }
  _vid.src = '';
  _vid.load();
}

// ---------------------------------------------------------------------------
// loadPlay — loads a new HLS URL; returns Result<T>
// ---------------------------------------------------------------------------
function loadPlay(url) {
  if (_hls) stopPlay();
  if (window.Hls && window.Hls.isSupported()) return loadHls(url);
  if (_vid.canPlayType('application/vnd.apple.mpegurl')) return loadNative(url);
  return { ok: false, err: 'HLS not supported' };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvPlay = { mkPlay, loadPlay, stopPlay };
