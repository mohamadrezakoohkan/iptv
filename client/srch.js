// ADR: ADR-0001
/* global window */

'use strict';

/**
 * getChs — pure filter + sort, no ST reads.
 * @param {Array} chs   - full Ch[] from ST.chs
 * @param {string} q    - search query string
 * @param {string} flt  - active filter: 'all' | 'favs' | category string
 * @param {Array} favs  - array of ch.id strings currently in favourites
 * @returns {Array} filtered and sorted Ch[]
 */
function getChs(chs, q, flt, favs) {
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
  return res.slice().sort(function bNum(a, b) { return a.num - b.num; });
}

window.IptvSrch = { getChs };
