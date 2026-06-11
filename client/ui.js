// ADR: ADR-0001, ADR-0004
/* global window, document, clearTimeout, setTimeout */

'use strict';

// ---------------------------------------------------------------------------
// Element registry — fully declared, never extended (CONVENTIONS §10)
// ---------------------------------------------------------------------------
const EL = {
  list: null,   // .ch-grid / #ch-list
  play: null,   // #player-video
  srch: null,   // #search
  info: null,   // #now-info
  err:  null,   // #player-err
  nav:  null,   // #grp-nav / .sidebar-list
  foot: null,   // #footer-form
  card: null,   // #player-card
  idle: null,   // #player-idle
  wrap: null,   // #player-wrap
};

// ---------------------------------------------------------------------------
// Debounce state — module-level vars, TOKENS TABLE compliant
// ---------------------------------------------------------------------------
let tmp  = null;   // debounce timeout id  (tmp = temporary)
let srch = '';     // pending search query (srch = search)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Zero-pad a channel number to 3 digits. */
function fmtNum(n) {
  const s = String(n);
  if (s.length >= 3) return s;
  if (s.length === 2) return '0' + s;
  return '00' + s;
}

/** Build logo HTML string for a channel. */
function mkLogo(ch) {
  if (ch.img && ch.img.length > 0) {
    return '<img class="ch-logo" src="' + ch.img + '" alt="">';
  }
  const letter = ch.name.charAt(0).toUpperCase();
  return '<span class="ch-logo-fb">' + letter + '</span>';
}

/**
 * Build fav star HTML string.
 * @param {{ id:*, name:string }} ch
 * @param {string[]} favs
 */
function mkFav(ch, favs) {
  const on    = favs.indexOf(String(ch.id)) !== -1 ? ' on' : '';
  const label = on ? 'Remove from favourites' : 'Add to favourites';
  return '<span class="ch-fav' + on + '" role="button" tabindex="0" data-fav="'
    + ch.id + '" aria-label="' + label + '">&#9733;</span>';
}

/**
 * Build a single channel card HTML string.
 * Reads ST.cur and ST.favs from window.IptvSt.
 * @param {Object} ch - Ch object
 */
function mkCard(ch) {
  const st   = window.IptvSt.ST;
  const favs = st.favs;
  const cur  = st.cur;
  const active = (cur && String(cur.id) === String(ch.id)) ? ' ch-active' : '';
  return '<div class="ch-card' + active + '" role="button" tabindex="0" data-id="' + ch.id + '">'
    + '<div class="ch-card-top">'
    + '<span class="ch-num">' + fmtNum(ch.num) + '</span>'
    + mkLogo(ch)
    + mkFav(ch, favs)
    + '</div>'
    + '<span class="ch-name">' + ch.name + '</span>'
    + '</div>';
}

/**
 * Build a single category button HTML string.
 * opts: { id, label, cnt, flt }
 */
function mkCatBtn(opts) {
  const active = (opts.flt === opts.id) ? ' active' : '';
  return '<button class="cat-btn' + active + '" data-cat="' + opts.id + '">'
    + '<span class="cat-label">' + opts.label + '</span>'
    + '<span class="cat-count">' + opts.cnt + '</span>'
    + '</button>';
}

// ---------------------------------------------------------------------------
// fireSrch — executes debounced search; reads module-level srch
// ---------------------------------------------------------------------------
function fireSrch() {
  const st = window.IptvSt.ST;
  window.IptvSt.setSrch(srch);
  rndGrid(window.IptvSrch.getChs(st.chs, srch, st.flt, st.favs));
}

// ---------------------------------------------------------------------------
// onSrch — captures search value then arms debounce timer
// ---------------------------------------------------------------------------
function onSrch(evt) {
  srch = evt.target.value;
  clearTimeout(tmp);
  tmp = setTimeout(fireSrch, 200);
}

// ---------------------------------------------------------------------------
// onCatClick — event-delegated click handler on EL.nav
// ---------------------------------------------------------------------------
function onCatClick(evt) {
  const btn = evt.target.closest('[data-cat]');
  if (!btn) return;
  const cat = btn.getAttribute('data-cat');
  const st  = window.IptvSt.ST;
  window.IptvSt.setFlt(cat);
  rndSide(st.cats, st.chs, st.favs);
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, cat, st.favs));
}

// ---------------------------------------------------------------------------
// toggleFav — toggle a channel in ST.favs; updates star element in-place
// ---------------------------------------------------------------------------
function toggleFav(id) {
  const st   = window.IptvSt.ST;
  const idx  = st.favs.indexOf(id);
  const nxt  = idx === -1 ? st.favs.concat([id]) : st.favs.filter(function notId(x) { return x !== id; });
  window.IptvSt.setFavs(nxt);
  const star = document.querySelector('[data-fav="' + id + '"]');
  if (!star) return;
  star.className = 'ch-fav' + (nxt.includes(id) ? ' on' : '');
  star.setAttribute('aria-label', nxt.includes(id) ? 'Remove from favourites' : 'Add to favourites');
}

// ---------------------------------------------------------------------------
// onGridClick — event-delegated click handler on EL.list (ch-grid)
// ---------------------------------------------------------------------------
function onGridClick(evt) {
  const fav  = evt.target.closest('[data-fav]');
  if (fav) { toggleFav(fav.getAttribute('data-fav')); return; }
  const card = evt.target.closest('[data-id]');
  if (!card) return;
  const id = card.getAttribute('data-id');
  const st = window.IptvSt.ST;
  const ch = st.chs.find(function byId(c) { return String(c.id) === id; });
  if (!ch) return;
  window.IptvSt.setCur(ch);
  if (window.IptvSt.ST.phase === 'READY') window.IptvSt.go('PLAY');
  if (window.IptvPlay) window.IptvPlay.loadPlay(ch.url);
}

// ---------------------------------------------------------------------------
// onGridKey — keyboard handler on EL.list for Enter key
// ---------------------------------------------------------------------------
function onGridKey(evt) {
  if (evt.key !== 'Enter') return;
  onGridClick(evt);
}

// ---------------------------------------------------------------------------
// mkEL — initialize EL from DOM, wire event listeners
// ---------------------------------------------------------------------------
function mkEL() {
  EL.list = document.getElementById('ch-list');
  EL.play = document.getElementById('player-video');
  EL.srch = document.getElementById('search');
  EL.info = document.getElementById('now-info');
  EL.err  = document.getElementById('player-err');
  EL.nav  = document.getElementById('grp-nav');
  EL.foot = document.getElementById('footer-form');
  EL.card = document.getElementById('player-card');
  EL.idle = document.getElementById('player-idle');
  EL.wrap = document.getElementById('player-wrap');
  if (EL.srch) EL.srch.addEventListener('input', onSrch);
  if (EL.nav)  EL.nav.addEventListener('click', onCatClick);
  if (EL.list) EL.list.addEventListener('click', onGridClick);
  if (EL.list) EL.list.addEventListener('keydown', onGridKey);
}

// ---------------------------------------------------------------------------
// rndGrid — render channel cards into .ch-grid
// ---------------------------------------------------------------------------
function rndGrid(chs) {
  if (!EL.list) return;
  if (!chs || chs.length === 0) {
    EL.list.innerHTML = '<p class="ch-empty">No channels found.</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < chs.length; i += 1) {
    html += mkCard(chs[i]);
  }
  EL.list.innerHTML = html;
}

// ---------------------------------------------------------------------------
// rndSide — render sidebar category list
// ---------------------------------------------------------------------------
function rndSide(cats, chs, favs) {
  if (!EL.nav) return;
  const flt    = window.IptvSt.ST.flt;
  const totAct = (flt === 'all') ? ' active' : '';
  let html = '<button class="cat-btn' + totAct + '" data-cat="all">'
    + '<span class="cat-label">All Channels</span>'
    + '<span class="cat-count">' + chs.length + '</span>'
    + '</button>';
  if (favs.length > 0) {
    const favAct = (flt === 'favs') ? ' active' : '';
    html += '<button class="cat-btn' + favAct + '" data-cat="favs">'
      + '<span class="cat-label">Favourites</span>'
      + '<span class="cat-count">' + favs.length + '</span>'
      + '</button>';
  }
  for (let i = 0; i < cats.length; i += 1) {
    const cat = cats[i];
    const cnt = chs.filter(function byCat(ch) { return ch.cat === cat.id; }).length;
    html += mkCatBtn({ id: cat.id, label: cat.name, cnt, flt });
  }
  EL.nav.innerHTML = html;
}

// ---------------------------------------------------------------------------
// rndHead — update content-head with current channel name
// ---------------------------------------------------------------------------
function rndHead() {
  if (!EL.info) return;
  const st = window.IptvSt.ST;
  EL.info.textContent = st.cur ? st.cur.name : '';
}

// ---------------------------------------------------------------------------
// rndFooter — toggle footer visibility class based on ST.phase
// ---------------------------------------------------------------------------
function rndFooter() {
  if (!EL.foot) return;
  const st     = window.IptvSt.ST;
  const isConn = st.phase === 'READY' || st.phase === 'PLAY' || st.phase === 'SRCH';
  EL.foot.classList.toggle('hidden', isConn);
}

// ---------------------------------------------------------------------------
// rndPlayer — update player-card visibility based on current phase
// ---------------------------------------------------------------------------
function rndPlayer() {
  const st   = window.IptvSt.ST;
  const play = st.phase === 'PLAY';
  const err  = st.phase === 'ERR' && st.cur !== null;
  if (EL.wrap) EL.wrap.style.display = err ? 'block' : '';
  if (EL.card) EL.card.classList.toggle('player-idle', !play);
  if (EL.idle) EL.idle.style.display = play ? 'none' : '';
  if (EL.play) EL.play.style.display = play ? '' : 'none';
  if (EL.err) {
    EL.err.style.display = err ? '' : 'none';
    if (err) EL.err.textContent = st.err ? st.err : '';
  }
}

// ---------------------------------------------------------------------------
// rndPhase — apply body.is-{phase} CSS class from ST.phase
// ---------------------------------------------------------------------------
function rndPhase() {
  const st     = window.IptvSt.ST;
  const phases = ['INIT', 'LOAD', 'READY', 'PLAY', 'SRCH', 'ERR'];
  for (let i = 0; i < phases.length; i += 1) {
    document.body.classList.remove('is-' + phases[i].toLowerCase());
  }
  if (st.phase) {
    document.body.classList.add('is-' + st.phase.toLowerCase());
  }
  rndPlayer();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvUi = { mkEL, mkCard, toggleFav, rndSide, rndGrid, rndHead, rndFooter, rndPhase };
