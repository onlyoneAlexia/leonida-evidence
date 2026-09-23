import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
await p.goto('http://localhost:5199/');
await p.locator('.hero-actions .pill.solid').click({ timeout: 20000 });
await p.getByText('Start doctoring').click();
await p.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'), null, { timeout: 30000 });
await p.waitForTimeout(1500);
// find the displayed image canvas (largest canvas in the editor)
const box = await p.evaluate(() => {
  const cs = [...document.querySelectorAll('.editor-wrap canvas')].map(c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cw: c.width, ch: c.height }; });
  return cs;
});
console.log('canvases', JSON.stringify(box));
await p.getByTestId('native-tool-draw').click();
await p.waitForTimeout(800);
await p.screenshot({ path: 'scripts/s4-draw.png' });
const c = await p.evaluate(() => {
  const cv = [...document.querySelectorAll('.editor-wrap canvas')][0];
  const r = cv.getBoundingClientRect();
  const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const bg = [d[0], d[1], d[2]];
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) { const i = (y * cv.width + x) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i+1] - bg[1]) + Math.abs(d[i+2] - bg[2]) > 30) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  const sx = r.width / cv.width, sy = r.height / cv.height;
  return { x: r.x + x0 * sx, y: r.y + y0 * sy, w: (x1 - x0) * sx, h: (y1 - y0) * sy };
});
console.log('image rect', c);
// face rect case1 approx: from scenes (x=430,y=640,s=1.25) head at y=277.5 → face box 382..478, 220..335
const toScreen = (x, y) => [c.x + (x / 1280) * c.w, c.y + (y / 720) * c.h];
for (let y = 215; y <= 340; y += 8) {
  const [x0, yy] = toScreen(375, y); const [x1] = toScreen(485, y);
  await p.mouse.move(x0, yy); await p.mouse.down(); await p.mouse.move(x1, yy, { steps: 8 }); await p.mouse.up();
}
await p.waitForTimeout(500);
await p.screenshot({ path: 'scripts/s5-drawn.png' });
await p.getByText('Send to evidence').click();
await p.waitForSelector('.ledger', { timeout: 20000 });
await p.waitForTimeout(300);
await p.screenshot({ path: 'scripts/s6-verdict.png' });
console.log(await p.locator('.objectives').last().innerText());
await b.close();
