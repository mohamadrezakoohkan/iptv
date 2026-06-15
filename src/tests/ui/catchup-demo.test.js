// ADR: ADR-0036
// UI tests — ACTIVATING the Replay control on a PAST archive-capable schedule
// row plays the program's TIMESHIFT archive stream through the EXISTING
// select+play path (TASK-0075, specs/catchup-archive.md §4). Boots demo mode
// through the real footer login (offline — no live network), then seeds two
// channels (one arch:true, one arch:false) with /live/-form urls and a synthetic
// guide (one PAST in-window program + one FUTURE program) into the live page
// state, re-rendering the grid via PRODUCTION rndGrid/mkCard. A loadPlay spy
// captures the URL the player is handed. The test then drives the PRODUCTION
// onGridClick → goReplay path by clicking the past row's Replay control and
// asserts, against the real running app:
//   - the player transitions to PLAY (body.is-play) for that channel
//     (#now-info shows the channel name),
//   - the URL played is the TIMESHIFT archive url (getArchUrl form), not the
//     live url — i.e. the live-stream select was NOT what ran,
//   - clicking Replay did NOT toggle the schedule expansion (stopPropagation),
//   - a non-archive channel surfaces no Replay to activate.

'use strict';

const { test, expect } = require('@playwright/test');

// Boot demo mode through the real footer login so the running app is fully wired
// (production handlers, IptvSt/IptvPlay/IptvEpg/IptvUi all live), offline.
async function bootDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// Seed two channels + a synthetic guide into the running page, pinning the
// reference time so past/future classification is deterministic, and install a
// loadPlay spy that records the played URL on window.__played (so the assertion
// can prove the ARCHIVE url, not the live url, was played). Channel 'a' is
// archive-capable with a /live/-form url (so getArchUrl yields a distinct
// timeshift url); channel 'b' is not. Each guide has one PAST in-window program
// (Old Show) and one FUTURE program.
async function seed(page) {
  await page.evaluate(function run() {
    // Spy on loadPlay so the test can prove the ARCHIVE url is what gets played,
    // and so the headless run does not attempt a real media load.
    window.__played = [];
    window.IptvPlay.loadPlay = function spyLoad(url) { window.__played.push(url); };

    const now  = Date.now();
    const past = now - 2 * 3600000;            // 2h ago (in-window, archDur 7d)
    const fut  = now + 2 * 3600000;            // 2h ahead
    const chs = [
      { id: 'a', name: 'Arch Channel', grp: 'News', url: 'http://portal.test/live/u/p/1.ts', img: '', cat: 'News', num: 1, arch: true,  archDur: 7 },
      { id: 'b', name: 'Plain Channel', grp: 'News', url: 'http://portal.test/live/u/p/2.ts', img: '', cat: 'News', num: 2, arch: false, archDur: 0 },
    ];
    window.IptvEpg.clear();
    ['a', 'b'].forEach(function each(id) {
      window.IptvEpg.set(id, [
        { chId: id, title: 'Old Show',    start: past, stop: past + 3600000, desc: '', cat: '' },
        { chId: id, title: 'Future Show', start: fut,  stop: fut + 3600000,  desc: '', cat: '' },
      ]);
    });
    window.IptvSt.setChs(chs, ['News'], '', '');
    window.IptvSt.setFlt('all');
    window.IptvSt.setSrch('');
    window.IptvUi.rndGrid(window.IptvSrch.getChs(chs, '', 'all', [], window.IptvSt.ST.sort));
  });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

function cardFor(page, id) {
  return page.locator('.ch-card[data-id="' + id + '"]');
}

test('activating Replay on a past archive row plays the archive stream (READY → PLAY) for that channel', async function ({ page }) {
  await bootDemo(page);
  await seed(page);

  const card = cardFor(page, 'a');
  await card.locator('.ch-exp').click();
  await expect(card.locator('.ch-sched')).toBeVisible();

  const rep = card.locator('.ch-replay');
  await expect(rep).toHaveCount(1);
  await rep.click();

  // The player entered PLAY for channel 'a'.
  await expect(page.locator('body')).toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText('Arch Channel');

  // Exactly one URL was played, and it is the TIMESHIFT archive url (getArchUrl
  // form), NOT the live url — i.e. the live-stream select did not run.
  const played = await page.evaluate(function get() { return window.__played; });
  expect(played.length).toBe(1);
  expect(played[0]).toContain('/timeshift/u/p/');
  expect(played[0]).not.toBe('http://portal.test/live/u/p/1.ts');
});

test('clicking Replay does NOT toggle the schedule expansion (stopPropagation)', async function ({ page }) {
  await bootDemo(page);
  await seed(page);

  const card = cardFor(page, 'a');
  const exp  = card.locator('.ch-exp');
  await exp.click();                                   // open the guide
  await expect(exp).toHaveAttribute('aria-expanded', 'true');

  await card.locator('.ch-replay').click();            // activate Replay
  // The guide is still open — the Replay click never bubbled to the expand
  // control nor the card's select target.
  await expect(exp).toHaveAttribute('aria-expanded', 'true');
});

test('a non-archive channel surfaces no Replay control to activate', async function ({ page }) {
  await bootDemo(page);
  await seed(page);

  const card = cardFor(page, 'b');
  await card.locator('.ch-exp').click();
  await expect(card.locator('.ch-sched')).toBeVisible();
  await expect(card.locator('.ch-replay')).toHaveCount(0);
});
