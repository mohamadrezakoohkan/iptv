// ADR: ADR-0021
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// empty.js — pure EmptyState resolvers (ADR-0021, specs/empty-states.md).
// Maps plain state values to the structured EmptyState shape
// ({ icon, title, body, action? }). No DOM, no globals beyond the export.
// Renderers (TASK-0044/0045) consume the returned plain objects.
// ---------------------------------------------------------------------------

// Fixed set of in-app action kinds (specs/empty-states.md §1).
const KINDS = {
  clr:  'clear-search',
  all:  'view-all',
  rty:  'retry',
  conn: 'connect',
};

// ---------------------------------------------------------------------------
// esc — pure: HTML-escape a string for safe inclusion in body copy.
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

// ---------------------------------------------------------------------------
// mkEmpty — pure: construct an EmptyState plain object; action is optional.
// ---------------------------------------------------------------------------
function mkEmpty(ico, title, body, action) {
  const st = { icon: ico, title: title, body: body };
  if (action) st.action = action;
  return st;
}

// ---------------------------------------------------------------------------
// resolveContent — pure: channel-grid EmptyState, or null when non-empty.
// Priority (specs/empty-states.md §2): active search → favourites-empty →
// category-empty → zero-channel source.
// opts: { total, shown, flt, srch, favs }
// ---------------------------------------------------------------------------
function resolveContent(opts) {
  if (opts.shown > 0) return null;
  if (opts.srch && opts.srch.length > 0) {
    const body = 'No channels match "' + esc(opts.srch) + '". Try a different search.';
    return mkEmpty('search', 'No matches', body, { label: 'Clear search', kind: KINDS.clr });
  }
  if (opts.flt === 'favs') {
    return mkEmpty('star', 'No favourites yet', 'Tap the star on any channel to add it here.',
      { label: 'Browse all channels', kind: KINDS.all });
  }
  if (opts.flt !== 'all') {
    return mkEmpty('list', 'Nothing in this category', 'This category has no channels right now.',
      { label: 'Browse all channels', kind: KINDS.all });
  }
  return mkEmpty('list', 'No channels', 'This playlist returned no channels. Try another source.');
}

// ---------------------------------------------------------------------------
// resolveSignal — pure: player no-signal EmptyState for idle + stream-error
// (specs/empty-states.md §3). opts: { phase, cur }
// ---------------------------------------------------------------------------
function resolveSignal(opts) {
  if (opts.phase === 'ERR' && opts.cur) {
    return mkEmpty('alert', "This channel won't play",
      'The stream could not be loaded. It may be offline or temporarily unavailable.',
      { label: 'Retry', kind: KINDS.rty });
  }
  if (opts.phase === 'INIT') {
    return mkEmpty('antenna', 'No signal', 'Connect a playlist below to start watching.',
      { label: 'Connect a source', kind: KINDS.conn });
  }
  return mkEmpty('antenna', 'No signal', 'Pick a channel from the grid to start watching.');
}

window.IptvEmpty = { resolveContent, resolveSignal };
