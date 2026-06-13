// ADR: ADR-0002
'use strict';

const CFG = {
  port:    Number(process.env.PORT)    || 3000,
  timeout: Number(process.env.TIMEOUT) || 10000,
  maxChs:  Number(process.env.MAX_CHS) || 5000,
  maxPrgs: 500,
  cacheMs: 3600000,
  plUrl:   process.env.PL_URL  || '',
  epgUrl:  process.env.EPG_URL || '',
};

module.exports = CFG;
