import { chromium } from 'playwright-core';
export async function open() {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 160)); });
  await p.goto('http://localhost:5199/');
  await p.waitForTimeout(1500);
  await p.getByPlaceholder('Your fixer alias').fill('Timi');
  await p.getByRole('button', { name: /START THE FIRST JOB/ }).click();
  return { b, p };
}
export async function startCase(p) {
  await p.getByText('Start doctoring').click();
  await p.waitForFunction(() => /\d:\d\d/.test(document.querySelector('.timer')?.textContent || ''), null, { timeout: 40000 });
  await p.waitForTimeout(600);
}
// On-screen rect of the tape inside the editor stage canvas.
export async function imageRect(p) {
  return p.evaluate(() => {
    const cv = [...document.querySelectorAll('.editor-wrap canvas')][0];
    const r = cv.getBoundingClientRect();
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const bg = [d[0], d[1], d[2]];
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
      const i = (y * cv.width + x) * 4;
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    const sx = r.width / cv.width, sy = r.height / cv.height;
    return { x: r.x + x0 * sx, y: r.y + y0 * sy, w: (x1 - x0) * sx, h: (y1 - y0) * sy };
  });
}
export const toScreen = (c, x, y) => [c.x + (x / 1280) * c.w, c.y + (y / 720) * c.h];
export async function targets(p, i) {
  return p.evaluate(async (i) => {
    const { CASES, renderCase } = await import('/src/scenes.js');
    return renderCase(CASES[i], i).targets;
  }, i);
}
export async function verdict(p) {
  await p.getByText('Send to evidence').click();
  await p.waitForSelector('.ledger', { timeout: 20000 });
  await p.waitForTimeout(3500);
  const head = await p.locator('.stamp-text').innerText();
  const obj = (await p.locator('.verdict .objectives').innerText()).replace(/\n/g, ' | ');
  return `${head} :: ${obj}`;
}
