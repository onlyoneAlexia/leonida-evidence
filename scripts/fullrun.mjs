import { open, startCase, imageRect, toScreen, targets, verdict } from './lib.mjs';
const { b, p } = await open();
const log = (...a) => console.log(...a);
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
async function scribble(p, c, r, pad = 6) {
  await p.getByTestId('native-tool-draw').click();
  await p.waitForTimeout(700);
  c = await imageRect(p);
  for (let y = r.y - pad; y <= r.y + r.h + pad; y += 6) {
    const [x0, yy] = toScreen(c, r.x - pad, y); const [x1] = toScreen(c, r.x + r.w + pad, y);
    await p.mouse.move(x0, yy); await p.mouse.down(); await p.mouse.move(x1, yy, { steps: 6 }); await p.mouse.up();
  }
}
async function dropSticker(p, id, c, r) {
  await p.getByTestId('native-tool-stickers').click();
  await p.waitForTimeout(700);
  await p.getByTestId(id).click();
  await p.waitForTimeout(800);
  const c2 = await imageRect(p);
  const [sx, sy] = toScreen(c2, 640, 360);
  const [tx, ty] = toScreen(c2, ...centre(r));
  await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(tx, ty, { steps: 12 }); await p.mouse.up();
  await p.waitForTimeout(400);
  return c2;
}
async function next(p) { await p.locator('.verdict .btn.primary').click(); await p.waitForTimeout(800); }

// Case 1: sticker
await startCase(p);
let t = await targets(p, 0);
await dropSticker(p, 'native-sticker-emoticons-agent', null, t[0].rect);
log('1 Kwik Mart (sticker):', await verdict(p)); await next(p);

// Case 2: shape rectangle over plate, draw over Lucia
await startCase(p);
t = await targets(p, 1);
await p.getByTestId('native-tool-shapes').click();
await p.waitForTimeout(800);
const shapeIds = await p.evaluate(() => [...document.querySelectorAll('[data-testid]')].map(e => e.dataset.testid).filter(x => /shape/.test(x)).slice(0, 12));
log('  shape testids:', shapeIds.join(' '));
const rectId = shapeIds.find(x => /rect|square/i.test(x) && /fill/i.test(x)) || shapeIds.find(x => /rect|square/i.test(x));
if (rectId) {
  await p.getByTestId(rectId).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'scripts/z2-shape.png' });
  const c = await imageRect(p);
  const plate = t.find(x => x.key === 'plate').rect;
  const [sx, sy] = toScreen(c, 640, 360);
  const [tx, ty] = toScreen(c, ...centre(plate));
  await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(tx, ty, { steps: 12 }); await p.mouse.up();
  await p.waitForTimeout(400);
}
let c = await imageRect(p);
await scribble(p, c, t.find(x => x.key === 'face').rect);
await p.screenshot({ path: 'scripts/z2-done.png' });
log('2 Causeway (shape+draw):', await verdict(p));
await p.screenshot({ path: 'scripts/z2-verdict.png' }); await next(p);

// Case 3: draw both, leave Rico
await startCase(p);
t = await targets(p, 2);
c = await imageRect(p);
await scribble(p, c, t.find(x => x.key === 'jface').rect);
await scribble(p, c, t.find(x => x.key === 'tattoo').rect, 4);
log('3 Bank (draw):', await verdict(p)); await next(p);

// Case 4: stickers on bag and reg
await startCase(p);
t = await targets(p, 3);
await dropSticker(p, 'native-sticker-emoticons-agent', null, t.find(x => x.key === 'bag').rect);
await p.screenshot({ path: 'scripts/z4-bag.png' });
c = await imageRect(p);
await scribble(p, c, t.find(x => x.key === 'reg').rect);
log('4 Marina (sticker+draw):', await verdict(p));
await p.screenshot({ path: 'scripts/z4-verdict.png' }); await next(p);

// Case 5: draw everything, then let the clock run out
await startCase(p);
t = await targets(p, 4);
c = await imageRect(p);
for (const k of ['jface', 'lface', 'plate']) await scribble(p, c, t.find(x => x.key === k).rect);
log('  waiting for the timer to expire…');
await p.waitForSelector('.ledger', { timeout: 100000 });
await p.waitForTimeout(3500);
log('5 Diamond Mile (timeout):', await p.locator('.stamp-text').innerText(), '::', (await p.locator('.verdict .objectives').innerText()).replace(/\n/g, ' | '), '::', (await p.locator('.note').allInnerTexts()).join(' '));
await p.screenshot({ path: 'scripts/z5-verdict.png' });
await next(p);
await p.waitForSelector('.poster', { timeout: 20000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'scripts/z6-rap.png', fullPage: true });
log('rap:', (await p.locator('.rap-inner .lede').innerText()));
await b.close();
