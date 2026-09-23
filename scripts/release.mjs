// Production-build UI tests use a local editor double for deterministic failures.
// release-live.mjs separately exercises the real Unlayer CDN integration.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const base = process.env.HOME_TEST_URL || 'http://127.0.0.1:5201/';
const errors = [];

async function openGame(mode = 'clean', width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript((mode) => {
    window.__mode = mode;
    window.__mounts = 0;
    window.__ImageEditorImpl__ = true;
    window.ImageEditor = {
      load: async () => {},
      createEditor: async options => {
        window.__mounts++;
        if (window.__mode === 'fail-once' && window.__mounts === 1) throw new Error('Simulated CDN mount error');
        const canvas = document.createElement('canvas');
        canvas.style.maxWidth = '100%';
        options.container.append(canvas);
        let data = null;
        async function reset(src = options.image) {
          data = null;
          const image = new Image(); image.src = src; await image.decode();
          canvas.width = image.width; canvas.height = image.height;
          const g = canvas.getContext('2d'); g.drawImage(image, 0, 0);
          if (window.__mode === 'clean') {
            g.fillStyle = '#181020';
            for (const r of window.__hideTargets || []) g.fillRect(r.x, r.y, r.w, r.h);
          }
          data = canvas.toDataURL();
        }
        // Return the mount before image decoding, like the real embed can do.
        reset();
        return {
          getImage: () => {
            if (window.__exportFails) throw new Error('Simulated export error');
            if (window.__corrupt) return 'data:image/png;base64,bm90YW5pbWFnZQ==';
            return data;
          },
          reset,
          destroy: () => canvas.remove(),
          updateOptions: () => {},
          hasChanges: () => true,
        };
      },
    };
  }, mode);
  await page.goto(base);
  await page.waitForSelector('.ler-play button:not([disabled])');
  await page.locator('#fixer-alias').fill('Release Tester');
  await page.locator('.ler-play button').click();
  return page;
}

async function enterLab(page) {
  await page.evaluate(() => {
    window.__hideTargets = [...document.querySelectorAll('.briefing .box:not(.keep)')].map(el => ({
      x: Math.round(parseFloat(el.style.left) * 12.8), y: Math.round(parseFloat(el.style.top) * 7.2),
      w: Math.round(parseFloat(el.style.width) * 12.8), h: Math.round(parseFloat(el.style.height) * 7.2),
    }));
  });
  await page.getByRole('button', { name: 'Start doctoring', exact: true }).click();
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'));
}

try {
  const clean = await openGame();
  // Every sound ships with the build, and the mute button remembers its setting.
  assert.ok(await clean.evaluate(async () => (await Promise.all(['shutter', 'tick', 'clear', 'alert', 'stamp', 'busted', 'cash'].map(n => fetch(`/audio/${n}.wav`).then(r => r.ok)))).every(Boolean)), 'Sound files missing');
  const sound = clean.getByRole('button', { name: 'Sound', exact: true });
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), 'false');
  assert.equal(await clean.evaluate(() => localStorage.getItem('ler-muted')), '1');
  await sound.click();
  assert.equal(await sound.getAttribute('aria-pressed'), 'true');
  for (let i = 0; i < 5; i++) {
    await enterLab(clean); await ready(clean);
    await clean.getByRole('button', { name: /Send to evidence/ }).click();
    await clean.waitForSelector('.ledger');
    assert.equal(await clean.locator('.stamp-text').innerText(), 'CASE DISMISSED');
    assert.ok((await clean.locator('.verdict .box span').allInnerTexts()).every(label => label === 'CLEAN' || label === 'INTACT'));
    await clean.locator('.verdict .btn.primary').click();
  }
  await clean.waitForSelector('.poster');
  assert.equal(await clean.locator('.logo').innerText(), 'GHOST OF LEONIDA');
  assert.deepEqual(await clean.locator('.poster').evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; }), [1080, 1350]);
  const download = clean.waitForEvent('download');
  await clean.getByRole('link', { name: 'Download poster', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'leonida-rap-sheet.png');
  await clean.getByRole('button', { name: 'Run it back', exact: true }).click();
  assert.match(await clean.locator('.case-no').innerText(), /CASE 1/);
  await clean.close();
  console.log('PASS production: five clean cases, winning ending, poster download, replay');

  const recovery = await openGame('fail-once', 390);
  await enterLab(recovery);
  await recovery.getByRole('button', { name: 'Retry editor (resets tape)', exact: true }).waitFor();
  assert.equal(await recovery.getByRole('button', { name: /Send to evidence/ }).isDisabled(), true);
  assert.equal(await recovery.locator('.timer').innerText(), '…');
  await recovery.getByRole('button', { name: 'Retry editor (resets tape)', exact: true }).click();
  await ready(recovery);
  assert.ok(await recovery.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile lab overflows');
  await recovery.screenshot({ path: 'scripts/release-mobile-lab.png' });
  await recovery.evaluate(() => { window.__exportFails = true; });
  await recovery.getByRole('button', { name: /Send to evidence/ }).click();
  await recovery.getByRole('button', { name: 'Retry editor (resets tape)', exact: true }).waitFor();
  await recovery.evaluate(() => { window.__exportFails = false; });
  await recovery.getByRole('button', { name: 'Retry editor (resets tape)', exact: true }).click();
  await ready(recovery);
  await recovery.evaluate(() => { window.__corrupt = true; });
  await recovery.getByRole('button', { name: /Send to evidence/ }).click();
  await recovery.getByRole('button', { name: 'Retry forensics', exact: true }).waitFor();
  await recovery.getByRole('button', { name: 'Redo this tape', exact: true }).click();
  assert.match(await recovery.locator('.case-no').innerText(), /CASE 1/);
  await recovery.close();
  console.log('PASS production: editor failure/retry, export recovery, analysis recovery, mobile lab');

  const timeout = await openGame('original');
  await timeout.clock.install();
  await enterLab(timeout); await ready(timeout);
  await timeout.clock.fastForward(91000);
  await timeout.waitForSelector('.ledger');
  assert.match(await timeout.locator('.note').innerText(), /Time ran out/);
  assert.equal(await timeout.locator('.stamp-text').innerText(), 'EVIDENCE LEAKED');
  assert.deepEqual(await timeout.locator('.verdict .box span').allInnerTexts(), ['MATCH', 'INTACT']);
  await timeout.close();
  console.log('PASS production: countdown expiry submits once with correct verdict');
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
