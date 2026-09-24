// Turns the Codex-generated originals in artwork/source/codex/ into game assets:
// backgrounds cropped to 16:9 at 1280x720, sprites keyed (green screen), trimmed and sized,
// and the flat magenta placeholders measured so the game can paint plates and names there.
// Writes public/art/scenes/*.webp and src/art-manifest.js. Run: node scripts/import-art.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const SRC = 'artwork/source/codex';
const OUT = 'public/art/scenes';
const BACKGROUNDS = ['bg-kwik', 'bg-causeway', 'bg-bank', 'bg-marina', 'bg-jewelry'];
// [name, longest side in px, has a magenta placeholder]
const SPRITES = [
  ['car-purple-rear', 720, true], ['car-orange-rear', 900, true], ['car-red-rear', 860, true],
  ['duffel-cash', 600], ['speedboat', 1000, true], ['yacht-rival', 1000, true],
  ['pillar-canopy', 900], ['truck-box', 1100], ['column-marble', 900], ['jetski', 700], ['bus-city', 1280],
  ['bystander-tourist', 900], ['guard-bank', 900],
];

async function processImage(page, file, job) {
  return page.evaluate(async ({ src, job }) => {
    const im = new Image(); im.src = src; await im.decode();
    const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    if (job.kind === 'bg') {
      // Keep the middle 16:9 band, then scale to the scene size.
      const bandH = im.width * 9 / 16;
      const c = canvas(1280, 720);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, (im.height - bandH) / 2, im.width, bandH, 0, 0, 1280, 720);
      return { data: c.toDataURL('image/webp', 0.86) };
    }
    const c = canvas(im.width, im.height);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let opaque = 0, green = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 250) opaque++;
      if (d[i] < 60 && d[i + 1] > 200 && d[i + 2] < 60) green++;
    }
    const keyed = green / (d.length / 4) > 0.2 && opaque / (d.length / 4) > 0.95;
    if (keyed) {
      for (let i = 0; i < d.length; i += 4) {
        // Green screen: clear strong green, soften and de-spill the fringe.
        const r = d[i], gr = d[i + 1], b = d[i + 2];
        const lead = gr - Math.max(r, b);
        if (lead > 70 && gr > 110) d[i + 3] = 0;
        else if (lead > 18) { d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - (lead - 18) / 52)); d[i + 1] = Math.max(r, b); }
      }
    }
    let box = null;
    if (job.placeholder) {
      // The placeholder is the largest patch of near-pure #FF00FF; purple paint or a pink stripe is not.
      const W = c.width, N = W * c.height;
      const strict = p => d[p * 4 + 3] > 200 && d[p * 4] >= 230 && d[p * 4 + 1] <= 45 && d[p * 4 + 2] >= 230;
      const seen = new Uint8Array(N);
      let best = null;
      for (let p = 0; p < N; p++) {
        if (seen[p] || !strict(p)) continue;
        const stack = [p]; seen[p] = 1;
        const comp = { n: 0, x0: W, y0: c.height, x1: 0, y1: 0 };
        while (stack.length) {
          const q = stack.pop(), x = q % W, y = (q / W) | 0;
          comp.n++; comp.x0 = Math.min(comp.x0, x); comp.x1 = Math.max(comp.x1, x); comp.y0 = Math.min(comp.y0, y); comp.y1 = Math.max(comp.y1, y);
          for (const nq of [q - 1, q + 1, q - W, q + W]) {
            if (nq < 0 || nq >= N || seen[nq] || Math.abs((nq % W) - x) > 1 || !strict(nq)) continue;
            seen[nq] = 1; stack.push(nq);
          }
        }
        if (!best || comp.n > best.n) best = comp;
      }
      if (best && best.n > 200) {
        box = best;
        // Neutral fill inside the patch and its anti-aliased rim, so no magenta shows under the painted plate.
        for (let y = Math.max(0, box.y0 - 3); y <= Math.min(c.height - 1, box.y1 + 3); y++) {
          for (let x = Math.max(0, box.x0 - 3); x <= Math.min(W - 1, box.x1 + 3); x++) {
            const i = (y * W + x) * 4;
            if (d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 130 && Math.abs(d[i] - d[i + 2]) < 70) { d[i] = 238; d[i + 1] = 234; d[i + 2] = 222; }
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    // Trim to the visible pixels.
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let p = 0, i = 3; i < d.length; i += 4, p++) {
      if (d[i] > 12) { const x = p % c.width, y = (p / c.width) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const k = Math.min(1, job.max / Math.max(tw, th));
    const out = canvas(Math.round(tw * k), Math.round(th * k));
    const og = out.getContext('2d');
    og.imageSmoothingQuality = 'high';
    og.drawImage(c, x0, y0, tw, th, 0, 0, out.width, out.height);
    const round = n => Math.round(n * 10000) / 10000;
    const place = box && { x: round((box.x0 - x0) / tw), y: round((box.y0 - y0) / th), w: round((box.x1 - box.x0 + 1) / tw), h: round((box.y1 - box.y0 + 1) / th) };
    return { data: out.toDataURL('image/webp', 0.9), w: out.width, h: out.height, keyed, place };
  }, { src: `data:image/png;base64,${readFileSync(file).toString('base64')}`, job });
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const manifest = {};
try {
  const page = await browser.newPage();
  mkdirSync(OUT, { recursive: true });
  const save = (name, data) => {
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`${OUT}/${name}.webp`, bytes);
    return Math.round(bytes.length / 1024);
  };
  for (const name of BACKGROUNDS) {
    const r = await processImage(page, `${SRC}/${name}.png`, { kind: 'bg' });
    console.log(`${name}: 1280x720, ${save(name, r.data)} KB`);
  }
  for (const [name, max, placeholder] of SPRITES) {
    const r = await processImage(page, `${SRC}/${name}.png`, { kind: 'sprite', max, placeholder: !!placeholder });
    if (placeholder && !r.place) throw new Error(`${name}: no magenta placeholder found`);
    manifest[name] = { w: r.w, h: r.h, ...(r.place ? { place: r.place } : {}) };
    console.log(`${name}: ${r.w}x${r.h}${r.keyed ? ', keyed' : ''}${r.place ? `, placeholder ${JSON.stringify(r.place)}` : ''}, ${save(name, r.data)} KB`);
  }
} finally { await browser.close(); }
writeFileSync('src/art-manifest.js', `// Generated by scripts/import-art.mjs: sprite sizes and placeholder boxes (fractions of the sprite).\nexport const ART = ${JSON.stringify(manifest, null, 2)};\n`);
console.log('Wrote src/art-manifest.js');
