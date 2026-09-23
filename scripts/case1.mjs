import { open, startCase, imageRect, toScreen, verdict } from './lib.mjs';
const { b, p } = await open();
await startCase(p);
await p.getByTestId('native-tool-stickers').click();
await p.waitForTimeout(1000);
await p.getByTestId('native-sticker-emoticons-agent').click();
await p.waitForTimeout(1000);
const c = await imageRect(p);
console.log('image rect on screen', JSON.stringify(c));
const [fx, fy] = toScreen(c, 442, 267);
const [sx, sy] = toScreen(c, 640, 360); // sticker drops at centre
await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(fx, fy, { steps: 12 }); await p.mouse.up();
await p.waitForTimeout(600);
await p.mouse.click(c.x + 20, c.y + c.h - 200 > 0 ? c.y + 60 : c.y + 10); // deselect
await p.waitForTimeout(400);
await p.screenshot({ path: 'scripts/y2-sticker-on-face.png' });
console.log('CASE 1 (sticker):', await verdict(p));
await p.screenshot({ path: 'scripts/y3-verdict1.png' });
await b.close();
