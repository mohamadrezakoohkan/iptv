// ADR: ADR-0001, ADR-0005, ADR-0008, ADR-0009, ADR-0020
/* global window, fetch, AbortController, encodeURIComponent, clearTimeout, setTimeout, Promise, URL */

(function runApi() {
  'use strict';

  const TOUT_MS = 15000;
  const DEMO_MS = 700;

  /**
   * DEMO_DATA: [category-name, [channel-names]][]
   * 7 categories, 31 channels total.
   */
  const DEMO_DATA = [
    ['News',          ['World News 24', 'Daily Headlines', 'Business Now', 'Weather 24', 'Regional News']],
    ['Sports',        ['Sports Arena HD', 'Racket TV', 'Football Hub', 'Motor Live', 'Extreme Sports', 'Padel One']],
    ['Movies',        ['Cinema One', 'Classic Films', 'Action Movies HD', 'Indie Screen', 'Comedy Films']],
    ['Entertainment', ['Prime Variety', 'Reality 24', 'Talk & Late Night', 'Lifestyle TV']],
    ['Kids',          ['Toon Time', 'Junior TV', 'Learning Land']],
    ['Music',         ['Hits 24/7', 'Classical Stage', 'Urban Beats', 'Retro Radio TV']],
    ['Documentary',   ['Nature & Wild', 'History Vault', 'Science Today', 'True Crime Files']],
  ];

  const DEMO_SRC1 = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  const DEMO_SRC2 = 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8';

  /** @param {string} src */
  function isDemo(src) {
    return typeof src === 'string' && src.trim().toLowerCase() === 'demo';
  }

  /** Slugify a demo category name into its stable category id. */
  function catSlug(name) {
    return name.toLowerCase().replace(/\s+/g, '-');
  }

  /** Build a single category object from a DEMO_DATA row. */
  function mkCat(d) {
    return { name: d[0], id: catSlug(d[0]) };
  }

  /** Build categories array from DEMO_DATA. */
  function getDemoCats() {
    return DEMO_DATA.map(mkCat);
  }

  /**
   * Build a single channel object. opts: { name, grp, cnt }
   * cat is the category id (slug of grp) so it matches getDemoCats()'s id —
   * the id-based grid filter (getChs flt, ADR-0009) keys on ch.cat === cat.id;
   * grp stays the human-readable category/genre name (Ch schema, §5a chip).
   */
  function mkDemoCh(opts) {
    return {
      id:  String(opts.cnt),
      name: opts.name,
      grp:  opts.grp,
      url:  opts.cnt % 2 === 0 ? DEMO_SRC2 : DEMO_SRC1,
      img:  '',
      cat:  catSlug(opts.grp),
      num:  opts.cnt,
    };
  }

  /** Build channels array from DEMO_DATA. */
  function getDemoChs() {
    const chs = [];
    let cnt = 1;
    for (let i = 0; i < DEMO_DATA.length; i += 1) {
      const grp = DEMO_DATA[i][0];
      const names = DEMO_DATA[i][1];
      for (let j = 0; j < names.length; j += 1) {
        chs.push(mkDemoCh({ name: names[j], grp, cnt }));
        cnt += 1;
      }
    }
    return chs;
  }

  /** Wait ms milliseconds. */
  function waitMs(ms) {
    return new Promise(function onWait(res) { setTimeout(res, ms); });
  }

  /** Strip trailing slashes from a portal base URL. */
  function getBase(src) {
    return String(src).replace(/\/+$/, '');
  }

  /** Build the proxy-wrapped Xtream API URL. opts: {user, pass, actn} */
  function mkPxUrl(src, opts) {
    const tmp = getBase(src) + '/player_api.php?username=' + opts.user
      + '&password=' + opts.pass + '&action=' + opts.actn;
    return '/api/xtream?url=' + encodeURIComponent(tmp);
  }

  /** Build the proxy-wrapped no-action player_api.php auth/info URL. opts: {user, pass} */
  function mkInfUrl(src, opts) {
    const tmp = getBase(src) + '/player_api.php?username=' + opts.user
      + '&password=' + opts.pass;
    return '/api/xtream?url=' + encodeURIComponent(tmp);
  }

  /** Fetch JSON through proxy with 15 s AbortController timeout. */
  async function loadJson(src) {
    const ctrl = new AbortController();
    const tid = setTimeout(function onTout() { ctrl.abort(); }, TOUT_MS);
    try {
      const raw = await fetch(src, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!raw.ok) return { ok: false, err: 'Portal responded ' + raw.status };
      const val = await raw.json();
      return { ok: true, val };
    } catch (e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') return { ok: false, err: 'Portal timed out after 15 s' };
      return { ok: false, err: 'Could not reach the portal – network error' };
    }
  }

  /** Fetch raw text through proxy with 15 s AbortController timeout. */
  async function fetchTxt(src) {
    const ctrl = new AbortController();
    const tid = setTimeout(function onTout() { ctrl.abort(); }, TOUT_MS);
    try {
      const raw = await fetch(src, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!raw.ok) return { ok: false, err: 'Playlist responded ' + raw.status };
      const val = await raw.text();
      return { ok: true, val };
    } catch (e) {
      clearTimeout(tid);
      if (e.name === 'AbortError') return { ok: false, err: 'Playlist timed out after 15 s' };
      return { ok: false, err: 'Could not reach the playlist – network error' };
    }
  }

  /** Extract hostname from a URL string. Returns the full url string on parse failure. */
  function hostOf(url) {
    try { return new URL(url).hostname; } catch (_) { return url; }
  }

  /** Fetch an M3U playlist via proxy, parse it, return Result<{server,host,user,categories,channels}>. */
  async function loadM3u(url) {
    const prx = '/api/xtream?url=' + encodeURIComponent(url);
    const res = await fetchTxt(prx);
    if (!res.ok) return res;
    const parsed = parsM3u(res.val);
    if (!parsed.ok) return parsed;
    return { ok: true, val: { server: null, host: hostOf(url), user: '', categories: parsed.val.categories, channels: parsed.val.channels } };
  }

  /** Predicate: no-action player_api.php payload carries a truthy user_info.auth. */
  function hasAuth(inf) {
    return Boolean(inf && inf.user_info && inf.user_info.auth);
  }

  /** Read the stream URL extension from the no-action info payload. Fallback "ts". */
  function getExt(inf) {
    const fmts = inf && inf.user_info && inf.user_info.allowed_output_formats;
    if (Array.isArray(fmts) && typeof fmts[0] === 'string' && fmts[0].length > 0) return fmts[0];
    return 'ts';
  }

  /** Normalize get_live_categories payload to M3U-shaped category objects. */
  function getXtCats(val) {
    const list = Array.isArray(val) ? val : [];
    return list.map(function mkXtCat(d) {
      return { category_id: String(d.category_id), category_name: String(d.category_name) };
    });
  }

  /** Build category_id → category_name Map from normalized category objects. */
  function mkCatMap(cats) {
    const m = new Map();
    for (let i = 0; i < cats.length; i += 1) {
      m.set(cats[i].category_id, cats[i].category_name);
    }
    return m;
  }

  /** Build a Ch object from one raw get_live_streams entry. opts: {raw, cmap, base, user, pass, ext} */
  function mkXtCh(opts) {
    const d = opts.raw;
    const cid = String(d.category_id ?? '');
    return {
      id:   String(d.stream_id),
      name: String(d.name ?? ''),
      grp:  opts.cmap.has(cid) ? opts.cmap.get(cid) : 'Uncategorized',
      url:  opts.base + '/live/' + opts.user + '/' + opts.pass + '/' + d.stream_id + '.' + opts.ext,
      img:  typeof d.stream_icon === 'string' ? d.stream_icon : '',
      cat:  cid,
      num:  typeof d.num === 'number' ? d.num : 0,
    };
  }

  /** Map raw get_live_streams payload to Ch[]. opts: {raw, cats, src, user, pass, ext} */
  function getXtChs(opts) {
    const list = Array.isArray(opts.raw) ? opts.raw : [];
    const cmap = mkCatMap(opts.cats);
    const base = getBase(opts.src);
    const chs = [];
    for (let i = 0; i < list.length; i += 1) {
      chs.push(mkXtCh({ raw: list[i], cmap, base, user: opts.user, pass: opts.pass, ext: opts.ext }));
    }
    return chs;
  }

  /** Load Xtream portal data — auth/info, categories, streams — normalized to Ch (ADR-0009). */
  async function loadXtream(src, opts) {
    let res = await loadJson(mkInfUrl(src, opts));
    if (!res.ok) return res;
    if (!hasAuth(res.val)) return { ok: false, err: 'Login failed – the portal rejected the username or password' };
    const ext = getExt(res.val);
    res = await loadJson(mkPxUrl(src, { user: opts.user, pass: opts.pass, actn: 'get_live_categories' }));
    if (!res.ok) return res;
    const cats = getXtCats(res.val);
    res = await loadJson(mkPxUrl(src, { user: opts.user, pass: opts.pass, actn: 'get_live_streams' }));
    if (!res.ok) return res;
    const chs = getXtChs({ raw: res.val, cats, src, user: opts.user, pass: opts.pass, ext });
    return { ok: true, val: { server: getBase(src), host: src, user: opts.user, categories: cats, channels: chs } };
  }

  /** Return demo Result after simulated delay. */
  async function loadDemo() {
    await waitMs(DEMO_MS);
    return {
      ok: true,
      val: { host: 'demo', user: 'demo', categories: getDemoCats(), channels: getDemoChs() },
    };
  }

  /**
   * Connect to a portal, M3U URL, or demo.
   * Routing (ADR-0008): demo first; then explicit opts.m3u boolean alone
   * decides the path — true means M3U, anything else means Xtream. No
   * URL-shape auto-detection.
   * @param {string} src  - portal base URL, M3U URL, or "demo"
   * @param {Object} opts - { user: string, pass: string, m3u: boolean }
   */
  async function connect(src, opts) {
    const usr = (opts && opts.user) || '';
    const pss = (opts && opts.pass) || '';
    if (isDemo(src)) return loadDemo();
    if (opts && opts.m3u === true) return loadM3u(src);
    return loadXtream(src, { user: usr, pass: pss });
  }

  /** Extract quoted attribute value from an #EXTINF line. Returns '' if absent. */
  function getM3uAttr(line, attr) {
    const re = new RegExp(attr + '="([^"]*)"');
    const m = line.match(re);
    return m ? m[1] : '';
  }

  /** Extract channel name from #EXTINF line (substring after last comma). */
  function getChanName(line) {
    const idx = line.lastIndexOf(',');
    return idx >= 0 ? line.slice(idx + 1).trim() : '';
  }

  /**
   * Build a Ch-conformant object from parsed M3U entry info. opts: {tvgId, tvgName, grp, img, chanName, strUrl, num}
   * cat is always '' (ADR-0020): M3U sources expose no categories, so the
   * sidebar is a flat list. grp keeps the raw group-title for display/debug.
   */
  function mkM3uCh(opts) {
    return {
      id:   opts.tvgId || String(opts.num),
      name: opts.tvgName || opts.chanName,
      grp:  opts.grp || 'Other',
      url:  opts.strUrl,
      img:  opts.img,
      cat:  '',
      num:  opts.num,
    };
  }

  /** Parse one #EXTINF line into an info object for mkM3uCh. */
  function parsInfLine(line) {
    return {
      tvgId:    getM3uAttr(line, 'tvg-id'),
      tvgName:  getM3uAttr(line, 'tvg-name'),
      grp:      getM3uAttr(line, 'group-title'),
      img:      getM3uAttr(line, 'tvg-logo'),
      chanName: getChanName(line),
    };
  }

  /** Accumulate channels from already-split lines (after the #EXTM3U header). */
  function parsM3uLines(lines) {
    const chs = [];
    let inf = null;
    let num = 1;
    for (let i = 0; i < lines.length; i += 1) {
      const ln = lines[i].trim();
      if (ln.startsWith('#EXTINF')) {
        inf = parsInfLine(ln);
      } else if (inf !== null && ln.length > 0 && !ln.startsWith('#')) {
        chs.push(mkM3uCh({ tvgId: inf.tvgId, tvgName: inf.tvgName, grp: inf.grp, img: inf.img, chanName: inf.chanName, strUrl: ln, num }));
        num += 1;
        inf = null;
      }
      /* blank lines and non-EXTINF comment lines are skipped without resetting inf */
    }
    return chs;
  }

  /** Find index of first non-empty line. Used by parsM3u. */
  function firstNonEmpty(lines) {
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].trim().length > 0) return i;
    }
    return -1;
  }

  /**
   * Pure M3U parser. Returns Result<{categories, channels}>.
   * categories is always [] (ADR-0020): M3U sources expose no categories,
   * so the sidebar renders a flat All Channels + Favourites list.
   * @param {string} text - raw M3U playlist text
   */
  function parsM3u(text) {
    const lines = text.split('\n');
    const first = firstNonEmpty(lines);
    if (first < 0 || !lines[first].trim().startsWith('#EXTM3U')) {
      return { ok: false, err: 'not an M3U file' };
    }
    const chs = parsM3uLines(lines.slice(first + 1));
    return { ok: true, val: { categories: [], channels: chs } };
  }

  window.IptvApi = { connect, isDemo, parsM3u, loadM3u };
}());
