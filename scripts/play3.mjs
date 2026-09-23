import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
await p.goto('http://localhost:5199/');
await p.getByPlaceholder('Your fixer alias').fill('Tidy Tim');
await p.locator('.hero-actions .pill.solid').click({ timeout: 20000 });
for (let i = 0; i < 5; i++) {
  await p.getByText('Start doctoring').click();
  await p.waitForFunction(() => document.querySelector('.timer')?.textContent.includes(':'), null, { timeout: 30000 });
  if (i === 2) await p.screenshot({ path: 'scripts/s7-lab-bank.png' });
  await p.getByText('Send to evidence').click();
  await p.waitForSelector('.ledger', { timeout: 20000 });
  const head = await p.locator('.stamp-text').innerText();
  console.log('case', i + 1, head);
  const btn = p.locator('.verdict .btn.primary');
  const label = await btn.innerText();
  if (i === 2) await p.screenshot({ path: 'scripts/s8-verdict-bank.png' });
  await btn.click();
  if (!label.startsWith('Next')) break;
}
await p.waitForSelector('.poster', { timeout: 20000 });
await p.waitForTimeout(500);
await p.screenshot({ path: 'scripts/s9-rap.png', fullPage: true });
await b.close();
