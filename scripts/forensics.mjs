// Forensics against everything Unlayer's Crop can do to a still: flips, quarter turns, straightening and crops on top.
// Exports are rebuilt in the browser the way the editor makes them (measured against the hosted editor: flips and
// turns are exact pixel moves; straighten turns about the centre in whole degrees, bilinear, at native scale, and
// shrinks the crop to the largest centred box of the same shape), then run through analyse() on /lab.html.
// Needs the dev server: HOME_TEST_URL defaults to http://127.0.0.1:5200/.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = (process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/').replace(/\/?$/, '/');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}lab.html`);
  await page.waitForFunction(() => window.labReady);
  const out = await page.evaluate(async () => {
    const { CASES, renderCase, ensureFonts, analyse } = window.lab;
    await ensureFonts();
    const draw = (w, h, fn) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); fn(c.getContext('2d')); return c; };
    // One of Crop's steps applied to { canvas, m }, where m (a DOMMatrix) maps tape pixels to the current picture.
    const steps = {
      flipX: ({ canvas: c, m }) => ({ canvas: draw(c.width, c.height, g => { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); }), m: new DOMMatrix([-1, 0, 0, 1, c.width, 0]).multiply(m) }),
      flipY: ({ canvas: c, m }) => ({ canvas: draw(c.width, c.height, g => { g.translate(0, c.height); g.scale(1, -1); g.drawImage(c, 0, 0); }), m: new DOMMatrix([1, 0, 0, -1, 0, c.height]).multiply(m) }),
      right: ({ canvas: c, m }) => ({ canvas: draw(c.height, c.width, g => { g.translate(c.height, 0); g.rotate(Math.PI / 2); g.drawImage(c, 0, 0); }), m: new DOMMatrix([0, 1, -1, 0, c.height, 0]).multiply(m) }),
      straighten: deg => ({ canvas: c, m }) => {
        const r = Math.abs(deg) * Math.PI / 180, w = c.width, h = c.height;
        const k = Math.cos(r) + (Math.max(w, h) / Math.min(w, h)) * Math.sin(r);
        const cw = w * Math.cos(r) + h * Math.sin(r), ch = w * Math.sin(r) + h * Math.cos(r);
        const t = new DOMMatrix().translate(cw / 2 - Math.floor((cw - w / k) / 2), ch / 2 - Math.floor((ch - h / k) / 2)).rotate(deg).translate(-w / 2, -h / 2);
        return { canvas: draw(Math.floor(w / k), Math.floor(h / k), g => { g.setTransform(t); g.drawImage(c, 0, 0); }), m: t.multiply(m) };
      },
      crop: (x, y, w, h) => ({ canvas: c, m }) => ({ canvas: draw(w, h, g => g.drawImage(c, -x, -y)), m: new DOMMatrix().translate(-x, -y).multiply(m) }),
    };
    const T = (flipX, flipY, rotate, angle) => ({ flipX, flipY, rotate, angle });
    const S = steps;
    const edits = [
      ['as shot', [], T(false, false, 0, 0)],
      ['crop', [S.crop(137, 61, 901, 575)], T(false, false, 0, 0)],
      ['flip horizontal', [S.flipX], T(true, false, 0, 0)],
      ['flip vertical', [S.flipY], T(false, true, 0, 0)],
      ['rotate right', [S.right], T(false, false, 90, 0)],
      ['rotate 180', [S.right, S.right], T(false, false, 180, 0)],
      ['rotate left', [S.right, S.right, S.right], T(false, false, 270, 0)],
      ['flip then rotate right', [S.flipX, S.right], T(true, false, 90, 0)],
      ['rotate right then crop', [S.right, S.crop(80, 190, 560, 900)], T(false, false, 90, 0)],
      ['flip then crop', [S.flipX, S.crop(300, 40, 900, 640)], T(true, false, 0, 0)],
      ['straighten +3', [S.straighten(3)], T(false, false, 0, 3)],
      ['straighten -8', [S.straighten(-8)], T(false, false, 0, -8)],
      ['straighten +15', [S.straighten(15)], T(false, false, 0, 15)],
      ['straighten -30', [S.straighten(-30)], T(false, false, 0, -30)],
      ['straighten +10 then crop', [S.straighten(10), S.crop(70, 50, 760, 430)], T(false, false, 0, 10)],
      ['rotate right then straighten -6', [S.right, S.straighten(-6)], T(false, false, 90, -6)],
    ];
    // Filters on top change the colours, never the verdict; painting after the crop hides evidence in the new frame.
    const looks = { plain: null, brighter: 'brightness(1.25) contrast(1.1)', sepia: 'sepia(0.7)' };
    const results = [];
    const times = [];
    const bests = {};
    for (let i = 0; i < CASES.length; i++) {
      const s = renderCase(CASES[i], i);
      const targets = [...s.targets, ...(s.surprise ? [s.surprise] : [])];
      const covered = draw(1280, 720, g => { g.drawImage(s.canvas, 0, 0); g.fillStyle = '#1b1426'; for (const t of targets.filter(t => t.kind === 'hide')) g.fillRect(t.rect.x - 2, t.rect.y - 2, t.rect.w + 4, t.rect.h + 4); });
      for (const [name, list, expect] of edits) {
        for (const [variant, source, look, paintAfter] of [['untouched', s.canvas, 'plain'], ['hides covered', covered, 'plain'], ['untouched', s.canvas, i % 2 ? 'sepia' : 'brighter'], ['hides painted after', s.canvas, 'plain', true]]) {
          if (paintAfter && i % 2) continue;
          let pic = { canvas: source, m: new DOMMatrix() };
          for (const step of list) pic = step(pic);
          const { m } = pic;
          // Where each target's corners land in the export: inside it, outside it, or cut through (not judged here).
          const where = t => {
            const pts = [[t.rect.x, t.rect.y], [t.rect.x + t.rect.w, t.rect.y], [t.rect.x, t.rect.y + t.rect.h], [t.rect.x + t.rect.w, t.rect.y + t.rect.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
            const [x0, x1, y0, y1] = [Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.y))];
            const { width: w, height: h } = pic.canvas;
            return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, state: x0 >= 0 && y0 >= 0 && x1 <= w && y1 <= h ? 'in' : x1 <= 0 || y1 <= 0 || x0 >= w || y0 >= h ? 'out' : 'cut' };
          };
          const exported = draw(pic.canvas.width, pic.canvas.height, g => {
            if (looks[look]) g.filter = looks[look];
            g.drawImage(pic.canvas, 0, 0);
            g.filter = 'none';
            g.fillStyle = '#1b1426';
            if (paintAfter) for (const t of targets.filter(t => t.kind === 'hide')) { const b = where(t).box; g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); }
          });
          const url = exported.toDataURL('image/png');
          const t0 = performance.now();
          const a = await analyse(s.canvas, url, targets);
          times.push(performance.now() - t0);
          results.push({
            id: CASES[i].id, name, variant, look, paintAfter: !!paintAfter, expect, got: a.transform, unrecognisable: a.unrecognisable,
            ms: Math.round(times[times.length - 1]),
            verdicts: a.results.map(r => ({ key: r.key, kind: r.kind, text: !!r.text, pass: r.pass, changed: +r.changed.toFixed(2), where: where(r).state, turned: !!r.turned })),
          });
        }
      }
      // Timing, best of three (the machine may be busy): one of each kind of export, on every tape.
      for (const [name, list] of edits.filter(([n]) => ['as shot', 'crop', 'flip horizontal', 'rotate right', 'straighten -8', 'straighten +10 then crop'].includes(n))) {
        let pic = { canvas: s.canvas, m: new DOMMatrix() };
        for (const step of list) pic = step(pic);
        const url = draw(pic.canvas.width, pic.canvas.height, g => { g.drawImage(pic.canvas, 0, 0); g.fillStyle = '#1b1426'; g.fillRect(400, 250, 120, 90); }).toDataURL('image/png');
        let best = Infinity;
        for (let k = 0; k < 3; k++) { const t0 = performance.now(); await analyse(s.canvas, url, targets); best = Math.min(best, performance.now() - t0); }
        (bests[name] ??= []).push(best);
      }
      // Still unrecognisable: something that matches nothing on the tape.
      const noise = draw(900, 600, g => { const d = g.createImageData(900, 600); let v = 7; for (let k = 0; k < d.data.length; k++) d.data[k] = k % 4 === 3 ? 255 : (v = (v * 1103515245 + 12345) >>> 0) >>> 24; g.putImageData(d, 0, 0); });
      const a = await analyse(s.canvas, noise.toDataURL(), targets);
      results.push({ id: CASES[i].id, name: 'noise', variant: 'noise', expect: null, got: a.transform, unrecognisable: a.unrecognisable, verdicts: [] });
    }
    return { results, times, bests };
  });

  let checked = 0;
  const failures = [];
  const check = (fn) => { try { fn(); } catch (e) { failures.push(e.message.split('\n')[0]); } };
  for (const r of out.results) {
    const tag = `${r.id} / ${r.name} / ${r.variant}${r.look && r.look !== 'plain' ? ` + ${r.look}` : ''}`;
    if (r.name === 'noise') { check(() => assert.ok(r.unrecognisable, `${tag}: an export that matches nothing stays unrecognisable`)); continue; }
    if (r.unrecognisable || JSON.stringify(r.got) !== JSON.stringify(r.expect)) { failures.push(`${tag}: detected ${r.unrecognisable ? 'nothing' : JSON.stringify(r.got)}`); continue; }
    const moved = r.expect.flipX || r.expect.flipY || r.expect.rotate || r.expect.angle;
    for (const v of r.verdicts) {
      if (v.where === 'cut') continue;
      const what = `${tag}: ${v.key} (${v.where}, changed ${v.changed})`;
      if (v.kind === 'hide') {
        // Cropped away or painted over is hidden; still in the picture, however it's turned, is a match.
        const hidden = v.where === 'out' || r.variant !== 'untouched';
        check(() => assert.equal(v.pass, hidden, `${what} should be ${hidden ? 'CLEAN' : 'a MATCH'}`));
      } else if (v.where === 'out') check(() => assert.equal(v.pass, false, `${what}: a KEEP cropped away is tampered`));
      else if (v.text && moved) check(() => assert.ok(!v.pass && v.turned, `${what}: flipped, turned or tilted lettering is TAMPERED`));
      else if (!r.paintAfter) check(() => assert.equal(v.pass, true, `${what}: an untouched KEEP stays INTACT`));
      checked++;
    }
  }
  for (const f of failures) console.log('FAIL', f);
  assert.equal(failures.length, 0, `${failures.length} forensic verdicts wrong`);
  const ms = [...out.times].sort((a, b) => a - b);
  const q = p => Math.round(ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]);
  console.log(`PASS ${out.results.length} exports across ${new Set(out.results.map(r => r.id)).size} tapes, ${checked} verdicts: flips, quarter turns, straightening to ±30°, crops on top, filters, painting after the crop`);
  console.log(`analyse() over the whole run: median ${q(0.5)} ms, p90 ${q(0.9)}, max ${q(1)}; cold first call ${Math.round(out.times[0])} ms`);
  const best = Object.entries(out.bests).map(([n, l]) => [n, Math.round(l.sort((a, b) => a - b)[l.length >> 1]), Math.round(l[l.length - 1])]);
  console.log(`Best of 3 per tape (median across tapes, slowest tape):\n${best.map(([n, m, x]) => `  ${n}: ${m} ms, ${x} ms`).join('\n')}`);
  assert.ok(best.every(([, m]) => m < 800), 'analyse() stays quick');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
