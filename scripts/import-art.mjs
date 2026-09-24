// Turns the Codex-generated originals in artwork/source/codex/ into game assets:
// backgrounds cropped to 16:9 at 1280x720, sprites keyed (green screen), trimmed and sized,
// the flat magenta placeholders measured so the game can paint plates and names there,
// and animation sheets sliced into even frame strips with per-frame face and body boxes.
// Writes public/art/scenes/*.webp and src/art-manifest.js.
// Run: node scripts/import-art.mjs [name ...]   (names re-import just those and keep the rest of the manifest)
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
  ['police-cruiser', 900], ['helicopter-police', 760],
];
// Animation sheets: [name, columns, rows, options]. `side` sheets face right and get a stride, a rest (feet-together)
// frame and, for walks, per-frame timing; `run` keeps each frame's lift off the ground; `head` is the head's share of
// the figure's height and `face` where the face starts below its top.
const SHEETS = [
  ['jason-walk', 4, 2, { side: true }], ['lucia-walk', 4, 2, { side: true }], ['rico-walk', 4, 2, { side: true }],
  ['jason-run', 4, 2, { side: true, run: true }], ['lucia-run', 4, 2, { side: true, run: true }],
  ['guard-walk', 4, 2, { side: true, fig: 470 }],
  ['lucia-stretch', 4, 1, {}], ['tourist-photo', 4, 1, {}],
];
const only = process.argv.slice(2);
const wanted = name => !only.length || only.includes(name);

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

// Generated sheets rarely respect their grid: key the green, split the figures by connected parts, give each
// its nearest cell, track the head from frame to frame, then redraw every frame at one scale with the head
// centred and the feet on one baseline, so the cycle does not jitter when played.
async function processSheet(page, file, job) {
  return page.evaluate(async ({ src, job }) => {
    const im = new Image(); im.src = src; await im.decode();
    const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const W = im.width, H = im.height, N = W * H;
    const c = canvas(W, H);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    // Some sheets come back truly transparent (their hidden colour looks like a shaded backdrop); key the rest.
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
    if (clear / N < 0.3) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gr = d[i + 1], b = d[i + 2];
        const lead = gr - Math.max(r, b);
        if (lead > 70 && gr > 110) { d[i + 3] = 0; clear++; }
        else if (lead > 18) { d[i + 3] = Math.round(d[i + 3] * Math.max(0, 1 - (lead - 18) / 52)); d[i + 1] = Math.max(r, b); }
      }
      if (clear / N < 0.3) return { error: `only ${Math.round((clear / N) * 100)}% flat green or transparent background` };
    }
    g.putImageData(img, 0, 0);
    // Connected parts of the figures (8-neighbour flood fill over solid pixels).
    const label = new Int32Array(N).fill(-1);
    const parts = [];
    const stack = new Int32Array(N);
    for (let p = 0; p < N; p++) {
      if (label[p] >= 0 || d[p * 4 + 3] < 60) continue;
      const id = parts.length, part = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0, sy: 0 };
      let top = 0; stack[top++] = p; label[p] = id;
      while (top) {
        const q = stack[--top], x = q % W, y = (q / W) | 0;
        part.n++; part.sx += x; part.sy += y;
        if (x < part.x0) part.x0 = x; if (x > part.x1) part.x1 = x; if (y < part.y0) part.y0 = y; if (y > part.y1) part.y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const nq = ny * W + nx;
          if (label[nq] < 0 && d[nq * 4 + 3] >= 60) { label[nq] = id; stack[top++] = nq; }
        }
      }
      parts.push(part);
    }
    const cells = job.cols * job.rows, cw = W / job.cols, ch = H / job.rows;
    const biggest = Math.max(...parts.map(p => p.n));
    const figs = Array.from({ length: cells }, () => ({ parts: [], x0: W, y0: H, x1: 0, y1: 0 }));
    const owner = new Int16Array(parts.length).fill(-1);
    const grow = (f, p, k) => { f.parts.push(p.id); owner[p.id] = k; f.x0 = Math.min(f.x0, p.x0); f.y0 = Math.min(f.y0, p.y0); f.x1 = Math.max(f.x1, p.x1); f.y1 = Math.max(f.y1, p.y1); };
    for (const p of parts.filter(p => p.n > biggest * 0.12)) {
      const col = Math.min(job.cols - 1, Math.floor(p.sx / p.n / cw)), row = Math.min(job.rows - 1, Math.floor(p.sy / p.n / ch));
      grow(figs[row * job.cols + col], p, row * job.cols + col);
    }
    if (figs.some(f => !f.parts.length)) return { error: `found ${figs.filter(f => f.parts.length).length} of ${cells} figures` };
    // Loose bits (a detached shoe, a strand of hair) join the figure they touch; specks far from any figure go.
    for (const p of parts.filter(p => p.n <= biggest * 0.12 && p.n >= 12)) {
      let best = -1, gap = 18;
      figs.forEach((f, k) => {
        const dx = Math.max(0, f.x0 - p.x1, p.x0 - f.x1), dy = Math.max(0, f.y0 - p.y1, p.y0 - f.y1);
        if (Math.max(dx, dy) < gap) { gap = Math.max(dx, dy); best = k; }
      });
      if (best >= 0) grow(figs[best], p, best);
    }
    const mine = (k, x, y) => { const l = label[y * W + x]; return l >= 0 && owner[l] === k; };
    const span = (k, ya, yb, lo = 0, hi = 1) => {
      const f = figs[k], xs = [];
      for (let y = Math.max(f.y0, Math.round(ya)); y <= Math.min(f.y1, Math.round(yb)); y++) for (let x = f.x0; x <= f.x1; x++) if (mine(k, x, y)) xs.push(x);
      if (!xs.length) return null;
      xs.sort((a, b) => a - b);
      return [xs[Math.floor(lo * (xs.length - 1))], xs[Math.floor(hi * (xs.length - 1))]];
    };
    // Head of the first frame, then template-matched in the others (arms raised overhead must not fool it).
    const f0 = figs[0], h0 = f0.y1 - f0.y0;
    const headH = Math.round(h0 * (job.head ?? 0.18));
    const faceTop = Math.round(h0 * (job.face ?? 0.055));
    let head, face0;
    if (job.side) {
      // In profile, hair flowing back or a raised elbow widen the top rows: measure back from the face's front edge.
      const front = span(0, f0.y0, f0.y0 + headH, 0, 0.99)[1];
      head = { x: front - Math.round(h0 * 0.13), y: f0.y0, w: Math.round(h0 * 0.13), h: headH };
      face0 = { x: front - Math.round(h0 * 0.115), y: f0.y0 + faceTop, w: Math.round(h0 * 0.115), h: headH - faceTop };
    } else {
      const [hx0, hx1] = span(0, f0.y0, f0.y0 + headH, 0.02, 0.98);
      head = { x: hx0, y: f0.y0, w: hx1 - hx0 + 1, h: headH };
      const [fx0, fx1] = span(0, f0.y0 + faceTop, f0.y0 + headH, 0.03, 0.97);
      face0 = { x: fx0, y: f0.y0 + faceTop, w: fx1 - fx0 + 1, h: headH - faceTop };
    }
    const tpl = [];
    for (let y = 0; y < head.h; y += 3) for (let x = 0; x < head.w; x += 3) {
      const i = ((head.y + y) * W + head.x + x) * 4;
      tpl.push([x, y, d[i], d[i + 1], d[i + 2], mine(0, head.x + x, head.y + y)]);
    }
    const heads = figs.map((f, k) => {
      if (!k) return { x: head.x, y: head.y };
      let best = null;
      for (let y = f.y0 - 12; y <= f.y0 + (f.y1 - f.y0) * 0.35; y += 2) for (let x = f.x0 - 24; x <= f.x1 - head.w + 24; x += 2) {
        let cost = 0;
        for (const [tx, ty, r, gg, b, on] of tpl) {
          const px = x + tx, py = y + ty;
          const here = px >= 0 && py >= 0 && px < W && py < H && mine(k, px, py);
          if (on && here) { const i = (py * W + px) * 4; cost += Math.abs(d[i] - r) + Math.abs(d[i + 1] - gg) + Math.abs(d[i + 2] - b); }
          else if (on !== here) cost += on ? 420 : 180;
        }
        if (!best || cost < best.cost) best = { x, y, cost };
      }
      return best;
    });
    // Ground: the lowest foot, or for runs the row's lowest foot so flight frames stay in the air.
    const ground = figs.map((f, k) => job.run ? Math.max(...figs.filter((_, j) => Math.floor(j / job.cols) === Math.floor(k / job.cols)).map(o => o.y1)) : f.y1);
    const tall = figs.map((_, k) => ground[k] - heads[k].y).sort((a, b) => a - b)[Math.floor(cells / 2)];
    const k = (job.fig ?? 420) / tall;
    const ax = heads.map(h => h.x + head.w / 2);
    const padT = 8, padB = 6;
    const fw = 2 * Math.ceil(Math.max(...figs.map((f, i) => Math.max(ax[i] - f.x0, f.x1 + 1 - ax[i]))) * k) + 4;
    const fh = Math.ceil(Math.max(...figs.map((f, i) => ground[i] - f.y0)) * k) + padT + padB;
    const out = canvas(fw * cells, fh);
    const og = out.getContext('2d');
    og.imageSmoothingQuality = 'high';
    const round = n => Math.round(n * 10000) / 10000;
    const box = (i, r) => [round((fw / 2 + (r.x - ax[i]) * k) / fw), round((fh - padB + (r.y - ground[i]) * k) / fh), round((r.w * k) / fw), round((r.h * k) / fh)];
    const face = [], body = [], feet = [], soles = [];
    figs.forEach((f, i) => {
      const bw = f.x1 - f.x0 + 1, bh = f.y1 - f.y0 + 1;
      const part = canvas(bw, bh), pg = part.getContext('2d');
      const piece = g.getImageData(f.x0, f.y0, bw, bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!mine(i, f.x0 + x, f.y0 + y)) piece.data[(y * bw + x) * 4 + 3] = 0;
      pg.putImageData(piece, 0, 0);
      og.drawImage(part, i * fw + fw / 2 - (ax[i] - f.x0) * k, fh - padB - (ground[i] - f.y0) * k, bw * k, bh * k);
      face.push(box(i, { ...face0, x: face0.x - head.x + heads[i].x, y: face0.y - head.y + heads[i].y }));
      const tall = ground[i] - heads[i].y;
      const [tx0, tx1] = span(i, heads[i].y + tall * 0.2, heads[i].y + tall * 0.55, 0.08, 0.92);
      body.push(box(i, { x: tx0, y: heads[i].y, w: tx1 - tx0 + 1, h: tall }));
      const foot = span(i, f.y1 - tall * 0.06, f.y1);
      feet.push(foot[1] - foot[0]);
      // Where the grounded soles are, relative to the head, in frame pixels.
      const cols = [];
      for (let x = f.x0; x <= f.x1; x++) {
        let n = 0;
        for (let y = Math.round(ground[i] - tall * 0.035); y <= ground[i]; y++) if (mine(i, x, y)) n++;
        cols.push(n > 0);
      }
      const here = [];
      let from = -1;
      cols.concat(false).forEach((on, x) => {
        if (on && from < 0) from = x;
        if (!on && from >= 0) { if (x - from > 4) here.push(((f.x0 + (from + x - 1) / 2) - ax[i]) * k); from = -1; }
      });
      soles.push(here);
    });
    // One cycle is two steps; a step is how far the feet spread beyond the feet-together (rest) pose.
    // A run covers more ground than its spread shows, because both feet leave the ground.
    const stride = job.side ? round((2 * (Math.max(...feet) - Math.min(...feet)) * k * (job.run ? 1.15 : 1)) / fh) : 0;
    const rest = job.side ? feet.indexOf(Math.min(...feet)) : 0;
    // Generated walk frames are rarely evenly spaced in time. Give each frame a hold as long as the body really
    // advances over it (the planted sole sliding back from this frame to the next), so the feet stay planted.
    let timing;
    if (job.side && !job.run) {
      const avg = (stride * fh) / cells;
      const advance = soles.map((now, i) => {
        let best = null;
        for (const a of now) for (const b of soles[(i + 1) % cells]) {
          const d = a - b;
          if (d > -0.4 * avg && d < 3 * avg && (best === null || Math.abs(d - avg) < Math.abs(best - avg))) best = d;
        }
        return Math.min(3 * avg, Math.max(0.35 * avg, best ?? avg));
      });
      const sum = advance.reduce((a, b) => a + b, 0);
      timing = advance.map((_, i) => round(advance.slice(0, i).reduce((a, b) => a + b, 0) / sum));
    }
    return { data: out.toDataURL('image/webp', 0.88), w: fw, h: fh, frames: cells, feet: round((fh - padB) / fh), tall: round((job.fig ?? 420) / fh), stride, rest, timing, face, body,
      heads: heads.map(h => h.cost ?? 0) };
  }, { src: `data:image/png;base64,${readFileSync(file).toString('base64')}`, job });
}

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
const previous = only.length ? (await import('../src/art-manifest.js')).ART : {};
const manifest = {};
try {
  const page = await browser.newPage();
  mkdirSync(OUT, { recursive: true });
  const save = (name, data) => {
    const bytes = Buffer.from(data.split(',')[1], 'base64');
    writeFileSync(`${OUT}/${name}.webp`, bytes);
    return Math.round(bytes.length / 1024);
  };
  for (const name of BACKGROUNDS.filter(wanted)) {
    const r = await processImage(page, `${SRC}/${name}.png`, { kind: 'bg' });
    console.log(`${name}: 1280x720, ${save(name, r.data)} KB`);
  }
  for (const [name, max, placeholder] of SPRITES) {
    if (!wanted(name)) { manifest[name] = previous[name]; continue; }
    const r = await processImage(page, `${SRC}/${name}.png`, { kind: 'sprite', max, placeholder: !!placeholder });
    if (placeholder && !r.place) throw new Error(`${name}: no magenta placeholder found`);
    manifest[name] = { w: r.w, h: r.h, ...(r.place ? { place: r.place } : {}) };
    console.log(`${name}: ${r.w}x${r.h}${r.keyed ? ', keyed' : ''}${r.place ? `, placeholder ${JSON.stringify(r.place)}` : ''}, ${save(name, r.data)} KB`);
  }
  for (const [name, cols, rows, options] of SHEETS) {
    if (!wanted(name)) { manifest[name] = previous[name]; continue; }
    const { data, heads, error, ...r } = await processSheet(page, `${SRC}/${name}.png`, { cols, rows, ...options });
    if (error) throw new Error(`${name}: ${error}`);
    manifest[name] = r;
    console.log(`${name}: ${r.frames} frames of ${r.w}x${r.h}, stride ${r.stride}, head match ${heads.map(n => Math.round(n / 1000)).join(' ')}, ${save(name, data)} KB`);
  }
} finally { await browser.close(); }
// Frame boxes stay one line each so the manifest remains readable.
const json = JSON.stringify(manifest, (_, value) => (Array.isArray(value) && typeof value[0] === 'number' ? JSON.stringify(value) : value), 2)
  .replace(/"(\[[^"]*\])"/g, '$1');
writeFileSync('src/art-manifest.js', `// Generated by scripts/import-art.mjs: sprite sizes and placeholder boxes, and for animation strips\n// the frame size, count, baseline, stride and per-frame face and body boxes (fractions of a frame).\nexport const ART = ${json};\n`);
console.log('Wrote src/art-manifest.js');
