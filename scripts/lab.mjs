import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1300, height: 800 } });
p.on('console', m => console.log('console:', m.text().slice(0, 300)));
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto('http://localhost:5199/lab.html');
await p.waitForFunction(() => window.labReady);
const out = await p.evaluate(async () => {
  const { CASES, renderCase, ensureFonts, analyse } = window.lab;
  await ensureFonts();
  const log = {};
  const shots = [];
  for (let i = 0; i < CASES.length; i++) {
    const r = renderCase(CASES[i], i);
    shots.push(r.dataUrl);
    const mk = (fn, w = 1280, h = 720) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn(g); return c.toDataURL('image/png'); };
    const hide = r.targets.filter(t => t.kind === 'hide');
    const tests = {
      untouched: r.dataUrl,
      coverHides: mk(g => { g.drawImage(r.canvas, 0, 0); g.fillStyle = '#000'; hide.forEach(t => g.fillRect(t.rect.x, t.rect.y, t.rect.w, t.rect.h)); }),
      blurHides: mk(g => { g.drawImage(r.canvas, 0, 0); hide.forEach(t => { g.save(); g.beginPath(); g.rect(t.rect.x, t.rect.y, t.rect.w, t.rect.h); g.clip(); g.filter = 'blur(10px)'; g.drawImage(r.canvas, 0, 0); g.restore(); }); }),
      scribbleHides: mk(g => { g.drawImage(r.canvas, 0, 0); g.strokeStyle = '#ff2d95'; g.lineWidth = 18; hide.forEach(t => { g.beginPath(); for (let y = t.rect.y; y < t.rect.y + t.rect.h; y += 14) { g.moveTo(t.rect.x, y); g.lineTo(t.rect.x + t.rect.w, y + 7); } g.stroke(); }); }),
      brightness: mk(g => { g.filter = 'brightness(1.3) contrast(1.1)'; g.drawImage(r.canvas, 0, 0); }),
      sepia: mk(g => { g.filter = 'sepia(0.8)'; g.drawImage(r.canvas, 0, 0); }),
      globalBlur: mk(g => { g.filter = 'blur(6px)'; g.drawImage(r.canvas, 0, 0); }),
      cropRight: mk(g => g.drawImage(r.canvas, -500, -100), 700, 560),
    };
    log[CASES[i].id] = {};
    for (const [k, url] of Object.entries(tests)) {
      const t0 = performance.now();
      const a = await analyse(r.canvas, url, r.targets);
      log[CASES[i].id][k] = `${Math.round(performance.now() - t0)}ms off=${a.offset.ox},${a.offset.oy} subtle=${a.subtle.toFixed(2)} ` + a.results.map(x => `${x.key}:${x.kind[0]}${Math.round(x.changed * 100)}${x.pass ? '✓' : '✗'}`).join(' ');
    }
  }
  return { log, shots };
});
console.log(JSON.stringify(out.log, null, 1));
const fs = await import('node:fs');
out.shots.forEach((s, i) => fs.writeFileSync(`scripts/scene${i}.png`, Buffer.from(s.split(',')[1], 'base64')));
await b.close();
