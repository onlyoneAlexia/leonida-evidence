import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const LABELS=['Cut','Tint','Spray','Caption','Blocks','Cover-ups'];
const hud=page=>page.locator('.hud').getByRole('button',{name:/Send to evidence/});
// Untouched stills ask once before they go in, unless every HIDE is already out of sight.
async function sendAnyway(page) {
 if(!await page.locator('.lab-side .objectives li.hide:not(.gone)').count()) return;
 await page.locator('dialog[open]').getByRole('heading',{name:'Send it untouched?'}).waitFor();
 await page.getByRole('button',{name:'Send it anyway',exact:true}).click();
}
// The live rail is this job's toolkit minus heat jams, with the custom icons; Save and Cancel carry the fiction labels.
async function checkEditor(page) {
 const rail=(await page.getByTestId('native-tool-nav').locator('button').allInnerTexts()).map(s=>s.trim()).sort();
 const kit=await page.locator('.lab-side .toolkit-tools li').evaluateAll(els=>els.map(li=>({tool:li.textContent.replace(/ jammed$/,''),jammed:li.classList.contains('jammed')})));
 if(kit.length) assert.deepEqual(rail,kit.filter(t=>!t.jammed).map(t=>t.tool).sort(),'Live rail matches the job toolkit');
 assert.ok(rail.length && rail.every(t=>LABELS.includes(t)),`Live rail labels: ${rail}`);
 assert.equal(await page.getByTestId('native-tool-nav').locator('svg.ler-tool-icon').count(),rail.length,'Custom icons render in the live rail');
 assert.deepEqual(await page.locator('.editor-wrap button:not([data-testid])').evaluateAll(els=>els.map(b=>b.textContent.trim()).filter(Boolean)),['Reset tape','Send to evidence']);
 return rail;
}
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
  await page.locator('.brief-side').getByRole('button',{name:'Roll tape',exact:true}).click();
  await page.getByRole('button',{name:/Freeze frame/}).click();
  await page.waitForFunction(()=>document.querySelector('.lab .timer')?.textContent.includes(':'),null,{timeout:90000});
  assert.ok(await page.locator('.editor-wrap canvas').count()>0, 'Live editor canvas');
  const rail=await checkEditor(page);
  const heat=await page.locator('.lab-side .heat-chips').evaluateAll(els=>els[0]?.textContent ?? 'no heat');
  if(i===0) {
   await page.screenshot({path:'scripts/release-live-editor.png'});
   // The Home dialog opens above the real editor, and Keep playing leaves the edit untouched.
   await page.getByRole('button',{name:'Home',exact:true}).click();
   assert.ok(await page.getByRole('button',{name:'Go to the homepage',exact:true}).isVisible(),'Home dialog over the live editor');
   await page.getByRole('button',{name:'Keep playing',exact:true}).click();
   assert.ok(await page.locator('.editor-wrap canvas').count()>0,'Editor survives Keep playing');
  }
  // Case 2 goes in through the editor's own Save, which reaches onSave and the same hand-in.
  if(i===1) await page.locator('.editor-wrap').getByRole('button',{name:'Send to evidence',exact:true}).click();
  else await hud(page).click();
  await sendAnyway(page);
  await page.waitForSelector('.ledger',{timeout:30000});
  console.log(`Live case ${i+1} (${rail.join(', ')}; ${heat}):`,await page.locator('.stamp-text').innerText());
  if(i===2) assert.equal(await page.locator('.busted-stamp').innerText(),'BUSTED','Bust is stamped across the still');
  await page.locator('.verdict-body .btn.primary').click();
 }
 await page.waitForSelector('.poster',{timeout:20000});
 const download=page.waitForEvent('download');
 await page.getByRole('link',{name:'Download poster',exact:true}).click();
 assert.equal((await download).suggestedFilename(),'leonida-rap-sheet.png');
 await page.getByRole('button',{name:'Run it back',exact:true}).click();
 assert.match(await page.locator('.case-no').innerText(),/CASE 1/);
 console.log('PASS live CDN: real editor, toolkit rails, custom labels and icons, untouched warning, editor Save hand-in, busted ending, poster download, replay');
 await page.close();
 const mobile=await browser.newPage({viewport:{width:390,height:844}});
 await mobile.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5201/');
 await mobile.waitForSelector('.ler-play button:not([disabled])');
 await mobile.locator('.ler-play button').click();
 await mobile.locator('.brief-side').getByRole('button',{name:'Roll tape',exact:true}).click();
 await mobile.getByRole('button',{name:/Freeze frame/}).click();
 await mobile.waitForFunction(()=>document.querySelector('.lab .timer')?.textContent.includes(':'),null,{timeout:90000});
 assert.ok(await mobile.locator('.editor-wrap canvas').count()>0);
 await checkEditor(mobile);
 assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Live mobile editor overflows');
 await mobile.screenshot({path:'scripts/release-live-mobile.png'});
 await hud(mobile).click();
 await sendAnyway(mobile);
 await mobile.waitForSelector('.ledger',{timeout:30000});
 await mobile.getByRole('button',{name:'Home',exact:true}).click();
 await mobile.getByRole('button',{name:'Go to the homepage',exact:true}).click();
 await mobile.waitForSelector('.ler-home');
 assert.equal(await mobile.evaluate(()=>scrollY),0,'Home opens the landing page at the top');
 console.log('PASS live CDN: mobile editor, layout, submission, verdict and Home');
} finally { await browser.close(); }
