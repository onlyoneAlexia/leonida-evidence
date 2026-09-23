import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 page.on('requestfailed',r=>console.log('FAILED',r.url().split('?')[0],r.failure()?.errorText));
 await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5201/');
 await page.waitForSelector('.ler-play button:not([disabled])');
 await page.locator('#fixer-alias').fill('Release Check');
 await page.locator('.ler-play button').click();
 for(let i=0;i<3;i++) {
  await page.getByRole('button',{name:'Start doctoring',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.timer')?.textContent.includes(':'),null,{timeout:90000});
  assert.ok(await page.locator('.editor-wrap canvas').count()>0, 'Live editor canvas');
  if(i===0) await page.screenshot({path:'scripts/release-live-editor.png'});
  await page.getByRole('button',{name:/Send to evidence/}).click();
  await page.waitForSelector('.ledger',{timeout:30000});
  console.log(`Live case ${i+1}:`,await page.locator('.stamp-text').innerText());
  if(i===2) assert.equal(await page.locator('.busted-stamp').innerText(),'BUSTED','Bust is stamped across the still');
  await page.locator('.verdict .btn.primary').click();
 }
 await page.waitForSelector('.poster',{timeout:20000});
 const download=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download poster',exact:true}).click();
 assert.equal((await download).suggestedFilename(),'leonida-rap-sheet.png');
 await page.getByRole('button',{name:'Run it back',exact:true}).click();
 assert.match(await page.locator('.case-no').innerText(),/CASE 1/);
 console.log('PASS live CDN: real editor, three cases, busted ending, poster download, replay');
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 await mobile.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5201/');
 await mobile.waitForSelector('.ler-play button:not([disabled])');
 await mobile.locator('.ler-play button').click();
 await mobile.getByRole('button',{name:'Start doctoring',exact:true}).click();
 await mobile.waitForFunction(()=>document.querySelector('.timer')?.textContent.includes(':'),null,{timeout:90000});
 assert.ok(await mobile.locator('.editor-wrap canvas').count()>0);
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live mobile editor overflows');
 await mobile.screenshot({path:'scripts/release-live-mobile.png'});
 await mobile.getByRole('button',{name:/Send to evidence/}).click();
 await mobile.waitForSelector('.ledger',{timeout:30000});
 console.log('PASS live CDN: mobile editor, layout, submission and verdict');
} finally { await browser.close(); }
