// ADR: ADR-0031
// UI tests — now/next line on the channel card (TASK-0064, specs/epg.md §4).
// Boots demo mode through the real footer login: the demo connect flow
// generates a synthetic in-memory guide (runDemoEpg, TASK-0063) and re-renders
// the grid (rndGuide), so each demo card shows a NOW/NEXT line with real
// program titles. Asserts the line is present and decorative, and that the
// card body remains clickable to select+play the channel.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// connectDemo — connect demo mode through the real footer login flow, then
// wait for the synthetic guide to fill in (the first card's now/next line).
// ---------------------------------------------------------------------------
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  // The demo EPG is generated + re-rendered after connect; wait for the line.
  await page.locator('.ch-card').first().locator('.ch-nn').waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Demo cards show a now/next line with real program titles.
// ---------------------------------------------------------------------------
test('demo channel cards show a NOW/NEXT line with real program titles', async function ({ page }) {
  await connectDemo(page);
  const first = page.locator('.ch-card').first();
  const nn    = first.locator('.ch-nn');
  await expect(nn).toHaveCount(1);
  // The synthetic guide spans Date.now(): NOW = Program 3, NEXT = Program 4.
  await expect(nn.locator('.ch-nn-now .ch-nn-mark')).toHaveText('NOW');
  await expect(nn.locator('.ch-nn-nxt .ch-nn-mark')).toHaveText('NEXT');
  await expect(nn.locator('.ch-nn-now .ch-nn-title')).toContainText('World News 24');
  await expect(nn.locator('.ch-nn-nxt .ch-nn-title')).toContainText('World News 24');
});

// ---------------------------------------------------------------------------
// The now/next line is decorative (aria-hidden) and does not steal the card's
// click target — clicking the card still selects + plays the channel.
// ---------------------------------------------------------------------------
test('the now/next line is decorative and the card stays clickable to play', async function ({ page }) {
  await connectDemo(page);
  const first = page.locator('.ch-card').first();
  await expect(first.locator('.ch-nn')).toHaveAttribute('aria-hidden', 'true');

  // Clicking the card body (over the now/next line) selects the channel: the
  // now-playing info bar updates to the channel name (onGridClick -> setCur).
  await first.locator('.ch-nn-now .ch-nn-title').click();
  await expect(page.locator('#now-info')).toHaveText('World News 24');
  // The click drove the select+play path (onGridClick -> setCur -> go('PLAY')),
  // so the app left READY for the PLAY phase — the now/next line never blocked
  // the card's primary click target (specs/iptv-player.md §6, specs/epg.md §7).
  await expect(page.locator('body')).toHaveClass(/is-play/);
});

// ---------------------------------------------------------------------------
// All demo cards carry a now/next line (every demo channel has a guide).
// ---------------------------------------------------------------------------
test('every demo card carries a now/next line', async function ({ page }) {
  await connectDemo(page);
  await expect(page.locator('.ch-card')).toHaveCount(31);
  await expect(page.locator('.ch-card .ch-nn')).toHaveCount(31);
});
