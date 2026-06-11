// ADR: ADR-0002
'use strict';

const http    = require('http');
const https   = require('https');
const express = require('express');

const rtr = express.Router();

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

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
  const parsed = new URL(raw);
  const mod    = parsed.protocol === 'https:' ? https : http;
  const opts   = {
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method:   req.method,
    headers:  { 'user-agent': 'iptv-proxy/1.0' },
  };
  const prx = mod.request(opts, function onProxyRes(upstream) {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });
  prx.on('error', function onProxyErr(err) {
    res.status(502).json({ err: err.message });
  });
  prx.end();
}

rtr.get('/api/xtream', runProxy);

rtr._isValidUrl = isValidUrl;

module.exports = rtr;
