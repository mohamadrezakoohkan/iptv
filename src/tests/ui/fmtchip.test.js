// ADR: ADR-0025
// UI tests — contextual single format chip (TASK-0052). The chip is absent at
// idle, appears labelled for the resolved engine when a demo channel plays,
// toggles an inline engine detail on click, and disappears again on stop.

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Idle — no chip visible on a fresh load
// ---------------------------------------------------------------------------
test('no format chip is visible at idle', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await expect(page.locator('#fmt-chip')).toBeHidden();
  await expect(page.locator('#fmt-detail')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Play — demo channel resolves an engine, exactly one chip appears
// ---------------------------------------------------------------------------
test('playing a demo channel surfaces exactly one chip with the engine label', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#fmt-chip')).toBeVisible();
  await expect(page.locator('#fmt-chip')).toHaveText('HLS');
});

// ---------------------------------------------------------------------------
// Click — toggles the inline engine detail, then hides it again
// ---------------------------------------------------------------------------
test('clicking the chip toggles the inline engine detail', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#fmt-chip')).toBeVisible();

  await expect(page.locator('#fmt-detail')).toBeHidden();
  await page.click('#fmt-chip');
  await expect(page.locator('#fmt-chip')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#fmt-detail')).toBeVisible();
  await expect(page.locator('#fmt-detail')).toHaveText('Playing via hls.js');

  await page.click('#fmt-chip');
  await expect(page.locator('#fmt-chip')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#fmt-detail')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Stop — disconnecting returns to idle and removes the chip
// ---------------------------------------------------------------------------
test('the chip disappears when playback stops', async function ({ page }) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await expect(page.locator('#footer-conn')).toBeVisible();
  await page.locator('.ch-card').first().click();
  await expect(page.locator('#fmt-chip')).toBeVisible();

  await page.evaluate(function () {
    window.IptvPlay.stopPlay();
    window.IptvSt.go('READY');
    window.IptvUi.rndPhase();
  });
  await expect(page.locator('#fmt-chip')).toBeHidden();
  await expect(page.locator('#fmt-detail')).toBeHidden();
});
