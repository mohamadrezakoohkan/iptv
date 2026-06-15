// ADR: ADR-0033
// UI tests — the Remind toggle on the EPG (TASK-0068, specs/reminders.md §3–§4).
// Boots demo mode through the real footer login (the demo connect flow generates
// a synthetic in-memory guide spanning Date.now(), so each expanded schedule
// carries upcoming rows AND the NOW/NEXT line carries a NEXT). The toggle is a
// keyboard-focusable aria-pressed <button>: focusing it and activating it via
// the keyboard flips aria-pressed to "true" WITHOUT starting playback or
// collapsing/expanding the card unexpectedly; activating again clears it
// (aria-pressed back to "false"). This file is shared with TASK-0069/0071; this
// task covers the toggle-state portion. The demo recording for the run lives in
// reminders-demo.test.js (a separate per-spec recorded context).

'use strict';

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// connectDemo — connect demo mode through the real footer login, then wait for
// the synthetic guide to fill in (the first card's now/next line). Mirrors
// epg.test.js's connectDemo.
// ---------------------------------------------------------------------------
async function connectDemo(page) {
  await page.goto('http://localhost:3000');
  await page.fill('#f-url', 'demo');
  await page.click('#btn-conn');
  await page.locator('#footer-conn').waitFor({ state: 'visible', timeout: 6000 });
  await page.locator('.ch-card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.ch-card').first().locator('.ch-nn').waitFor({ state: 'visible', timeout: 5000 });
}

// ---------------------------------------------------------------------------
// The NOW/NEXT line's NEXT part carries a keyboard-focusable Remind toggle that
// is aria-pressed="false" in the baseline (no reminder set yet).
// ---------------------------------------------------------------------------
test('the NOW/NEXT line carries a baseline aria-pressed="false" Remind toggle', async function ({ page }) {
  await connectDemo(page);
  const rem = page.locator('.ch-card').first().locator('.ch-nn .ch-rem');
  await expect(rem).toHaveCount(1);
  await expect(rem).toHaveAttribute('aria-pressed', 'false');
  // It is a real <button> (keyboard focusable / activatable).
  await expect(rem).toHaveJSProperty('tagName', 'BUTTON');
});

// ---------------------------------------------------------------------------
// Keyboard-focus + activate the NOW/NEXT Remind toggle: aria-pressed flips to
// "true", and this neither plays the channel nor changes the card's expansion.
// Activating again clears it (aria-pressed back to "false").
// ---------------------------------------------------------------------------
test('keyboard-activating the NOW/NEXT Remind toggle flips aria-pressed without playing', async function ({ page }) {
  await connectDemo(page);
  const card = page.locator('.ch-card').first();
  const rem  = card.locator('.ch-nn .ch-rem');

  // Focus the toggle directly (it is keyboard reachable as a real <button>).
  await rem.focus();
  await expect(rem).toBeFocused();
  await expect(rem).toHaveAttribute('aria-pressed', 'false');

  // Activate via the keyboard (Enter). aria-pressed flips to "true".
  await rem.press('Enter');
  await expect(rem).toHaveAttribute('aria-pressed', 'true');
  // The accessible label flips to the clear-reminder form.
  await expect(rem).toHaveAttribute('aria-label', /^Clear reminder for /);

  // Toggling did NOT start playback: the app stayed out of PLAY, no channel was
  // selected, the player video stays hidden, and the card did not expand.
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText('');
  await expect(page.locator('#player-video')).toBeHidden();
  await expect(card).not.toHaveClass(/is-expanded/);

  // Activate again: the reminder clears, aria-pressed flips back to "false".
  await rem.press('Enter');
  await expect(rem).toHaveAttribute('aria-pressed', 'false');
  await expect(rem).toHaveAttribute('aria-label', /^Remind me when /);
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
});

// ---------------------------------------------------------------------------
// Each UPCOMING schedule row inside the expanded guide carries a Remind toggle;
// activating one flips its aria-pressed in place without collapsing the guide or
// starting playback. Expanding the guide first proves the toggle and the expand
// control stay cleanly separated.
// ---------------------------------------------------------------------------
test('an upcoming schedule row Remind toggle flips in place without playing or collapsing', async function ({ page }) {
  await connectDemo(page);
  const card = page.locator('.ch-card').first();
  const exp  = card.locator('.ch-exp');
  const list = card.locator('.ch-sched');

  // Expand the per-channel schedule (playback-safe expand control).
  await exp.click();
  await expect(card).toHaveClass(/is-expanded/);
  await expect(list).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-play/);

  // Upcoming rows carry a Remind toggle; the currently-airing row carries none.
  const rowRem = list.locator('.ch-sched-row .ch-rem');
  expect(await rowRem.count()).toBeGreaterThanOrEqual(1);
  const first = rowRem.first();
  await expect(first).toHaveAttribute('aria-pressed', 'false');

  // Keyboard-activate the first row toggle: aria-pressed flips to "true".
  await first.focus();
  await expect(first).toBeFocused();
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  // The guide stays expanded (toggle never bubbles to the expand control) and
  // playback never started (toggle never bubbles to the card's select/play).
  await expect(card).toHaveClass(/is-expanded/);
  await expect(list).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/is-play/);
  await expect(page.locator('#now-info')).toHaveText('');

  // Activate again: the row reminder clears (aria-pressed back to "false").
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect(card).toHaveClass(/is-expanded/);
});

// ---------------------------------------------------------------------------
// The currently-airing schedule row carries NO Remind toggle (only upcoming
// programs are remindable, specs/reminders.md §1, §3).
// ---------------------------------------------------------------------------
test('the currently-airing schedule row carries no Remind toggle', async function ({ page }) {
  await connectDemo(page);
  const card = page.locator('.ch-card').first();
  await card.locator('.ch-exp').click();
  const curRow = card.locator('.ch-sched-row.ch-sched-cur');
  await expect(curRow).toHaveCount(1);
  await expect(curRow.locator('.ch-rem')).toHaveCount(0);
});
