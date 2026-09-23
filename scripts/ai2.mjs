import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => console.log('console', m.type(), m.text().slice(0, 200)));
p.on('response', async r => {
  const u = r.url();
  if (/unlayer/.test(u) && !/\.(js|css|woff2?|png|svg|json)(\?|$)/.test(u) || /api/.test(u) && /unlayer/.test(u)) {
    let body = ''; try { body = (await r.text()).slice(0, 400); } catch {}
    console.log('RESP', r.status(), u.slice(0, 140), '\n   ', body.replace(/\s+/g, ' '));
  }
});
await p.goto('http://localhost:5199/');
await p.getByText('Open the evidence locker').click({ timeout: 20000 });
await p.getByText('Start doctoring').click();
await p.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'), null, { timeout: 30000 });
await p.waitForTimeout(4000);
const txt = await p.locator('.editor-wrap').innerText();
console.log('EDITOR TEXT:', txt.replace(/\s+/g, ' ').slice(0, 300));
await b.close();
