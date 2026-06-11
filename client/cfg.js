// ADR: ADR-0001, ADR-0003
/* global window */

'use strict';

const S = {
  base:     '/api',
  pgSz:     50,
  volStp:   0.1,
  skpSec:   10,
  debMs:    200,
  retries:  3,
  credsKey: 'iptv_creds',
  selKey:   'iptv_sel',
  favsKey:  'iptv_favs',
};
Object.freeze(S);
window.S = S;
