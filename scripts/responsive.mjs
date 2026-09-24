// Responsive checks on phones (both orientations), a tablet and a desktop: no sideways overflow,
// nothing covering the controls, 44px touch targets, no text under 9px, and the hero call to action on screen.
// Uses the same editor double as release.mjs, so it needs no network. Defaults to the dev server on port 5200.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/';
const DEVICES = [
  { name: 'phone 320x568', width: 320, height: 568, touch: true },
  { name: 'phone 390x664', width: 390, height: 664, touch: true },
  { name: 'phone landscape 844x390', width: 844, height: 390, touch: true },
  { name: 'tablet 768x1024', width: 768, height: 1024, touch: true },
  { name: 'desktop 1440x900', width: 1440, height: 900 },
];

function editorDouble() {
  window.ImageEditor = {
    load: async () => {},
    createEditor: async options => {
      const canvas = document.createElement('canvas');
      canvas.style.maxWidth = '100%';
      options.container.append(canvas);
      let data = null;
      async function reset(src = options.image) {
        const image = new Image(); image.src = src; await image.decode();
        canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        data = canvas.toDataURL();
      }
      reset();
      return { getImage: () => data, reset, destroy: () => canvas.remove(), updateOptions: () => {}, hasChanges: () => !window.__untouched };
    },
  };
}

// The widest TOP FIXER readout: the longest name the board accepts and the biggest possible cash.
const board = { top: [{ id: 'lead', name: 'Maximiliana Vargas', cash: 236450, time: 290 }], total: 1 };

// Runs in the page. Controls are probed 20px beyond each edge too, so enlarged invisible hit areas count.
// `scope` limits the check to one part of the page, such as an open dialog.
function inspect({ touch, scope }) {
  const problems = [];
  if (innerWidth !== document.documentElement.clientWidth || document.documentElement.scrollWidth > innerWidth) problems.push(`page is ${document.documentElement.scrollWidth}px wide`);
  const shown = el => !el.closest('[inert], [aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.className).trim().replace(/\s+/g, ' ').slice(0, 30);
  const root = scope ? document.querySelector(scope) : document.body;
  // Controls scrolled under the homepage's fixed nav are hidden by scrolling, not by the layout.
  const nav = document.querySelector('.ler-nav');
  const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
  // The hero's TOP FIXER readout must not overlap the rest of the hero HUD.
  const readout = document.querySelector('.ler-top-fixer');
  if (!scope && readout && shown(readout) && scrollY === 0) {
    const r = readout.getBoundingClientRect();
    for (const el of document.querySelectorAll('.ler-hud, .ler-location, .ler-hero-copy > *, .ler-scroll, .ler-nav a')) {
      const o = el.getBoundingClientRect();
      if (shown(el) && r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom) problems.push(`TOP FIXER overlaps "${name(el)}"`);
    }
  }
  for (const el of root.querySelectorAll('a[href], button:not(:disabled), input')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cy < 0 || cy > innerHeight || (!nav?.contains(el) && cy < navBottom)) continue;
    const at = (x, y) => { const hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), y); return hit && (el.contains(hit) || hit.contains(el)); };
    if (!at(cx, cy)) problems.push(`"${name(el)}" is covered`);
    // Inline links inside a sentence are exempt from target sizes.
    if (!touch || getComputedStyle(el).display === 'inline') continue;
    const tall = r.height >= 43.5 || (at(cx, cy - 20) && at(cx, cy + 20));
    const wide = r.width >= 43.5 || (at(cx - 20, cy) && at(cx + 20, cy));
    if (!tall || !wide) problems.push(`"${name(el)}" is a ${Math.round(r.width)}x${Math.round(r.height)} touch target`);
  }
  for (const el of root.querySelectorAll('*')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !shown(el) || el.closest('.ler-redaction')) continue;
    if (parseFloat(getComputedStyle(el).fontSize) < 9) problems.push(`"${name(el)}" is ${getComputedStyle(el).fontSize} text`);
  }
  return [...new Set(problems)];
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errors = [];
try {
  for (const device of DEVICES) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, isMobile: !!device.touch, hasTouch: !!device.touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(editorDouble);
    await page.route('**/api/leaderboard', route => (route.request().method() === 'GET' ? route.fulfill({ json: board }) : route.continue()));
    const check = async (screen, scope) => {
      // Let entrance animations settle so measurements reflect the resting layout.
      await page.waitForTimeout(150);
      const problems = await page.evaluate(inspect, { touch: !!device.touch, scope });
      assert.deepEqual(problems, [], `${device.name}, ${screen}`);
    };
    await page.goto(base);
    await page.waitForSelector('.ler-play button:not([disabled])');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('.ler-top-fixer');
    for (const selector of ['.ler-hero-copy .ler-button', '.ler-powered']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box.y + box.height <= device.height, `${device.name}: ${selector} is below the first screen`);
    }
    await check('home');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await check('home footer');
    await page.locator('.ler-play button').click();
    // Leak every tape: three verdicts reach the busted ending, whose stamp used to widen the page on phones.
    for (let i = 0; i < 5 && !(await page.locator('.rapsheet').count()); i++) {
      await page.waitForSelector('.briefing');
      await check(`briefing ${i + 1}`);
      await page.locator('.brief-side').getByRole('button', { name: 'Roll tape', exact: true }).click();
      await page.getByRole('button', { name: /Freeze frame/ }).click();
      await page.waitForFunction(() => document.querySelector('.lab .timer')?.textContent.includes(':'));
      await check(`lab ${i + 1}`);
      // The Home dialog (with all three choices once a job is finished) fits and is easy to tap.
      if (i === 1) {
        await page.getByRole('button', { name: 'Home', exact: true }).click();
        await check('Home dialog', 'dialog[open]');
        await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
      }
      // The first lab sends an untouched still, so its warning dialog is checked too.
      if (i === 0) {
        await page.evaluate(() => { window.__untouched = true; });
        await page.locator('.hud').getByRole('button', { name: /Send to evidence/ }).click();
        await check('untouched dialog', 'dialog[open]');
        await page.getByRole('button', { name: 'Send it anyway', exact: true }).click();
        await page.evaluate(() => { window.__untouched = false; });
      } else await page.locator('.hud').getByRole('button', { name: /Send to evidence/ }).click();
      await page.waitForSelector('.ledger');
      await check(`verdict ${i + 1}`);
      await page.locator('.verdict-body .btn.primary').click({ timeout: 5000 });
      await page.waitForSelector('.briefing, .rapsheet');
    }
    await page.waitForSelector('.rapsheet .poster');
    await check('rap sheet');
    console.log(`PASS ${device.name}: no overflow, uncovered controls, touch targets, text size, hero on screen`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
