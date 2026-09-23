import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage();
  mkdirSync('public/art', { recursive: true });
  for (const name of ['crew-sprites-v2', 'leonida-crew-v2', 'evidence-studio-v2']) {
    const source = readFileSync(`artwork/source/${name}.png`);
    const result = await page.evaluate(async (data) => {
      const image = new Image(); image.src = data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', 0.94);
    }, `data:image/png;base64,${source.toString('base64')}`);
    if (!result.startsWith('data:image/webp;')) throw new Error('WebP export unsupported');
    const output = Buffer.from(result.split(',')[1], 'base64');
    writeFileSync(`public/art/${name}.webp`, output);
    console.log(`${name}: ${Math.round(source.length / 1024)} KB -> ${Math.round(output.length / 1024)} KB`);
  }
} finally { await browser.close(); }
