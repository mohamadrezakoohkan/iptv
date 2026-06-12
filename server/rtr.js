// ADR: ADR-0002, ADR-0011
'use strict';

const http    = require('http');
const https   = require('https');
const express = require('express');

const rtr = express.Router();

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const REDIR_CODES   = [301, 302, 303, 307, 308];
const MAX_HOPS      = 5;

function isValidUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (BLOCKED_HOSTS.includes(parsed.hostname)) return false;
  return true;
}

function runProxy(req, res) {
  const raw = req.query.url;
  if (!isValidUrl(raw)) {
    res.status(400).json({ err: 'invalid url' });
    return;
  }
  runHop(res, { url: raw, hops: 0, method: req.method });
}

function runHop(res, opts) {
  const parsed = new URL(opts.url);
  const mod    = parsed.protocol === 'https:' ? https : http;
  const prx = mod.request({
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method:   opts.method,
    headers:  { 'user-agent': 'iptv-proxy/1.0' },
  }, function onProxyRes(upstream) {
    if (REDIR_CODES.includes(upstream.statusCode) && upstream.headers.location) {
      upstream.resume();
      goRedir(res, { url: opts.url, loc: upstream.headers.location, hops: opts.hops, method: opts.method });
      return;
    }
    runPipe(res, { prx: prx, upstream: upstream });
  });
  prx.on('error', function onProxyErr(err) {
    if (res.headersSent) { res.destroy(); return; }
    res.status(502).json({ err: err.message });
  });
  prx.end();
}

function goRedir(res, opts) {
  if (opts.hops + 1 > MAX_HOPS) {
    res.status(502).json({ err: 'too many redirects' });
    return;
  }
  let nxt = '';
  try {
    nxt = new URL(opts.loc, opts.url).href;
  } catch (_) {
    nxt = '';
  }
  if (!isValidUrl(nxt)) {
    res.status(400).json({ err: 'invalid redirect target' });
    return;
  }
  runHop(res, { url: nxt, hops: opts.hops + 1, method: opts.method });
}

function runPipe(res, opts) {
  res.writeHead(opts.upstream.statusCode, opts.upstream.headers);
  opts.upstream.pipe(res);
  res.on('close', function onCliGone() {
    opts.upstream.destroy();
    opts.prx.destroy();
  });
  opts.upstream.on('error', function onUpErr() { if (!res.headersSent) res.destroy(); });
}

rtr.get('/api/xtream', runProxy);

rtr._isValidUrl  = isValidUrl;
rtr._runProxy    = runProxy;
rtr._blocked     = BLOCKED_HOSTS;

module.exports = rtr;
