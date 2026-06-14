// ADR: ADR-0027
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// errlog.js — in-memory, session-scoped playback-failure log (ADR-0027,
// specs/playback-failure-log.md §1). Holds the failures captured at the single
// fatal-playback choke point (onEngErr in play.js, hooked by TASK-0057); the
// log button + panel (ADR-0028, TASK-0058+) read it. Never persisted: it is a
// live diagnostic for the current session, gone on reload.
// ---------------------------------------------------------------------------

/** @typedef {{ at:number, name:string, num:(number|null), url:string, detail:string }} ErrEntry
 *  at     — Date.now() when the failure was recorded
 *  name   — failed channel's display name (ST.cur.name; "Unknown channel" when absent)
 *  num    — failed channel's number (ST.cur.num) or null
 *  url    — failed channel's stream url (ST.cur.url) or ''
 *  detail — the engine failure detail string passed to onEngErr (the raw token)
 */

// Fixed maximum entries held; a long session cannot grow the log unbounded.
const MAX = 50;

// Internal store — newest-last. Only mutated through add / clear below; never
// handed out by reference (list returns a fresh, newest-first copy).
const LOG = [];

// ---------------------------------------------------------------------------
// mkEntry — pure builder: turns the current channel (ST.cur, possibly
// null/undefined or partial) plus a detail string into a normalized ErrEntry,
// stamping at = Date.now(). Tolerates a missing/partial channel without
// throwing.
// ---------------------------------------------------------------------------
function mkEntry(cur, detail) {
  const c = cur || {};
  return {
    at:     Date.now(),
    name:   c.name || 'Unknown channel',
    num:    (c.num === 0 || c.num) ? c.num : null,
    url:    c.url || '',
    detail: String(detail),
  };
}

// ---------------------------------------------------------------------------
// add — append one entry, newest-last, capping the log at MAX by dropping the
// oldest (front) entries so only the newest MAX are retained.
// ---------------------------------------------------------------------------
function add(entry) {
  LOG.push(entry);
  while (LOG.length > MAX) LOG.shift();
}

// ---------------------------------------------------------------------------
// list — entries newest-first as a fresh array copy; mutating the result never
// affects internal state.
// ---------------------------------------------------------------------------
function list() {
  return LOG.slice().reverse();
}

// ---------------------------------------------------------------------------
// count — number of entries currently held.
// ---------------------------------------------------------------------------
function count() {
  return LOG.length;
}

// ---------------------------------------------------------------------------
// clear — empties the log (count() becomes 0).
// ---------------------------------------------------------------------------
function clear() {
  LOG.length = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvErrLog = {
  add,
  list,
  count,
  clear,
  mkEntry,
};
