import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const LABELS = ['Cut', 'Tint', 'Spray', 'Caption', 'Blocks', 'Cover-ups'];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  for (const width of [1440, 1000, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let sdk;
      Object.defineProperty(window, 'ImageEditor', {
        configurable: true,
        get: () => sdk,
        set: value => {
          sdk = value;
          const create = value.createEditor.bind(value);
          value.createEditor = async (...args) => {
            const editor = await create(...args);
            window.__editorUnderTest = editor;
            return editor;
          };
        },
      });
    });
    // Every tool is exercised on the first tape, so its toolkit is widened to the full kit (the later jobs keep theirs).
    let widened = false;
    await page.route(/\/(assets\/index-[^/]*|src\/scenes)\.js(\?.*)?$/, async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/toolkit:\s*\{\s*tools:\s*\[[^\]]*\]/, () => { widened = true; return 'toolkit:{tools:["crop","filter","draw","text","shapes","stickers"]'; });
      await route.fulfill({ response, body });
    });
    await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5201');
    await page.waitForSelector('.ler-play button:not([disabled])');
    await page.locator('.ler-play button').click();
    await page.locator('.brief-side').getByRole('button', { name: 'Roll tape', exact: true }).click();
    await page.getByRole('button', { name: /Freeze frame/ }).click();
    await page.waitForFunction(() => document.querySelector('.lab .timer')?.textContent.includes(':'), null, { timeout: 60000 });
    assert.ok(widened, "The first job's toolkit was widened for this suite");
    const canvas = page.locator('canvas.upper-canvas');
    const initial = (await canvas.boundingBox()).width;
    // The game-styled editor: fiction labels and custom icons on the rail, and Save/Cancel relabelled through translations.
    // Below 640px the editor shows Save and Cancel as icons, so their labels are read from the DOM.
    const rail = page.getByTestId('native-tool-nav');
    assert.deepEqual((await rail.locator('button').allInnerTexts()).map(s => s.trim()).sort(), [...LABELS].sort());
    assert.equal(await rail.locator('svg.ler-tool-icon').count(), LABELS.length, 'Custom tool icons render');
    const toolbar = page.locator('.editor-wrap button:not([data-testid])');
    assert.deepEqual(await toolbar.evaluateAll(els => els.map(b => b.textContent.trim()).filter(Boolean)), ['Reset tape', 'Send to evidence']);
    const nativeButton = name => toolbar.filter({ hasText: name });
    await page.getByTestId('native-tool-draw').click();
    assert.match(await page.getByTestId('native-tool-options-title').innerText(), /Spray/);
    await page.getByTestId('native-draw-size').fill('45');
    await page.waitForTimeout(350);
    const panelOpen = (await canvas.boundingBox()).width;
    if (width <= 1000) assert.ok(panelOpen >= initial - 2, 'Opening Draw must not shrink narrow canvas');
    await page.getByRole('button', { name: 'Hide tool settings', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await page.getByTestId('native-tool-options').isVisible(), false);
    const panelClosed = (await canvas.boundingBox()).width;
    assert.ok(panelClosed >= initial - 2);
    // A stroke on the expanded canvas must be included in the actual SDK export.
    const before = await page.evaluate(() => window.__editorUnderTest.getImage());
    assert.equal(await page.evaluate(() => window.__editorUnderTest.hasChanges()), true, 'An open tool counts as a change');
    const r = await canvas.boundingBox();
    await page.mouse.move(r.x + r.width * .42, r.y + r.height * .5);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * .58, r.y + r.height * .5, { steps: 15 });
    await page.mouse.up();
    const painted = await page.evaluate(() => window.__editorUnderTest.getImage());
    assert.notEqual(painted, before, 'Draw remains active with settings hidden');
    await page.getByRole('button', { name: 'Show tool settings', exact: true }).click();
    assert.equal(await page.getByTestId('native-draw-size').inputValue(), '45');
    await page.getByRole('button', { name: 'Hide tool settings', exact: true }).click();
    await page.getByRole('button', { name: 'Full screen', exact: true }).click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#lab-orders').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__editorUnderTest.getImage()), painted, 'Expanding preserves edits');
    await page.screenshot({ path: `scripts/workspace-${width}.png` });
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__editorUnderTest.getImage()), painted, 'Exiting preserves edits');
    // Reset tape (the editor's Cancel) asks first, and Keep my edits keeps them.
    await nativeButton('Reset tape').click();
    await page.locator('dialog[open]').getByRole('heading', { name: 'Reset the tape?' }).waitFor();
    await page.getByRole('button', { name: 'Keep my edits', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__editorUnderTest.getImage()), painted, 'Keep my edits leaves the stroke');
    // Switching tools must make its options available again.
    await page.getByTestId('native-tool-shapes').click();
    await page.getByTestId('native-tool-options').waitFor({ state: 'visible' });
    assert.match(await page.getByTestId('native-tool-options-title').innerText(), /Blocks/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Tall panels scroll inside the workspace instead of stretching the canvas off screen.
    await page.getByTestId('native-tool-stickers').click();
    await page.getByTestId('native-tool-options-title').filter({ hasText: 'Cover-ups' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'Stickers panel stretches the page');
    // A filter still open in its panel must reach the submitted image, whichever button hands it in.
    await page.getByTestId('native-tool-filter').click();
    const beforeBlur = await page.evaluate(() => window.__editorUnderTest.getImage());
    await page.getByTestId('native-filter-blur').fill('100');
    let via;
    if (width === 1440) {
      // A failed export keeps the editor and the edits mounted, pauses the clock, and the retry sends them.
      via = 'Send to evidence after a failed export';
      await page.evaluate(() => {
        const editor = window.__editorUnderTest, getImage = editor.getImage;
        editor.getImage = () => { editor.getImage = getImage; throw new Error('Simulated export failure'); };
      });
      await page.locator('.hud').getByRole('button', { name: /Send to evidence/ }).click();
      await page.getByRole('button', { name: 'Try sending again', exact: true }).waitFor();
      assert.match(await page.locator('.editor-status[role=alert]').innerText(), /didn't make it to evidence/);
      const pausedAt = await page.locator('.timer').innerText();
      await page.waitForTimeout(1300);
      assert.equal(await page.locator('.timer').innerText(), pausedAt, 'Clock paused while the export fails');
      assert.ok(await canvas.isVisible(), 'The editor stays mounted behind the retry');
      assert.notEqual(await page.evaluate(() => window.__editorUnderTest.getImage()), beforeBlur, 'The blur is still in the editor');
      await page.getByRole('button', { name: 'Try sending again', exact: true }).click();
    } else if (width === 1000) {
      // The editor's own Save applies the open filter itself before calling onSave.
      via = 'the editor Save';
      await page.getByRole('button', { name: 'Full screen', exact: true }).click();
      await page.locator('.editor-wrap').getByRole('button', { name: 'Send to evidence', exact: true }).click();
    } else {
      via = 'Send to evidence';
      await page.locator('.hud').getByRole('button', { name: /Send to evidence/ }).click();
    }
    await page.waitForSelector('.ledger');
    assert.notEqual(await page.locator('.verdict .evidence-photo > img:not(.verdict-original)').getAttribute('src'), beforeBlur, 'Open filter panel reaches the submission');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: canvas widths ${initial}/${panelOpen}/${panelClosed}; labels and icons, drawing while collapsed, brush retained, fullscreen without edit loss, Reset tape confirm, tool switching, open filter handed in via ${via}`);
    await page.close();
  }
} finally { await browser.close(); }
