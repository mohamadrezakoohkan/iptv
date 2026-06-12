// ADR: ADR-0001, ADR-0017
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// SORTS — single source of truth for the available sort options (ADR-0017).
// id = stable token used by the comparator + persistence; label = UI text.
// Order is the order the control renders them. Default is the first, num-asc.
// ---------------------------------------------------------------------------
const SORTS = [
  { id: 'num-asc',   label: 'Number ↑' },
  { id: 'name-asc',  label: 'Name A–Z' },
  { id: 'name-desc', label: 'Name Z–A' },
  { id: 'fav-first', label: 'Favourites first' },
];

// ---------------------------------------------------------------------------
// cmpNum — pure: channel number ascending; the deterministic tiebreak.
// ---------------------------------------------------------------------------
function cmpNum(a, b) {
  return a.num - b.num;
}

// ---------------------------------------------------------------------------
// cmpName — pure: case-insensitive locale name compare, num-asc tiebreak.
// dir is 1 for A→Z, -1 for Z→A.
// ---------------------------------------------------------------------------
function cmpName(a, b, dir) {
  const c = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  return c !== 0 ? c * dir : cmpNum(a, b);
}

// ---------------------------------------------------------------------------
// cmpFav — pure: favourites (id in favs) first, each partition num-asc.
// ---------------------------------------------------------------------------
function cmpFav(a, b, favs) {
  const fa = favs.indexOf(String(a.id)) !== -1 ? 0 : 1;
  const fb = favs.indexOf(String(b.id)) !== -1 ? 0 : 1;
  return fa !== fb ? fa - fb : cmpNum(a, b);
}

// ---------------------------------------------------------------------------
// sortChs — pure: orders a copy of res by the sort token; unknown → num-asc.
// ---------------------------------------------------------------------------
function sortChs(res, sort, favs) {
  if (sort === 'name-asc')  return res.slice().sort(function cN(a, b) { return cmpName(a, b, 1); });
  if (sort === 'name-desc') return res.slice().sort(function cN(a, b) { return cmpName(a, b, -1); });
  if (sort === 'fav-first') return res.slice().sort(function cF(a, b) { return cmpFav(a, b, favs); });
  return res.slice().sort(cmpNum);
}

/**
 * getChs — pure filter + sort, no ST reads.
 * @param {Array} chs   - full Ch[] from ST.chs
 * @param {string} q    - search query string
 * @param {string} flt  - active filter: 'all' | 'favs' | category string
 * @param {Array} favs  - array of ch.id strings currently in favourites
 * @param {string} sort - active sort token (one of SORTS ids; unknown → num-asc)
 * @returns {Array} filtered and sorted Ch[]
 */
function getChs(chs, q, flt, favs, sort) {
  let res = chs;
  if (flt === 'favs') {
    res = chs.filter(function isFav(ch) { return favs.indexOf(String(ch.id)) !== -1; });
  } else if (flt !== 'all') {
    res = chs.filter(function isCat(ch) { return ch.cat === flt; });
  }
  if (q && q.length > 0) {
    const lq = q.toLowerCase();
    res = res.filter(function matchQ(ch) {
      return ch.name.toLowerCase().indexOf(lq) !== -1 || String(ch.num).indexOf(q) !== -1;
    });
  }
  return sortChs(res, sort, favs);
}

window.IptvSrch = { getChs, SORTS };
