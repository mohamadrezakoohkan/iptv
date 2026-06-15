// ADR: ADR-0037
/* global window */

'use strict';

// ---------------------------------------------------------------------------
// vod.js — in-memory, session-scoped VOD (Movies & Series) store + pure
// normalizers + pure on-demand stream-URL builders (ADR-0037,
// specs/vod-library.md §1–§4). Mirrors epg.js / errlog.js / rem.js: a small
// self-contained flat-scope client module holding a non-persisted, Map-backed
// store for movies, series browse entries, and per-series episodes, plus the
// pure normalizers that map raw Xtream get_vod_streams / get_series /
// get_series_info payloads into the parallel on-demand Vod / Series shapes, and
// the pure /movie/… and /series/… URL builders (extension preserved so getEng
// resolves the same engine). No fetch, no DOM, no ST, no localStorage — the
// fetch wiring is TASK-0078, the UI is ADR-0038.
//
// Top-level bindings are uniquely named (VOD, vodMkMov, vodSetMovs, …) so this
// flat-scope module never collides with epg.js / errlog.js / rem.js, which
// share the same browser global scope (a documented prior near-miss). The
// public window.IptvVod object exposes the spec member names.
// ---------------------------------------------------------------------------

/** @typedef {{ id:string, name:string, grp:string, url:string, img:string, cat:string, num:number, kind:'movie'|'episode' }} Vod */
/** @typedef {{ id:string, name:string, grp:string, img:string, cat:string }} Series */

// Internal store — Map-backed (mirroring window.IptvEpg's keyed store). Only
// mutated through the vodSet*/vodClear mutators; getters hand out fresh copies
// (arrays sliced) so the internal references are never leaked.
//   movs  — Vod[] (kind:'movie'), the full movie list
//   sers  — Series[], the series browse entries
//   epis  — Map<seriesId, Vod[]> (kind:'episode'), per-series flattened episodes
const VOD = {
  movs: [],
  sers: [],
  epis: new Map(),
};

// Live-extension fallback when an item carries no container_extension (§3).
const VOD_EXT = 'ts';

// ---------------------------------------------------------------------------
// vodGrp — pure: resolve a category id to its name via the category Map,
// 'Uncategorized' when the id is unknown (§1, §2 — mirrors mkXtCh's grp rule).
// ---------------------------------------------------------------------------
function vodGrp(cmap, cid) {
  return cmap && cmap.has(cid) ? cmap.get(cid) : 'Uncategorized';
}

// ---------------------------------------------------------------------------
// vodExt — pure: the extension to preserve for an item — its
// container_extension when a non-empty string, else the account live extension
// (opts.ext), else 'ts' (§3).
// ---------------------------------------------------------------------------
function vodExt(raw, ext) {
  const ce = raw && raw.container_extension;
  if (typeof ce === 'string' && ce.length > 0) return ce;
  return typeof ext === 'string' && ext.length > 0 ? ext : VOD_EXT;
}

// ---------------------------------------------------------------------------
// vodMovUrl — pure: build the Xtream on-demand movie URL
// <base>/movie/<user>/<pass>/<id>.<ext> (§3).
// ---------------------------------------------------------------------------
function vodMovUrl(opts) {
  return opts.base + '/movie/' + opts.user + '/' + opts.pass + '/' + opts.id + '.' + opts.ext;
}

// ---------------------------------------------------------------------------
// vodEpiUrl — pure: build the Xtream on-demand series-episode URL
// <base>/series/<user>/<pass>/<id>.<ext> (§3).
// ---------------------------------------------------------------------------
function vodEpiUrl(opts) {
  return opts.base + '/series/' + opts.user + '/' + opts.pass + '/' + opts.id + '.' + opts.ext;
}

// ---------------------------------------------------------------------------
// vodNum — pure: numeric ordering hint — the raw num when numeric, else 0 (§1).
// ---------------------------------------------------------------------------
function vodNum(raw) {
  return typeof raw.num === 'number' ? raw.num : 0;
}

// ---------------------------------------------------------------------------
// vodImg — pure: poster URL — the first non-empty of the candidate fields,
// '' when none (§1: movie stream_icon/cover, series cover).
// ---------------------------------------------------------------------------
function vodImg(raw) {
  if (typeof raw.stream_icon === 'string' && raw.stream_icon.length > 0) return raw.stream_icon;
  if (typeof raw.cover === 'string' && raw.cover.length > 0) return raw.cover;
  return '';
}

// ---------------------------------------------------------------------------
// vodMkMov — pure: one raw get_vod_streams entry → Vod movie item (kind:'movie')
// with grp resolved and url built (§1, §3). opts: {raw, cmap, base, user, pass, ext}
// ---------------------------------------------------------------------------
function vodMkMov(opts) {
  const d = opts.raw;
  const cid = String(d.category_id ?? '');
  const id = String(d.stream_id);
  return {
    id,
    name: String(d.name ?? ''),
    grp:  vodGrp(opts.cmap, cid),
    url:  vodMovUrl({ base: opts.base, user: opts.user, pass: opts.pass, id, ext: vodExt(d, opts.ext) }),
    img:  vodImg(d),
    cat:  cid,
    num:  vodNum(d),
    kind: 'movie',
  };
}

// ---------------------------------------------------------------------------
// vodGetMovs — pure: raw get_vod_streams payload → Vod[] movies.
// opts: {raw, cmap, base, user, pass, ext}
// ---------------------------------------------------------------------------
function vodGetMovs(opts) {
  const list = Array.isArray(opts.raw) ? opts.raw : [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    out.push(vodMkMov({ raw: list[i], cmap: opts.cmap, base: opts.base, user: opts.user, pass: opts.pass, ext: opts.ext }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// vodMkSer — pure: one raw get_series entry → Series browse entry (no url)
// with grp resolved (§2). opts: {raw, cmap}
// ---------------------------------------------------------------------------
function vodMkSer(opts) {
  const d = opts.raw;
  const cid = String(d.category_id ?? '');
  return {
    id:   String(d.series_id),
    name: String(d.name ?? ''),
    grp:  vodGrp(opts.cmap, cid),
    img:  vodImg(d),
    cat:  cid,
  };
}

// ---------------------------------------------------------------------------
// vodGetSers — pure: raw get_series payload → Series[]. opts: {raw, cmap}
// ---------------------------------------------------------------------------
function vodGetSers(opts) {
  const list = Array.isArray(opts.raw) ? opts.raw : [];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    out.push(vodMkSer({ raw: list[i], cmap: opts.cmap }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// vodEpiName — pure: episode display name "<series> · S<season>E<episode>
// <title>" (§1). Season/episode taken from the flatten opts; trailing space
// trimmed when the raw episode carries no title.
// ---------------------------------------------------------------------------
function vodEpiName(opts) {
  const ttl = String(opts.title || '');
  const head = opts.series + ' · S' + opts.season + 'E' + opts.episode;
  return ttl.length > 0 ? head + ' ' + ttl : head;
}

// ---------------------------------------------------------------------------
// vodMkEpi — pure: one raw episode object (from get_series_info episodes[season])
// → Vod episode item (kind:'episode') with name + built series URL (§1, §3).
// opts: {raw, series, season, base, user, pass, ext}
// ---------------------------------------------------------------------------
function vodMkEpi(opts) {
  const d = opts.raw;
  const id = String(d.id);
  const info = d.info || {};
  return {
    id,
    name: vodEpiName({ series: opts.series, season: opts.season, episode: String(d.episode_num ?? ''), title: d.title }),
    grp:  'S' + opts.season,
    url:  vodEpiUrl({ base: opts.base, user: opts.user, pass: opts.pass, id, ext: vodExt(d, opts.ext) }),
    img:  typeof info.movie_image === 'string' ? info.movie_image : '',
    cat:  String(opts.season),
    num:  typeof d.episode_num === 'number' ? d.episode_num : Number(d.episode_num) || 0,
    kind: 'episode',
  };
}

// ---------------------------------------------------------------------------
// vodSeasonKeys — pure: the episodes-map season keys in ascending numeric order
// (the get_series_info episodes map is keyed by season number string).
// ---------------------------------------------------------------------------
function vodSeasonKeys(eps) {
  return Object.keys(eps || {}).sort(function bySeas(a, b) { return Number(a) - Number(b); });
}

// ---------------------------------------------------------------------------
// vodGetEpis — pure: a get_series_info payload → flattened Vod[] episodes,
// grouped by season (season order ascending, episode order as listed). §1, §3.
// opts: {raw, series, base, user, pass, ext}
// ---------------------------------------------------------------------------
function vodGetEpis(opts) {
  const eps = opts.raw && opts.raw.episodes ? opts.raw.episodes : {};
  const keys = vodSeasonKeys(eps);
  const out = [];
  for (let i = 0; i < keys.length; i += 1) {
    const season = keys[i];
    const list = Array.isArray(eps[season]) ? eps[season] : [];
    for (let j = 0; j < list.length; j += 1) {
      out.push(vodMkEpi({ raw: list[j], series: opts.series, season, base: opts.base, user: opts.user, pass: opts.pass, ext: opts.ext }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// vodSetMovs — store the movie Vod[] (sliced copy), replacing any prior list.
// ---------------------------------------------------------------------------
function vodSetMovs(movs) {
  VOD.movs = (movs || []).slice();
}

// ---------------------------------------------------------------------------
// vodGetMovsStore — the stored movie Vod[] as a fresh copy.
// ---------------------------------------------------------------------------
function vodGetMovsStore() {
  return VOD.movs.slice();
}

// ---------------------------------------------------------------------------
// vodSetSers — store the Series[] (sliced copy), replacing any prior list.
// ---------------------------------------------------------------------------
function vodSetSers(sers) {
  VOD.sers = (sers || []).slice();
}

// ---------------------------------------------------------------------------
// vodGetSersStore — the stored Series[] as a fresh copy.
// ---------------------------------------------------------------------------
function vodGetSersStore() {
  return VOD.sers.slice();
}

// ---------------------------------------------------------------------------
// vodSetEpis — store a series' episode Vod[] keyed by series_id (sliced copy).
// ---------------------------------------------------------------------------
function vodSetEpis(serId, epis) {
  VOD.epis.set(String(serId), (epis || []).slice());
}

// ---------------------------------------------------------------------------
// vodGetEpisStore — the stored episode Vod[] for a series_id as a fresh copy
// ([] when none stored).
// ---------------------------------------------------------------------------
function vodGetEpisStore(serId) {
  const list = VOD.epis.get(String(serId));
  return list ? list.slice() : [];
}

// ---------------------------------------------------------------------------
// vodHasMovs — true when at least one movie is stored.
// ---------------------------------------------------------------------------
function vodHasMovs() {
  return VOD.movs.length > 0;
}

// ---------------------------------------------------------------------------
// vodHasSers — true when at least one series browse entry is stored.
// ---------------------------------------------------------------------------
function vodHasSers() {
  return VOD.sers.length > 0;
}

// ---------------------------------------------------------------------------
// vodClear — empty the whole store (connect/switch/disconnect reset).
// ---------------------------------------------------------------------------
function vodClear() {
  VOD.movs = [];
  VOD.sers = [];
  VOD.epis = new Map();
}

// ---------------------------------------------------------------------------
// Public API — spec member names (§1 store API; normalizers; URL builders).
// ---------------------------------------------------------------------------
window.IptvVod = {
  // normalizers (pure)
  getMovs:  vodGetMovs,
  getSers:  vodGetSers,
  getEpis:  vodGetEpis,
  // URL builders (pure)
  movUrl:   vodMovUrl,
  epiUrl:   vodEpiUrl,
  // store mutators / accessors
  setMovs:  vodSetMovs,
  movies:   vodGetMovsStore,
  setSers:  vodSetSers,
  series:   vodGetSersStore,
  setEpis:  vodSetEpis,
  episodes: vodGetEpisStore,
  hasMovies: vodHasMovs,
  hasSeries: vodHasSers,
  clear:    vodClear,
};
