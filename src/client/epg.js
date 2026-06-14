// ADR: ADR-0030
/* global window, atob, escape, decodeURIComponent */

'use strict';

// ---------------------------------------------------------------------------
// epg.js — in-memory, session-scoped Electronic Program Guide store
// (ADR-0030, specs/epg.md §1–§2). Mirrors errlog.js (ADR-0027): a small
// self-contained client IIFE holding a non-persisted, keyed-by-channel guide,
// the two pure parsers (parsXtEpg, parsXmltv), the store mutators, and the
// pure now/next/schedule selectors over the canonical Prg / PRG_DEF schema
// (CONVENTIONS §7). Not persisted: live session metadata, gone on reload.
// ---------------------------------------------------------------------------

/** @typedef {{ chId:string, title:string, start:number, stop:number, desc:string, cat:string }} Prg */

// Internal store — { [chId]: Prg[] }, each list sorted ascending by start.
// Only mutated through set / setAll / clear; get hands out a fresh copy.
const EPG = {};

// Unix seconds → ms multiplier; XMLTV timestamp field lengths.
const SEC_MS = 1000;
const TS_LEN = 14;

// ---------------------------------------------------------------------------
// isB64 — pure predicate: the value looks like a base64 blob (length a
// multiple of 4, base64 alphabet only). Used to decide whether to decode.
// ---------------------------------------------------------------------------
function isB64(val) {
  const s = String(val);
  return s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

// ---------------------------------------------------------------------------
// getDec — pure: UTF-8-safe base64 decode when the value is base64, else the
// value verbatim. Returns '' for empty / undecodable input.
// ---------------------------------------------------------------------------
function getDec(val) {
  if (val === null || val === undefined) return '';
  if (!isB64(val)) return String(val);
  try { return decodeURIComponent(escape(atob(String(val)))); }
  catch (err) { return String(val); }
}

// ---------------------------------------------------------------------------
// mkPrg — pure builder: a normalized Prg from already-coerced parts. opts
// carries { chId, title, start, stop, desc, cat }; missing optionals default
// to '' per PRG_DEF (CONVENTIONS §7).
// ---------------------------------------------------------------------------
function mkPrg(opts) {
  return {
    chId:  String(opts.chId),
    title: String(opts.title || ''),
    start: opts.start,
    stop:  opts.stop,
    desc:  String(opts.desc || ''),
    cat:   String(opts.cat || ''),
  };
}

// ---------------------------------------------------------------------------
// isPrg — pure predicate: a built Prg is well-formed (string chId, finite
// numeric start < stop). Malformed entries are dropped during parse.
// ---------------------------------------------------------------------------
function isPrg(prg) {
  return typeof prg.chId === 'string' && prg.chId.length > 0
    && Number.isFinite(prg.start) && Number.isFinite(prg.stop)
    && prg.start < prg.stop;
}

// ---------------------------------------------------------------------------
// bySrt — comparator: ascending by start (unix ms).
// ---------------------------------------------------------------------------
function bySrt(a, b) {
  return a.start - b.start;
}

// ---------------------------------------------------------------------------
// mkXtPrg — pure: one Xtream get_simple_data_table listing → Prg for chId.
// Reads *_timestamp (unix seconds) → unix ms, base64-decodes title/desc.
// ---------------------------------------------------------------------------
function mkXtPrg(d, chId) {
  return mkPrg({
    chId,
    title: getDec(d.title),
    start: Number(d.start_timestamp) * SEC_MS,
    stop:  Number(d.stop_timestamp) * SEC_MS,
    desc:  getDec(d.description),
    cat:   '',
  });
}

// ---------------------------------------------------------------------------
// parsXtEpg — pure: a get_simple_data_table-shaped payload
// ({ epg_listings: [...] }) → Prg[] for chId, ascending by start, malformed
// dropped. Tolerates a missing / empty epg_listings.
// ---------------------------------------------------------------------------
function parsXtEpg(raw, chId) {
  const src = (raw && Array.isArray(raw.epg_listings)) ? raw.epg_listings : [];
  const out = [];
  for (let i = 0; i < src.length; i += 1) {
    const prg = mkXtPrg(src[i], chId);
    if (isPrg(prg)) out.push(prg);
  }
  return out.sort(bySrt);
}

// ---------------------------------------------------------------------------
// getXmlTs — pure: an XMLTV "YYYYMMDDHHMMSS ±HHMM" timestamp → unix ms,
// honoring the offset. Returns NaN when the field is malformed (drops entry).
// ---------------------------------------------------------------------------
function getXmlTs(val) {
  const m = String(val).match(/^(\d{14})(?:\s*([+-]\d{4}))?/);
  if (!m) return NaN;
  const b = m[1];
  const iso = b.slice(0, 4) + '-' + b.slice(4, 6) + '-' + b.slice(6, 8)
    + 'T' + b.slice(8, 10) + ':' + b.slice(10, 12) + ':' + b.slice(12, TS_LEN)
    + (m[2] ? m[2].slice(0, 3) + ':' + m[2].slice(3) : 'Z');
  return Date.parse(iso);
}

// ---------------------------------------------------------------------------
// getTag — pure: inner text of the first <tag>…</tag> in a programme block,
// trimmed; '' when absent.
// ---------------------------------------------------------------------------
function getTag(block, tag) {
  const m = block.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------------------
// mkXmlPrg — pure: one <programme>…</programme> block → Prg, using its
// attribute string (channel/start/stop) and inner tags (title/desc/category).
// ---------------------------------------------------------------------------
function mkXmlPrg(block, attrs) {
  const ch = (attrs.match(/channel="([^"]*)"/) || [])[1] || '';
  return mkPrg({
    chId:  ch,
    title: getTag(block, 'title'),
    start: getXmlTs((attrs.match(/start="([^"]*)"/) || [])[1] || ''),
    stop:  getXmlTs((attrs.match(/stop="([^"]*)"/) || [])[1] || ''),
    desc:  getTag(block, 'desc'),
    cat:   getTag(block, 'category'),
  });
}

// ---------------------------------------------------------------------------
// addPrg — push a parsed Prg into the per-channel buckets of a working map.
// ---------------------------------------------------------------------------
function addPrg(map, prg) {
  if (!map[prg.chId]) map[prg.chId] = [];
  map[prg.chId].push(prg);
}

// ---------------------------------------------------------------------------
// parsXmltv — pure: XMLTV text → { [tvgId]: Prg[] } keyed by each
// <programme channel="…">, each list ascending by start, malformed dropped.
// Timestamps parsed to unix ms honoring the offset (CONVENTIONS §7).
// ---------------------------------------------------------------------------
function parsXmltv(text) {
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  const map = {};
  let m = re.exec(String(text));
  while (m) {
    const prg = mkXmlPrg(m[2], m[1]);
    if (isPrg(prg)) addPrg(map, prg);
    m = re.exec(String(text));
  }
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length; i += 1) map[keys[i]].sort(bySrt);
  return map;
}

// ---------------------------------------------------------------------------
// set — store Prg[] for a channel id, replacing any prior list (sorted copy).
// ---------------------------------------------------------------------------
function set(chId, prgs) {
  EPG[String(chId)] = (prgs || []).slice().sort(bySrt);
}

// ---------------------------------------------------------------------------
// setAll — bulk-store a { [chId]: Prg[] } map (the XMLTV path).
// ---------------------------------------------------------------------------
function setAll(map) {
  const keys = Object.keys(map || {});
  for (let i = 0; i < keys.length; i += 1) set(keys[i], map[keys[i]]);
}

// ---------------------------------------------------------------------------
// get — the stored Prg[] for a channel as a fresh copy ([] when none); the
// internal reference is never handed out.
// ---------------------------------------------------------------------------
function get(chId) {
  const list = EPG[String(chId)];
  return list ? list.slice() : [];
}

// ---------------------------------------------------------------------------
// has — true only when a non-empty guide is stored for the channel.
// ---------------------------------------------------------------------------
function has(chId) {
  const list = EPG[String(chId)];
  return Boolean(list && list.length > 0);
}

// ---------------------------------------------------------------------------
// count — number of channels with a non-empty stored guide.
// ---------------------------------------------------------------------------
function count() {
  return Object.keys(EPG).filter(hasKey).length;
}

// ---------------------------------------------------------------------------
// hasKey — pure predicate used by count: the stored list for a key is
// non-empty.
// ---------------------------------------------------------------------------
function hasKey(k) {
  return EPG[k].length > 0;
}

// ---------------------------------------------------------------------------
// clear — empty the store (count() becomes 0).
// ---------------------------------------------------------------------------
function clear() {
  const keys = Object.keys(EPG);
  for (let i = 0; i < keys.length; i += 1) delete EPG[keys[i]];
}

// ---------------------------------------------------------------------------
// getNow — pure: the program airing at ts (start <= ts < stop), or null.
// ---------------------------------------------------------------------------
function getNow(prgs, ts) {
  for (let i = 0; i < prgs.length; i += 1) {
    if (prgs[i].start <= ts && ts < prgs[i].stop) return prgs[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// getNxt — pure: the earliest program whose start reaches the threshold lo
// (the list is already ascending by start), or null. lo is the current
// program's stop when one airs, else ts — so next is always after now.
// ---------------------------------------------------------------------------
function getNxt(prgs, lo) {
  for (let i = 0; i < prgs.length; i += 1) {
    if (prgs[i].start >= lo) return prgs[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// getNowNext — pure: { now, next } for a channel at time now (defaults to
// Date.now()); both null when nothing matches or no guide.
// ---------------------------------------------------------------------------
function getNowNext(chId, now) {
  const ts = (now === null || now === undefined) ? Date.now() : now;
  const prgs = get(chId);
  const cur = getNow(prgs, ts);
  const lo = cur ? cur.stop : ts;
  return { now: cur, next: getNxt(prgs, lo) };
}

// ---------------------------------------------------------------------------
// getSched — pure: upcoming Prg[] (current program plus those not yet
// stopped) ascending by start; [] when no guide.
// ---------------------------------------------------------------------------
function getSched(chId, now) {
  const ts = (now === null || now === undefined) ? Date.now() : now;
  const out = [];
  const prgs = get(chId);
  for (let i = 0; i < prgs.length; i += 1) {
    if (prgs[i].stop > ts) out.push(prgs[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
window.IptvEpg = {
  parsXtEpg,
  parsXmltv,
  set,
  setAll,
  get,
  has,
  count,
  clear,
  getNowNext,
  getSched,
};
