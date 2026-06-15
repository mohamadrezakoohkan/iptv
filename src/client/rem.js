// ADR: ADR-0032
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// rem.js — client-side, localStorage-persisted program-reminders store
// (ADR-0032, specs/reminders.md §1–§2). A self-contained client IIFE-free
// module (mirroring errlog.js / epg.js) holding the reminder list, its
// localStorage persistence (the iptv_rems key — S.remsKey, mirroring the
// favourites pattern ADR-0003), the pure Rem builders/identity, the store
// mutators (each persisting through a guarded write), and the pure due(now)
// selector over the canonical Prg / PRG_DEF schema (CONVENTIONS §7).
//
// Top-level bindings are uniquely named (REMS, REM_GRACE, remLoad, remAdd, …)
// so this flat-scope module never collides with epg.js / errlog.js, which
// share the same browser global scope (a documented prior near-miss). The
// public window.IptvRem object exposes the spec member names.
// ---------------------------------------------------------------------------

/** @typedef {{ chId:string, start:number, title:string }} Rem
 *  chId  — the Ch.id / Prg.chId the program belongs to
 *  start — the program start time, unix ms (the Prg.start value)
 *  title — the program title when the reminder was set (toast/notification copy)
 */

// Internal store — a flat Rem[], mirroring ST.favs (a flat array). Only mutated
// through remAdd / remRm / remClear; remList hands out a fresh copy.
const REMS = [];

// due(now) grace window: a reminder fires when start is at or before now but no
// older than this many ms, so a just-due reminder is selected once and a
// long-past one is ignored.
const REM_GRACE = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// remKey — pure: the canonical "<chId>|<start>" identity string used for
// matching and de-dup.
// ---------------------------------------------------------------------------
function remKey(chId, start) {
  return String(chId) + '|' + String(start);
}

// ---------------------------------------------------------------------------
// remMk — pure builder: a normalized Rem from a channel id and a Prg. title
// defaults to '' per the Prg schema (CONVENTIONS §7); tolerates a partial prg.
// ---------------------------------------------------------------------------
function remMk(chId, prg) {
  const p = prg || {};
  return {
    chId:  String(chId),
    start: p.start,
    title: String(p.title || ''),
  };
}

// ---------------------------------------------------------------------------
// isRem — pure predicate: a stored value is a well-formed Rem (string chId,
// finite numeric start). Malformed / non-object entries are dropped on load.
// ---------------------------------------------------------------------------
function isRem(rem) {
  return Boolean(rem) && typeof rem === 'object'
    && typeof rem.chId === 'string' && rem.chId.length > 0
    && Number.isFinite(rem.start);
}

// ---------------------------------------------------------------------------
// remSave — guarded write of the whole store to iptv_rems (S.remsKey),
// mirroring saveSt('favs'). A localStorage exception is swallowed — the store
// degrades to in-memory-only, never throws.
// ---------------------------------------------------------------------------
function remSave() {
  const S  = window.S;
  const ls = window.localStorage;
  if (!S || !ls) return;
  try { ls.setItem(S.remsKey, JSON.stringify(REMS)); } catch (e) {}
}

// ---------------------------------------------------------------------------
// remList — the stored reminders as a fresh array copy; the internal array is
// never handed out by reference.
// ---------------------------------------------------------------------------
function remList() {
  return REMS.slice();
}

// ---------------------------------------------------------------------------
// remHas — pure predicate: a reminder for that chId+start identity is stored.
// ---------------------------------------------------------------------------
function remHas(chId, start) {
  const k = remKey(chId, start);
  for (let i = 0; i < REMS.length; i += 1) {
    if (remKey(REMS[i].chId, REMS[i].start) === k) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// remAdd — store one reminder, de-duped by identity (chId+start); persists.
// A duplicate identity is a no-op (no second entry, no write churn change).
// ---------------------------------------------------------------------------
function remAdd(rem) {
  if (!isRem(rem)) return;
  if (remHas(rem.chId, rem.start)) return;
  REMS.push(remMk(rem.chId, rem));
  remSave();
}

// ---------------------------------------------------------------------------
// remRm — remove the reminder for that identity; persists.
// ---------------------------------------------------------------------------
function remRm(chId, start) {
  const k = remKey(chId, start);
  for (let i = REMS.length - 1; i >= 0; i -= 1) {
    if (remKey(REMS[i].chId, REMS[i].start) === k) REMS.splice(i, 1);
  }
  remSave();
}

// ---------------------------------------------------------------------------
// remToggle — add the reminder for the Prg if absent, remove it if present;
// persists; returns the resulting pressed state (true when now set).
// ---------------------------------------------------------------------------
function remToggle(chId, prg) {
  const rem = remMk(chId, prg);
  if (remHas(rem.chId, rem.start)) {
    remRm(rem.chId, rem.start);
    return false;
  }
  remAdd(rem);
  return true;
}

// ---------------------------------------------------------------------------
// remCount — number of stored reminders.
// ---------------------------------------------------------------------------
function remCount() {
  return REMS.length;
}

// ---------------------------------------------------------------------------
// remClear — empty the store; persists.
// ---------------------------------------------------------------------------
function remClear() {
  REMS.length = 0;
  remSave();
}

// ---------------------------------------------------------------------------
// remLoad — read iptv_rems, validate, populate the store (drops malformed
// entries; never throws), mirroring loadSt. A localStorage / parse exception
// is swallowed and the store is left empty.
// ---------------------------------------------------------------------------
function remLoad() {
  const S  = window.S;
  const ls = window.localStorage;
  REMS.length = 0;
  if (!S || !ls) return;
  try {
    const arr = JSON.parse(ls.getItem(S.remsKey));
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i += 1) {
      if (isRem(arr[i])) REMS.push(remMk(arr[i].chId, arr[i]));
    }
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// remDue — pure: stored reminders due at/before now and no older than the
// grace window (now - REM_GRACE <= start <= now); never mutates, never
// persists. The timer (ADR-0034) decides what to do with the due list.
// ---------------------------------------------------------------------------
function remDue(now) {
  const ts  = (now === null || now === undefined) ? Date.now() : now;
  const lo  = ts - REM_GRACE;
  const out = [];
  for (let i = 0; i < REMS.length; i += 1) {
    const start = REMS[i].start;
    if (start <= ts && start >= lo) out.push(REMS[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API — spec member names (specs/reminders.md §2).
// ---------------------------------------------------------------------------
window.IptvRem = {
  mkRem:  remMk,
  key:    remKey,
  list:   remList,
  has:    remHas,
  add:    remAdd,
  rm:     remRm,
  toggle: remToggle,
  count:  remCount,
  clear:  remClear,
  load:   remLoad,
  due:    remDue,
};
