// ADR: ADR-0001, ADR-0003, ADR-0004, ADR-0008, ADR-0010, ADR-0013, ADR-0014, ADR-0016, ADR-0017, ADR-0019, ADR-0022, ADR-0023, ADR-0025, ADR-0028, ADR-0030, ADR-0031
/* global window, document, clearTimeout, setTimeout */

'use strict';

// ---------------------------------------------------------------------------
// Element registry — fully declared, never extended (CONVENTIONS §10)
// ---------------------------------------------------------------------------
const EL = {
  list: null,   // #ch-list (.ch-grid)
  srt:  null,   // #ch-sort sort select (ADR-0017)
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
  fchp: null,   // #fmt-chip contextual format chip button (ADR-0025)
  fdtl: null,   // #fmt-detail inline engine-detail text (ADR-0025)
  apnl: null,   // #acct-panel aside (ADR-0014)
  abtn: null,   // #acct-btn nav button (ADR-0014)
  ascr: null,   // #acct-scrim backdrop (ADR-0014)
  acls: null,   // #acct-close button (ADR-0014)
  aadd: null,   // #acct-add button (ADR-0014)
  alst: null,   // #acct-list container (ADR-0014)
  acon: null,   // #acct-conn connected block (ADR-0014)
  apst: null,   // #acct-psts community presets list (ADR-0016)
  thm:  null,   // #theme-toggle sun/moon switch (ADR-0019)
  lbtn: null,   // #log-btn nav button (ADR-0028)
  lcnt: null,   // #log-count badge (ADR-0028)
  lpnl: null,   // #log-panel aside (ADR-0028)
  lscr: null,   // #log-scrim backdrop (ADR-0028)
  lcls: null,   // #log-close button (ADR-0028)
  lclr: null,   // #log-clear button (ADR-0028)
  llst: null,   // #log-list container (ADR-0028)
};

// Hint text per login mode (ADR-0008)
const HINT_XTR = 'Type "demo" to try a sample playlist.';
const HINT_M3U = 'Paste an .m3u / .m3u8 playlist URL — no login needed.';

// Empty-state placeholder icon glyphs (ADR-0022). Decorative inline SVG paths
// keyed by the icon token IptvEmpty.resolveContent returns; rendered
// aria-hidden so the title + body carry the meaning (specs/empty-states.md §4).
const EMPTY_ICOS = {
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  star:   '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  list:   '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
};

// Player no-signal placeholder icon glyphs (ADR-0023, specs/empty-states.md §3).
// Decorative inline SVG paths keyed by the icon token IptvEmpty.resolveSignal
// returns ('antenna' for idle, 'alert' for stream error); rendered aria-hidden
// so the title + body carry the meaning (§4). Distinct from EMPTY_ICOS (grid).
const SIGNAL_ICOS = {
  antenna: '<line x1="12" y1="20" x2="12" y2="13"/><polyline points="9 23 12 20 15 23"/>'
    + '<path d="M8 9a4 4 0 0 1 8 0"/><path d="M5 9a7 7 0 0 1 14 0"/><circle cx="12" cy="9" r="1"/>',
  alert: '<path d="M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z"/>'
    + '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

// ---------------------------------------------------------------------------
// Debounce state — module-level vars, TOKENS TABLE compliant
// ---------------------------------------------------------------------------
let tmp  = null;   // debounce timeout id  (tmp = temporary)
let srch = '';     // pending search query (srch = search)

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** HTML-escape a string for safe inclusion in rendered markup (ADR-0023). */
function escHtml(s) {
  return String(s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

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
 * Build one now/next row HTML (ADR-0031): a mono marker + the program title,
 * single-line ellipsized, title HTML-escaped. opts: { kind, prg } where kind is
 * 'now' | 'nxt'. Returns '' when the program is absent so a missing now/next
 * part is omitted entirely (never rendered as "null"/"undefined").
 */
function mkNnRow(opts) {
  if (!opts.prg) return '';
  const mark = opts.kind === 'now' ? 'NOW' : 'NEXT';
  return '<span class="ch-nn-row ch-nn-' + opts.kind + '">'
    + '<span class="ch-nn-mark">' + mark + '</span>'
    + '<span class="ch-nn-title">' + escHtml(opts.prg.title) + '</span>'
    + '</span>';
}

/**
 * Build the now/next line HTML for a channel (ADR-0031), reading
 * window.IptvEpg.getNowNext(ch.id) at render time. Returns '' when the EPG
 * module is absent or no guide is loaded (caller guards with has()), and when
 * both now and next are absent. Decorative within the card — never a click
 * target (specs/epg.md §4, §7).
 */
function mkNowNext(ch) {
  const nn  = window.IptvEpg.getNowNext(ch.id);
  const row = mkNnRow({ kind: 'now', prg: nn.now }) + mkNnRow({ kind: 'nxt', prg: nn.next });
  if (!row) return '';
  return '<div class="ch-nn" aria-hidden="true">' + row + '</div>';
}

/**
 * Pure: a short local-time clock string for a unix-ms timestamp (ADR-0031).
 * Falls back to '' for a missing/invalid stamp so a malformed program never
 * throws during schedule render (mirrors fmtLogTime, ADR-0028).
 */
function fmtPrgTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Build one schedule row HTML for a program (ADR-0031, specs/epg.md §5): a
 * local-time range (start–stop), the program title, and the optional category.
 * The currently-airing program (start <= now < stop) gets the ch-sched-cur
 * marker class. All program-derived text is HTML-escaped (guide data).
 * opts: { prg, now } where now is the reference time (unix ms).
 */
function mkSchedRow(opts) {
  const prg = opts.prg;
  const cur = (prg.start <= opts.now && opts.now < prg.stop) ? ' ch-sched-cur' : '';
  const rng = escHtml(fmtPrgTime(prg.start)) + '–' + escHtml(fmtPrgTime(prg.stop));
  const cat = prg.cat ? '<span class="ch-sched-cat">' + escHtml(prg.cat) + '</span>' : '';
  return '<li class="ch-sched-row' + cur + '">'
    + '<span class="ch-sched-time">' + rng + '</span>'
    + '<span class="ch-sched-meta">'
    + '<span class="ch-sched-title">' + escHtml(prg.title) + '</span>'
    + cat
    + '</span>'
    + '</li>';
}

/**
 * Build the expandable schedule block HTML for a channel (ADR-0031,
 * specs/epg.md §5): a keyboard-focusable expand <button> carrying aria-expanded
 * (always 'false' at render — collapsed baseline, Rule R-0001) and an accessible
 * label, plus the schedule list (hidden via aria-hidden until expanded). The
 * list renders getSched(ch.id) rows, the current program marked. Returns '' when
 * the guide is empty so a guide-less card never gains an expand control. The
 * control is the only interactive node inside the card besides the fav star; its
 * handler (onGridClick) stops propagation so expanding never plays the channel.
 */
function mkSched(ch) {
  const now  = Date.now();
  const prgs = window.IptvEpg.getSched(ch.id, now);
  if (prgs.length === 0) return '';
  let rows = '';
  for (let i = 0; i < prgs.length; i += 1) {
    rows += mkSchedRow({ prg: prgs[i], now });
  }
  const lbl = 'Show guide for ' + escHtml(ch.name);
  return '<button type="button" class="ch-exp" data-exp="' + ch.id + '"'
    + ' aria-expanded="false" aria-label="' + lbl + '">'
    + '<span class="ch-exp-label">Guide</span>'
    + '<span class="ch-exp-caret" aria-hidden="true">&#9662;</span>'
    + '</button>'
    + '<ul class="ch-sched" aria-hidden="true">' + rows + '</ul>';
}

/**
 * Build a single channel card HTML string.
 * Reads ST.cur and ST.favs from window.IptvSt; appends a now/next line
 * (ADR-0031) only when a guide is loaded for the channel — guarded so the card
 * still renders when the EPG module is absent (test isolation, specs/epg.md §4).
 * @param {Object} ch - Ch object
 */
function mkCard(ch) {
  const st   = window.IptvSt.ST;
  const favs = st.favs;
  const cur  = st.cur;
  const active = (cur && String(cur.id) === String(ch.id)) ? ' ch-active' : '';
  const hasEpg = Boolean(window.IptvEpg && window.IptvEpg.has(ch.id));
  const nn = hasEpg ? mkNowNext(ch) : '';
  const sched = hasEpg ? mkSched(ch) : '';
  return '<div class="ch-card' + active + '" role="button" tabindex="0" data-id="' + ch.id + '">'
    + '<div class="ch-card-top">'
    + '<span class="ch-num">' + fmtNum(ch.num) + '</span>'
    + mkLogo(ch)
    + mkFav(ch, favs)
    + '</div>'
    + '<span class="ch-name">' + ch.name + '</span>'
    + nn
    + sched
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
// mkSort — pure: build the sort <option> HTML from IptvSrch.SORTS (ADR-0017),
// marking the option whose id equals the active token `cur` as selected.
// opts: { sorts, cur }
// ---------------------------------------------------------------------------
function mkSort(opts) {
  let html = '';
  for (let i = 0; i < opts.sorts.length; i += 1) {
    const o   = opts.sorts[i];
    const sel = o.id === opts.cur ? ' selected' : '';
    html += '<option value="' + o.id + '"' + sel + '>' + o.label + '</option>';
  }
  return html;
}

// ---------------------------------------------------------------------------
// fireSrch — executes debounced search; reads module-level srch
// ---------------------------------------------------------------------------
function fireSrch() {
  const st = window.IptvSt.ST;
  window.IptvSt.setSrch(srch);
  rndGrid(window.IptvSrch.getChs(st.chs, srch, st.flt, st.favs, st.sort));
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
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, cat, st.favs, st.sort));
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
// goClrSrch — empty-state "Clear search" action (ADR-0022): clear the search
// input and re-run the existing debounced search path with an empty query so
// the grid re-renders to the unfiltered (within current category) result.
// ---------------------------------------------------------------------------
function goClrSrch() {
  if (EL.srch) EL.srch.value = '';
  srch = '';
  fireSrch();
}

// ---------------------------------------------------------------------------
// goViewAll — empty-state "Browse all channels" action (ADR-0022): switch the
// active category to "All Channels" through the existing category-filter path
// (setFlt + rndSide + rndGrid), exactly as a sidebar "All Channels" click does.
// ---------------------------------------------------------------------------
function goViewAll() {
  const st = window.IptvSt.ST;
  window.IptvSt.setFlt('all');
  rndSide(st.cats, st.chs, st.favs);
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, 'all', st.favs, st.sort));
}

// ---------------------------------------------------------------------------
// onEmptyAct — route an empty-state action button to its existing handler
// (ADR-0022); the data-empty-act value is the EmptyState action kind.
// ---------------------------------------------------------------------------
function onEmptyAct(kind) {
  if (kind === 'clear-search') { goClrSrch(); return; }
  if (kind === 'view-all') goViewAll();
}

// ---------------------------------------------------------------------------
// toggleSched — flip a channel card's presentational schedule expansion
// (ADR-0031, specs/epg.md §5). Purely presentational like the account/log
// panels (setAcct/setLog, ADR-0014/ADR-0028): an is-expanded class on the card
// plus the control's aria-expanded and the list's aria-hidden are the single
// source of truth — no ST phase, no boolean flag (CONVENTIONS §6), no storage
// key. Reads the live DOM state so a re-render starting collapsed re-collapses.
// ---------------------------------------------------------------------------
function toggleSched(btn) {
  const card  = btn.closest('.ch-card');
  if (!card) return;
  const sched = card.querySelector('.ch-sched');
  const open  = btn.getAttribute('aria-expanded') !== 'true';
  card.classList.toggle('is-expanded', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (sched) sched.setAttribute('aria-hidden', open ? 'false' : 'true');
}

// ---------------------------------------------------------------------------
// onGridClick — event-delegated click handler on EL.list (ch-grid)
// ---------------------------------------------------------------------------
function onGridClick(evt) {
  const act  = evt.target.closest('[data-empty-act]');
  if (act) { onEmptyAct(act.getAttribute('data-empty-act')); return; }
  const exp  = evt.target.closest('[data-exp]');
  if (exp) { evt.stopPropagation(); toggleSched(exp); return; }
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
  rndHead();
  if (window.IptvPlay) window.IptvPlay.loadPlay(ch.url);
}

// ---------------------------------------------------------------------------
// onGridKey — keyboard handler on EL.list for Enter key
// ---------------------------------------------------------------------------
function onGridKey(evt) {
  if (evt.key !== 'Enter') return;
  // The expand control is a real <button>: Enter/Space already fire a native
  // click that toggleSched handles via onGridClick. Routing the keydown here
  // too would double-toggle, so the button activates itself (ADR-0031).
  if (evt.target.closest('[data-exp]')) return;
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
// onAcctKey — Escape keydown closes whichever slide-in panel is open. The
// single document keydown handler covers both the account panel (ADR-0014) and
// the log panel (ADR-0028); each is an independent presentational toggle.
// ---------------------------------------------------------------------------
function onAcctKey(evt) {
  if (evt.key !== 'Escape') return;
  if (EL.apnl && EL.apnl.classList.contains('is-open')) setAcct(false);
  if (EL.lpnl && EL.lpnl.classList.contains('is-open')) setLog(false);
}

// ---------------------------------------------------------------------------
// setLog — set log panel open/closed presentational state (ADR-0028). No ST
// phase, no boolean flag (CONVENTIONS §6): the is-open class on panel + scrim
// plus the aria attributes are the single source of truth (mirrors setAcct).
// ---------------------------------------------------------------------------
function setLog(open) {
  if (!EL.lpnl || !EL.lscr || !EL.lbtn) return;
  EL.lpnl.classList.toggle('is-open', open);
  EL.lscr.classList.toggle('is-open', open);
  EL.lbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  EL.lpnl.setAttribute('aria-hidden', open ? 'false' : 'true');
}

// ---------------------------------------------------------------------------
// onLogBtn — log button click: toggle the panel based on its current is-open
// ---------------------------------------------------------------------------
function onLogBtn() {
  if (!EL.lpnl) return;
  setLog(!EL.lpnl.classList.contains('is-open'));
}

// ---------------------------------------------------------------------------
// onLogClose — close button / scrim click: close the log panel
// ---------------------------------------------------------------------------
function onLogClose() {
  setLog(false);
}

// ---------------------------------------------------------------------------
// fmtLogTime — pure: a short local clock time for a failure entry's `at`
// timestamp (ADR-0028). Falls back to '' for a missing/invalid stamp so a
// malformed entry never throws during render.
// ---------------------------------------------------------------------------
function fmtLogTime(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString();
}

// ---------------------------------------------------------------------------
// mkLogRow — pure: build one failure-log row HTML from an ErrEntry (ADR-0028):
// the channel name (+ number when present) as the primary line, the engine
// detail as a dimmed secondary line, and the failure time. All entry-derived
// text is HTML-escaped (entries carry channel names / engine tokens).
// ---------------------------------------------------------------------------
function mkLogRow(entry) {
  const num   = (entry.num === 0 || entry.num) ? '#' + escHtml(fmtNum(entry.num)) + ' ' : '';
  const name  = escHtml(entry.name);
  const dtl   = escHtml(entry.detail);
  const time  = escHtml(fmtLogTime(entry.at));
  return '<div class="log-row">'
    + '<div class="log-row-head">'
    + '<span class="log-row-name">' + num + name + '</span>'
    + '<span class="log-row-time">' + time + '</span>'
    + '</div>'
    + '<span class="log-row-detail">' + dtl + '</span>'
    + '</div>';
}

// ---------------------------------------------------------------------------
// rndLog — render the log button's count badge and the panel's entry list from
// window.IptvErrLog (ADR-0028): the badge shows count() and gets the is-empty
// class (hidden, CSS §10) when zero, with the count folded into the button's
// accessible name (aria-label, not colour-only); the list shows one row per
// list() entry newest-first, or a single calm empty-state placeholder when the
// log is empty. Guarded to no-op when IptvErrLog is absent (test isolation),
// mirroring the existing guarded global reads. Called on init, after every
// capture (the play.js onEngErr hook), and after clear().
// ---------------------------------------------------------------------------
function rndLog() {
  if (!window.IptvErrLog) return;
  const n = window.IptvErrLog.count();
  if (EL.lcnt) {
    EL.lcnt.textContent = String(n);
    EL.lcnt.classList.toggle('is-empty', n === 0);
  }
  if (EL.lbtn) {
    EL.lbtn.setAttribute('aria-label', n === 0
      ? 'Log, no playback failures'
      : 'Log, ' + n + (n === 1 ? ' playback failure' : ' playback failures'));
  }
  if (!EL.llst) return;
  if (n === 0) {
    EL.llst.innerHTML = '<p class="log-empty">No playback failures this session.</p>';
    return;
  }
  const entries = window.IptvErrLog.list();
  let html = '';
  for (let i = 0; i < entries.length; i += 1) {
    html += mkLogRow(entries[i]);
  }
  EL.llst.innerHTML = html;
}

// ---------------------------------------------------------------------------
// onLogClear — Clear button: empty the failure log (IptvErrLog.clear) and
// re-render so the panel falls back to the empty state and the badge hides
// (ADR-0028). Guarded so it no-ops when the log module is absent.
// ---------------------------------------------------------------------------
function onLogClear() {
  if (window.IptvErrLog) window.IptvErrLog.clear();
  rndLog();
}

// ---------------------------------------------------------------------------
// getSrv — pure: the server URL shown for an account; the demo playlist shows
// the literal "demo" (its stored url), any other account shows its url (ADR-0014).
// ---------------------------------------------------------------------------
function getSrv(acct) {
  return acct.url || acct.name;
}

// ---------------------------------------------------------------------------
// mkRow — build one account-list row HTML: name + server url, the active
// marker (is-active class + indicator), a switch target (data-acct) and a
// remove control (data-rm). opts: { acct, act } (ADR-0014).
// ---------------------------------------------------------------------------
function mkRow(opts) {
  const a   = opts.acct;
  const on  = (opts.act && a.id === opts.act) ? ' is-active' : '';
  return '<div class="acct-row' + on + '" role="button" tabindex="0" data-acct="' + a.id + '">'
    + '<span class="acct-row-dot" aria-hidden="true"></span>'
    + '<span class="acct-row-meta">'
    + '<span class="acct-row-name">' + a.name + '</span>'
    + '<span class="acct-row-srv">' + getSrv(a) + '</span>'
    + '</span>'
    + '<button type="button" class="acct-row-rm" data-rm="' + a.id + '" aria-label="Remove account">&#10005;</button>'
    + '</div>';
}

// ---------------------------------------------------------------------------
// mkPst — build one community-preset row HTML (ADR-0016): the preset name +
// playlist url, a select target (data-pst="<idx>"), and the is-active marker
// only when this preset's url is the active account's M3U connection. Mirrors
// mkRow; no remove control (the catalog is static, ADR-0015).
// opts: { pst, idx, act }
// ---------------------------------------------------------------------------
function mkPst(opts) {
  const p   = opts.pst;
  const act = opts.act;
  const on  = (act && act.m3u && act.url === p.url) ? ' is-active' : '';
  return '<div class="acct-row acct-pst' + on + '" role="button" tabindex="0" data-pst="' + opts.idx + '">'
    + '<span class="acct-row-dot" aria-hidden="true"></span>'
    + '<span class="acct-row-meta">'
    + '<span class="acct-row-name">' + p.name + '</span>'
    + '<span class="acct-row-srv">' + p.url + '</span>'
    + '</span>'
    + '</div>';
}

// ---------------------------------------------------------------------------
// rndConn — render the connected-account block (#acct-conn): name + server URL
// + "Connected" dot when an account is active; a "Not connected" line otherwise
// (ADR-0014). act is the active Acct or null.
// ---------------------------------------------------------------------------
function rndConn(act) {
  if (!EL.acon) return;
  if (!act) {
    EL.acon.innerHTML = '<span class="acct-conn-off">Not connected</span>';
    return;
  }
  EL.acon.innerHTML = '<span class="acct-conn-dot" aria-hidden="true"></span>'
    + '<span class="acct-conn-meta">'
    + '<span class="acct-conn-name">' + act.name + '</span>'
    + '<span class="acct-conn-srv">' + getSrv(act) + '</span>'
    + '</span>'
    + '<span class="acct-conn-stat">Connected</span>';
}

// ---------------------------------------------------------------------------
// rndList — render the account-list rows (#acct-list), one per saved account,
// the active one marked. store: { accts, actId } (ADR-0014).
// ---------------------------------------------------------------------------
function rndList(store) {
  if (!EL.alst) return;
  if (!store.accts || store.accts.length === 0) {
    EL.alst.innerHTML = '<p class="acct-empty">No saved accounts.</p>';
    return;
  }
  let html = '';
  for (let i = 0; i < store.accts.length; i += 1) {
    html += mkRow({ acct: store.accts[i], act: store.actId });
  }
  EL.alst.innerHTML = html;
}

// ---------------------------------------------------------------------------
// rndPsts — render the community presets section (#acct-psts) from S.psts
// (ADR-0015/ADR-0016), always present (default catalog, even with zero saved
// accounts). Marks the row whose url is the active M3U account's connection.
// act is the active Acct or null.
// ---------------------------------------------------------------------------
function rndPsts(act) {
  if (!EL.apst) return;
  const psts = window.S.psts;
  let html = '';
  for (let i = 0; i < psts.length; i += 1) {
    html += mkPst({ pst: psts[i], idx: i, act });
  }
  EL.apst.innerHTML = html;
}

// ---------------------------------------------------------------------------
// rndAcct — render the whole account panel from the store (ADR-0013/ADR-0014):
// the nav button label, the connected block, the list, and the community
// presets section (ADR-0016). Called after every connect, disconnect, switch,
// add, and remove so the surfaces never disagree.
// ---------------------------------------------------------------------------
function rndAcct() {
  const st    = window.IptvSt;
  const store = st.loadAccts();
  const act   = st.getAct(store.accts, store.actId);
  const lbl   = document.getElementById('acct-label');
  if (lbl) lbl.textContent = act ? act.name : 'Account';
  rndConn(act);
  rndList(store);
  rndPsts(act);
}

// ---------------------------------------------------------------------------
// onAcctList — delegate account-list clicks (ADR-0014): a [data-rm] click
// removes that account; a non-active [data-acct] click switches to it; the
// already-active row is a no-op. Re-renders the panel after any of these.
// ---------------------------------------------------------------------------
function onAcctList(evt) {
  const rm = evt.target.closest('[data-rm]');
  if (rm) { onAcctRm(rm.getAttribute('data-rm')); rndAcct(); return; }
  const row = evt.target.closest('[data-acct]');
  if (!row) return;
  goSwitch(row.getAttribute('data-acct'));
  rndAcct();
}

// ---------------------------------------------------------------------------
// onPstOk — successful preset connect completion (ADR-0016): persist the
// preset as a saved + active Acct (saveActive: mkAcct→addAcct dedupe→
// saveAccts/saveAct, ADR-0015), then run the shared switch render lifecycle
// (onSwOk) so the panel/grid/sidebar/footer reflect the connection and the
// preset now also appears in the saved list. On failure nothing here runs.
// ---------------------------------------------------------------------------
function onPstOk(pst, val) {
  const acct = saveActive(window.IptvSt.getPst(pst));
  onSwOk(acct, val);
}

// ---------------------------------------------------------------------------
// runPst — async: connect to a community preset on the M3U path (ADR-0016),
// reusing the runSwitch tear-down + reconnect flow. Tears the live session
// down first; on success persists + renders via onPstOk, on failure shows the
// inline connect error and leaves the store untouched (ADR-0013 invariant).
// ---------------------------------------------------------------------------
async function runPst(pst) {
  tearDown();
  window.IptvSt.go('LOAD');
  rndFoot();
  const opts = window.IptvSt.getPst(pst);
  const res  = await window.IptvApi.connect(opts.url, { user: opts.user, pass: opts.pass, m3u: opts.m3u });
  if (res.ok) { onPstOk(pst, res.val); } else { onFail(res.err); }
}

// ---------------------------------------------------------------------------
// goPst — connect to the community preset at S.psts[idx] (ADR-0015/ADR-0016).
// No-op when that preset is already the active M3U connection (same guard
// shape as goSwitch).
// ---------------------------------------------------------------------------
function goPst(idx) {
  const pst = window.S.psts[idx];
  if (!pst) return;
  const store = window.IptvSt.loadAccts();
  const act   = window.IptvSt.getAct(store.accts, store.actId);
  if (act && act.m3u && act.url === pst.url) return;
  runPst(pst).catch(function onErr(e) { onFail(e.message); });
}

// ---------------------------------------------------------------------------
// onPstList — delegate community-preset clicks (#acct-psts, ADR-0016): a
// [data-pst] click connects to that preset on the M3U path (goPst); the
// already-active preset is a no-op. Re-renders the panel after a select.
// ---------------------------------------------------------------------------
function onPstList(evt) {
  const row = evt.target.closest('[data-pst]');
  if (!row) return;
  goPst(Number(row.getAttribute('data-pst')));
  rndAcct();
}

// ---------------------------------------------------------------------------
// onAcctAdd — add-account action (#acct-add): close the panel, reset the footer
// to the logged-out login form, and focus the URL field (ADR-0014). A later
// successful footer connect saves it as a new active account (onOk).
// ---------------------------------------------------------------------------
function onAcctAdd() {
  setAcct(false);
  tearDown();
  if (EL.url && EL.url.focus) EL.url.focus();
}

// ---------------------------------------------------------------------------
// rndTheme — apply a theme token (ADR-0019). Pure presentational chrome, no ST
// phase: 'light' sets data-theme="light" on <html> and emphasises the sun
// (is-light + aria-checked="true"); any other token ('dark' default) removes
// the attribute (baseline = no data-theme, Rule R-0001) and emphasises the
// moon. Idempotent; safe before/independent of any connect flow.
// ---------------------------------------------------------------------------
function rndTheme(theme) {
  const light = theme === 'light';
  const root  = document.documentElement;
  if (light) {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
  if (!EL.thm) return;
  EL.thm.classList.toggle('is-light', light);
  EL.thm.setAttribute('aria-checked', light ? 'true' : 'false');
  EL.thm.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
}

// ---------------------------------------------------------------------------
// onTheme — theme-toggle click handler (ADR-0019): flip dark↔light from the
// current data-theme on <html>, apply via rndTheme, and persist via saveTheme
// (TASK-0037 writer). One synchronous handler, no phase transition.
// ---------------------------------------------------------------------------
function onTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const nxt = cur === 'light' ? 'dark' : 'light';
  rndTheme(nxt);
  window.IptvSt.saveTheme(nxt);
}

// ---------------------------------------------------------------------------
// mkEL — initialize EL from DOM, wire event listeners
// ---------------------------------------------------------------------------
function mkEL() {
  EL.list  = document.getElementById('ch-list');
  EL.srt   = document.getElementById('ch-sort');
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
  EL.fchp  = document.getElementById('fmt-chip');
  EL.fdtl  = document.getElementById('fmt-detail');
  EL.apnl  = document.getElementById('acct-panel');
  EL.abtn  = document.getElementById('acct-btn');
  EL.ascr  = document.getElementById('acct-scrim');
  EL.acls  = document.getElementById('acct-close');
  EL.aadd  = document.getElementById('acct-add');
  EL.alst  = document.getElementById('acct-list');
  EL.acon  = document.getElementById('acct-conn');
  EL.apst  = document.getElementById('acct-psts');
  EL.thm   = document.getElementById('theme-toggle');
  EL.lbtn  = document.getElementById('log-btn');
  EL.lcnt  = document.getElementById('log-count');
  EL.lpnl  = document.getElementById('log-panel');
  EL.lscr  = document.getElementById('log-scrim');
  EL.lcls  = document.getElementById('log-close');
  EL.lclr  = document.getElementById('log-clear');
  EL.llst  = document.getElementById('log-list');
  if (EL.thm)  EL.thm.addEventListener('click', onTheme);
  if (EL.fchp) EL.fchp.addEventListener('click', onFmtChip);
  if (EL.srch) EL.srch.addEventListener('input', onSrch);
  if (EL.nav)  EL.nav.addEventListener('click', onCatClick);
  if (EL.list) EL.list.addEventListener('click', onGridClick);
  if (EL.card) EL.card.addEventListener('click', onPlayClick);
  if (EL.list) EL.list.addEventListener('keydown', onGridKey);
  if (EL.srt)  EL.srt.addEventListener('change', onSort);
  const frm = document.getElementById('login-form');
  if (frm)    frm.addEventListener('submit', onConn);
  if (EL.url) EL.url.addEventListener('input', onUrlInput);
  if (EL.mode) EL.mode.addEventListener('change', onMode);
  if (EL.bdis) EL.bdis.addEventListener('click', onDisc);
  if (EL.abtn) EL.abtn.addEventListener('click', onAcctBtn);
  if (EL.acls) EL.acls.addEventListener('click', onAcctClose);
  if (EL.ascr) EL.ascr.addEventListener('click', onAcctClose);
  if (EL.apnl || EL.lpnl) document.addEventListener('keydown', onAcctKey);
  if (EL.alst) EL.alst.addEventListener('click', onAcctList);
  if (EL.apst) EL.apst.addEventListener('click', onPstList);
  if (EL.aadd) EL.aadd.addEventListener('click', onAcctAdd);
  if (EL.lbtn) EL.lbtn.addEventListener('click', onLogBtn);
  if (EL.lcls) EL.lcls.addEventListener('click', onLogClose);
  if (EL.lscr) EL.lscr.addEventListener('click', onLogClose);
  if (EL.lclr) EL.lclr.addEventListener('click', onLogClear);
  rndLog();
}

// ---------------------------------------------------------------------------
// mkEmptyIco — pure: decorative inline-SVG icon HTML for an EmptyState icon
// token (ADR-0022). aria-hidden; the title + body carry the meaning (§4).
// ---------------------------------------------------------------------------
function mkEmptyIco(name) {
  const paths = EMPTY_ICOS[name] || EMPTY_ICOS.list;
  return '<svg class="ch-empty-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + paths + '</svg>';
}

// ---------------------------------------------------------------------------
// mkEmptyBtn — pure: action-button HTML for an EmptyState action (ADR-0022).
// data-empty-act carries the kind so onGridClick can route it through the
// existing search/category handlers; keyboard-focusable with a label.
// ---------------------------------------------------------------------------
function mkEmptyBtn(action) {
  return '<button type="button" class="ch-empty-btn" data-empty-act="' + action.kind + '">'
    + action.label + '</button>';
}

// ---------------------------------------------------------------------------
// mkEmptyBox — pure: full contextual no-content placeholder HTML from a
// resolved EmptyState (ADR-0022, specs/empty-states.md §2). role="status"
// container, decorative icon, title, body, and the optional action button.
// (Distinct name from empty.js's mkEmpty — both are top-level <script> globals.)
// ---------------------------------------------------------------------------
function mkEmptyBox(es) {
  const btn = es.action ? mkEmptyBtn(es.action) : '';
  return '<div class="ch-empty" role="status">'
    + mkEmptyIco(es.icon)
    + '<p class="ch-empty-title">' + es.title + '</p>'
    + '<p class="ch-empty-body">' + es.body + '</p>'
    + btn + '</div>';
}

// ---------------------------------------------------------------------------
// mkSigIco — pure: decorative inline-SVG icon HTML for a player no-signal icon
// token (ADR-0023). aria-hidden; the title + body carry the meaning (§4).
// ---------------------------------------------------------------------------
function mkSigIco(name) {
  const paths = SIGNAL_ICOS[name] || SIGNAL_ICOS.antenna;
  return '<svg class="sig-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + paths + '</svg>';
}

// ---------------------------------------------------------------------------
// mkSigBtn — pure: player no-signal action-button HTML (ADR-0023). data-sig-act
// carries the EmptyState action kind ('retry' | 'connect') so onPlayAct can
// route it; keyboard-focusable with a discernible accessible label.
// ---------------------------------------------------------------------------
function mkSigBtn(action) {
  return '<button type="button" class="sig-btn" data-sig-act="' + action.kind + '">'
    + action.label + '</button>';
}

// ---------------------------------------------------------------------------
// mkIdleBox — pure: idle "NO SIGNAL" placeholder HTML from a resolved
// EmptyState (ADR-0023, specs/empty-states.md §3a). Antenna icon, the visible
// "NO SIGNAL" title (literal token preserved), a guidance body, and the
// optional "Connect a source" action in the no-session case.
// ---------------------------------------------------------------------------
function mkIdleBox(es) {
  const btn = es.action ? mkSigBtn(es.action) : '';
  return mkSigIco(es.icon)
    + '<span class="idle-label">NO SIGNAL</span>'
    + '<p class="sig-body">' + es.body + '</p>'
    + btn;
}

// ---------------------------------------------------------------------------
// mkErrBox — pure: stream-error placeholder HTML from a resolved EmptyState
// (ADR-0023, specs/empty-states.md §3b). Warning icon, the constant headline,
// a friendly explanation, a Retry button, and the raw engine detail as a small
// dimmed secondary line — visible text, never console-only (§12). raw is the
// HTML-escaped engine token (or '' when absent).
// ---------------------------------------------------------------------------
function mkErrBox(es, raw) {
  const btn  = es.action ? mkSigBtn(es.action) : '';
  const dtl  = raw ? '<p class="sig-detail">' + raw + '</p>' : '';
  return mkSigIco(es.icon)
    + '<p class="sig-title">' + es.title + '</p>'
    + '<p class="sig-body">' + es.body + '</p>'
    + btn + dtl;
}

// ---------------------------------------------------------------------------
// onPlayAct — route a player no-signal action button to its handler (ADR-0023):
// 'retry' re-attempts playback of the current channel through the existing play
// path (IptvPlay.goPlay); 'connect' focuses the footer login URL field so the
// user can connect a source (the no-session guidance affordance).
// ---------------------------------------------------------------------------
function onPlayAct(kind) {
  if (kind === 'retry') { if (window.IptvPlay) window.IptvPlay.goPlay(); return; }
  if (kind === 'connect' && EL.url && EL.url.focus) EL.url.focus();
}

// ---------------------------------------------------------------------------
// onPlayClick — event-delegated click on the player card: a [data-sig-act]
// button routes to its action handler (ADR-0023); anything else is ignored.
// ---------------------------------------------------------------------------
function onPlayClick(evt) {
  const btn = evt.target.closest('[data-sig-act]');
  if (btn) onPlayAct(btn.getAttribute('data-sig-act'));
}

// ---------------------------------------------------------------------------
// rndGrid — render channel cards into .ch-grid, or a contextual empty-state
// placeholder when the filtered list is empty (ADR-0022). The placeholder is
// chosen by IptvEmpty.resolveContent from the live ST (total source count,
// active filter, search query, favourites) — same opts other rnd* read.
// ---------------------------------------------------------------------------
function rndGrid(chs) {
  if (!EL.list) return;
  if (!chs || chs.length === 0) {
    const st = window.IptvSt.ST;
    const es = window.IptvEmpty.resolveContent({
      total: st.chs.length, shown: 0, flt: st.flt, srch: st.srch, favs: st.favs,
    });
    EL.list.innerHTML = mkEmptyBox(es);
    return;
  }
  let html = '';
  for (let i = 0; i < chs.length; i += 1) {
    html += mkCard(chs[i]);
  }
  EL.list.innerHTML = html;
}

// ---------------------------------------------------------------------------
// rndSort — populate the sort select (#ch-sort) from IptvSrch.SORTS with the
// current ST.sort token selected (ADR-0017). Idempotent; called on init and
// after every connect/switch so the control always reflects ST.sort.
// ---------------------------------------------------------------------------
function rndSort() {
  if (!EL.srt) return;
  const st = window.IptvSt.ST;
  EL.srt.innerHTML = mkSort({ sorts: window.IptvSrch.SORTS, cur: st.sort });
}

// ---------------------------------------------------------------------------
// onSort — sort-select change handler (ADR-0017): record the chosen token via
// setSort, persist it (saveSt('sort')), and re-render the grid through getChs
// with the new token so the visible card order updates.
// ---------------------------------------------------------------------------
function onSort(evt) {
  const st = window.IptvSt;
  st.setSort(evt.target.value);
  if (st.saveSt) st.saveSt('sort');
  const s = st.ST;
  rndGrid(window.IptvSrch.getChs(s.chs, s.srch, s.flt, s.favs, s.sort));
}

// ---------------------------------------------------------------------------
// rndSide — render sidebar category list: "All Channels", an optional
// "Favourites" button, then one button per source category in the source's
// delivery order, directly into EL.nav (no filter input, no #cat-list wrapper).
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
// rndGuide — re-render the channel grid from current ST after a guide arrives
// (ADR-0030, ADR-0031). The grid's now/next line reads window.IptvEpg at
// render time, so re-rendering surfaces guides as they fill in. Guarded as a
// callback so the EPG fetch layer (api.js) need not import ui.js.
// ---------------------------------------------------------------------------
function rndGuide() {
  const st = window.IptvSt.ST;
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, st.flt, st.favs, st.sort));
}

// ---------------------------------------------------------------------------
// goEpg — kick off the best-effort, non-blocking EPG fetch after a successful
// connect (ADR-0030). Channels are already rendered; this only populates
// window.IptvEpg and re-renders via rndGuide as guides arrive. A failed /
// empty / timed-out EPG fetch is swallowed by IptvApi.loadEpg and never
// affects ST.phase or browsing. opts: { src, user, pass, m3u, chs, epgUrl }
// ---------------------------------------------------------------------------
function goEpg(opts) {
  const api = window.IptvApi;
  if (!api || typeof api.loadEpg !== 'function') return;
  api.loadEpg({
    src:    opts.src,
    user:   opts.user,
    pass:   opts.pass,
    m3u:    opts.m3u,
    chs:    opts.chs,
    epgUrl: opts.epgUrl,
    onDone: rndGuide,
  });
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
  rndHead();
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, st.flt, st.favs, st.sort));
  rndFoot();
  rndAcct();
  if (EL.bcon) { EL.bcon.textContent = 'Connect'; EL.bcon.disabled = false; }
  if (EL.url)   EL.url.disabled   = false;
  if (EL.uname) EL.uname.disabled = false;
  if (EL.pwd)   EL.pwd.disabled   = false;
  goEpg({ src, user, pass, m3u, chs: st.chs, epgUrl: val.epgUrl });
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
  rndGrid(window.IptvSrch.getChs(st.chs, st.srch, st.flt, st.favs, st.sort));
  rndFoot();
  rndHead();
  rndAcct();
  goEpg({ src: acct.url, user: acct.user, pass: acct.pass, m3u: acct.m3u, chs: st.chs, epgUrl: val.epgUrl });
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
  window.IptvSt.setCur(null);
  rndFoot();
  rndSide([], [], []);
  rndGrid([]);
  rndHead();
  rndAcct();
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
// Contextual format chip (ADR-0025): label + inline-detail text per resolved
// engine token. A remuxed .ts surfaces 'hls' upstream (ADR-0012), so 'hls'
// here always means the hls.js / native-HLS engine is the one in use.
// ---------------------------------------------------------------------------
const FMT_LBL = { hls: 'HLS', ts: 'TS' };
const FMT_DTL = { hls: 'Playing via hls.js', ts: 'Playing via mpegts.js' };

// ---------------------------------------------------------------------------
// rndChip — surface the contextual format chip for the resolved engine, or
// hide it (and collapse its detail) when no engine is playing (ADR-0025).
// ---------------------------------------------------------------------------
function rndChip(eng) {
  if (!EL.fchp || !EL.fdtl) return;
  const lbl = FMT_LBL[eng];
  if (!lbl) {
    EL.fchp.hidden = true;
    EL.fchp.classList.remove('active');
    EL.fchp.setAttribute('aria-expanded', 'false');
    EL.fdtl.hidden = true;
    EL.fdtl.textContent = '';
    return;
  }
  EL.fchp.textContent = lbl;
  EL.fchp.dataset.eng = eng;
  EL.fchp.hidden = false;
  EL.fchp.classList.add('active');
}

// ---------------------------------------------------------------------------
// onFmtChip — presentational toggle of the inline engine-detail (ADR-0025).
// Never touches ST.phase or the running engine; mirrors aria-expanded.
// ---------------------------------------------------------------------------
function onFmtChip() {
  if (!EL.fchp || !EL.fdtl) return;
  const open = EL.fchp.getAttribute('aria-expanded') !== 'true';
  EL.fchp.setAttribute('aria-expanded', open ? 'true' : 'false');
  EL.fdtl.textContent = open ? (FMT_DTL[EL.fchp.dataset.eng] ?? '') : '';
  EL.fdtl.hidden = !open;
}

// ---------------------------------------------------------------------------
// rndPlayer — update player-card visibility and render both no-output states
// from IptvEmpty.resolveSignal (ADR-0023, specs/empty-states.md §3). Idle ("NO
// SIGNAL" + guidance, optional Connect) shows whenever not playing; the
// stream-error placeholder (warning icon + headline + friendly body + Retry +
// dimmed raw detail) replaces it on phase ERR with a current channel.
// ---------------------------------------------------------------------------
function rndPlayer() {
  const st   = window.IptvSt.ST;
  const play = st.phase === 'PLAY';
  const err  = st.phase === 'ERR' && st.cur !== null;
  if (!play) rndChip('');
  if (EL.wrap) EL.wrap.style.display = err ? 'block' : '';
  if (EL.card) EL.card.classList.toggle('player-idle', !play);
  if (EL.idle) {
    EL.idle.style.display = play || err ? 'none' : '';
    if (!play && !err) {
      EL.idle.innerHTML = mkIdleBox(window.IptvEmpty.resolveSignal({ phase: st.phase, cur: st.cur }));
    }
  }
  if (EL.play) EL.play.style.display = play ? '' : 'none';
  if (EL.err) {
    EL.err.style.display = err ? '' : 'none';
    if (err) {
      const es = window.IptvEmpty.resolveSignal({ phase: st.phase, cur: st.cur });
      EL.err.innerHTML = mkErrBox(es, st.err ? escHtml(st.err) : '');
    }
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
window.IptvUi = { mkEL, mkCard, mkSched, mkSort, toggleFav, toggleSched, rndSide, rndGrid, rndSort, onSort, rndHead, rndFoot, rndPhase, rndPlayer, rndMode, rndChip, onFmtChip, getMode, onAcctBtn, onAcctClose, onAcctKey, goSwitch, onAcctRm, rndAcct, onAcctList, onAcctAdd, mkPst, rndPsts, onPstList, rndTheme, onTheme, setLog, onLogBtn, onLogClose, onLogClear, rndLog, goEpg, rndGuide };
