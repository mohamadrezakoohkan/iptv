// ADR: ADR-0001, ADR-0003, ADR-0004, ADR-0008, ADR-0010, ADR-0013, ADR-0014
/* global window, document, clearTimeout, setTimeout */

'use strict';

// ---------------------------------------------------------------------------
// Element registry — fully declared, never extended (CONVENTIONS §10)
// ---------------------------------------------------------------------------
const EL = {
  list: null,   // #ch-list (.ch-grid)
  play: null,   // #player-video
  srch: null,   // #search
  info: null,   // #now-info
  err:  null,   // #player-err
  nav:  null,   // #grp-nav / .sidebar-list
  foot: null,   // #footer
  card: null,   // #player-card
  idle: null,   // #player-idle
  wrap: null,   // #player-wrap
  url:  null,   // #f-url
  uname: null,  // #f-user
  pwd:  null,   // #f-pass
  conn: null,   // #footer-conn
  logi: null,   // #footer-login
  hint: null,   // #footer-hint
  ferr: null,   // #footer-err
  bcon: null,   // #btn-conn
  bdis: null,   // #btn-disc
  ctxt: null,   // #conn-text
  mode: null,   // #login-mode (radiogroup container)
  mxt:  null,   // #mode-xtream radio
  mm3u: null,   // #mode-m3u radio
  chls: null,   // #chip-hls format chip (ADR-0010)
  cts:  null,   // #chip-ts format chip (ADR-0010)
  apnl: null,   // #acct-panel aside (ADR-0014)
  abtn: null,   // #acct-btn nav button (ADR-0014)
  ascr: null,   // #acct-scrim backdrop (ADR-0014)
  acls: null,   // #acct-close button (ADR-0014)
  aadd: null,   // #acct-add button (ADR-0014)
  alst: null,   // #acct-list container (ADR-0014)
  acon: null,   // #acct-conn connected block (ADR-0014)
};

// Hint text per login mode (ADR-0008)
const HINT_XTR = 'Type "demo" to try a sample playlist.';
const HINT_M3U = 'Paste an .m3u / .m3u8 playlist URL — no login needed.';

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
 * Category id — normalized Xtream/M3U shape first (ADR-0009), demo fallback.
 * @param {Object} cat
 */
function getCatId(cat) {
  return cat.category_id ?? cat.id;
}

/**
 * Category label — normalized Xtream/M3U shape first (ADR-0009), demo fallback.
 * @param {Object} cat
 */
function getCatName(cat) {
  return cat.category_name ?? cat.name;
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
  if (window.IptvSt.saveSt) window.IptvSt.saveSt('favs');
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
  if (window.IptvSt.saveSt) window.IptvSt.saveSt('sel');
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
// setAcct — set account panel open/closed presentational state (ADR-0014).
// No ST phase, no boolean flag (CONVENTIONS §6): the is-open class on panel +
// scrim plus the aria attributes are the single source of truth.
// ---------------------------------------------------------------------------
function setAcct(open) {
  if (!EL.apnl || !EL.ascr || !EL.abtn) return;
  EL.apnl.classList.toggle('is-open', open);
  EL.ascr.classList.toggle('is-open', open);
  EL.abtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  EL.apnl.setAttribute('aria-hidden', open ? 'false' : 'true');
}

// ---------------------------------------------------------------------------
// onAcctBtn — nav button click: toggle the panel based on current is-open
// ---------------------------------------------------------------------------
function onAcctBtn() {
  if (!EL.apnl) return;
  setAcct(!EL.apnl.classList.contains('is-open'));
}

// ---------------------------------------------------------------------------
// onAcctClose — close button / scrim click: close the panel
// ---------------------------------------------------------------------------
function onAcctClose() {
  setAcct(false);
}

// ---------------------------------------------------------------------------
// onAcctKey — Escape keydown closes the panel only when it is open
// ---------------------------------------------------------------------------
function onAcctKey(evt) {
  if (evt.key !== 'Escape') return;
  if (!EL.apnl || !EL.apnl.classList.contains('is-open')) return;
  setAcct(false);
}

// ---------------------------------------------------------------------------
// mkEL — initialize EL from DOM, wire event listeners
// ---------------------------------------------------------------------------
function mkEL() {
  EL.list  = document.getElementById('ch-list');
  EL.play  = document.getElementById('player-video');
  EL.srch  = document.getElementById('search');
  EL.info  = document.getElementById('now-info');
  EL.err   = document.getElementById('player-err');
  EL.nav   = document.getElementById('grp-nav');
  EL.foot  = document.getElementById('footer');
  EL.card  = document.getElementById('player-card');
  EL.idle  = document.getElementById('player-idle');
  EL.wrap  = document.getElementById('player-wrap');
  EL.url   = document.getElementById('f-url');
  EL.uname = document.getElementById('f-user');
  EL.pwd   = document.getElementById('f-pass');
  EL.conn  = document.getElementById('footer-conn');
  EL.logi  = document.getElementById('footer-login');
  EL.hint  = document.getElementById('footer-hint');
  EL.ferr  = document.getElementById('footer-err');
  EL.bcon  = document.getElementById('btn-conn');
  EL.bdis  = document.getElementById('btn-disc');
  EL.ctxt  = document.getElementById('conn-text');
  EL.mode  = document.getElementById('login-mode');
  EL.mxt   = document.getElementById('mode-xtream');
  EL.mm3u  = document.getElementById('mode-m3u');
  EL.chls  = document.getElementById('chip-hls');
  EL.cts   = document.getElementById('chip-ts');
  EL.apnl  = document.getElementById('acct-panel');
  EL.abtn  = document.getElementById('acct-btn');
  EL.ascr  = document.getElementById('acct-scrim');
  EL.acls  = document.getElementById('acct-close');
  EL.aadd  = document.getElementById('acct-add');
  EL.alst  = document.getElementById('acct-list');
  EL.acon  = document.getElementById('acct-conn');
  if (EL.srch) EL.srch.addEventListener('input', onSrch);
  if (EL.nav)  EL.nav.addEventListener('click', onCatClick);
  if (EL.list) EL.list.addEventListener('click', onGridClick);
  if (EL.list) EL.list.addEventListener('keydown', onGridKey);
  const frm = document.getElementById('login-form');
  if (frm)    frm.addEventListener('submit', onConn);
  if (EL.url) EL.url.addEventListener('input', onUrlInput);
  if (EL.mode) EL.mode.addEventListener('change', onMode);
  if (EL.bdis) EL.bdis.addEventListener('click', onDisc);
  if (EL.abtn) EL.abtn.addEventListener('click', onAcctBtn);
  if (EL.acls) EL.acls.addEventListener('click', onAcctClose);
  if (EL.ascr) EL.ascr.addEventListener('click', onAcctClose);
  if (EL.apnl) document.addEventListener('keydown', onAcctKey);
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
    const id  = getCatId(cats[i]);
    const cnt = chs.filter(function byCat(ch) { return ch.cat === id; }).length;
    html += mkCatBtn({ id, label: getCatName(cats[i]), cnt, flt });
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
// rndFoot — update footer section visibility based on ST.phase
// ---------------------------------------------------------------------------
function rndFoot() {
  if (!EL.logi || !EL.conn) return;
  const st    = window.IptvSt.ST;
  const ready = st.phase === 'READY' || st.phase === 'PLAY' || st.phase === 'SRCH';
  EL.logi.style.display = ready ? 'none' : '';
  EL.conn.style.display = ready ? '' : 'none';
  if (ready) {
    const cnt = st.chs.length;
    const cat = st.cats.length;
    EL.ctxt.textContent = 'Connected to ' + st.host + ' as ' + st.user
      + ' · ' + cnt + ' channels · ' + cat + ' categories';
  }
  if ((st.phase === 'INIT' || st.phase === 'ERR') && EL.ferr) {
    EL.ferr.style.display = st.err ? '' : 'none';
    if (st.err) EL.ferr.textContent = st.err;
  }
}

// ---------------------------------------------------------------------------
// getMode — pure: current login mode from the selector ('xtream' | 'm3u')
// ---------------------------------------------------------------------------
function getMode() {
  return (EL.mm3u && EL.mm3u.checked) ? 'm3u' : 'xtream';
}

// ---------------------------------------------------------------------------
// rndMode — render footer per selected login mode: is-m3u class + hint text
// ---------------------------------------------------------------------------
function rndMode() {
  if (!EL.logi) return;
  const m3u = getMode() === 'm3u';
  if (m3u) {
    EL.logi.classList.add('is-m3u');
  } else {
    EL.logi.classList.remove('is-m3u');
  }
  if (EL.hint) EL.hint.textContent = m3u ? HINT_M3U : HINT_XTR;
}

// ---------------------------------------------------------------------------
// onMode — login-mode selector change handler
// ---------------------------------------------------------------------------
function onMode() {
  rndMode();
}

// ---------------------------------------------------------------------------
// onUrlInput — enable/disable Connect button based on URL input value
// ---------------------------------------------------------------------------
function onUrlInput() {
  if (!EL.bcon || !EL.url) return;
  const st = window.IptvSt.ST;
  EL.bcon.disabled = EL.url.value.trim().length === 0 || st.phase === 'LOAD';
}

// ---------------------------------------------------------------------------
// saveActive — turn a successful connection into a saved + active account
// (ADR-0013): build an Acct via mkAcct, dedupe-add it, persist the accounts
// list and the active id. opts: { url, host, user, pass, m3u }
// ---------------------------------------------------------------------------
function saveActive(opts) {
  const st = window.IptvSt;
  const store = st.loadAccts();
  const acct  = st.mkAcct(opts);
  const accts = st.addAcct(store.accts, acct);
  st.saveAccts(accts);
  st.saveAct(acct.id);
  return acct;
}

// ---------------------------------------------------------------------------
// onOk — handle successful connect result
// ---------------------------------------------------------------------------
function onOk(val) {
  window.IptvSt.setChs(val.channels, val.categories, val.host, val.user);
  window.IptvSt.go('READY');
  const src  = EL.url   ? EL.url.value.trim()   : val.host;
  const user = EL.uname ? EL.uname.value.trim() : val.user;
  const pass = EL.pwd   ? EL.pwd.value          : '';
  const m3u  = getMode() === 'm3u';
  saveActive({ url: src, host: val.host, user, pass, m3u });
  const st = window.IptvSt.ST;
  rndSide(st.cats, st.chs, st.favs);
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, st.flt, st.favs));
  rndFoot();
  if (EL.bcon) { EL.bcon.textContent = 'Connect'; EL.bcon.disabled = false; }
  if (EL.url)   EL.url.disabled   = false;
  if (EL.uname) EL.uname.disabled = false;
  if (EL.pwd)   EL.pwd.disabled   = false;
}

// ---------------------------------------------------------------------------
// onFail — handle failed connect result
// ---------------------------------------------------------------------------
function onFail(msg) {
  window.IptvSt.setErr(msg);
  window.IptvSt.go('ERR');
  if (EL.ferr) { EL.ferr.textContent = msg; EL.ferr.style.display = ''; }
  if (EL.bcon) { EL.bcon.textContent = 'Connect'; EL.bcon.disabled = false; }
  if (EL.url)   EL.url.disabled   = false;
  if (EL.uname) EL.uname.disabled = false;
  if (EL.pwd)   EL.pwd.disabled   = false;
  rndFoot();
}

// ---------------------------------------------------------------------------
// runConn — async: read inputs, call API, delegate to onOk/onFail
// ---------------------------------------------------------------------------
async function runConn() {
  const src  = EL.url   ? EL.url.value.trim()   : '';
  const user = EL.uname ? EL.uname.value.trim() : '';
  const pass = EL.pwd   ? EL.pwd.value          : '';
  window.IptvSt.go('LOAD');
  if (EL.bcon) { EL.bcon.disabled = true; EL.bcon.textContent = '⧖ Connecting…'; }
  if (EL.url)   EL.url.disabled   = true;
  if (EL.uname) EL.uname.disabled = true;
  if (EL.pwd)   EL.pwd.disabled   = true;
  const res = await window.IptvApi.connect(src, { user, pass, m3u: getMode() === 'm3u' });
  if (res.ok) { onOk(res.val); } else { onFail(res.err); }
}

// ---------------------------------------------------------------------------
// onConn — form submit handler; prevents default, calls runConn
// ---------------------------------------------------------------------------
function onConn(evt) {
  evt.preventDefault();
  runConn().catch(function onErr(e) { onFail(e.message); });
}

// ---------------------------------------------------------------------------
// onSwOk — handle a successful account-switch connect: populate channels,
// transition READY, mark the switched account active (ADR-0013), re-render.
// ---------------------------------------------------------------------------
function onSwOk(acct, val) {
  window.IptvSt.setChs(val.channels, val.categories, val.host, val.user);
  window.IptvSt.go('READY');
  window.IptvSt.saveAct(acct.id);
  const st = window.IptvSt.ST;
  rndSide(st.cats, st.chs, st.favs);
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, st.flt, st.favs));
  rndFoot();
}

// ---------------------------------------------------------------------------
// runSwitch — async: reconnect a saved account, replaying its stored m3u mode
// (ADR-0013, never re-detected). Tears the live session down first; on success
// the account becomes active, on failure the inline connect error is shown and
// the store is left untouched.
// ---------------------------------------------------------------------------
async function runSwitch(acct) {
  tearDown();
  window.IptvSt.go('LOAD');
  rndFoot();
  const res = await window.IptvApi.connect(acct.url, { user: acct.user, pass: acct.pass, m3u: acct.m3u });
  if (res.ok) { onSwOk(acct, res.val); } else { onFail(res.err); }
}

// ---------------------------------------------------------------------------
// goSwitch — switch to the saved account with the given id (ADR-0013/ADR-0014).
// No-op for an unknown id or the already-active account.
// ---------------------------------------------------------------------------
function goSwitch(id) {
  const store = window.IptvSt.loadAccts();
  const acct  = window.IptvSt.getAct(store.accts, id);
  if (!acct || id === store.actId) return;
  runSwitch(acct).catch(function onErr(e) { onFail(e.message); });
}

// ---------------------------------------------------------------------------
// onAcctRm — remove the saved account with the given id (ADR-0013/ADR-0014).
// Always deletes it from iptv_accts; removing the ACTIVE account also clears
// the active id and tears the live session down. Removing a non-active account
// leaves the live session untouched.
// ---------------------------------------------------------------------------
function onAcctRm(id) {
  const store = window.IptvSt.loadAccts();
  const accts = window.IptvSt.rmAcct(store.accts, id);
  window.IptvSt.saveAccts(accts);
  if (id === store.actId) {
    window.IptvSt.clearAct();
    tearDown();
  }
}

// ---------------------------------------------------------------------------
// tearDown — clear the live session: stop playback, empty the channel state,
// and walk the phase back to INIT, then re-render the footer/sidebar/grid into
// the logged-out shell. Used by disconnect, switch (before reconnecting), and
// remove-active. Does not touch the persisted accounts store.
// ---------------------------------------------------------------------------
function tearDown() {
  const cur = window.IptvSt.ST.phase;
  if (window.IptvPlay && cur === 'PLAY') window.IptvPlay.stopPlay();
  window.IptvSt.setChs([], [], '', '');
  if (cur === 'SRCH') window.IptvSt.go('READY');
  if (window.IptvSt.ST.phase === 'PLAY' || window.IptvSt.ST.phase === 'READY') {
    window.IptvSt.go('ERR');
  }
  if (window.IptvSt.ST.phase === 'ERR') window.IptvSt.go('INIT');
  if (EL.url)   { EL.url.value   = ''; EL.url.disabled   = false; }
  if (EL.uname) { EL.uname.value = ''; EL.uname.disabled = false; }
  if (EL.pwd)   { EL.pwd.value   = ''; EL.pwd.disabled   = false; }
  if (EL.bcon)  { EL.bcon.disabled = true; EL.bcon.textContent = 'Connect'; }
  rndFoot();
  rndSide([], [], []);
  rndGrid([]);
}

// ---------------------------------------------------------------------------
// onDisc — disconnect button handler: clear the live session and the active
// account pointer (ADR-0013), preserving the saved iptv_accts, iptv_sel, and
// iptv_favs (iptv_creds no longer exists).
// ---------------------------------------------------------------------------
function onDisc() {
  window.IptvSt.clearAct();
  tearDown();
}

// ---------------------------------------------------------------------------
// rndChip — highlight the format chip of the engine in use (ADR-0010)
// ---------------------------------------------------------------------------
function rndChip(eng) {
  if (!EL.chls || !EL.cts) return;
  EL.chls.classList.toggle('active', eng === 'hls');
  EL.cts.classList.toggle('active', eng === 'ts');
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
window.IptvUi = { mkEL, mkCard, toggleFav, rndSide, rndGrid, rndHead, rndFoot, rndPhase, rndMode, rndChip, getMode, onAcctBtn, onAcctClose, onAcctKey, goSwitch, onAcctRm };
