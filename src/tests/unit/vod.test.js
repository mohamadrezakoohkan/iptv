// ADR: ADR-0037
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir      = dirname(__filename);
const VOD_SRC    = join(__dir, '../../client/vod.js');

/** Execute client/vod.js against a fresh window, return window.IptvVod.
 *  A fresh evaluation gives each test its own isolated in-memory store. */
function loadVod() {
  const win = {};
  const src = readFileSync(VOD_SRC, 'utf8');
  // eslint-disable-next-line no-new-func
  const fn = new Function('window', '"use strict";\n' + src + '\nreturn window.IptvVod;');
  return fn(win);
}

/** A category_id → category_name Map. */
function mkCmap(pairs) {
  return new Map(pairs);
}

// ---------------------------------------------------------------------------
// Movie normalizer — getMovs
// ---------------------------------------------------------------------------
describe('getMovs — Xtream get_vod_streams normalize', function () {
  let vod;
  beforeEach(function () { vod = loadVod(); });

  it('maps a raw movie entry into the documented Vod movie shape', function () {
    const cmap = mkCmap([['10', 'Action']]);
    const movs = vod.getMovs({
      raw: [{ stream_id: 501, name: 'Big Movie', category_id: '10', stream_icon: 'http://img/1.png', num: 7, container_extension: 'mp4' }],
      cmap, base: 'http://host:80', user: 'u', pass: 'p', ext: 'ts',
    });
    expect(movs).toHaveLength(1);
    expect(movs[0]).toEqual({
      id: '501',
      name: 'Big Movie',
      grp: 'Action',
      url: 'http://host:80/movie/u/p/501.mp4',
      img: 'http://img/1.png',
      cat: '10',
      num: 7,
      kind: 'movie',
    });
  });

  it('resolves an unknown category to "Uncategorized"', function () {
    const movs = vod.getMovs({
      raw: [{ stream_id: 1, name: 'X', category_id: '999', container_extension: 'mkv' }],
      cmap: mkCmap([['10', 'Action']]), base: 'http://h', user: 'u', pass: 'p', ext: 'ts',
    });
    expect(movs[0].grp).toBe('Uncategorized');
  });

  it('falls back to the account live extension when container_extension is absent', function () {
    const movs = vod.getMovs({
      raw: [{ stream_id: 9, name: 'Y', category_id: '10' }],
      cmap: mkCmap([['10', 'Action']]), base: 'http://h', user: 'u', pass: 'p', ext: 'm3u8',
    });
    expect(movs[0].url).toBe('http://h/movie/u/p/9.m3u8');
  });

  it('falls back to "ts" when neither container_extension nor account ext is present', function () {
    const movs = vod.getMovs({
      raw: [{ stream_id: 9, name: 'Y', category_id: '10' }],
      cmap: mkCmap([['10', 'Action']]), base: 'http://h', user: 'u', pass: 'p', ext: '',
    });
    expect(movs[0].url).toBe('http://h/movie/u/p/9.ts');
  });

  it('uses cover as img when stream_icon is absent, num defaults to 0', function () {
    const movs = vod.getMovs({
      raw: [{ stream_id: 3, name: 'Z', category_id: '10', cover: 'http://cov/z.png' }],
      cmap: mkCmap([['10', 'Action']]), base: 'http://h', user: 'u', pass: 'p', ext: 'ts',
    });
    expect(movs[0].img).toBe('http://cov/z.png');
    expect(movs[0].num).toBe(0);
  });

  it('returns [] for a non-array payload', function () {
    expect(vod.getMovs({ raw: null, cmap: mkCmap([]), base: 'http://h', user: 'u', pass: 'p', ext: 'ts' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Series normalizer — getSers
// ---------------------------------------------------------------------------
describe('getSers — Xtream get_series normalize', function () {
  let vod;
  beforeEach(function () { vod = loadVod(); });

  it('maps a raw series entry into the documented Series browse shape (no url)', function () {
    const sers = vod.getSers({
      raw: [{ series_id: 88, name: 'Some Show', category_id: '20', cover: 'http://cov/s.png' }],
      cmap: mkCmap([['20', 'Drama']]),
    });
    expect(sers).toHaveLength(1);
    expect(sers[0]).toEqual({ id: '88', name: 'Some Show', grp: 'Drama', img: 'http://cov/s.png', cat: '20' });
    expect(sers[0].url).toBeUndefined();
  });

  it('resolves an unknown series category to "Uncategorized"', function () {
    const sers = vod.getSers({
      raw: [{ series_id: 1, name: 'A', category_id: '404' }],
      cmap: mkCmap([['20', 'Drama']]),
    });
    expect(sers[0].grp).toBe('Uncategorized');
    expect(sers[0].img).toBe('');
  });

  it('returns [] for a non-array payload', function () {
    expect(vod.getSers({ raw: undefined, cmap: mkCmap([]) })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Episode normalizer — getEpis
// ---------------------------------------------------------------------------
describe('getEpis — get_series_info episodes flatten', function () {
  let vod;
  beforeEach(function () { vod = loadVod(); });

  const RAW = {
    episodes: {
      '1': [
        { id: 1001, episode_num: 1, title: 'Pilot', container_extension: 'mkv', info: { movie_image: 'http://e/1.png' } },
        { id: 1002, episode_num: 2, title: 'Second', container_extension: 'mp4' },
      ],
      '2': [
        { id: 2001, episode_num: 1, title: 'Return', container_extension: 'mkv' },
      ],
    },
  };

  it('flattens season→episode into Vod episode items grouped by season', function () {
    const epis = vod.getEpis({ raw: RAW, series: 'Some Show', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' });
    expect(epis).toHaveLength(3);
    expect(epis.map(function k(e) { return e.kind; })).toEqual(['episode', 'episode', 'episode']);
    // grouping: season 1 episodes precede season 2
    expect(epis[0].cat).toBe('1');
    expect(epis[1].cat).toBe('1');
    expect(epis[2].cat).toBe('2');
  });

  it('builds the episode name "<series> · S<season>E<episode> <title>"', function () {
    const epis = vod.getEpis({ raw: RAW, series: 'Some Show', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' });
    expect(epis[0].name).toBe('Some Show · S1E1 Pilot');
    expect(epis[2].name).toBe('Some Show · S2E1 Return');
  });

  it('builds the series-episode URL with extension preserved', function () {
    const epis = vod.getEpis({ raw: RAW, series: 'Some Show', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' });
    expect(epis[0].url).toBe('http://h/series/u/p/1001.mkv');
    expect(epis[1].url).toBe('http://h/series/u/p/1002.mp4');
  });

  it('falls back to the account ext when an episode has no container_extension', function () {
    const raw = { episodes: { '1': [{ id: 5, episode_num: 1, title: 'NoExt' }] } };
    const epis = vod.getEpis({ raw, series: 'S', base: 'http://h', user: 'u', pass: 'p', ext: 'm3u8' });
    expect(epis[0].url).toBe('http://h/series/u/p/5.m3u8');
  });

  it('orders seasons numerically ascending (10 after 2)', function () {
    const raw = { episodes: {
      '10': [{ id: 1, episode_num: 1, title: 'Ten' }],
      '2': [{ id: 2, episode_num: 1, title: 'Two' }],
    } };
    const epis = vod.getEpis({ raw, series: 'S', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' });
    expect(epis[0].cat).toBe('2');
    expect(epis[1].cat).toBe('10');
  });

  it('omits the trailing title when the episode has none', function () {
    const raw = { episodes: { '1': [{ id: 7, episode_num: 3 }] } };
    const epis = vod.getEpis({ raw, series: 'Show', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' });
    expect(epis[0].name).toBe('Show · S1E3');
  });

  it('returns [] when the payload has no episodes map', function () {
    expect(vod.getEpis({ raw: {}, series: 'S', base: 'http://h', user: 'u', pass: 'p', ext: 'ts' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// URL builders — movUrl / epiUrl
// ---------------------------------------------------------------------------
describe('movUrl / epiUrl — on-demand stream URL builders', function () {
  let vod;
  beforeEach(function () { vod = loadVod(); });

  it('builds <base>/movie/<user>/<pass>/<id>.<ext>', function () {
    expect(vod.movUrl({ base: 'http://h:8080', user: 'usr', pass: 'pwd', id: '42', ext: 'mp4' }))
      .toBe('http://h:8080/movie/usr/pwd/42.mp4');
  });

  it('builds <base>/series/<user>/<pass>/<id>.<ext>', function () {
    expect(vod.epiUrl({ base: 'http://h:8080', user: 'usr', pass: 'pwd', id: '99', ext: 'mkv' }))
      .toBe('http://h:8080/series/usr/pwd/99.mkv');
  });
});

// ---------------------------------------------------------------------------
// Store API — set/get/clear/has round-trip
// ---------------------------------------------------------------------------
describe('IptvVod store — set/get/clear/has round-trips', function () {
  let vod;
  beforeEach(function () { vod = loadVod(); });

  it('starts empty', function () {
    expect(vod.hasMovies()).toBe(false);
    expect(vod.hasSeries()).toBe(false);
    expect(vod.movies()).toEqual([]);
    expect(vod.series()).toEqual([]);
    expect(vod.episodes('1')).toEqual([]);
  });

  it('round-trips movies and reports hasMovies', function () {
    const m = [{ id: '1', name: 'M', grp: 'g', url: 'u', img: '', cat: 'c', num: 0, kind: 'movie' }];
    vod.setMovs(m);
    expect(vod.hasMovies()).toBe(true);
    expect(vod.movies()).toEqual(m);
  });

  it('round-trips series and reports hasSeries', function () {
    const s = [{ id: '1', name: 'S', grp: 'g', img: '', cat: 'c' }];
    vod.setSers(s);
    expect(vod.hasSeries()).toBe(true);
    expect(vod.series()).toEqual(s);
  });

  it('round-trips episodes keyed by series id', function () {
    const e = [{ id: '1', name: 'E', grp: 'S1', url: 'u', img: '', cat: '1', num: 1, kind: 'episode' }];
    vod.setEpis('88', e);
    expect(vod.episodes('88')).toEqual(e);
    expect(vod.episodes('99')).toEqual([]);
  });

  it('hands out fresh copies — mutating a getter result does not affect the store', function () {
    vod.setMovs([{ id: '1', name: 'M', grp: 'g', url: 'u', img: '', cat: 'c', num: 0, kind: 'movie' }]);
    const got = vod.movies();
    got.push({ id: '2' });
    expect(vod.movies()).toHaveLength(1);
  });

  it('clear empties movies, series, and episodes', function () {
    vod.setMovs([{ id: '1', name: 'M', grp: 'g', url: 'u', img: '', cat: 'c', num: 0, kind: 'movie' }]);
    vod.setSers([{ id: '1', name: 'S', grp: 'g', img: '', cat: 'c' }]);
    vod.setEpis('1', [{ id: '1', name: 'E', grp: 'S1', url: 'u', img: '', cat: '1', num: 1, kind: 'episode' }]);
    vod.clear();
    expect(vod.hasMovies()).toBe(false);
    expect(vod.hasSeries()).toBe(false);
    expect(vod.movies()).toEqual([]);
    expect(vod.series()).toEqual([]);
    expect(vod.episodes('1')).toEqual([]);
  });
});
