// ADR: ADR-0001, ADR-0003, ADR-0013, ADR-0015
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// Community presets (ADR-0015) — a small, stable, all-M3U catalog of public
// iptv-org playlists, all under the durable https://iptv-org.github.io/iptv/
// path. Carries no credentials. Frozen so it shares S's immutability.
// ---------------------------------------------------------------------------
/** @typedef {{ name:string, url:string }} Pst */
const PSTS = [
  { name: 'iptv-org · All',     url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: 'iptv-org · English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
  { name: 'iptv-org · News',    url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { name: 'iptv-org · Sports',  url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { name: 'iptv-org · Music',   url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
];
PSTS.forEach(function frz(p) { Object.freeze(p); });
Object.freeze(PSTS);

const S = {
  base:     '/api',
  pgSz:     50,
  volStp:   0.1,
  skpSec:   10,
  debMs:    200,
  retries:  3,
  acctsKey: 'iptv_accts',
  actKey:   'iptv_act',
  selKey:   'iptv_sel',
  favsKey:  'iptv_favs',
  psts:     PSTS,
};
Object.freeze(S);
window.S = S;
