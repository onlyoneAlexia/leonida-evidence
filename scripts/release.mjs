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
        window.__options = options;
        if (window.__mode === 'fail-once' && window.__mounts === 1) throw new Error('Simulated CDN mount error');
        // Like the real editor: a rail of the enabled tools and a Save/Cancel toolbar, labelled through options.translations.
        const label = key => options.translations?.en?.[key] ?? key;
        const button = (text, onClick, testid) => {
          const b = document.createElement('button');
          b.type = 'button';
          if (testid) b.dataset.testid = testid;
          b.append(text);
          b.onclick = onClick;
          return b;
        };
        const tools = options.features?.imageEditor?.tools ?? {};
        const rail = document.createElement('div');
        rail.dataset.testid = 'native-tool-nav';
        for (const id of ['crop', 'filter', 'draw', 'text', 'shapes', 'stickers', 'resize', 'frame']) {
          const tool = tools[id];
          if (tool === false || tool?.enabled === false) continue;
          const b = button(label(`image_editor.tools.${id}`), null, `native-tool-${id}`);
          if (tool?.icon) b.insertAdjacentHTML('afterbegin', tool.icon);
          rail.append(b);
        }
        const canvas = document.createElement('canvas');
        canvas.style.maxWidth = '100%';
        let data = null;
        // Edits live in this instance, so a remount loses them.
        let painted = false;
        async function load(src = options.image) {
          data = null;
          const image = new Image(); image.src = src; await image.decode();
          canvas.width = image.width; canvas.height = image.height;
          canvas.getContext('2d').drawImage(image, 0, 0);
          data = canvas.toDataURL();
        }
        const api = {
          getImage: () => {
            if (window.__exportFails) throw new Error('Simulated export error');
            if (window.__corrupt) return 'data:image/png;base64,bm90YW5pbWFnZQ==';
            if ((window.__mode !== 'clean' && !painted) || !data) return data;
            // A clean edit paints over every HIDE box on the lab's orders map, including a late surprise.
            const g = canvas.getContext('2d');
            g.fillStyle = '#181020';
            for (const el of document.querySelectorAll('.lab-side .mini .box.hide')) {
              g.fillRect(parseFloat(el.style.left) * 12.8, parseFloat(el.style.top) * 7.2, parseFloat(el.style.width) * 12.8, parseFloat(el.style.height) * 7.2);
            }
            return canvas.toDataURL();
          },
          reset: src => { painted = false; return load(src); },
          destroy: () => { rail.remove(); bar.remove(); canvas.remove(); },
          updateOptions: () => {},
          hasChanges: () => window.__mode === 'clean' || painted || !!window.__touched,
          paint: () => { painted = true; },
        };
        const bar = document.createElement('div');
        bar.append(
          button(label('image_editor.toolbar.cancel'), () => options.onCancel?.()),
          button(label('image_editor.toolbar.save'), () => { window.__saves = (window.__saves || 0) + 1; options.onSave?.({ dataUrl: api.getImage(), blob: null }); }),
        );
        options.container.append(bar, rail, canvas);
        // Return the mount before image decoding, like the real embed can do.
        if (window.__decodeFails) { window.__decodeFails = false; setTimeout(() => options.onLoadError?.(), 50); }
        else load();
        window.__editor = api;
        return api;
      },
    };
  }, mode);
  await page.goto(base);
  await page.waitForSelector('.ler-play button:not([disabled])');
  // In through the hero's #play link, so going home has an anchor to clear.
  await page.getByRole('link', { name: /GET TO WORK/ }).click();
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
  await page.waitForFunction(() => document.querySelector('.lab .timer')?.textContent.includes(':'));
}
// Two ways to hand in: the HUD button and the editor's own Save, relabelled through options.translations.
const hudSend = page => page.locator('.hud').getByRole('button', { name: /Send to evidence/ });
const nativeSave = page => page.locator('.editor-wrap').getByRole('button', { name: 'Send to evidence', exact: true });
const nativeReset = page => page.locator('.editor-wrap').getByRole('button', { name: 'Reset tape', exact: true });
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const ledgerTotal = async page => (await page.locator('.ledger dd').allInnerTexts()).slice(0, 3).reduce((sum, v) => sum + Number(v.replace(/[$,]/g, '')), 0);
async function sendAnyway(page) {
  const dialog = page.locator('dialog[open]');
  assert.match(await dialog.getByRole('heading').innerText(), /Send it untouched\?/);
  await dialog.getByRole('button', { name: 'Send it anyway', exact: true }).click();
}
const LABELS = ['Cut', 'Tint', 'Spray', 'Caption', 'Blocks', 'Cover-ups'];
const PAINTS = ['Spray', 'Blocks', 'Cover-ups'];
const toolkitText = (page, scope) => page.locator(`${scope} .toolkit`).evaluateAll(els => els[0]?.textContent ?? null);
// The editor gets the job's toolkit minus whatever heat jammed, and the jams leave at least one way to cover evidence.
async function checkToolkit(page, feedToolkit) {
  const rail = (await page.locator('[data-testid="native-tool-nav"] button').allInnerTexts()).map(s => s.trim()).sort();
  const kit = await page.locator('.lab-side .toolkit-tools li').evaluateAll(els => els.map(li => ({ tool: li.textContent.replace(/ jammed$/, ''), jammed: li.classList.contains('jammed') })));
  const chips = (await page.locator('.lab-side .heat-chips span').allInnerTexts()).filter(s => / jammed$/i.test(s)).map(s => s.replace(/ jammed$/i, ''));
  const tools = kit.length ? kit : LABELS.map(tool => ({ tool, jammed: chips.some(c => c.toLowerCase() === tool.toLowerCase()) }));
  assert.equal(await toolkitText(page, '.lab-side'), feedToolkit, 'The tape screen showed the same toolkit as the lab');
  assert.deepEqual(rail, tools.filter(t => !t.jammed).map(t => t.tool).sort(), 'Editor rail is the toolkit minus jammed tools');
  assert.deepEqual(chips.map(c => c.toLowerCase()).sort(), tools.filter(t => t.jammed).map(t => t.tool.toLowerCase()).sort(), 'Heat chips name the jammed tools');
  assert.ok(rail.every(t => LABELS.includes(t)), `Rail labels come from the translations: ${rail}`);
  assert.ok(rail.some(t => [...PAINTS, 'Cut'].includes(t)), 'A covering tool always survives the heat');
  if (tools.some(t => PAINTS.includes(t.tool))) assert.ok(rail.some(t => PAINTS.includes(t)), 'A paint-over tool always survives the heat');
  assert.equal(await page.locator('[data-testid="native-tool-nav"] svg.ler-tool-icon').count(), rail.length, 'Every tool has its custom icon');
  assert.deepEqual(await page.evaluate(() => [window.__options.features.imageEditor.tools.resize, window.__options.features.imageEditor.tools.frame]), [false, false]);
  return { rail, jammed: chips };
}
const homeButton = page => page.getByRole('button', { name: 'Home', exact: true });
// Going home lands on the landing page at the top, with the #play anchor cleared.
async function assertHome(page, from) {
  await page.waitForSelector('.ler-home');
  await page.waitForSelector('.ler-play button:not([disabled])');
  assert.deepEqual(await page.evaluate(() => [scrollY, location.hash]), [0, ''], `Home from ${from} opens the landing page at the top`);
  assert.equal(await page.locator('dialog[open]').count(), 0);
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
  let cash = 0;
  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      assert.equal(await homeButton(clean).count(), 1, 'Home on the tape');
      // With reduced motion the chatter changes line by line, so this job's calls come round within a few seconds.
      await clean.locator('.feed-col [role=marquee]').filter({ hasText: /Kwik Mart|Ocean/ }).waitFor({ timeout: 12000 });
    }
    // The toolkit is on the tape screen before the tape rolls.
    const feedToolkit = await toolkitText(clean, '.brief-side');
    if (feedToolkit) assert.match(feedToolkit, /^Toolkit.+/, `Case ${i + 1}: toolkit label`);
    // Late in the clip every KEEP that must show (Rico, his yacht) is in the shot.
    await freezeAt(clean, 11.2); await ready(clean);
    assert.equal(await clean.locator('.lab-side .objectives li.missing').count(), 0, `Case ${i + 1}: a must-show KEEP is missing`);
    const { jammed } = await checkToolkit(clean, feedToolkit);
    assert.deepEqual(jammed, [], 'No heat, nothing jammed');
    if (i === 0) {
      assert.deepEqual(await nativeReset(clean).count(), 1, 'Cancel is relabelled Reset tape');
      assert.equal(await clean.evaluate(() => window.__options.translations.en['image_editor.toolbar.save']), 'Send to evidence');
    }
    if (i === 0) {
      assert.equal(await homeButton(clean).count(), 1, 'Home in the lab');
      assert.equal(await clean.locator('.lab [role=marquee]').count(), 1, 'Dispatch chatter in the lab');
      // The upload screen is brief, so record whether it offered Home as it went by.
      await clean.evaluate(() => {
        const seen = new MutationObserver(() => { if (document.querySelector('.screen.center .home-toggle') && /Uploading/.test(document.body.textContent)) window.__uploadHome = true; });
        seen.observe(document.body, { childList: true, subtree: true });
      });
    }
    // Case 1 goes in through the editor's own Save (double-clicked), case 2 through both buttons at once: each submits once.
    if (i === 0) await nativeSave(clean).dblclick();
    else if (i === 1) await clean.evaluate(() => { [...document.querySelectorAll('.editor-wrap button')].find(b => b.textContent === 'Send to evidence').click(); document.querySelector('.hud > .btn.primary').click(); });
    else await hudSend(clean).click();
    await clean.waitForSelector('.ledger');
    if (i < 2) assert.ok(await clean.evaluate(() => window.__saves >= 1), 'The editor Save reached onSave');
    if (i === 0) {
      assert.equal(await clean.evaluate(() => window.__uploadHome), true, 'Home on the upload screen');
      assert.equal(await homeButton(clean).count(), 1, 'Home on the verdict');
    }
    assert.equal(await clean.locator('.stamp-text').innerText(), 'CASE DISMISSED');
    cash += await ledgerTotal(clean);
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
    if (i < 4) {
      await clean.waitForSelector('.briefing');
      assert.equal(await clean.locator('.brief-head .cash').innerText(), money(cash), `Case ${i + 1} was paid once`);
    }
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
  // Mid-run, Home asks first. With nothing finished there is no rap sheet to offer.
  await homeButton(clean).click();
  const leave = clean.locator('dialog[open]');
  assert.match(await leave.innerText(), /Nothing's finished yet/);
  assert.deepEqual(await leave.getByRole('button').allInnerTexts(), ['Keep playing', 'Go to the homepage']);
  await leave.getByRole('button', { name: 'Go to the homepage', exact: true }).click();
  await assertHome(clean, 'the tape');
  // The hero's TOP FIXER readout shows the board's #1, which now includes the posted run.
  const top = (await clean.evaluate(() => fetch('/api/leaderboard').then(r => r.json()))).top[0];
  const readout = clean.getByRole('link', { name: /^TOP FIXER/ });
  assert.equal(await readout.getAttribute('href'), '#leaders');
  assert.match(await readout.innerText(), new RegExp(`TOP FIXER\\s+\\$${top.cash.toLocaleString('en-US')}\\s+#1 ${top.name.toUpperCase()}`));
  assert.match(await clean.locator('#leaders .ler-board').innerText(), /Release Tester/);
  await clean.close();
  console.log('PASS production: five clean cases, winning ending, poster download, leaderboard post, replay, Home mid-run, hero TOP FIXER');

  const recovery = await openGame('fail-once', 390);
  const problem = () => recovery.locator('.editor-status[role=alert]');
  // Embed failure: the editor never mounted. Its retry mounts a new one, whose still then fails to decode.
  await freezeAt(recovery);
  await recovery.getByRole('button', { name: 'Reload the lab', exact: true }).waitFor();
  assert.match(await problem().innerText(), /couldn't reach Unlayer's image editor[\s\S]*timer is paused/);
  assert.equal(await hudSend(recovery).isDisabled(), true);
  assert.equal(await recovery.locator('.timer').innerText(), '…');
  await recovery.evaluate(() => { window.__decodeFails = true; });
  await recovery.getByRole('button', { name: 'Reload the lab', exact: true }).click();
  await recovery.getByRole('button', { name: 'Reload the still', exact: true }).waitFor();
  assert.match(await problem().innerText(), /frozen still wouldn't load/);
  await recovery.getByRole('button', { name: 'Reload the still', exact: true }).click();
  await ready(recovery);
  assert.equal(await recovery.evaluate(() => window.__mounts), 3);
  assert.ok(await recovery.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile lab overflows');
  await recovery.screenshot({ path: 'scripts/release-mobile-lab.png' });
  // An untouched still asks once before it goes in; Keep editing leaves the lab running.
  await hudSend(recovery).click();
  await recovery.locator('dialog[open]').getByRole('heading', { name: 'Send it untouched?' }).waitFor();
  await recovery.getByRole('button', { name: 'Keep editing', exact: true }).click();
  assert.equal(await recovery.locator('dialog[open]').count(), 0);
  assert.equal(await recovery.locator('.lab').count(), 1, 'Keep editing stays in the lab');
  // Export failure keeps the mounted editor and its edits; the retry sends them.
  await recovery.evaluate(() => { window.__editor.paint(); window.__exportFails = true; });
  await hudSend(recovery).click();
  await recovery.getByRole('button', { name: 'Try sending again', exact: true }).waitFor();
  assert.match(await problem().innerText(), /didn't make it to evidence[\s\S]*edits are safe[\s\S]*timer is paused/);
  assert.equal(await recovery.locator('dialog[open]').count(), 0, 'An edited still goes straight in');
  const pausedAt = await recovery.locator('.timer').innerText();
  await recovery.waitForTimeout(1300);
  assert.equal(await recovery.locator('.timer').innerText(), pausedAt, 'The clock is paused while the export fails');
  assert.deepEqual(await recovery.evaluate(() => [window.__mounts, document.querySelectorAll('.editor-wrap canvas').length]), [3, 1], 'Editor stays mounted');
  await recovery.evaluate(() => { window.__exportFails = false; });
  await recovery.getByRole('button', { name: 'Try sending again', exact: true }).click();
  await recovery.waitForSelector('.ledger');
  assert.equal(await recovery.locator('.stamp-text').innerText(), 'CASE DISMISSED', 'The retried hand-in kept the edits');
  await recovery.locator('.verdict-body .btn.primary').click();
  // Reset tape (the editor's Cancel) asks before wiping edits.
  await freezeAt(recovery); await ready(recovery);
  await recovery.evaluate(() => window.__editor.paint());
  await nativeReset(recovery).click();
  await recovery.locator('dialog[open]').getByRole('heading', { name: 'Reset the tape?' }).waitFor();
  await recovery.getByRole('button', { name: 'Keep my edits', exact: true }).click();
  assert.equal(await recovery.evaluate(() => window.__editor.hasChanges()), true, 'Keep my edits keeps them');
  await nativeReset(recovery).click();
  await recovery.locator('dialog[open]').getByRole('button', { name: 'Reset tape', exact: true }).click();
  await ready(recovery);
  assert.equal(await recovery.evaluate(() => window.__editor.hasChanges()), false, 'Reset tape wipes the edits');
  await recovery.evaluate(() => { window.__corrupt = true; });
  await nativeSave(recovery).click();
  await sendAnyway(recovery);
  await recovery.getByRole('button', { name: 'Retry forensics', exact: true }).waitFor();
  assert.equal(await homeButton(recovery).count(), 1, 'Home on the forensics error screen');
  await recovery.getByRole('button', { name: 'Redo this tape', exact: true }).click();
  assert.match(await recovery.locator('.case-no').innerText(), /CASE 2/);
  // Home from the lab asks first, then drops the run.
  await recovery.evaluate(() => { window.__corrupt = false; });
  await freezeAt(recovery); await ready(recovery);
  await homeButton(recovery).click();
  await recovery.getByRole('button', { name: 'Keep playing', exact: true }).click();
  assert.equal(await recovery.locator('.lab').count(), 1, 'Keep playing stays in the lab');
  await homeButton(recovery).click();
  await recovery.getByRole('button', { name: 'Go to the homepage', exact: true }).click();
  await assertHome(recovery, 'the lab');
  await recovery.close();
  console.log('PASS production: embed and decode failures with their own retries, untouched warning, export recovery keeping edits, Reset tape confirm, analysis recovery, mobile lab, Home from the lab');

  // Early freeze: Jason is still inside, so only the plate is evidence; the tape time is off the clock.
  const surprise = await openGame();
  await surprise.route('**/api/leaderboard', route => route.abort());
  await freezeAt(surprise, 0.3); await ready(surprise);
  assert.match(await surprise.locator('.lab-side .objectives li.gone').innerText(), /Jason's face[\s\S]*no edit needed/);
  assert.ok(Number((await surprise.locator('.timer').innerText()).replace(':', '')) < 130, 'The tape time counts against the clock');
  await surprise.waitForSelector('.enhance', { timeout: 9000 });
  assert.match(await surprise.locator('.enhance').innerText(), /security monitor/);
  assert.match(await surprise.locator('.lab-side .objectives li.fresh').innerText(), /security monitor/);
  await hudSend(surprise).click();
  await surprise.waitForSelector('.ledger');
  assert.equal(await surprise.locator('.stamp-text').innerText(), 'CASE DISMISSED');
  assert.equal(await surprise.locator('.verdict .box').count(), 3, 'Plate, timestamp and the surprise are judged');
  await surprise.locator('.verdict-body .btn.primary').click();
  // Walking away keeps a rap sheet of the finished job but stays off the board.
  await surprise.waitForSelector('.feed');
  await homeButton(surprise).click();
  assert.deepEqual(await surprise.locator('dialog[open]').getByRole('button').allInnerTexts(), ['Keep playing', 'See my rap sheet', 'Go to the homepage']);
  assert.match(await surprise.locator('dialog[open]').innerText(), /finished 1 job/);
  await surprise.getByRole('button', { name: 'Keep playing', exact: true }).click();
  assert.equal(await surprise.locator('.feed').count(), 1);
  assert.equal(await surprise.locator('dialog[open]').count(), 0);
  await homeButton(surprise).click();
  await surprise.getByRole('button', { name: 'See my rap sheet', exact: true }).click();
  await surprise.waitForSelector('.rapsheet .poster');
  assert.equal(await surprise.locator('.logo').innerText(), 'WALKED AWAY');
  assert.match(await surprise.locator('.board-panel').innerText(), /walk away from don't make the board/);
  assert.match(await surprise.locator('.board-panel').innerText(), /offline/);
  assert.equal(await surprise.getByRole('button', { name: 'Post to leaderboard' }).count(), 0);
  // On the rap sheet Home goes straight to the landing page, and the next run starts from scratch.
  // Clicked in place: a normal click would scroll the button (and the page) to the top first.
  await surprise.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  assert.ok(await surprise.evaluate(() => scrollY > 0));
  await homeButton(surprise).evaluate(el => el.click());
  await assertHome(surprise, 'the rap sheet');
  assert.equal(await surprise.locator('.ler-top-fixer').count(), 0, 'No TOP FIXER readout while the board is offline');
  await surprise.locator('.ler-play button').click();
  assert.match(await surprise.locator('.case-no').innerText(), /CASE 1/);
  assert.equal(await surprise.locator('.brief-head .cash').innerText(), '$0');
  await surprise.close();
  console.log('PASS production: out-of-sight evidence, clock after the tape, mid-edit surprise, walk away to rap sheet, Home from the rap sheet, board offline');

  const timeout = await openGame('original');
  // The tape runs on animation frames, so fake the clock only once the lab's countdown is running.
  await freezeAt(timeout); await ready(timeout);
  await timeout.clock.install();
  await timeout.clock.fastForward(100000);
  await timeout.waitForSelector('.ledger');
  assert.equal(await timeout.locator('dialog[open]').count(), 0, 'The countdown never asks about an untouched still');
  assert.match(await timeout.locator('.note').innerText(), /Time ran out/);
  assert.equal(await timeout.locator('.stamp-text').innerText(), 'EVIDENCE LEAKED');
  assert.deepEqual(await timeout.locator('.verdict .box span').allInnerTexts(), ['MATCH', 'INTACT', 'MATCH']);
  // Heat carries into the next tape.
  await timeout.locator('.verdict-body .btn.primary').click();
  await timeout.waitForSelector('.feed');
  assert.match(await timeout.locator('.heat-chips').innerText(), /Sirens[\s\S]*Camera shake/i);
  await timeout.close();
  console.log('PASS production: countdown expiry submits once with correct verdict; heat carries over');

  // Heat against per-job toolkits: leak the first two tapes (four stars), then clean the rest. Jams come out of each
  // job's toolkit, never its last way to cover evidence, and the tape screen shows them before the tape rolls.
  const heat = await openGame('original');
  for (let i = 0; i < 5; i++) {
    const feedToolkit = await toolkitText(heat, '.brief-side');
    const feedChips = await heat.locator('.brief-side .heat-chips').evaluateAll(els => els[0]?.textContent ?? '');
    await heat.evaluate(leak => { window.__mode = leak ? 'original' : 'clean'; }, i < 2);
    await freezeAt(heat, 11.2); await ready(heat);
    const { rail, jammed } = await checkToolkit(heat, feedToolkit);
    for (const tool of jammed) assert.match(feedChips, new RegExp(`${tool} jammed`, 'i'), 'The tape screen named the jam first');
    if (i >= 2) {
      assert.match(await heat.locator('.lab-side .heat-chips').innerText(), /Sirens[\s\S]*Camera shake/i, 'Heat still wails and shakes');
      assert.ok(jammed.length <= 2 && rail.length >= 1);
      console.log(`  4 stars, case ${i + 1}: rail ${rail.join(', ')}; jammed ${jammed.join(', ') || 'nothing'}`);
    }
    if (i === 0) {
      // Keep editing, then send again: the untouched warning only asks once.
      await hudSend(heat).click();
      await heat.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await hudSend(heat).click();
    } else if (i === 1) {
      await hudSend(heat).click();
      await sendAnyway(heat);
    } else await hudSend(heat).click();
    await heat.waitForSelector('.ledger');
    assert.equal(await heat.locator('.stamp-text').innerText(), i < 2 ? 'EVIDENCE LEAKED' : 'CASE DISMISSED');
    await heat.locator('.verdict-body .btn.primary').click();
    await heat.waitForSelector('.briefing, .rapsheet');
  }
  assert.equal(await heat.locator('.rapsheet').count(), 1, 'Four stars never busts a clean run');
  await heat.close();
  console.log('PASS production: heat jams toolkit tools but never the last covering tool; untouched warning asks once');
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
