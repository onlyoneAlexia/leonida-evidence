import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/');
  await page.waitForSelector('.ler-tape-image img');
  const results = await page.evaluate(async () => {
    const { CASES, ensureFonts, renderCase } = await import('/src/scenes.js');
    const { analyse } = await import('/src/forensics.js');
    const { loadAvatarArt } = await import('/src/avatars.js');
    await ensureFonts();
    if (!await loadAvatarArt()) throw new Error('Avatar atlas failed to load');
    const results = [];
    for (let i = 0; i < CASES.length; i++) {
      const scene = renderCase(CASES[i], i);
      const unchanged = await analyse(scene.canvas, scene.dataUrl, scene.targets);
      const edit = document.createElement('canvas');
      edit.width = scene.canvas.width; edit.height = scene.canvas.height;
      const g = edit.getContext('2d');
      g.drawImage(scene.canvas, 0, 0);
      g.fillStyle = '#181020';
      for (const target of scene.targets.filter(t => t.kind === 'hide')) {
        const r = target.rect;
        g.fillRect(r.x, r.y, r.w, r.h);
      }
      const covered = await analyse(scene.canvas, edit.toDataURL(), scene.targets);
      for (const target of scene.targets.filter(t => t.kind === 'keep')) {
        const r = target.rect;
        g.fillRect(r.x, r.y, r.w, r.h);
      }
      const tampered = await analyse(scene.canvas, edit.toDataURL(), scene.targets);
      g.drawImage(scene.canvas, 0, 0);
      for (const t of scene.targets) {
        const r = t.rect;
        g.strokeStyle = t.kind === 'hide' ? '#ff4060' : '#29e7ff';
        g.lineWidth = 2; g.strokeRect(r.x,r.y,r.w,r.h);
        g.fillStyle = g.strokeStyle; g.font = 'bold 13px monospace';
        g.fillText(t.label,r.x,r.y-5);
      }
      results.push({ id: CASES[i].id, image: edit.toDataURL(), targets: scene.targets,
        unchanged: unchanged.results.map(t=>({kind:t.kind,pass:t.pass})),
        covered: covered.results.map(t=>({key:t.key,pass:t.pass,changed:t.changed})),
        tampered: tampered.results.filter(t=>t.kind==='keep').map(t=>({key:t.key,pass:t.pass})) });
    }
    return results;
  });
  for (const r of results) {
    writeFileSync(`scripts/avatars-${r.id}.png`, Buffer.from(r.image.split(',')[1], 'base64'));
    assert.ok(r.targets.every(t => t.rect.w > 0 && t.rect.h > 0 && t.rect.x >= 0 && t.rect.y >= 0 && t.rect.x+t.rect.w<=1280 && t.rect.y+t.rect.h<=720), `${r.id}: invalid target bounds`);
    assert.ok(r.unchanged.every(t => t.pass === (t.kind === 'keep')), `${r.id}: untouched evidence verdict`);
    assert.ok(r.covered.every(t => t.pass), `${r.id}: covered hide targets / preserved keep targets ${JSON.stringify(r.covered)}`);
    assert.ok(r.tampered.every(t => !t.pass), `${r.id}: tampered keep targets must fail`);
    console.log(`PASS ${r.id}: illustrated scene, target bounds, untouched/covered/tampered forensic verdicts`);
  }

  // The live tape: what is evidence depends on the frame the player freezes.
  const live = await page.evaluate(async () => {
    const { CASES, renderCase, stampTime } = await import('/src/scenes.js');
    const at = (i, t) => {
      const s = renderCase(CASES[i], i, t);
      return { in: s.targets.map(x => x.key), gone: s.gone.map(x => x.key), missing: s.missing.map(x => x.key), surprise: s.surprise?.key ?? null };
    };
    // When the truck covers both the plate and Lucia on the causeway.
    let blocked = null;
    for (let t = 4.6; t < 8.4 && !blocked; t += 0.05) {
      const f = at(1, t);
      if (!f.in.some(k => k !== 'stamp')) blocked = { t: Math.round(t * 100) / 100, ...f };
    }
    return {
      kwikEarly: at(0, 0.3), kwikMid: at(0, 4),
      bankEarly: at(2, 0.5), bankLate: at(2, 11.5),
      marinaEarly: at(3, 0.5), marinaLate: at(3, 11.5),
      causewayBlocked: blocked,
      stamp: [stampTime(CASES[0], 0), stampTime(CASES[0], 11.9)],
    };
  });
  assert.deepEqual(live.kwikEarly.gone, ['face'], 'Jason is still inside the store at the start');
  assert.ok(live.kwikMid.in.includes('face') && live.kwikMid.in.includes('plate'));
  assert.deepEqual(live.bankEarly.missing, ['rico'], 'Rico has not walked in yet');
  assert.ok(live.bankLate.in.includes('rico') && !live.bankLate.missing.length);
  assert.deepEqual(live.marinaEarly.missing, ['ricoBoat'], "Rico's yacht is not in the shot yet");
  assert.ok(live.marinaLate.in.includes('ricoBoat'));
  assert.ok(live.causewayBlocked, 'The truck can cover the plate and Lucia at the same moment');
  assert.deepEqual(live.causewayBlocked.gone.sort(), ['face', 'plate']);
  assert.equal(live.causewayBlocked.surprise, null, 'Evidence hidden behind the truck cannot surprise you either');
  assert.deepEqual(live.stamp, ['02:13:44', '02:13:55'], 'The burned-in clock runs with the tape');
  console.log(`PASS live tape: out-of-sight evidence, must-show KEEPs, truck window at ${live.causewayBlocked.t}s, running timestamp`);
} finally { await browser.close(); }
