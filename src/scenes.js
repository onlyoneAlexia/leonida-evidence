// Live CCTV scenes: illustrated backgrounds and sprites (artwork/source/codex, see scripts/import-art.mjs)
// animated over a short clip. The player freezes the tape; that frame becomes the still they doctor.
// Every draw returns exact evidence bounds plus what was drawn in front of them, so evidence hidden
// behind a passing truck or a pillar at the frozen moment no longer has to be edited.
import { drawAvatar, drawHead, loadAvatarArt } from './avatars.js';
import { ART } from './art-manifest.js';

export const W = 1280;
export const H = 720;
const BACKGROUNDS = ['bg-kwik', 'bg-causeway', 'bg-bank', 'bg-marina', 'bg-jewelry'];
// Face bounds in the bystander sprites, as fractions of the sprite (x, y, w, h).
const EXTRA_FACES = { 'bystander-tourist': [0.42, 0.05, 0.24, 0.09], 'guard-bank': [0.41, 0.06, 0.2, 0.085] };

const IMG = {};
let artLoading;
export function loadSceneArt() {
  artLoading ??= Promise.all([...BACKGROUNDS, ...Object.keys(ART)].map(name => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { IMG[name] = image; resolve(); };
    image.onerror = () => reject(new Error(`Missing art: ${name}`));
    image.src = `/art/scenes/${name}.webp`;
  })));
  return artLoading;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = n => Math.max(0, Math.min(1, n));
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = p => p * p * (3 - 2 * p);
const seg = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// A walk from a to b between t0 and t1; `step` drives the stride bob.
function walk(t, t0, t1, a, b) {
  const p = smooth(seg(t, t0, t1));
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p), step: t > t0 && t < t1 ? (t - t0) * 3.4 : 0 };
}

// Crew member from the shared atlas, feet at (x, y). Returns face/tattoo bounds and the body that blocks the view.
function crew(g, who, pos, { tattoo = false } = {}) {
  const bob = pos.step ? Math.abs(Math.sin(pos.step * Math.PI)) * 5 * pos.s : 0;
  const drawn = drawAvatar(g, { avatar: who, x: pos.x, y: pos.y - bob, s: pos.s, tattoo });
  const h = 340 * pos.s;
  const w = h / 2;
  return { ...drawn, depth: pos.y, body: { x: pos.x - w * 0.28, y: pos.y - h * 0.96, w: w * 0.56, h: h * 0.96 } };
}

// A sprite from the manifest, bottom-centre at (cx, bottom), `w` wide.
function sprite(g, name, cx, bottom, w, { alpha = 1 } = {}) {
  const a = ART[name];
  const h = (w * a.h) / a.w;
  const rect = { x: cx - w / 2, y: bottom - h, w, h };
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(IMG[name], rect.x, rect.y, w, h);
  g.restore();
  const place = a.place && { x: rect.x + a.place.x * w, y: rect.y + a.place.y * h, w: a.place.w * w, h: a.place.h * h };
  return { rect, place, depth: bottom };
}

// Bystander sprite drawn at crew scale (feet at y).
function extra(g, name, pos) {
  const h = 340 * pos.s * 0.96;
  const bob = pos.step ? Math.abs(Math.sin(pos.step * Math.PI)) * 5 * pos.s : 0;
  const s = sprite(g, name, pos.x, pos.y - bob, (h * ART[name].w) / ART[name].h);
  const [fx, fy, fw, fh] = EXTRA_FACES[name];
  const r = s.rect;
  return { depth: pos.y, face: { x: r.x + fx * r.w, y: r.y + fy * r.h, w: fw * r.w, h: fh * r.h }, body: { x: r.x + r.w * 0.18, y: r.y, w: r.w * 0.64, h: r.h } };
}

const pad = (r, n) => r && { x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 };

function fitText(g, text, weight, family, maxW, maxH) {
  let size = maxH;
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxW) size = (size * maxW) / w;
  g.font = `${weight} ${size}px ${family}`;
}

// Leonida plate painted into a sprite's placeholder box.
function plateIn(g, r, text) {
  g.save();
  g.fillStyle = '#f4f1e8';
  rr(g, r.x, r.y, r.w, r.h, Math.min(6, r.h * 0.14));
  g.fill();
  g.strokeStyle = '#222';
  g.lineWidth = Math.max(1, r.h * 0.05);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = r.x + r.w / 2;
  g.fillStyle = '#d2224b';
  fitText(g, 'LEONIDA', 700, 'IBM Plex Mono, monospace', r.w * 0.6, r.h * 0.22);
  g.fillText('LEONIDA', cx, r.y + r.h * 0.2);
  g.fillStyle = '#10204a';
  fitText(g, text, 700, 'IBM Plex Mono, monospace', r.w * 0.88, r.h * 0.5);
  g.fillText(text, cx, r.y + r.h * 0.58);
  g.fillStyle = '#2e8b57';
  fitText(g, 'SUNSHINE STATE', 400, 'IBM Plex Mono, monospace', r.w * 0.7, r.h * 0.15);
  g.fillText('SUNSHINE STATE', cx, r.y + r.h * 0.87);
  g.restore();
  return pad(r, 4);
}

// Hull lettering painted into a boat's placeholder box.
function letterIn(g, r, text, color, family = 'Montserrat, sans-serif') {
  g.save();
  g.fillStyle = '#eeeade';
  g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, text, 800, family, r.w * 0.94, r.h * 0.8);
  g.fillText(text, r.x + r.w / 2, r.y + r.h * 0.55);
  g.restore();
  return pad(r, 4);
}

function neon(g, text, x, y, size, color, glow = 1) {
  g.save();
  g.font = `${size}px Anton, sans-serif`;
  g.textBaseline = 'middle';
  g.globalAlpha = 0.35 + 0.65 * glow;
  g.shadowColor = color;
  g.shadowBlur = 26 * glow;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 8;
  g.fillStyle = '#fff';
  g.globalAlpha *= 0.85;
  g.fillText(text, x, y);
  g.restore();
}

// Neon that mostly glows but stutters now and then.
const flicker = (t, seed) => {
  const k = Math.sin(t * 13.1 + seed * 7) + Math.sin(t * 29.7 + seed);
  return k > 1.7 ? 0.25 : 1;
};

function signText(g, lines, x, y) {
  g.save();
  g.fillStyle = '#fff';
  for (const [text, font, dy] of lines) {
    g.font = font;
    g.fillText(text, x, y + dy);
  }
  g.restore();
}

// Sun or neon glints drifting across water.
function glints(g, t, area, color = 'rgba(255,240,210,0.55)', n = 40, seed = 3) {
  const rand = rng(seed);
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = area.x + ((rand() * area.w + t * (8 + rand() * 18)) % area.w);
    const y = area.y + rand() * area.h;
    const on = Math.sin(t * (2 + rand() * 3) + i) > 0.2;
    if (on) g.fillRect(x, y, 10 + rand() * 26, 2);
  }
  g.restore();
}

function rain(g, t) {
  const rand = rng(11);
  g.save();
  g.strokeStyle = 'rgba(200,220,255,0.28)';
  g.lineWidth = 1.4;
  g.beginPath();
  for (let i = 0; i < 140; i++) {
    const x = (rand() * (W + 200) - t * 180 * (0.8 + rand() * 0.4)) % (W + 200);
    const y = (rand() * H + t * 900 * (0.8 + rand() * 0.4)) % H;
    const px = x < -100 ? x + W + 200 : x;
    g.moveTo(px, y);
    g.lineTo(px - 6, y + 22);
  }
  g.stroke();
  g.restore();
}

// Hazard lights: two amber glows on a car's tail lights, blinking.
function hazards(g, car, t) {
  if (Math.sin(t * Math.PI * 2.2) < 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const fx of [0.2, 0.8]) {
    const x = car.x + car.w * fx;
    const y = car.y + car.h * 0.5;
    const glow = g.createRadialGradient(x, y, 2, x, y, car.w * 0.12);
    glow.addColorStop(0, 'rgba(255,190,60,0.9)');
    glow.addColorStop(1, 'rgba(255,140,0,0)');
    g.fillStyle = glow;
    g.fillRect(x - car.w * 0.12, y - car.w * 0.12, car.w * 0.24, car.w * 0.24);
  }
  g.restore();
}

// --- Evidence the detectives can spot mid-edit (see `surprise` below) ---

function monitor(g, r, t) {
  g.save();
  g.fillStyle = '#1a1c22';
  rr(g, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 4);
  g.fill();
  drawHead(g, 'jason', r);
  g.fillStyle = `rgba(80,255,150,${0.18 + 0.05 * Math.sin(t * 9)})`;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = r.y; y < r.y + r.h; y += 3) g.fillRect(r.x, y, r.w, 1);
  g.restore();
  return pad(r, 4);
}

function heartSticker(g, cx, cy, size) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = '#ff4fa0';
  g.beginPath();
  g.moveTo(0, size * 0.35);
  g.bezierCurveTo(-size, -size * 0.35, -size * 0.45, -size, 0, -size * 0.45);
  g.bezierCurveTo(size * 0.45, -size, size, -size * 0.35, 0, size * 0.35);
  g.fill();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${size * 0.42}px Montserrat, sans-serif`;
  g.fillText('L+J', 0, -size * 0.18);
  g.restore();
  return { x: cx - size - 4, y: cy - size - 4, w: size * 2 + 8, h: size * 1.45 + 8 };
}

function note(g, r, lines, paper = '#fbf7ea', ink = '#1d2340') {
  g.save();
  g.fillStyle = paper;
  g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = ink;
  g.textBaseline = 'middle';
  lines.forEach(([text, size], i) => {
    g.font = `700 ${size}px IBM Plex Mono, monospace`;
    g.fillText(text, r.x + 5, r.y + (r.h / (lines.length + 1)) * (i + 1));
  });
  g.restore();
  return pad(r, 3);
}

function idCard(g, r) {
  g.save();
  g.translate(r.x + r.w / 2, r.y + r.h / 2);
  g.rotate(-0.12);
  g.fillStyle = '#e9f1ff';
  rr(g, -r.w / 2, -r.h / 2, r.w, r.h, 4);
  g.fill();
  g.fillStyle = '#1f4fa0';
  g.fillRect(-r.w / 2, -r.h / 2, r.w, r.h * 0.24);
  drawHead(g, 'jason', { x: -r.w / 2 + 4, y: -r.h / 2 + r.h * 0.3, w: r.w * 0.32, h: r.h * 0.62 });
  g.fillStyle = '#1d2340';
  g.font = `700 ${r.h * 0.17}px IBM Plex Mono, monospace`;
  g.fillText('LEONIDA ID', -r.w / 2 + r.w * 0.4, -r.h * 0.02);
  g.fillText('J. ****', -r.w / 2 + r.w * 0.4, r.h * 0.26);
  g.restore();
  return pad(r, 6);
}

// --- Scenes. Each draws the frame at `t` seconds and returns evidence rects and blockers. ---

function draw(g, list) {
  // Nearest last: everything drawn later (larger depth) can block what was drawn before it.
  const out = [];
  for (const item of list.filter(Boolean).sort((a, b) => a.depth - b.depth)) out.push({ depth: item.depth, ...item.draw() });
  return out;
}
const blockers = drawn => drawn.filter(d => d.body).map(d => ({ depth: d.depth, rect: d.body }));
// A drawn person, filed under `key`, whose body blocks whatever stands behind them.
const as = (key, p) => ({ [key]: p, body: p.body });

function sceneKwik(g, t) {
  g.drawImage(IMG['bg-kwik'], 0, 0, W, H);
  neon(g, 'KWIK MART', 792, 168, 60, '#ff3fa4', flicker(t, 1));
  neon(g, '24/7', 1100, 168, 48, '#29e7ff');
  const screen = monitor(g, { x: 1068, y: 250, w: 64, h: 46 }, t);
  // Jason is still out by the car when the tape ends: the pillar mid-walk is the only way to lose his face.
  const J = t >= 0.8 ? walk(t, 0.8, 9.4, { x: 1110, y: 392, s: 0.6 }, { x: 656, y: 604, s: 1.05 }) : null;
  if (J && t > 9.4) J.x += Math.sin((t - 9.4) * 2.2) * 5;
  const drawn = draw(g, [
    J && { depth: J.y, draw: () => as('jason', crew(g, 'jason', J)) },
    { depth: 612, draw: () => {
      const car = sprite(g, 'car-purple-rear', 470, 612, 300);
      return { plate: plateIn(g, car.place, 'KWK 118'), body: car.rect };
    } },
    // The canopy pillar stands right in front of the camera.
    { depth: 900, draw: () => ({ body: sprite(g, 'pillar-canopy', 887, 740, 150).rect }) },
  ]);
  const jason = drawn.find(d => d.jason)?.jason;
  const car = drawn.find(d => d.plate);
  return {
    rects: { face: jason && { rect: jason.face, depth: jason.depth }, plate: { rect: car.plate, depth: car.depth }, screen: { rect: screen, depth: -1 } },
    blockers: blockers(drawn),
  };
}

function sceneCauseway(g, t) {
  g.drawImage(IMG['bg-causeway'], 0, 0, W, H);
  // Below the camera label, which covers the top of the sign.
  signText(g, [['LEONIDA CAUSEWAY', '700 30px Montserrat, sans-serif', 0], ['VICE CITY  →  EXIT 5A', '600 22px Montserrat, sans-serif', 40]], 112, 94);
  glints(g, t, { x: 520, y: 300, w: 760, h: 110 });
  let L = null;
  if (t >= 1.4) {
    if (t < 5) L = walk(t, 1.4, 5, { x: 380, y: 650, s: 0.98 }, { x: 870, y: 598, s: 0.9 });
    else if (t < 9.2) L = { x: 870 + Math.sin(t * 2) * 5, y: 598, s: 0.9, step: 0 };
    else L = walk(t, 9.2, 12.6, { x: 870, y: 598, s: 0.9 }, { x: 400, y: 648, s: 0.98 });
  }
  const truckP = seg(t, 4.6, 8.4);
  const drawn = draw(g, [
    L && { depth: L.y, draw: () => as('lucia', crew(g, 'lucia', L)) },
    { depth: 655, draw: () => {
      const car = sprite(g, 'car-orange-rear', 520, 655, 400);
      hazards(g, car.rect, t);
      const sticker = heartSticker(g, car.rect.x + car.rect.w * 0.66, car.rect.y + car.rect.h * 0.2, car.rect.w * 0.05);
      return { plate: plateIn(g, car.place, 'LCJ 0924'), sticker, body: car.rect };
    } },
    truckP > 0 && truckP < 1 && { depth: 760, draw: () => ({ body: sprite(g, 'truck-box', lerp(1350, -1000, truckP), 760, 880).rect }) },
  ]);
  const lucia = drawn.find(d => d.lucia)?.lucia;
  const car = drawn.find(d => d.plate);
  return {
    rects: {
      plate: { rect: car.plate, depth: car.depth },
      face: lucia && { rect: lucia.face, depth: lucia.depth },
      sticker: { rect: car.sticker, depth: car.depth },
    },
    blockers: blockers(drawn),
  };
}

function sceneBank(g, t) {
  g.drawImage(IMG['bg-bank'], 0, 0, W, H);
  g.save();
  g.fillStyle = '#f5c542';
  g.font = '58px Anton, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BANK OF LEONIDA', 642, 84);
  g.restore();
  glints(g, t, { x: 900, y: 120, w: 360, h: 420 }, 'rgba(255,240,200,0.35)', 18, 5);
  const slip = note(g, { x: 822, y: 290, w: 104, h: 40 }, [['DEPOSIT', 9], ['J. ACCT 0924', 10]]);
  const J = { x: 430 + Math.sin(t * 0.8) * 4, y: 612, s: 1.0, step: 0 };
  const L = { x: 700, y: 640, s: 1.06, step: 0 };
  const R = t >= 2.6 ? walk(t, 2.6, 9.4, { x: 60, y: 470, s: 0.78 }, { x: 1010, y: 650, s: 1.06 }) : null;
  const guard = t >= 5.4 && t < 10.6 ? walk(t, 5.4, 10.6, { x: 1420, y: 745, s: 1.45 }, { x: -170, y: 745, s: 1.45 }) : null;
  const drawn = draw(g, [
    { depth: J.y, draw: () => as('jason', crew(g, 'jason', J)) },
    { depth: L.y, draw: () => as('lucia', crew(g, 'lucia', L, { tattoo: true })) },
    R && { depth: R.y, draw: () => as('rico', crew(g, 'rico', R)) },
    guard && { depth: guard.y, draw: () => extra(g, 'guard-bank', guard) },
  ]);
  const pick = key => drawn.find(d => d[key])?.[key];
  const [jason, lucia, rico] = [pick('jason'), pick('lucia'), pick('rico')];
  return {
    rects: {
      jface: { rect: jason.face, depth: jason.depth },
      tattoo: { rect: lucia.tattoo, depth: lucia.depth },
      rico: rico && { rect: rico.face, depth: rico.depth },
      slip: { rect: slip, depth: -1 },
    },
    blockers: blockers(drawn),
  };
}

function sceneMarina(g, t) {
  g.drawImage(IMG['bg-marina'], 0, 0, W, H);
  glints(g, t, { x: 0, y: 290, w: W, h: 290 }, 'rgba(255,255,255,0.5)', 70, 8);
  const yachtP = 1 - (1 - seg(t, 1.4, 6.6)) ** 2;
  const jetP = seg(t, 4.0, 7.4);
  const drawn = draw(g, [
    { depth: 400, draw: () => {
      const yacht = sprite(g, 'yacht-rival', lerp(1560, 930, yachtP), 402 + Math.sin(t * 1.3) * 2, 480);
      return { name: letterIn(g, yacht.place, "RICO'S REVENGE", '#10204a'), body: yacht.rect };
    } },
    { depth: 585, draw: () => {
      const boat = sprite(g, 'speedboat', 380, 585 + Math.sin(t * 1.7) * 4, 640);
      return { reg: letterIn(g, boat.place, 'FL 4471 VC', '#10204a', 'IBM Plex Mono, monospace'), body: boat.rect };
    } },
    jetP > 0 && jetP < 1 && { depth: 612, draw: () => ({ body: sprite(g, 'jetski', lerp(-380, 1450, jetP), 612 + Math.sin(t * 9) * 3, 330).rect }) },
    { depth: 690, draw: () => {
      const bag = sprite(g, 'duffel-cash', 880, 690, 250);
      const tag = note(g, { x: bag.rect.x + bag.rect.w * 0.74, y: bag.rect.y + bag.rect.h * 0.08, w: 52, h: 26 }, [['PROP. OF', 7], ['LUCIA', 8]], '#ffd23f');
      return { bag: pad(bag.rect, -8), tag, body: bag.rect };
    } },
  ]);
  const get = key => drawn.find(d => d[key]);
  return {
    rects: {
      bag: { rect: get('bag').bag, depth: get('bag').depth },
      reg: { rect: get('reg').reg, depth: get('reg').depth },
      ricoBoat: { rect: get('name').name, depth: get('name').depth },
      tag: { rect: get('tag').tag, depth: get('tag').depth },
    },
    blockers: blockers(drawn),
  };
}

function sceneJewelry(g, t) {
  g.drawImage(IMG['bg-jewelry'], 0, 0, W, H);
  neon(g, 'DIAMOND MILE JEWELERS', 150, 88, 44, '#ff4fd8', flicker(t, 4));
  const card = idCard(g, { x: 206, y: 590, w: 78, h: 48 });
  // The crew only reach the car as the tape ends; the passing bus is the moment to catch them hidden.
  const J = t >= 0.4 ? walk(t, 0.4, 11.2, { x: 360, y: 470, s: 0.82 }, { x: 905, y: 668, s: 1.12 }) : null;
  const L = t >= 1.0 ? walk(t, 1.0, 11.6, { x: 470, y: 478, s: 0.84 }, { x: 1080, y: 672, s: 1.12 }) : null;
  const R = t >= 2.2 ? walk(t, 2.2, 11.6, { x: 1340, y: 520, s: 0.9 }, { x: 760, y: 540, s: 0.92 }) : null;
  const tourist = { x: 590, y: 560, s: 0.95, step: 0 };
  const busP = seg(t, 5.8, 8.0);
  const drawn = draw(g, [
    { depth: tourist.y, draw: () => as('tourist', extra(g, 'bystander-tourist', tourist)) },
    J && { depth: J.y, draw: () => as('jason', crew(g, 'jason', J)) },
    L && { depth: L.y, draw: () => as('lucia', crew(g, 'lucia', L)) },
    R && { depth: R.y, draw: () => as('rico', crew(g, 'rico', R)) },
    { depth: 708, draw: () => {
      const car = sprite(g, 'car-red-rear', 1000, 708, 380);
      return { plate: plateIn(g, car.place, 'VC 2HOT'), body: car.rect };
    } },
    busP > 0 && busP < 1 && { depth: 770, draw: () => ({ body: sprite(g, 'bus-city', lerp(-1400, 1450, busP), 770, 1500).rect }) },
  ]);
  rain(g, t);
  const pick = key => drawn.find(d => d[key]);
  const person = key => pick(key) && { rect: pick(key)[key].face, depth: pick(key).depth };
  return {
    rects: {
      jface: person('jason'),
      lface: person('lucia'),
      plate: { rect: pick('plate').plate, depth: pick('plate').depth },
      rico: person('rico'),
      tourist: person('tourist'),
      card: { rect: card, depth: 638 },
    },
    blockers: blockers(drawn),
  };
}

// Clocks shrink as the jobs get bigger; the tape's running time counts against the clock.
export const CASES = [
  {
    id: 'kwik',
    title: 'Kwik Mart Stick-Up',
    place: 'Vice Beach',
    seconds: 90,
    payout: 12000,
    clip: 12,
    preview: 4,
    brief: 'Jason hit the Kwik Mart on Ocean Drive and walked straight past the pump camera to the getaway car.',
    tip: 'Jason passes behind the canopy pillar on his way to the car.',
    draw: sceneKwik,
    cam: 'CAM 04',
    camPlace: 'KWIK MART #117 · VICE BEACH',
    time: '02:13:44',
    targets: r => [
      { key: 'face', kind: 'hide', label: "Jason's face", at: r.face },
      { key: 'plate', kind: 'hide', label: 'Getaway car plate', at: r.plate },
    ],
    surprise: r => ({ key: 'screen', kind: 'hide', label: "Jason on the store's security monitor", at: r.screen }),
  },
  {
    id: 'causeway',
    title: 'Causeway Getaway',
    place: 'Leonida Causeway',
    seconds: 80,
    payout: 18000,
    clip: 12,
    preview: 3.5,
    brief: 'Toll camera caught the getaway car on the shoulder at sunset. Lucia stepped out to stretch. Of course she did.',
    tip: 'A box truck blocks the lane for a split second. Catch it covering both the plate and Lucia.',
    draw: sceneCauseway,
    cam: 'TOLL 5A',
    camPlace: 'LEONIDA CAUSEWAY · EASTBOUND',
    time: '19:47:02',
    targets: r => [
      { key: 'plate', kind: 'hide', label: 'License plate', at: r.plate },
      { key: 'face', kind: 'hide', label: "Lucia's face", at: r.face },
    ],
    surprise: r => ({ key: 'sticker', kind: 'hide', label: 'L+J sticker on the rear window', at: r.sticker }),
  },
  {
    id: 'bank',
    title: 'Bank of Leonida',
    place: 'Downtown Vice City',
    seconds: 75,
    payout: 30000,
    clip: 12,
    preview: 11,
    brief: "Lobby cam. Rico's crew was casing the same bank. Scrub Jason, lose Lucia's tattoo, and leave Rico's face for the cops.",
    tip: 'Rico walks in late, and a guard crosses the lobby. Freeze after Rico is in the shot.',
    draw: sceneBank,
    cam: 'CAM 11',
    camPlace: 'BANK OF LEONIDA · LOBBY',
    time: '10:02:31',
    targets: r => [
      { key: 'jface', kind: 'hide', label: "Jason's face", at: r.jface },
      { key: 'tattoo', kind: 'hide', label: "Lucia's L+J tattoo", at: r.tattoo },
      { key: 'rico', kind: 'keep', mustShow: true, label: "Rico's face (frame him)", at: r.rico },
    ],
    surprise: r => ({ key: 'slip', kind: 'hide', label: "Jason's deposit slip on the glass", at: r.slip }),
  },
  {
    id: 'marina',
    title: 'Keys Marina Drop',
    place: 'Leonida Keys',
    seconds: 70,
    payout: 42000,
    clip: 12,
    preview: 8,
    brief: 'Harbor patrol drone. The cash bag is on the dock and our boat registration is readable. Rico’s yacht has to be in the shot.',
    tip: 'Wait for Rico’s yacht to pull in. A jet ski screams past our hull.',
    draw: sceneMarina,
    cam: 'DRONE 2',
    camPlace: 'HARBOR PATROL · LEONIDA KEYS',
    stampLabel: 'Drone timestamp',
    time: '14:26:10',
    targets: r => [
      { key: 'bag', kind: 'hide', label: 'Duffel bag of cash', at: r.bag },
      { key: 'reg', kind: 'hide', label: 'Boat registration', at: r.reg },
      { key: 'ricoBoat', kind: 'keep', mustShow: true, label: "Rico's boat name", at: r.ricoBoat },
    ],
    surprise: r => ({ key: 'tag', kind: 'hide', label: "Lucia's name tag on the duffel", at: r.tag }),
  },
  {
    id: 'jewelry',
    title: 'Diamond Mile',
    place: 'Vice City Strip',
    seconds: 65,
    payout: 75000,
    clip: 12,
    preview: 4.5,
    brief: 'The big one. Street cam saw everything. Erase the crew and the plate, frame Rico, and leave the tourist alone.',
    tip: 'A bus sweeps the street while the crew run for the car. Wait for Rico to come up the sidewalk first.',
    draw: sceneJewelry,
    cam: 'CAM 22',
    camPlace: 'DIAMOND MILE · VICE CITY',
    time: '03:58:17',
    targets: r => [
      { key: 'jface', kind: 'hide', label: "Jason's face", at: r.jface },
      { key: 'lface', kind: 'hide', label: "Lucia's face", at: r.lface },
      { key: 'plate', kind: 'hide', label: 'License plate', at: r.plate },
      { key: 'rico', kind: 'keep', mustShow: true, label: "Rico's face (frame him)", at: r.rico },
      { key: 'tourist', kind: 'keep', label: "Tourist's face (innocent)", at: r.tourist },
    ],
    surprise: r => ({ key: 'card', kind: 'hide', label: "Jason's dropped ID card", at: r.card }),
  },
];

export async function ensureFonts() {
  // Font/CDN failures must not leave the start button disabled forever.
  let timeout;
  const fonts = Promise.allSettled([
    document.fonts.load('44px Anton'),
    document.fonts.load('600 22px "IBM Plex Mono"'),
    document.fonts.load('700 22px "IBM Plex Mono"'),
    document.fonts.load('700 30px Montserrat'),
    document.fonts.load('600 26px Montserrat'),
    document.fonts.load('800 20px Montserrat'),
  ]);
  await Promise.all([
    loadAvatarArt(),
    loadSceneArt(),
    Promise.race([fonts, new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]),
  ]);
  clearTimeout(timeout);
}

// The burned-in clock runs with the tape.
export function stampTime(c, t) {
  const [h, m, s] = c.time.split(':').map(Number);
  const total = h * 3600 + m * 60 + s + Math.floor(t);
  const two = n => String(n).padStart(2, '0');
  return `${two(Math.floor(total / 3600) % 24)}:${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
}

function labels(g, c, t, rec = true) {
  g.save();
  g.font = '600 22px IBM Plex Mono, monospace';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(20, 18, g.measureText(`${c.cam}  ${c.camPlace}`).width + 28, 38);
  g.fillStyle = '#e8ffe8';
  g.fillText(`${c.cam}  ${c.camPlace}`, 34, 38);
  if (rec) {
    g.fillStyle = '#ff2b2b';
    g.beginPath();
    g.arc(W - 118, 38, 9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#fff';
  g.fillText('REC', W - 100, 38);
  const stamp = `09/24/2026  ${stampTime(c, t)}  VCPD-NET`;
  g.font = '600 24px IBM Plex Mono, monospace';
  const box = { x: 20, y: H - 64, w: g.measureText('09/24/2026  00:00:00  VCPD-NET').width + 32, h: 44 };
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(box.x, box.y, box.w, box.h);
  g.fillStyle = '#e8ffe8';
  g.fillText(stamp, box.x + 16, box.y + box.h / 2);
  g.restore();
  return { x: box.x - 4, y: box.y - 4, w: box.w + 8, h: box.h + 8 };
}

// Full CCTV treatment for a frozen still: per-pixel grain, scanlines, vignette, then the labels.
function cctvStill(g, rand, c, t) {
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    const y = ((i / 4 / W) | 0) % 3 === 0 ? -10 : 0;
    d[i] = Math.max(0, Math.min(255, d[i] * 0.92 + n + y));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * 0.96 + n + y + 4));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * 0.92 + n + y));
  }
  g.putImageData(img, 0, 0);
  vignette(g);
  return labels(g, c, t);
}

function vignette(g) {
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

// Cheap live overlay for the playing tape: cached scanlines and grain frames instead of per-pixel work.
let liveCache;
function liveOverlay() {
  if (liveCache) return liveCache;
  const lines = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const lg = lines.getContext('2d');
  lg.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 3) lg.fillRect(0, y, W, 1);
  vignette(lg);
  const grain = [0, 1, 2, 3].map(k => {
    const c = Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 });
    const cg = c.getContext('2d');
    const img = cg.createImageData(c.width, c.height);
    const rand = rng(90 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 34;
    }
    cg.putImageData(img, 0, 0);
    return c;
  });
  liveCache = { lines, grain };
  return liveCache;
}

// How much of a rect is on screen and not behind something nearer, sampled on a grid.
// Returns the bounding box of the visible part and the visible share.
function visibility(rect, depth, blocked) {
  if (!rect || rect.w <= 0 || rect.h <= 0) return { rect: null, share: 0 };
  const front = blocked.filter(b => b.depth > depth);
  const N = 12;
  let seen = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = rect.x + ((i + 0.5) / N) * rect.w;
      const y = rect.y + ((j + 0.5) / N) * rect.h;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (front.some(b => x >= b.rect.x && x <= b.rect.x + b.rect.w && y >= b.rect.y && y <= b.rect.y + b.rect.h)) continue;
      seen++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  const share = seen / (N * N);
  const cw = rect.w / N / 2, ch = rect.h / N / 2;
  return { share, rect: seen ? clampRect({ x: x0 - cw, y: y0 - ch, w: x1 - x0 + cw * 2, h: y1 - y0 + ch * 2 }) : null };
}

// Below this share a target is out of sight: hidden evidence needs no edit, a must-show KEEP counts as missing.
const IN_SHOT = 0.3;

// Draws frame `t` of case `c` onto `g` and classifies every target:
// `targets` are in shot, `gone` are hidden evidence that needs no edit, `missing` are KEEPs that must show but don't.
function frame(g, c, t) {
  const { rects, blockers: blocked } = c.draw(g, t);
  const classify = spec => {
    const v = visibility(spec.at?.rect, spec.at?.depth ?? 0, blocked);
    return { ...spec, rect: v.rect, share: v.share, inShot: v.share >= IN_SHOT };
  };
  const all = c.targets(rects).map(classify);
  const surprise = c.surprise ? classify(c.surprise(rects)) : null;
  return {
    targets: all.filter(x => x.inShot).map(strip),
    gone: all.filter(x => !x.inShot && !(x.kind === 'keep' && x.mustShow)).map(strip),
    missing: all.filter(x => !x.inShot && x.kind === 'keep' && x.mustShow).map(strip),
    surprise: surprise?.inShot ? strip(surprise) : null,
    all,
  };
}
const strip = ({ at: _at, share: _share, inShot: _inShot, ...target }) => target;

// Draws a live frame for the playing tape, with the fast overlay. Returns every target's status.
export function drawLive(g, c, t) {
  const f = frame(g, c, t);
  const { lines, grain } = liveOverlay();
  g.drawImage(lines, 0, 0);
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'overlay';
  g.drawImage(grain[Math.abs(Math.floor(t * 24)) % grain.length], 0, 0, W, H);
  g.restore();
  // Tracking glitch: a bright band rolls down the picture every few seconds.
  const band = (t * 0.45) % 1;
  if (band < 0.18) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, (band / 0.18) * H - 30, W, 30);
  }
  const stamp = labels(g, c, t, Math.floor(t * 2) % 2 === 0);
  return { ...f, stamp };
}

// Renders the frozen still at `t` for the lab: { canvas, dataUrl, targets, gone, missing, surprise, t }.
export function renderCase(c, index, t = c.preview) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const f = frame(g, c, t);
  const stampRect = cctvStill(g, rng(1000 + index * 77), c, t);
  const targets = [...f.targets, { key: 'stamp', kind: 'keep', label: c.stampLabel ?? 'CCTV timestamp', rect: stampRect }]
    .map(x => ({ ...x, rect: clampRect(x.rect) }));
  return { canvas, dataUrl: canvas.toDataURL('image/png'), targets, gone: f.gone, missing: f.missing, surprise: f.surprise && { ...f.surprise, rect: clampRect(f.surprise.rect) }, t };
}

function clampRect(r) {
  const x = Math.max(0, Math.round(r.x));
  const y = Math.max(0, Math.round(r.y));
  return {
    x,
    y,
    w: Math.min(W, Math.round(r.x + r.w)) - x,
    h: Math.min(H, Math.round(r.y + r.h)) - y,
  };
}
