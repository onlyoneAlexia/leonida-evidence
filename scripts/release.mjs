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
          canvas.getContext('2d').drawImage(image, 0, 0);
          data = canvas.toDataURL();
        }
        // Return the mount before image decoding, like the real embed can do.
        reset();
        return {
          getImage: () => {
            if (window.__exportFails) throw new Error('Simulated export error');
            if (window.__corrupt) return 'data:image/png;base64,bm90YW5pbWFnZQ==';
            if (window.__mode !== 'clean' || !data) return data;
            // A clean edit paints over every HIDE box on the lab's orders map, including a late surprise.
            const g = canvas.getContext('2d');
            g.fillStyle = '#181020';
            for (const el of document.querySelectorAll('.lab-side .mini .box.hide')) {
              g.fillRect(parseFloat(el.style.left) * 12.8, parseFloat(el.style.top) * 7.2, parseFloat(el.style.width) * 12.8, parseFloat(el.style.height) * 7.2);
            }
            return canvas.toDataURL();
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

// Rolls the tape and freezes once it reaches `at` seconds (at the end of the clip it freezes itself).
async function freezeAt(page, at = 0.3) {
  await page.locator('.brief-side').getByRole('button', { name: 'Roll tape', exact: true }).click();
  await page.waitForFunction(t => Number(document.querySelector('.feed canvas')?.dataset.t) >= t || !document.querySelector('.feed'), at, { polling: 50 }).catch(async error => {
    await page.screenshot({ path: 'scripts/release-freeze-timeout.png' });
    throw new Error(`[errors: ${errors.join(" | ") || "none"}] Tape stuck at t=${await page.locator('.feed canvas').getAttribute('data-t').catch(() => '?')} (${await page.locator('.case-no').first().innerText().catch(() => '?')}): ${error.message}`);
  });
  if (await page.locator('.feed').count()) await page.getByRole('button', { name: /Freeze frame/ }).click();
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
    // Late in the clip every KEEP that must show (Rico, his yacht) is in the shot.
    await freezeAt(clean, 11.2); await ready(clean);
    assert.equal(await clean.locator('.lab-side .objectives li.missing').count(), 0, `Case ${i + 1}: a must-show KEEP is missing`);
    await clean.getByRole('button', { name: /Send to evidence/ }).click();
    await clean.waitForSelector('.ledger');
    assert.equal(await clean.locator('.stamp-text').innerText(), 'CASE DISMISSED');
    assert.ok((await clean.locator('.verdict .box span').allInnerTexts()).every(label => label === 'CLEAN' || label === 'INTACT'));
    if (i === 0) {
      const compare = clean.getByRole('slider', { name: 'Compare original and doctored evidence' });
      assert.equal(await compare.inputValue(), '50');
      const photo = await clean.locator('.verdict .evidence-photo').boundingBox();
      await clean.mouse.move(photo.x + photo.width * .5, photo.y + photo.height * .5);
      await clean.mouse.down();
      await clean.mouse.move(photo.x + photo.width * .75, photo.y + photo.height * .5, { steps: 8 });
      await clean.mouse.up();
      assert.ok(Number(await compare.inputValue()) >= 70, 'Dragging the divider should reveal more of the original');
      const original = clean.locator('.verdict-original');
      assert.notEqual(await original.getAttribute('src'), await clean.locator('.evidence-photo > img').first().getAttribute('src'));
      await compare.fill('50');
      await clean.screenshot({ path: 'scripts/verdict-compare.png' });
      await compare.fill('0');
      assert.match(await original.evaluate(el => getComputedStyle(el).clipPath), /inset\(0px 100%/);
      await compare.fill('100');
      assert.match(await original.evaluate(el => getComputedStyle(el).clipPath), /inset\(0px 0%/);
      await compare.press('ArrowLeft');
      assert.equal(await compare.inputValue(), '99');
    }
    await clean.locator('.verdict-body .btn.primary').click();
  }
  await clean.waitForSelector('.poster');
  assert.equal(await clean.locator('.logo').innerText(), 'GHOST OF LEONIDA');
  assert.deepEqual(await clean.locator('.poster').evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; }), [1080, 1350]);
  const download = clean.waitForEvent('download');
  await clean.getByRole('link', { name: 'Download poster', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'leonida-rap-sheet.png');
  // A finished run can be posted once, and the board highlights it.
  await clean.getByRole('button', { name: 'Post to leaderboard', exact: true }).click();
  await clean.getByRole('status').filter({ hasText: 'Posted.' }).waitFor();
  assert.match(await clean.locator('.board-panel [role=status]').innerText(), /Release Tester is #\d+ of \d+/);
  assert.match(await clean.locator('.board tr.you').innerText(), /Release Tester/);
  assert.equal(await clean.getByRole('button', { name: 'Post to leaderboard' }).count(), 0);
  await clean.getByRole('button', { name: 'Run it back', exact: true }).click();
  assert.match(await clean.locator('.case-no').innerText(), /CASE 1/);
  await clean.close();
  console.log('PASS production: five clean cases, winning ending, poster download, leaderboard post, replay');

  const recovery = await openGame('fail-once', 390);
  await freezeAt(recovery);
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

  // Early freeze: Jason is still inside, so only the plate is evidence; the tape time is off the clock.
  const surprise = await openGame();
  await surprise.route('**/api/leaderboard', route => route.abort());
  await freezeAt(surprise, 0.3); await ready(surprise);
  assert.match(await surprise.locator('.lab-side .objectives li.gone').innerText(), /Jason's face[\s\S]*no edit needed/);
  assert.ok(Number((await surprise.locator('.timer').innerText()).replace(':', '')) < 130, 'The tape time counts against the clock');
  await surprise.waitForSelector('.enhance', { timeout: 9000 });
  assert.match(await surprise.locator('.enhance').innerText(), /security monitor/);
  assert.match(await surprise.locator('.lab-side .objectives li.fresh').innerText(), /security monitor/);
  await surprise.getByRole('button', { name: /Send to evidence/ }).click();
  await surprise.waitForSelector('.ledger');
  assert.equal(await surprise.locator('.stamp-text').innerText(), 'CASE DISMISSED');
  assert.equal(await surprise.locator('.verdict .box').count(), 3, 'Plate, timestamp and the surprise are judged');
  await surprise.locator('.verdict-body .btn.primary').click();
  // Walking away keeps a rap sheet of the finished job but stays off the board.
  await surprise.waitForSelector('.feed');
  await surprise.getByRole('button', { name: 'Quit', exact: true }).click();
  await surprise.getByRole('button', { name: 'Keep playing', exact: true }).click();
  assert.equal(await surprise.locator('.feed').count(), 1);
  await surprise.getByRole('button', { name: 'Quit', exact: true }).click();
  await surprise.getByRole('button', { name: 'Walk away', exact: true }).click();
  await surprise.waitForSelector('.rapsheet .poster');
  assert.equal(await surprise.locator('.logo').innerText(), 'WALKED AWAY');
  assert.match(await surprise.locator('.board-panel').innerText(), /walk away from don't make the board/);
  assert.match(await surprise.locator('.board-panel').innerText(), /offline/);
  assert.equal(await surprise.getByRole('button', { name: 'Post to leaderboard' }).count(), 0);
  await surprise.close();
  console.log('PASS production: out-of-sight evidence, clock after the tape, mid-edit surprise, quit to rap sheet, board offline');

  const timeout = await openGame('original');
  // The tape runs on animation frames, so fake the clock only once the lab's countdown is running.
  await freezeAt(timeout); await ready(timeout);
  await timeout.clock.install();
  await timeout.clock.fastForward(100000);
  await timeout.waitForSelector('.ledger');
  assert.match(await timeout.locator('.note').innerText(), /Time ran out/);
  assert.equal(await timeout.locator('.stamp-text').innerText(), 'EVIDENCE LEAKED');
  assert.deepEqual(await timeout.locator('.verdict .box span').allInnerTexts(), ['MATCH', 'INTACT', 'MATCH']);
  // Heat carries into the next tape.
  await timeout.locator('.verdict-body .btn.primary').click();
  await timeout.waitForSelector('.feed');
  assert.match(await timeout.locator('.heat-chips').innerText(), /Sirens[\s\S]*Camera shake/i);
  await timeout.close();
  console.log('PASS production: countdown expiry submits once with correct verdict; heat carries over');
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
