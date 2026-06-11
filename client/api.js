// ADR: ADR-0001
/* global window, fetch, AbortController, encodeURIComponent, clearTimeout, setTimeout, Promise */

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

  /** Build a single category object from a DEMO_DATA row. */
  function mkCat(d) {
    return { name: d[0], id: d[0].toLowerCase().replace(/\s+/g, '-') };
  }

  /** Build categories array from DEMO_DATA. */
  function getDemoCats() {
    return DEMO_DATA.map(mkCat);
  }

  /** Build a single channel object. opts: { name, grp, cnt } */
  function mkDemoCh(opts) {
    return {
      id:  String(opts.cnt),
      name: opts.name,
      grp:  opts.grp,
      url:  opts.cnt % 2 === 0 ? DEMO_SRC2 : DEMO_SRC1,
      img:  '',
      cat:  opts.grp,
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

  /** Build the proxy-wrapped Xtream API URL. opts: {user, pass, actn} */
  function mkPxUrl(src, opts) {
    const tmp = src + '/player_api.php?username=' + opts.user
      + '&password=' + opts.pass + '&action=' + opts.actn;
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

  /** Return demo Result after simulated delay. */
  async function loadDemo() {
    await waitMs(DEMO_MS);
    return {
      ok: true,
      val: { host: 'demo', user: 'demo', categories: getDemoCats(), channels: getDemoChs() },
    };
  }

  /**
   * Connect to a portal or demo.
   * @param {string} src  - portal base URL or "demo"
   * @param {Object} opts - { user: string, pass: string }
   */
  async function connect(src, opts) {
    if (isDemo(src)) return loadDemo();
    let res = await loadJson(mkPxUrl(src, { user: opts.user, pass: opts.pass, actn: 'get_live_categories' }));
    if (!res.ok) return res;
    const val = res.val;
    res = await loadJson(mkPxUrl(src, { user: opts.user, pass: opts.pass, actn: 'get_live_streams' }));
    if (!res.ok) return res;
    return { ok: true, val: { host: src, user: opts.user, categories: val, channels: res.val } };
  }

  window.IptvApi = { connect, isDemo };
}());
