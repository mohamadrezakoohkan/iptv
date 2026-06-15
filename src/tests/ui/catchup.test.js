// ADR: ADR-0036
// UI tests — the Replay control on PAST archive-capable schedule rows of the
// expandable per-channel guide (TASK-0074, specs/catchup-archive.md §3). Boots
// demo mode through the real footer login (offline — no live network), then
// injects two channels (one arch:true, one arch:false) and a synthetic guide
// (one PAST in-window program + one FUTURE program per channel) directly into the
// live page state and re-renders the grid via PRODUCTION rndGrid/mkCard. The test
// then asserts, against the real rendered DOM:
//   - the past archive-capable row carries a keyboard-focusable Replay <button>
//     with data-replay + an aria-label present in the baseline (R-0001),
//   - the future row and the airing/non-past rows carry NO Replay,
//   - a non-archive channel's past row carries NO Replay.
// Activation/playback is TASK-0075; this task only renders the control.

'use strict';

const { test, expect } = require('@playwright/test');

// Inject two channels + a synthetic guide into the running page, pinning the
// reference time on the client so past/future classification is deterministic.
// Channel 'a' is archive-capable (arch:true, archDur 7d); channel 'b' is not.
// Each guide has one PAST in-window program (Old Show) and one FUTURE program.
async function seedGuide(page) {
  await page.evaluate(function seed() {
    const now  = Date.now();
    const past = now - 2 * 3600000;            // 2h ago
    const fut  = now + 2 * 3600000;            // 2h ahead
    const chs = [
      { id: 'a', name: 'Arch Channel', grp: 'News', url: 'http://x/live/u/p/1.ts', img: '', cat: 'News', num: 1, arch: true,  archDur: 7 },
      { id: 'b', name: 'Plain Channel', grp: 'News', url: 'http://x/live/u/p/2.ts', img: '', cat: 'News', num: 2, arch: false, archDur: 0 },
    ];
    const cats = ['News'];
    window.IptvEpg.clear();
    ['a', 'b'].forEach(function each(id) {
      window.IptvEpg.set(id, [
        { chId: id, title: 'Old Show',    start: past,        stop: past + 3600000, desc: '', cat: '' },
        { chId: id, title: 'Future Show', start: fut,         stop: fut + 3600000,  desc: '', cat: '' },
      ]);
    });
    window.IptvSt.setChs(chs, cats, '', '');
    window.IptvSt.setFlt('all');
    window.IptvSt.setSrch('');
    window.IptvUi.rndGrid(window.IptvSrch.getChs(chs, '', 'all', [], window.IptvSt.ST.sort));
  });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

async function bootDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
}

// Locate the card for a given channel num (cards carry the channel in order).
function cardFor(page, id) {
  return page.locator('.ch-card[data-id="' + id + '"]');
}

test('a past archive-capable row carries a focusable Replay button present in the baseline', async function ({ page }) {
  await bootDemo(page);
  await seedGuide(page);

  const card = cardFor(page, 'a');
  await card.locator('.ch-exp').click();
  const list = card.locator('.ch-sched');
  await expect(list).toBeVisible();

  // The Replay control is on the past (Old Show) row, and is a real focusable button.
  const rep = list.locator('.ch-replay');
  await expect(rep).toHaveCount(1);
  await expect(rep).toHaveJSProperty('tagName', 'BUTTON');
  // R-0001: aria-label is present in the rendered markup (one-shot action button).
  await expect(rep).toHaveAttribute('aria-label', 'Replay Old Show');
  // data-replay carries the program identity "<chId>|<start>".
  await expect(rep).toHaveAttribute('data-replay', /^a\|\d+$/);

  // It is keyboard-focusable.
  await rep.focus();
  await expect(rep).toBeFocused();
});

test('the Replay control sits on the PAST row only — never the future row', async function ({ page }) {
  await bootDemo(page);
  await seedGuide(page);

  const card = cardFor(page, 'a');
  await card.locator('.ch-exp').click();
  const rows = card.locator('.ch-sched .ch-sched-row');
  // Two rows: a past in-window row (with Replay) and a future row (without).
  expect(await rows.count()).toBeGreaterThanOrEqual(2);

  // The row that contains the Replay control also contains the past title.
  const replayRow = card.locator('.ch-sched-row', { has: page.locator('.ch-replay') });
  await expect(replayRow).toHaveCount(1);
  await expect(replayRow).toContainText('Old Show');

  // The future row carries no Replay.
  const futRow = card.locator('.ch-sched-row', { hasText: 'Future Show' });
  await expect(futRow.locator('.ch-replay')).toHaveCount(0);
});

test('a non-archive channel renders NO Replay on any row', async function ({ page }) {
  await bootDemo(page);
  await seedGuide(page);

  const card = cardFor(page, 'b');
  // The non-archive channel's guide is upcoming-only (past rows are not surfaced),
  // so its expanded schedule shows the future row and no Replay anywhere.
  await card.locator('.ch-exp').click();
  await expect(card.locator('.ch-sched')).toBeVisible();
  await expect(card.locator('.ch-replay')).toHaveCount(0);
});
