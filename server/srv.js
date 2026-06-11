// ADR: ADR-0002
'use strict';

const path    = require('path');
const express = require('express');
const CFG     = require('./cfg');
const rtr     = require('./rtr');

const ROOT = path.join(__dirname, '..');

const ST = {
  chs:   [],
  grps:  [],
  epg:   {},
  ready: false,
  err:   null,
  ts:    0,
};

const app = express();

app.use(rtr);
app.use(express.static(path.join(ROOT, 'client')));
app.get('/', function getCatch(req, res) {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(CFG.port, function onListen() {
  ST.ready = true;
  ST.ts    = Date.now();
  process.stdout.write('iptv srv listening on port ' + CFG.port + '\n');
});

module.exports = { app, ST };
