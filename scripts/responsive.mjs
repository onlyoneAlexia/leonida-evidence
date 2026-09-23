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
      return { getImage: () => data, reset, destroy: () => canvas.remove(), updateOptions: () => {}, hasChanges: () => true };
    },
  };
}

// Runs in the page. Controls are probed 20px beyond each edge too, so enlarged invisible hit areas count.
function inspect({ touch }) {
  const problems = [];
  if (innerWidth !== document.documentElement.clientWidth || document.documentElement.scrollWidth > innerWidth) problems.push(`page is ${document.documentElement.scrollWidth}px wide`);
  const shown = el => !el.closest('[inert], [aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.className).trim().replace(/\s+/g, ' ').slice(0, 30);
  // Controls scrolled under the homepage's fixed nav are hidden by scrolling, not by the layout.
  const nav = document.querySelector('.ler-nav');
  const navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
  for (const el of document.querySelectorAll('a[href], button:not(:disabled), input')) {
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
  for (const el of document.querySelectorAll('body *')) {
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
    const check = async screen => {
      // Let entrance animations settle so measurements reflect the resting layout.
      await page.waitForTimeout(150);
      const problems = await page.evaluate(inspect, { touch: !!device.touch });
      assert.deepEqual(problems, [], `${device.name}, ${screen}`);
    };
    await page.goto(base);
    await page.waitForSelector('.ler-play button:not([disabled])');
    await page.evaluate(() => document.fonts.ready);
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
      await page.getByRole('button', { name: 'Start doctoring', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'));
      await check(`lab ${i + 1}`);
      await page.getByRole('button', { name: /Send to evidence/ }).click();
      await page.waitForSelector('.ledger');
      await check(`verdict ${i + 1}`);
      await page.locator('.verdict .btn.primary').click({ timeout: 5000 });
      await page.waitForSelector('.briefing, .rapsheet');
    }
    await page.waitForSelector('.rapsheet .poster');
    await check('rap sheet');
    console.log(`PASS ${device.name}: no overflow, uncovered controls, touch targets, text size, hero on screen`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
