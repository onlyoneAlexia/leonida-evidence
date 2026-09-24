// Poster studio: opening with the poster, Save replacing the download, Back to original, Cancel, sharing,
// Escape and focus return, load failure and retry, the leaderboard post, and layout on a desktop and a phone
// in both orientations. Uses an editor double like release.mjs. POSTER_LIVE=1 opens the studio in Unlayer's
// hosted editor instead (needs network). Defaults to the dev server on port 5200.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/';
const TOOLS = ['crop', 'resize', 'filter', 'draw', 'text', 'shapes', 'stickers', 'frame'];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errors = [];
let current;

// The lab gets release.mjs's double ('clean' paints every HIDE box). The studio's copies the real editor's
// shape: a toolbar with Cancel and Save inside .image-editor-root, a Stickers tool, and a JPEG on Save.
function editorDouble() {
  window.__ImageEditorImpl__ = true;
  window.__studio = { mounts: 0, fail: 0, shares: [] };
  // Sharing is stubbed so no system share sheet opens; __canShare picks the path.
  navigator.canShare = () => !!window.__canShare;
  navigator.share = async data => { window.__studio.shares.push({ text: data.text, files: data.files.map(f => ({ name: f.name, type: f.type, size: f.size })) }); };
  window.ImageEditor = {
    load: async () => {},
    createEditor: async options => {
      const studio = options.container.closest('.studio');
      if (studio) {
        window.__studio.mounts++;
        if (window.__studio.fail > 0) { window.__studio.fail--; throw new Error('Simulated studio load error'); }
        window.__studio.image = options.image;
        window.__studio.options = JSON.parse(JSON.stringify({ ...options, container: null, image: null }));
      }
      const root = Object.assign(document.createElement('div'), { className: 'image-editor-root' });
      root.style.height = '100%';
      root.innerHTML = '<div style="display:flex;flex-direction:column;height:100%"><div style="display:flex;justify-content:flex-end;gap:8px;padding:8px"></div><div data-testid="native-editor" style="flex:1;min-height:0;display:flex"><canvas style="max-width:100%;max-height:100%;margin:auto"></canvas></div></div>';
      options.container.append(root);
      const canvas = root.querySelector('canvas');
      let data = null;
      let changed = false;
      async function reset(src = options.image) {
        const image = new Image(); image.src = src; await image.decode();
        canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        data = canvas.toDataURL();
      }
      reset();
      const sticker = () => { const g = canvas.getContext('2d'); g.fillStyle = '#ffd23f'; g.fillRect(80, 80, 320, 160); changed = true; data = canvas.toDataURL(); };
      if (studio) {
        const bar = root.querySelector(':scope > div > div');
        for (const [label, act] of [
          ['Stickers', sticker],
          ['Cancel', () => options.onCancel()],
          ['Save', () => canvas.toBlob(blob => options.onSave({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), blob }), 'image/jpeg', 0.92)],
        ]) {
          const button = Object.assign(document.createElement('button'), { textContent: label, onclick: act });
          if (label === 'Stickers') button.dataset.testid = 'native-tool-stickers';
          bar.append(button);
        }
      }
      return {
        getImage: () => {
          if (studio || window.__lab !== 'clean' || !data) return data;
          const g = canvas.getContext('2d');
          g.fillStyle = '#181020';
          for (const el of document.querySelectorAll('.lab-side .mini .box.hide')) {
            g.fillRect(parseFloat(el.style.left) * 12.8, parseFloat(el.style.top) * 7.2, parseFloat(el.style.width) * 12.8, parseFloat(el.style.height) * 7.2);
          }
          return canvas.toDataURL();
        },
        reset,
        destroy: () => root.remove(),
        updateOptions: () => {},
        // The lab's "Send it untouched?" check only fires for an untouched still.
        hasChanges: () => (studio ? changed : true),
      };
    },
  };
}

// Runs in the page, like responsive.mjs: no sideways overflow, uncovered controls, 44px touch targets, no text under 9px.
function inspect({ touch, scope }) {
  const problems = [];
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`page is ${document.documentElement.scrollWidth}px wide`);
  const shown = el => !el.closest('[inert], [aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const name = el => (el.getAttribute('aria-label') || el.textContent || el.className).trim().replace(/\s+/g, ' ').slice(0, 30);
  const root = document.querySelector(scope);
  if (!root) return [`${scope} is missing`];
  const box = root.getBoundingClientRect();
  if (scope === '.studio' && (box.left < 0 || box.top < 0 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5)) problems.push('studio overflows the viewport');
  for (const el of root.querySelectorAll('a[href], button:not(:disabled), input')) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cy < 0 || cy > innerHeight) continue;
    if (r.right > innerWidth + 0.5 || r.left < -0.5) problems.push(`"${name(el)}" is cut off`);
    const at = (x, y) => { const hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), y); return hit && (el.contains(hit) || hit.contains(el)); };
    if (!at(cx, cy)) problems.push(`"${name(el)}" is covered`);
    if (!touch || getComputedStyle(el).display === 'inline') continue;
    if (r.height < 43.5 || r.width < 43.5) problems.push(`"${name(el)}" is a ${Math.round(r.width)}x${Math.round(r.height)} touch target`);
  }
  for (const el of root.querySelectorAll('*')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) || !shown(el)) continue;
    if (parseFloat(getComputedStyle(el).fontSize) < 9) problems.push(`"${name(el)}" is ${getComputedStyle(el).fontSize} text`);
  }
  return [...new Set(problems)];
}

async function newGame({ width, height, touch = false, reduce = true, lab = 'original', double = true }) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = current = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  if (double) await page.addInitScript(editorDouble);
  await page.addInitScript(mode => { window.__lab = mode; }, lab);
  await page.goto(base);
  await page.waitForSelector('.ler-play button:not([disabled])');
  await page.locator('#fixer-alias').fill('Poster Tester');
  await page.locator('.ler-play button').click();
  return page;
}

// One job, as release.mjs plays it: roll the tape, freeze early, send it and read the verdict.
async function playJob(page, timeout = 30000) {
  await page.locator('.brief-side').getByRole('button', { name: 'Roll tape', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.feed canvas')?.dataset.t) >= 0.3 || !document.querySelector('.feed'), null, { polling: 50 });
  if (await page.locator('.feed').count()) await page.getByRole('button', { name: /Freeze frame/ }).click();
  await page.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'), null, { timeout });
  await page.locator('.hud').getByRole('button', { name: /Send to evidence/ }).click();
  // The real editor reports an untouched still, and the lab asks before sending one.
  const anyway = page.getByRole('button', { name: 'Send it anyway', exact: true });
  await Promise.race([page.waitForSelector('.ledger', { timeout }), anyway.waitFor({ timeout }).then(() => anyway.click(), () => {})]);
  await page.waitForSelector('.ledger', { timeout });
  await page.locator('.verdict-body .btn.primary').click();
}

// The quick way to a rap sheet: one job, then walk away from the next tape.
async function walkAway(page, timeout) {
  await playJob(page, timeout);
  await page.waitForSelector('.briefing');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'See my rap sheet', exact: true }).click();
  await page.waitForSelector('.rapsheet .poster');
}

const sha = bytes => createHash('sha1').update(bytes).digest('hex');
async function download(page, click) {
  const event = page.waitForEvent('download');
  await click();
  const file = await event;
  const bytes = await readFile(await file.path());
  assert.equal(file.suggestedFilename(), 'leonida-rap-sheet.png');
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', 'The poster downloads as a PNG');
  return { hash: sha(bytes), size: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
const downloadPoster = page => download(page, () => page.getByRole('link', { name: 'Download poster', exact: true }).click());
const customize = page => page.getByRole('button', { name: 'Customize poster', exact: true });
const focused = page => page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent.trim());
async function openStudio(page) {
  await customize(page).click();
  await page.waitForSelector('.studio');
  await page.waitForFunction(() => !document.querySelector('.studio-status'), null, { timeout: 60000 });
}
async function check(page, what, touch, scope) {
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(inspect, { touch, scope }), [], what);
}

try {
  if (!process.env.POSTER_LIVE) {
    // Desktop: a finished run, so the leaderboard post can be checked after an edit.
    const page = await newGame({ width: 1440, height: 900, lab: 'clean' });
    for (let i = 0; i < 5; i++) await playJob(page);
    await page.waitForSelector('.rapsheet .poster');
    await check(page, '1440x900 rap sheet', false, '.rapsheet');
    assert.equal(await page.locator('.poster-badge').count(), 0);
    const original = await downloadPoster(page);
    assert.deepEqual([original.width, original.height], [1080, 1350]);

    // Opening: focus moves in, the page behind goes inert, and the editor gets this poster with every tool on.
    await customize(page).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.studio canvas');
    assert.equal(await page.getByRole('dialog', { name: 'Make it yours' }).count(), 1);
    assert.match(await page.locator('#studio-hint').innerText(), /frame, stickers, a caption/);
    assert.equal(await focused(page), 'studio-title', 'Focus moves into the studio');
    assert.equal(await page.evaluate(() => document.getElementById('root').inert), true, 'The rap sheet is inert behind the studio');
    assert.equal(await page.evaluate(async () => {
      const blob = await (await fetch(document.querySelector('.rapsheet .poster').src)).blob();
      const url = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      return url === window.__studio.image;
    }), true, 'The studio opens the rap sheet poster');
    const { features, theme } = await page.evaluate(() => window.__studio.options);
    assert.deepEqual(TOOLS.filter(t => features.imageEditor.tools[t] !== true), [], 'Every tool is on');
    assert.equal(features.ai, false);
    assert.equal(theme, 'dark');
    assert.equal(await page.locator('.studio').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion skips the entrance');
    await check(page, '1440x900 studio', false, '.studio');
    await page.screenshot({ path: 'scripts/poster-studio-1440.png' });

    // Escape with nothing changed closes, and focus goes back to the button.
    await page.keyboard.press('Escape');
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await focused(page), 'Customize poster', 'Focus returns to Customize poster');
    assert.equal(await page.evaluate(() => document.getElementById('root').inert), false);

    // With edits, Escape and Close ask first; Keep editing stays, Discard leaves the poster alone.
    await openStudio(page);
    await page.getByTestId('native-tool-stickers').click();
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').waitFor();
    assert.equal(await focused(page), 'Keep editing');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert.equal(await page.locator('.studio').count(), 1, 'Escape on the question keeps editing');
    await page.getByRole('button', { name: 'Close poster studio' }).click();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    assert.equal(await page.locator('.studio').count(), 1);
    await page.getByRole('button', { name: 'Close poster studio' }).click();
    await page.getByRole('button', { name: 'Discard edits', exact: true }).click();
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await page.locator('.poster-badge').count(), 0);
    assert.equal((await downloadPoster(page)).hash, original.hash, 'Discarding leaves the poster unchanged');

    // The editor's own Cancel closes straight away and changes nothing.
    await openStudio(page);
    await page.getByTestId('native-tool-stickers').click();
    await page.locator('.studio').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await focused(page), 'Customize poster');
    assert.equal(await page.locator('.poster-badge').count(), 0);
    assert.equal((await downloadPoster(page)).hash, original.hash, 'Cancel leaves the poster unchanged');

    // Save: the edit is shown with an Edited badge and becomes what Download poster saves, as a PNG.
    const before = await page.locator('.rapsheet .poster').getAttribute('src');
    await openStudio(page);
    await page.getByTestId('native-tool-stickers').click();
    await page.locator('.studio').getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await focused(page), 'Customize poster');
    assert.equal(await page.locator('.poster-badge').innerText(), 'EDITED');
    assert.notEqual(await page.locator('.rapsheet .poster').getAttribute('src'), before);
    assert.equal(await page.locator('.rapsheet .poster').getAttribute('alt'), 'Your customized rap sheet poster');
    const edited = await downloadPoster(page);
    assert.notEqual(edited.hash, original.hash, 'Download poster saves the edit');
    assert.deepEqual([edited.width, edited.height], [1080, 1350]);
    // The sticker is in the downloaded file: the double paints gold at (80, 80).
    assert.deepEqual(await page.evaluate(async () => {
      const image = new Image(); image.src = document.querySelector('.rapsheet .poster').src; await image.decode();
      const c = new OffscreenCanvas(1, 1).getContext('2d'); c.drawImage(image, -200, -160);
      return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)].map(v => Math.round(v / 16));
    }), [16, 13, 4], 'The saved poster carries the edit');
    await check(page, '1440x900 edited rap sheet', false, '.rapsheet');
    await page.screenshot({ path: 'scripts/poster-rapsheet-1440.png' });

    // Sharing: the file itself where the browser can, otherwise a download of the same poster.
    await page.evaluate(() => { window.__canShare = true; });
    await page.getByRole('button', { name: 'Share poster', exact: true }).click();
    await page.waitForFunction(() => window.__studio.shares.length === 1);
    const [shared] = await page.evaluate(() => window.__studio.shares);
    assert.deepEqual(shared.files, [{ name: 'leonida-rap-sheet.png', type: 'image/png', size: edited.size }], 'Shares the edited poster file');
    assert.match(shared.text, /Leonida Evidence Room.*#BuiltWithImageEditor/);
    await page.evaluate(() => { window.__canShare = false; });
    const fallback = await download(page, () => page.getByRole('button', { name: 'Share poster', exact: true }).click());
    assert.equal(fallback.hash, edited.hash, 'Without file sharing, Share poster downloads the poster');
    assert.match(await page.locator('.share-note').innerText(), /downloaded instead/);
    assert.match(await page.getByRole('link', { name: 'Share on X' }).getAttribute('href'), /^https:\/\/twitter\.com\/intent\/tweet\?text=I%20doctored%205%20VCPD%20tapes/);

    // The leaderboard post carries the scored jobs only, edit or no edit.
    const post = page.waitForRequest(r => r.url().endsWith('/api/leaderboard') && r.method() === 'POST');
    await page.getByRole('button', { name: 'Post to leaderboard', exact: true }).click();
    const body = (await post).postDataJSON();
    assert.deepEqual(Object.keys(body), ['name', 'jobs']);
    assert.equal(body.jobs.length, 5);
    assert.ok(!JSON.stringify(body).includes('data:'), 'No poster in the leaderboard post');
    await page.getByRole('status').filter({ hasText: 'Posted.' }).waitFor();
    assert.equal(await page.locator('.board tr.you td:nth-child(3)').innerText(), '$' + body.jobs.reduce((s, j) => s + j.cash, 0).toLocaleString('en-US'));

    // Back to original restores the printed poster.
    await page.getByRole('button', { name: 'Back to original', exact: true }).click();
    assert.equal(await page.locator('.poster-badge').count(), 0);
    assert.equal(await focused(page), 'Customize poster', 'Focus stays on the studio button');
    assert.equal((await downloadPoster(page)).hash, original.hash, 'Back to original downloads the original');

    // A studio that can't load offers a retry, and the rap sheet behind it is untouched.
    await page.evaluate(() => { window.__studio.fail = 1; });
    await customize(page).click();
    await page.getByRole('button', { name: 'Retry studio', exact: true }).waitFor();
    assert.match(await page.locator('.studio-status[role=alert]').innerText(), /couldn't load/);
    await page.getByRole('button', { name: 'Retry studio', exact: true }).click();
    await page.waitForSelector('.studio canvas');
    await page.waitForFunction(() => !document.querySelector('.studio-status'));
    await page.locator('.studio').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await page.locator('.rapsheet .poster').count(), 1);
    assert.equal((await downloadPoster(page)).hash, original.hash);
    // And one that never answers times out into the same retry.
    await page.clock.install();
    await page.evaluate(() => { window.__studio.fail = 0; window.__hang = window.ImageEditor.createEditor; window.ImageEditor.createEditor = () => new Promise(() => {}); });
    await customize(page).click();
    await page.getByText('Loading the poster studio…').waitFor();
    await page.clock.fastForward(26000);
    await page.getByRole('button', { name: 'Retry studio', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close poster studio' }).click();
    await page.waitForSelector('.studio', { state: 'detached' });
    assert.equal(await focused(page), 'Customize poster');
    await page.getByRole('button', { name: 'Run it back', exact: true }).click();
    assert.match(await page.locator('.case-no').first().innerText(), /CASE 1/);
    await page.context().close();
    console.log('PASS desktop 1440x900: opens with the poster and every tool, Save replaces the download, Back to original, Cancel and Discard change nothing, share and its fallback, leaderboard post unaffected, Escape and focus return, load failure and timeout retry, layout');

    // Phones, both orientations, with touch and full motion.
    const phone = await newGame({ width: 390, height: 664, touch: true, reduce: false });
    await walkAway(phone);
    await check(phone, '390x664 rap sheet', true, '.rapsheet');
    await openStudio(phone);
    assert.equal(await phone.locator('.studio').evaluate(el => getComputedStyle(el).animationName), 'studioIn');
    await phone.waitForTimeout(400);
    await check(phone, '390x664 studio', true, '.studio');
    await phone.screenshot({ path: 'scripts/poster-studio-390.png' });
    await phone.setViewportSize({ width: 844, height: 390 });
    await check(phone, '844x390 studio', true, '.studio');
    const stage = await phone.locator('.studio-stage').boundingBox();
    assert.ok(stage.height >= 320, `Landscape leaves the editor ${stage.height}px`);
    await phone.screenshot({ path: 'scripts/poster-studio-844.png' });
    await phone.getByTestId('native-tool-stickers').click();
    await phone.locator('.studio').getByRole('button', { name: 'Save', exact: true }).click();
    await phone.waitForSelector('.studio', { state: 'detached' });
    await phone.waitForSelector('.poster-badge');
    await check(phone, '844x390 edited rap sheet', true, '.rapsheet');
    await phone.setViewportSize({ width: 390, height: 664 });
    await check(phone, '390x664 edited rap sheet', true, '.rapsheet');
    await phone.locator('.studio-actions').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await phone.screenshot({ path: 'scripts/poster-rapsheet-390.png' });
    await phone.context().close();
    console.log('PASS phone 390x664 and 844x390: rap sheet and studio fit, touch targets, text size, motion, Save on a phone');
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } else {
    // The hosted editor: the poster loads with every tool, native Save and Cancel show, and Save replaces the download.
    for (const device of [{ width: 1440, height: 900 }, { width: 390, height: 664, touch: true }, { width: 844, height: 390, touch: true }]) {
      const page = await newGame({ ...device, double: false });
      const tag = `${device.width}x${device.height}`;
      await walkAway(page, 90000);
      const original = await downloadPoster(page);
      await openStudio(page);
      await page.waitForSelector('.studio canvas');
      for (const tool of TOOLS) assert.equal(await page.getByTestId(`native-tool-${tool}`).count(), 1, `${tag}: ${tool} tool`);
      const save = page.locator('.studio button').filter({ hasText: /^Save$/ });
      const cancel = page.locator('.studio button').filter({ hasText: /^Cancel$/ });
      assert.ok(await save.isVisible() && await cancel.isVisible(), `${tag}: the editor's Save and Cancel show`);
      if (device.touch) for (const button of [save, cancel]) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 43.5 && box.height >= 43.5, `${tag}: native ${await button.innerText()} is ${box.width}x${box.height}`);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: studio overflows`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.studio')).position), 'fixed');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `scripts/poster-live-${tag}.png` });
      // Frames are on here, unlike the lab.
      await page.getByTestId('native-tool-frame').click();
      await page.getByTestId('native-frame-rainbow').click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `scripts/poster-live-frame-${tag}.png` });
      // On a portrait phone the settings sit under the canvas, so the whole poster stays in view while you pick.
      if (device.height > device.width) assert.ok(await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="native-tool-options"]').getBoundingClientRect();
        const canvas = document.querySelector('[data-testid="native-editor"] > :first-child').getBoundingClientRect();
        return sheet.top >= canvas.bottom - 1 && canvas.height > 150;
      }), `${tag}: tool settings open as a sheet under the canvas`);
      await save.click();
      await page.waitForSelector('.studio', { state: 'detached', timeout: 20000 });
      await page.waitForSelector('.poster-badge');
      const edited = await downloadPoster(page);
      assert.notEqual(edited.hash, original.hash, `${tag}: Save replaces the download`);
      console.log(`PASS live ${tag}: poster loads with ${TOOLS.length} tools, native Save and Cancel, framed save downloads as a ${edited.width}x${edited.height} PNG`);
      await page.screenshot({ path: `scripts/poster-live-saved-${tag}.png`, fullPage: false });
      // Escape and the editor's own Cancel both close the real studio and keep the saved poster.
      await openStudio(page);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.studio', { state: 'detached' });
      assert.equal(await focused(page), 'Customize poster', `${tag}: focus returns after Escape`);
      await openStudio(page);
      await page.getByTestId('native-tool-stickers').click();
      await cancel.click();
      await page.waitForSelector('.studio', { state: 'detached' });
      assert.equal((await downloadPoster(page)).hash, edited.hash, `${tag}: Cancel keeps the saved poster`);
      await page.context().close();
    }
  }
} catch (error) {
  await current?.screenshot({ path: 'scripts/poster-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
