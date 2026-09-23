import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
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
    await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5201');
    await page.waitForSelector('.ler-play button:not([disabled])');
    await page.locator('.ler-play button').click();
    await page.getByRole('button', { name: 'Start doctoring', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'), null, { timeout: 60000 });
    const canvas = page.locator('canvas.upper-canvas');
    const initial = (await canvas.boundingBox()).width;
    assert.equal(await page.getByRole('button', { name: /^(Save|Cancel)$/ }).count(), 0, 'Editor Save/Cancel stay hidden');
    await page.getByTestId('native-tool-draw').click();
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
    // Switching tools must make its options available again.
    await page.getByTestId('native-tool-shapes').click();
    await page.getByTestId('native-tool-options').waitFor({ state: 'visible' });
    assert.match(await page.getByTestId('native-tool-options-title').innerText(), /Shapes/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Tall panels scroll inside the workspace instead of stretching the canvas off screen.
    await page.getByTestId('native-tool-stickers').click();
    await page.getByTestId('native-tool-options-title').filter({ hasText: 'Stickers' }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), 'Stickers panel stretches the page');
    // A filter still open in its panel must reach the submitted image.
    await page.getByTestId('native-tool-filter').click();
    const beforeBlur = await page.evaluate(() => window.__editorUnderTest.getImage());
    await page.getByTestId('native-filter-blur').fill('100');
    if (width === 1000) await page.getByRole('button', { name: 'Full screen', exact: true }).click();
    await page.getByRole('button', { name: /Send to evidence/ }).click();
    await page.waitForSelector('.ledger');
    assert.notEqual(await page.locator('.verdict .evidence-photo img').getAttribute('src'), beforeBlur, 'Open filter panel reaches the submission');
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: canvas widths ${initial}/${panelOpen}/${panelClosed}; drawing while collapsed, brush retained, fullscreen without edit loss, tool switching, submission`);
    await page.close();
  }
} finally { await browser.close(); }
