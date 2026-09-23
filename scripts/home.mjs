import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errors = [];
try {
  for (const { width, reduced } of [{ width: 1440 }, { width: 768 }, { width: 390 }, { width: 320 }, { width: 390, reduced: true }]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/');
    await page.waitForSelector('.ler-play button:not([disabled])');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.ler-hero-art').evaluate(img => img.decode());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`);
    assert.equal(await page.locator('.ler-tape').count(), 5);
    assert.match(await page.locator('.ler-hero-art').evaluate(img => img.currentSrc), /leonida-crew-v2\.webp/);
    const powered = page.getByRole('link', { name: 'POWERED BY Unlayer', exact: true });
    await powered.locator('img').evaluate(img => img.decode());
    assert.equal(await powered.getAttribute('href'), 'https://unlayer.com/');
    assert.ok(await powered.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), `Unlayer badge in first view at ${width}px`);
    await page.screenshot({ path: `scripts/ler-hero-${width}${reduced ? '-reduced' : ''}.png` });
    if (!reduced) {
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.ler-film').offsetHeight - document.querySelector('.ler-stage').clientHeight));
      await page.waitForFunction(() => Number(document.querySelector('.ler-stage').style.getPropertyValue('--zoom')) > .99);
      assert.equal(await page.locator('.ler-screen').evaluate(e => e.inert), true);
      const screen = await page.locator('.ler-screen').boundingBox();
      assert.ok(screen.width < width * .8, 'Opening scene shrinks into monitor');
      await page.screenshot({ path: `scripts/ler-transition-${width}.png` });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => !document.querySelector('.ler-screen').inert);
    } else {
      assert.equal(await page.locator('.ler-screen').evaluate(e => getComputedStyle(e).transform), 'none');
    }
    await page.getByRole('link', { name: 'THE EVIDENCE', exact: true }).click();
    assert.equal(new URL(page.url()).hash, '#evidence');
    await page.locator('#evidence-wipe').fill('80');
    assert.match(await page.locator('.ler-redaction-layer').getAttribute('style'), /20%/);
    await page.getByRole('button', { name: 'SHOW ORIGINAL', exact: true }).click();
    assert.equal(await page.locator('.ler-redaction-layer').count(), 0);
    await page.getByRole('button', { name: 'SHOW THE COVER-UP', exact: true }).click();
    assert.equal(await page.locator('.ler-redaction-layer').count(), 1);
    for (let i = 0; i < 5; i++) {
      await page.locator('.ler-tape').nth(i).click();
      assert.equal(await page.locator('.ler-tape').nth(i).getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('.ler-case-info').innerText(), new RegExp(`FILE 0${i + 1}`));
    }
    await page.getByRole('link', { name: 'INSPECT TAPE', exact: true }).click();
    assert.match(await page.locator('.ler-demo-header').innerText(), /TAPE 05/);
    await page.getByRole('link', { name: /PLAY NOW/ }).click();
    await page.getByLabel('WHAT DO WE CALL YOU?', { exact: false }).fill('Nightshift');
    if (width === 1440) await page.locator('#fixer-alias').press('Enter');
    else await page.getByRole('button', { name: 'START THE FIRST JOB', exact: true }).click();
    await page.waitForSelector('.briefing');
    assert.match(await page.locator('.briefing h2').innerText(), /Kwik Mart/);
    console.log(`PASS ${width}px${reduced ? ' reduced motion' : ''}: responsive layout, scroll transition, evidence slider, case previews, navigation, alias, start`);
    await page.close();
  }
  // React renders the sections after the browser's anchor jump, so a deep link needs the app's help.
  const deep = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  deep.on('pageerror', error => errors.push(error.message));
  await deep.goto(new URL('#play', process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/').href);
  await deep.waitForSelector('.ler-play button:not([disabled])');
  const form = await deep.locator('.ler-play form').evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  assert.ok(form.top > 0 && form.bottom <= 900, `/#play shows the start form (form at ${Math.round(form.top)}-${Math.round(form.bottom)}px)`);
  assert.match(await deep.locator('.ler-nav').getAttribute('class'), /is-scrolled/);
  await deep.close();
  console.log('PASS deep link: /#play opens on the start form under a solid nav');
  assert.deepEqual(errors, [], 'Browser runtime errors');
} finally { await browser.close(); }
