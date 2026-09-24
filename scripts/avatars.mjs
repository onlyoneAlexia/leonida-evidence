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

  // Animation strips: every frame's face box sits on the head it was measured from, and follows it through the cycle.
  const strips = await page.evaluate(async () => {
    const { ART } = await import('/src/art-manifest.js');
    const out = {};
    for (const [name, a] of Object.entries(ART).filter(([, a]) => a.frames)) {
      const im = new Image(); im.src = `/art/scenes/${name}.webp`; await im.decode();
      const c = Object.assign(document.createElement('canvas'), { width: im.width, height: im.height });
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const cover = (i, [x, y, w, h]) => {
        const d = g.getImageData(Math.round(i * a.w + x * a.w), Math.round(y * a.h), Math.max(1, Math.round(w * a.w)), Math.max(1, Math.round(h * a.h))).data;
        let on = 0; for (let k = 3; k < d.length; k += 4) if (d[k] > 128) on++;
        return on / (d.length / 4);
      };
      out[name] = { ...a, width: im.width, cover: a.face.map((f, i) => cover(i, f)) };
    }
    return out;
  });
  for (const [name, a] of Object.entries(strips)) {
    assert.equal(a.width, a.w * a.frames, `${name}: strip holds ${a.frames} frames`);
    assert.ok(a.face.length === a.frames && a.body.length === a.frames, `${name}: a face and body box per frame`);
    a.face.forEach(([x, y, w, h], i) => {
      const [bx, , bw] = a.body[i];
      assert.ok(y >= 0 && y + h < 0.3 && x >= 0 && x + w <= 1, `${name} frame ${i}: face box in the head region`);
      assert.ok(x + w / 2 > bx - 0.05 && x + w / 2 < bx + bw + 0.05, `${name} frame ${i}: face above the body`);
      assert.ok(a.cover[i] > 0.6, `${name} frame ${i}: face box covers the head (${a.cover[i].toFixed(2)})`);
    });
    if (a.stride) {
      assert.ok(new Set(a.face.map(f => f[1])).size >= 3, `${name}: face boxes follow the head's bob through the cycle`);
      assert.ok(a.face.every(f => f[0] + f[2] > 0.5), `${name}: in profile the face is at the front of the head`);
      assert.ok(a.rest >= 0 && a.rest < a.frames && a.feet > 0.9, `${name}: rest frame and baseline`);
    }
  }
  console.log(`PASS animation strips: ${Object.keys(strips).join(', ')}`);

  // In the tapes, walking, running, turning and stretching faces stay boxed: the box holds the drawn face, not the backdrop.
  const faces = await page.evaluate(async () => {
    const { CASES } = await import('/src/scenes.js');
    const bgs = ['bg-kwik', 'bg-causeway', 'bg-bank', 'bg-marina', 'bg-jewelry'];
    const scene = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const plain = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
    const sg = scene.getContext('2d', { willReadFrequently: true }), pg = plain.getContext('2d', { willReadFrequently: true });
    // Jewelry samples fall between alarm strobes, when neither beacon is lit.
    const samples = [[0, 1.4, 'face'], [0, 2.1, 'face'], [0, 3.0, 'face'], [0, 4.2, 'face'], [0, 6.6, 'face'], [0, 9.5, 'face'],
      [1, 2.6, 'face'], [1, 6.5, 'face'], [1, 7.6, 'face'], [1, 10.4, 'face'], [2, 1.0, 'jface'], [2, 4.2, 'rico'], [2, 10.5, 'rico'],
      [4, 5.9375, 'lface'], [4, 6.5625, 'jface'], [4, 6.5625, 'rico'], [4, 3.125, 'tourist'], [4, 10.3125, 'lface']];
    const out = [];
    for (const [i, t, key] of samples) {
      const bg = new Image(); bg.src = `/art/scenes/${bgs[i]}.webp`; await bg.decode();
      pg.drawImage(bg, 0, 0, 1280, 720);
      const r = CASES[i].draw(sg, t).rects[key]?.rect;
      if (!r) { out.push({ i, t, key, share: 0 }); continue; }
      const box = [Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h))];
      const a = sg.getImageData(...box).data, b = pg.getImageData(...box).data;
      let diff = 0;
      for (let k = 0; k < a.length; k += 4) if (Math.max(Math.abs(a[k] - b[k]), Math.abs(a[k + 1] - b[k + 1]), Math.abs(a[k + 2] - b[k + 2])) > 40) diff++;
      out.push({ i, t, key, share: diff / (a.length / 4) });
    }
    return out;
  });
  for (const f of faces) assert.ok(f.share > 0.5, `${f.key} at ${f.t}s in tape ${f.i + 1}: the face box holds the drawn face (${f.share.toFixed(2)})`);
  console.log(`PASS face boxes follow walks, runs, turns and the stretch (${faces.length} samples, min ${Math.min(...faces.map(f => f.share)).toFixed(2)})`);

  // Timing windows: short mid-clip moments pay, waiting for the end does not, and new traffic and flashes add no long free windows.
  const windows = await page.evaluate(async () => {
    const { CASES, drawLive } = await import('/src/scenes.js');
    const g = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 }).getContext('2d');
    const out = {};
    for (const c of CASES) {
      const rows = [];
      for (let t = 0; t <= c.clip + 1e-6; t += 0.02) {
        const f = drawLive(g, c, t);
        const hides = f.all.filter(a => a.kind === 'hide');
        rows.push({ t, fx: f.fx, clear: hides.every(a => !a.inShot), ok: !f.missing.length, in: f.all.filter(a => a.inShot).map(a => a.key) });
      }
      const spans = pick => {
        const list = [];
        rows.forEach((r, k) => {
          if (!pick(r)) return;
          if (k && pick(rows[k - 1])) list[list.length - 1][1] = r.t;
          else list.push([r.t, r.t]);
        });
        return list;
      };
      out[c.id] = {
        free: spans(r => r.clear), paying: spans(r => r.clear && r.ok), faceOut: spans(r => !r.in.includes('face') && r.in.includes('plate')),
        end: rows[rows.length - 1].in, cues: c.cues, clip: c.clip,
        shake: Math.max(...rows.map(r => r.fx.shake)), flash: Math.max(...rows.map(r => r.fx.flash)),
        fxOk: rows.every(r => r.fx.shake >= 0 && r.fx.shake <= 1 && r.fx.flash >= 0 && r.fx.flash <= 1),
        touristFlash: rows.find(r => Math.abs(r.t - 2.24) < 0.011)?.in.includes('tourist'),
      };
    }
    return out;
  });
  const len = ([a, b]) => b - a;
  const kwikPillar = windows.kwik.faceOut.find(w => w[0] > 3);
  assert.ok(kwikPillar && kwikPillar[0] > 4 && kwikPillar[1] < 6.4 && len(kwikPillar) > 1, `Kwik: the pillar hides Jason mid-walk while the plate shows ${JSON.stringify(kwikPillar)}`);
  const bus = windows.jewelry.paying.find(w => len(w) > 0.5);
  assert.ok(bus && bus[0] > 6.8 && bus[1] < 8.2, `Diamond Mile: the bus hides the crew and plate with Rico in shot ${JSON.stringify(windows.jewelry.paying)}`);
  for (const [id, w] of Object.entries(windows)) {
    assert.ok(w.free.every(s => len(s) < 1.2), `${id}: no long window that hides all the evidence ${JSON.stringify(w.free)}`);
    assert.ok(!w.free.some(s => s[1] > w.clip - 2), `${id}: waiting until the end does not hide the evidence`);
    assert.ok(w.fxOk, `${id}: fx values stay within 0..1`);
    assert.ok(w.cues.length && w.cues.every((q, k) => q.at >= 0 && q.at < w.clip && (!k || q.at >= w.cues[k - 1].at)), `${id}: sound cues in order within the clip`);
  }
  assert.ok(['face', 'plate'].every(k => windows.kwik.end.includes(k)), 'Kwik: Jason is still in view at the end');
  assert.ok(['jface', 'lface', 'plate', 'rico'].every(k => windows.jewelry.end.includes(k)), 'Diamond Mile: crew, plate and Rico in view at the end');
  assert.ok(windows.jewelry.shake > 0.6 && windows.causeway.shake > 0.4 && windows.kwik.shake > 0.3, 'Heavy traffic shakes the camera');
  assert.ok(windows.jewelry.flash > 0.2 && windows.jewelry.touristFlash === false, "The tourist's flash whites out his face for a moment");
  console.log(`PASS windows: Kwik pillar ${kwikPillar.map(n => n.toFixed(2)).join('-')}s, causeway ${windows.causeway.paying.map(s => s.map(n => n.toFixed(2)).join('-'))}s, Diamond Mile bus ${bus.map(n => n.toFixed(2)).join('-')}s; fx and cues`);

  // Every cue the tapes use is synthesized and audible, stays silent when muted, and never throws before audio is unlocked.
  const cues = await page.evaluate(async names => {
    const out = {};
    for (const name of [...names, 'muted']) {
      let ctx;
      window.AudioContext = class extends OfflineAudioContext {
        constructor() { super(2, 44100 * 3.5, 44100); ctx = this; }
        resume() { return Promise.resolve(); }
      };
      const sound = await import(`/src/sound.js?cue=${name}`);
      sound.cue(name);
      sound.unlockAudio();
      if (name === 'muted') { sound.setMuted(true); sound.cue('siren'); sound.setMuted(false); } else sound.cue(name);
      const d = (await ctx.startRendering()).getChannelData(0);
      let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      out[name] = { rms: Math.sqrt(sum / d.length), known: name === 'muted' || sound.cueNames.includes(name) };
    }
    return out;
  }, [...new Set(Object.values(windows).flatMap(w => w.cues.map(q => q.name)))]);
  for (const [name, r] of Object.entries(cues)) {
    if (name === 'muted') assert.equal(r.rms, 0, 'Muted cues stay silent');
    else assert.ok(r.known && r.rms > 0.001, `cue ${name} plays (rms ${r.rms.toFixed(4)})`);
  }
  console.log(`PASS sound cues: ${Object.keys(cues).filter(n => n !== 'muted').join(', ')}; muted stays silent`);
} finally { await browser.close(); }
