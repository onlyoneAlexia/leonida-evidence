// Live CCTV scenes: illustrated backgrounds and sprites (artwork/source/codex, see scripts/import-art.mjs)
// animated over a short clip. The player freezes the tape; that frame becomes the still they doctor.
// Every draw returns exact evidence bounds plus what was drawn in front of them, so evidence hidden
// behind a passing truck or a pillar at the frozen moment no longer has to be edited.
import { drawAvatar, drawHead, loadAvatarArt } from './avatars.js';
import { ART } from './art-manifest.js';

export const W = 1280;
export const H = 720;
const BACKGROUNDS = ['bg-kwik', 'bg-causeway', 'bg-bank', 'bg-marina', 'bg-jewelry'];

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
// Speeds up over the first `r` of a trip, cruises, and slows over the last `r`.
const ramp = r => u => {
  const v = 1 / (1 - r);
  return u < r ? (v * u * u) / (2 * r) : u > 1 - r ? 1 - (v * (1 - u) ** 2) / (2 * r) : v * (u - r / 2);
};
const stroll = ramp(0.3);
const dash = ramp(0.18);
const steady = u => u;
// 1 when `x` is mid-frame, falling to 0 `span` px either side: how hard a passing vehicle shakes the camera.
const near = (x, span) => clamp01(1 - Math.abs(x - W / 2) / span);

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function union(rects) {
  const list = rects.filter(Boolean);
  if (!list.length) return null;
  const x0 = Math.min(...list.map(r => r.x)), y0 = Math.min(...list.map(r => r.y));
  return { x: x0, y: y0, w: Math.max(...list.map(r => r.x + r.w)) - x0, h: Math.max(...list.map(r => r.y + r.h)) - y0 };
}

// --- People. Standing crew use the front-facing atlas; walks, runs, the stretch and the tourist's photos come
// from animation strips whose per-frame face and body boxes follow the head through the cycle. ---

const FIG = 330; // head-to-toe height of a figure at scale 1, as the crew atlas draws it
const FOOT = 6; // atlas poses stand this far above their feet point at scale 1
const DEPTH = 2; // a step toward the camera moves the feet down the screen this many times less than a step across

// Ground walked from a to b by progress p, in scale-1 px: nearer the camera, each screen pixel is less ground.
function ground(a, b, p) {
  const len = Math.hypot(b.x - a.x, (b.y - a.y) * DEPTH);
  const ds = b.s - a.s;
  return Math.abs(ds) < 1e-4 ? (len * p) / a.s : (len / ds) * Math.log((a.s + ds * p) / a.s);
}

// Where in its cycle (0..1) each frame of a strip starts: walks carry measured timings, other strips are even.
const starts = art => art.timing ?? Array.from({ length: art.frames }, (_, i) => i / art.frames);
const cycle = (art, phase) => {
  const at = starts(art), u = ((phase % 1) + 1) % 1;
  let frame = 0;
  while (frame + 1 < art.frames && at[frame + 1] <= u) frame++;
  return frame;
};

// On foot from a to b between t0 and t1 on an animation strip. Frames advance with the ground covered, so feet don't
// skate, and the stride stretches a little so every trip starts and ends on a feet-together frame.
function trip(t, t0, t1, a, b, sheet, ease = stroll) {
  const art = ART[sheet], at = starts(art);
  const p = ease(seg(t, t0, t1));
  const total = ground(a, b, 1);
  const raw = total / ((art.stride * FIG) / art.tall);
  // Whole cycles end on the rest frame; the other feet-together frame sits half a cycle round.
  const half = (at[(art.rest + art.frames / 2) % art.frames] - at[art.rest] + 1) % 1;
  const cycles = [0, half].map(o => o + Math.max(o ? 0 : 1, Math.round(raw - o))).sort((x, y) => Math.abs(x - raw) - Math.abs(y - raw))[0];
  return {
    x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p), sheet, flip: b.x < a.x,
    frame: cycle(art, at[art.rest] + 1e-6 + (cycles * ground(a, b, p)) / total),
  };
}

// Standing about: breathing, plus for the nervous a restless shift from foot to foot.
const idle = (st, t, nerves = 0) => ({
  ...st, x: st.x + nerves * (Math.sin(t * 1.9) * 4 + Math.sin(t * 5.3) * 1.6), breath: 1 + 0.009 * Math.sin(t * 2.3),
});

// One frame of an animation strip, head centred over the feet at (x, y). Returns that frame's face and body boxes.
function strip(g, name, frame, { x, y, s, drop = 0, flip = false, alpha = 1, squash = 1, breath = 1 }) {
  const a = ART[name];
  const size = (FIG * s) / a.tall;
  const h = size * breath, w = ((size * a.w) / a.h) * squash;
  const top = y + drop - FOOT * s - a.feet * h;
  if (alpha > 0.01) {
    g.save();
    g.globalAlpha = alpha;
    if (flip) { g.translate(2 * x, 0); g.scale(-1, 1); }
    g.drawImage(IMG[name], frame * a.w, 0, a.w, a.h, x - w / 2, top, w, h);
    g.restore();
  }
  const box = ([bx, by, bw, bh]) => ({ x: flip ? x + w / 2 - (bx + bw) * w : x - w / 2 + bx * w, y: top + by * h, w: bw * w, h: bh * h });
  return { face: box(a.face[frame]), body: box(a.body[frame]) };
}

// A crew member's front pose from the shared atlas, with the body that blocks the view.
function pose(g, who, { x, y, s, drop = 0, alpha = 1, squash = 1, breath = 1, tattoo = false }) {
  const drawn = drawAvatar(g, { avatar: who, x, y: y + drop, s, alpha, squash, breath, tattoo });
  const h = 340 * s * breath, w = ((340 * s) / 2) * squash;
  return { ...drawn, body: { x: x - w * 0.28, y: y + drop - h * 0.96, w: w * 0.56, h: h * 0.96 } };
}

// Someone in a strip pose (`sheet`, `frame`) or facing the camera: the atlas pose of `who`, or a front strip
// (`front`, `frontFrame`). `turn` (0..1) swings the strip pose round to the front one with a quick squash and blend,
// so poses never snap. Faces fading in or out count once they are mostly drawn.
function person(g, who, st) {
  const turn = st.sheet ? clamp01(st.turn ?? 0) : 1;
  const alpha = st.alpha ?? 1;
  const parts = [];
  if (turn < 0.56) parts.push(strip(g, st.sheet, st.frame, { ...st, alpha: alpha * clamp01((0.56 - turn) / 0.12), squash: 1 - 0.28 * clamp01(turn / 0.5) }));
  if (turn > 0.44) {
    const o = { ...st, flip: false, alpha: alpha * clamp01((turn - 0.44) / 0.12), squash: 0.72 + 0.28 * clamp01((turn - 0.5) / 0.5) };
    parts.push(st.front ? strip(g, st.front, st.frontFrame ?? 0, o) : pose(g, who, o));
  }
  const seen = alpha >= 0.5;
  return {
    face: seen ? union(parts.map(p => p.face)) : null,
    tattoo: seen ? parts.find(p => p.tattoo)?.tattoo ?? null : null,
    body: seen ? union(parts.map(p => p.body)) : null,
    depth: st.y,
  };
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

// --- Light and motion effects. Lights add ('lighter') so they read as glare on the tape. ---

function glow(g, x, y, r, color, alpha) {
  if (alpha <= 0.005 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${color},${alpha})`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// A vehicle tearing past: fading copies trail behind it like smear on a cheap camera.
function streaks(g, img, x, y, w, h, dir, n = 3, gap = 0.06) {
  g.save();
  for (let k = n; k >= 1; k--) {
    g.globalAlpha = 0.34 / (k + 0.6);
    g.drawImage(img, x - dir * k * w * gap, y, w, h);
  }
  g.restore();
}

// Spray, dust or road mist kicked up behind a moving vehicle: specks that fly back, rise and fade.
function kickup(g, t, x, y, dir, { n = 16, reach = 120, rise = 30, size = 5, color = '255,255,255', alpha = 0.55, seed = 1 } = {}) {
  const rand = rng(seed);
  g.save();
  g.fillStyle = `rgb(${color})`;
  for (let i = 0; i < n; i++) {
    const a = rand(), b = rand();
    const age = (t * (1.8 + a) + i / n) % 1;
    g.globalAlpha = alpha * (1 - age);
    g.beginPath();
    g.arc(x - dir * age * reach * (0.5 + b * 0.7), y - Math.sin(age * Math.PI) * rise * (0.4 + a), size * (0.5 + age * 1.6), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// A VCPD cruiser in side view: body bounce, motion streaks, headlights at night and a flashing red and blue bar.
// `dir` 1 drives right, -1 left. Returns the cabin and body, which block the view (not the air above the hood).
function cruiser(g, t, cx, bottom, w, dir, { night = true, seed = 1 } = {}) {
  const img = IMG['police-cruiser'], a = ART['police-cruiser'];
  const h = (w * a.h) / a.w;
  const x = cx - w / 2, y = bottom - h - Math.abs(Math.sin(t * 23 + seed)) * 2.4 - Math.sin(t * 9) * 1.2;
  const at = (fx, fy) => ({ x: dir > 0 ? x + fx * w : 2 * cx - x - fx * w, y: y + fy * h });
  const part = (fx, fy, fw, fh) => ({ x: dir > 0 ? x + fx * w : 2 * cx - x - (fx + fw) * w, y: y + fy * h, w: fw * w, h: fh * h });
  g.save();
  if (dir < 0) { g.translate(2 * cx, 0); g.scale(-1, 1); }
  streaks(g, img, x, y, w, h, 1);
  g.drawImage(img, x, y, w, h);
  g.restore();
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (night) {
    const lamp = at(0.955, 0.6);
    glow(g, lamp.x, lamp.y, w * 0.14, '255,244,210', 0.8);
    glow(g, lamp.x + dir * w * 0.3, lamp.y + h * 0.3, w * 0.36, '255,240,200', 0.18);
  }
  // Two quick red flashes, then two blue: the bar washes everything near it.
  const beat = (t * 2.4 + seed * 0.37) % 1;
  const red = beat < 0.1 || (beat > 0.18 && beat < 0.28), blue = (beat > 0.5 && beat < 0.6) || (beat > 0.68 && beat < 0.78);
  for (const [on, fx, color] of [[red, 0.494, '255,40,70'], [blue, 0.453, '50,120,255']]) {
    const p = at(fx, 0.035);
    glow(g, p.x, p.y, w * (on ? 0.62 : 0.1), color, on ? (night ? 0.5 : 0.32) : 0.3);
    glow(g, p.x, p.y, w * 0.05, on ? '255,255,255' : color, on ? 0.95 : 0.5);
  }
  g.restore();
  return { bodies: [part(0.24, 0.07, 0.45, 0.25), { ...part(0.01, 0.31, 0.98, 0.69), h: bottom - y - 0.31 * h }], depth: bottom };
}

// The VCPD helicopter, bobbing, with rotor flicker and blinking nav lights. `face` runs from -1 (nose left)
// to 1 (nose right) through a quick turn. Returns where its searchlight hangs.
function helicopter(g, t, cx, cy, w, face) {
  const img = IMG['helicopter-police'], a = ART['helicopter-police'];
  const h = (w * a.h) / a.w;
  const x = cx - w / 2, y = cy - h / 2 + Math.sin(t * 2.1) * 3;
  const sx = Math.sign(face || 1) * Math.max(0.15, Math.abs(face));
  const at = (fx, fy) => ({ x: cx + (fx - 0.5) * w * sx, y: y + fy * h });
  g.save();
  g.translate(cx, 0);
  g.scale(sx, 1);
  g.translate(-cx, 0);
  g.drawImage(img, x, y, w, h);
  // Blades sweeping over the painted blur.
  g.strokeStyle = 'rgba(20,22,44,0.4)';
  g.lineWidth = 2.5;
  g.beginPath();
  for (let k = 0; k < 2; k++) {
    const ang = t * 41 + k * 1.6;
    g.moveTo(x + 0.607 * w - Math.cos(ang) * w * 0.5, y + 0.144 * h - Math.sin(ang) * h * 0.05);
    g.lineTo(x + 0.607 * w + Math.cos(ang) * w * 0.5, y + 0.144 * h + Math.sin(ang) * h * 0.05);
  }
  g.stroke();
  g.restore();
  g.save();
  g.globalCompositeOperation = 'lighter';
  const tail = at(0.08, 0.45), belly = at(0.55, 0.78);
  if (Math.sin(t * 7) > 0.2) glow(g, tail.x, tail.y, 16, '255,40,40', 0.9);
  if ((t * 1.3) % 1 < 0.08) glow(g, belly.x, belly.y, 26, '255,255,255', 0.9);
  g.restore();
  return at(0.838, 0.894);
}

// A searchlight: a cone of light from `src` down to a pool on the ground; `k` is its strength.
function searchlight(g, src, pool, k) {
  if (k <= 0.01) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const cone = g.createLinearGradient(src.x, src.y, pool.x, pool.y);
  cone.addColorStop(0, `rgba(255,250,225,${0.42 * k})`);
  cone.addColorStop(1, `rgba(255,250,225,${0.07 * k})`);
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(src.x - 4, src.y);
  g.lineTo(src.x + 4, src.y);
  g.lineTo(pool.x + pool.r, pool.y);
  g.lineTo(pool.x - pool.r, pool.y);
  g.closePath();
  g.fill();
  g.translate(pool.x, pool.y);
  g.scale(1, 0.36);
  glow(g, 0, 0, pool.r * 1.15, '255,248,220', 0.42 * k);
  g.restore();
  glow(g, src.x, src.y, 22, '255,255,240', 0.9 * k);
}

// Alarm strobes: red beacons flashing in turn, each washing the room around it in red. `k` fades them in.
function alarm(g, t, lamps, k = 1) {
  if (k <= 0) return;
  let wash = 0;
  for (const [i, [x, y, r]] of lamps.entries()) {
    const p = Math.max(0, Math.sin((t * 1.6 + i * 0.5) * Math.PI * 2)) ** 2 * k;
    wash = Math.max(wash, p);
    g.fillStyle = p > 0.3 ? '#ff4a5a' : '#6a1420';
    g.beginPath();
    g.arc(x, y, 8, Math.PI, 0);
    g.fill();
    g.save();
    g.globalCompositeOperation = 'lighter';
    glow(g, x, y, r, '255,30,50', 0.6 * p);
    glow(g, x, y - 3, 22, '255,210,210', p);
    g.restore();
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = `rgba(255,20,40,${0.12 * wash})`;
  g.fillRect(0, 0, W, H);
  g.restore();
}

// A camera flash: a white burst with a star glint. While bright it whites out the evidence right next to it.
function cameraFlash(g, x, y, k) {
  if (k <= 0.01) return null;
  g.save();
  g.globalCompositeOperation = 'lighter';
  glow(g, x, y, 40 + 130 * k, '255,255,255', k);
  glow(g, x, y, 26 + 30 * k, '255,255,255', k);
  g.strokeStyle = `rgba(255,255,255,${0.8 * k})`;
  g.lineWidth = 2;
  g.beginPath();
  for (const [dx, dy] of [[1, 0], [0, 1], [0.7, 0.7], [0.7, -0.7]]) {
    g.moveTo(x - dx * 90 * k, y - dy * 90 * k);
    g.lineTo(x + dx * 90 * k, y + dy * 90 * k);
  }
  g.stroke();
  g.restore();
  const r = 62 * k;
  return k > 0.4 ? { x: x - r, y: y - r, w: r * 2, h: r * 2 } : null;
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

function neon(g, text, x, y, size, color, bright = 1) {
  g.save();
  g.font = `${size}px Anton, sans-serif`;
  g.textBaseline = 'middle';
  g.globalAlpha = 0.35 + 0.65 * bright;
  g.shadowColor = color;
  g.shadowBlur = 26 * bright;
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
  for (const fx of [0.2, 0.8]) glow(g, car.x + car.w * fx, car.y + car.h * 0.5, car.w * 0.12, '255,170,40', 0.9);
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

// --- Scenes. Each draws the frame at `t` seconds and returns evidence rects, blockers and the frame's fx
// (camera shake from heavy traffic, white-out from a flash). ---

function draw(g, list) {
  // Nearest last: everything drawn later (larger depth) can block what was drawn before it.
  const out = [];
  for (const item of list.filter(Boolean).sort((a, b) => a.depth - b.depth)) out.push({ depth: item.depth, ...item.draw() });
  return out;
}
// Anything drawn with a `body` (or several `bodies`) blocks what stands behind it.
const blockers = drawn => drawn.flatMap(d => (d.bodies ?? [d.body]).filter(Boolean).map(rect => ({ depth: d.depth, rect })));
// A drawn person, filed under `key`, whose body blocks whatever stands behind them.
const as = (key, p) => ({ [key]: p, body: p.body });
const target = p => p?.face && { rect: p.face, depth: p.depth };

const KWIK = {
  door: { x: 1110, y: 392, s: 0.6 }, lookout: { x: 1030, y: 430, s: 0.68 },
  pillar: { x: 886, y: 497, s: 0.82 }, car: { x: 656, y: 604, s: 1.05 },
};

// Jason steps out of the store and freezes, facing the lot, as a cruiser screams past; when the chopper arrives
// he hurries behind the canopy pillar, waits a beat out of its light, then walks to the car and waits there,
// fidgeting. He is still in view when the tape ends.
function kwikJason(t) {
  const { door, lookout, pillar, car } = KWIK;
  if (t < 0.8) return null;
  if (t < 3.5) return idle({ ...trip(t, 0.8, 1.9, door, lookout, 'jason-walk'), alpha: seg(t, 0.8, 1.05), turn: seg(t, 1.95, 2.25) }, t, seg(t, 2.25, 2.6));
  if (t < 5.3) return { ...trip(t, 3.8, 5.0, lookout, pillar, 'jason-walk'), turn: 1 - seg(t, 3.5, 3.8) };
  return idle({ ...trip(t, 5.3, 7.4, pillar, car, 'jason-walk'), turn: seg(t, 7.45, 7.8) }, t, seg(t, 7.8, 8.5));
}

function sceneKwik(g, t) {
  g.drawImage(IMG['bg-kwik'], 0, 0, W, H);
  neon(g, 'KWIK MART', 792, 168, 60, '#ff3fa4', flicker(t, 1));
  neon(g, '24/7', 1100, 168, 48, '#29e7ff');
  const screen = monitor(g, { x: 1068, y: 250, w: 64, h: 46 }, t);
  // The chopper slides in from the right, hovers over the store, then turns and climbs away.
  const heliIn = t >= 3.0 && t < 11.6;
  const hin = stroll(seg(t, 3.0, 4.9)), hout = stroll(seg(t, 9.0, 11.6));
  const light = heliIn && helicopter(g, t, lerp(1470, 985, hin) + 580 * hout, 66 - 150 * hout, 230, lerp(-1, 1, smooth(seg(t, 8.6, 9.1))));
  const J = kwikJason(t);
  const copP = seg(t, 2.45, 3.4);
  const copX = lerp(1760, -560, copP);
  const drawn = draw(g, [
    J && { depth: J.y, draw: () => as('jason', person(g, 'jason', J)) },
    { depth: 612, draw: () => {
      const car = sprite(g, 'car-purple-rear', 470, 612, 300);
      return { plate: plateIn(g, car.place, 'KWK 118'), body: car.rect };
    } },
    // A cruiser tears across the forecourt right under the camera.
    copP > 0 && copP < 1 && { depth: 718, draw: () => cruiser(g, t, copX, 718, 640, -1) },
    // The canopy pillar stands right in front of the camera.
    { depth: 900, draw: () => ({ body: sprite(g, 'pillar-canopy', 887, 740, 150).rect }) },
  ]);
  if (light) searchlight(g, light, { x: 890 + 330 * Math.sin((t - 5.3) * 1.05), y: 612 + 24 * Math.sin(t * 0.8), r: 120 }, seg(t, 4.0, 4.5) * (1 - seg(t, 8.5, 8.9)));
  const car = drawn.find(d => d.plate);
  return {
    rects: { face: target(drawn.find(d => d.jason)?.jason), plate: { rect: car.plate, depth: car.depth }, screen: { rect: screen, depth: -1 } },
    blockers: blockers(drawn),
    fx: { shake: copP > 0 && copP < 1 ? 0.55 * near(copX, 900) : 0, flash: 0 },
  };
}

const CAUSEWAY = { car: { x: 296, y: 606, s: 0.92 }, rail: { x: 870, y: 598, s: 0.9 }, back: { x: 300, y: 608, s: 0.92 } };

// Lucia climbs out of the driver's side, strolls behind the car to the railing, turns to the camera for a long
// stretch, then heads back.
function causewayLucia(t) {
  const { car, rail, back } = CAUSEWAY;
  if (t < 1.4) return null;
  // Stepping out: she rises from behind the car before she walks.
  if (t < 5.1) return { ...trip(t, 1.7, 5.0, car, rail, 'lucia-walk'), drop: 90 * (1 - smooth(seg(t, 1.4, 2.0))) };
  const stretch = t < 5.5 ? 0 : t < 5.85 ? 1 : t < 7.1 ? 2 : t < 7.45 ? 3 : 0;
  const front = { front: 'lucia-stretch', frontFrame: stretch };
  if (t < 9.1) return idle({ ...rail, sheet: 'lucia-walk', frame: ART['lucia-walk'].rest, ...front, turn: seg(t, 5.1, 5.45) }, t);
  return { ...trip(t, 9.4, 12.9, rail, back, 'lucia-walk'), ...front, frontFrame: 0, turn: 1 - seg(t, 9.1, 9.4) };
}

function sceneCauseway(g, t) {
  g.drawImage(IMG['bg-causeway'], 0, 0, W, H);
  // Below the camera label, which covers the top of the sign.
  signText(g, [['LEONIDA CAUSEWAY', '700 30px Montserrat, sans-serif', 0], ['VICE CITY  →  EXIT 5A', '600 22px Montserrat, sans-serif', 40]], 112, 94);
  glints(g, t, { x: 520, y: 300, w: 760, h: 110 });
  const L = causewayLucia(t);
  const truckP = seg(t, 4.6, 8.4);
  const truckX = lerp(1350, -1000, truckP);
  const copP = seg(t, 2.2, 3.3);
  const drawn = draw(g, [
    // A cruiser flies down the far lane, behind the parked car.
    copP > 0 && copP < 1 && { depth: 552, draw: () => cruiser(g, t, lerp(-460, 1760, copP), 552, 390, 1, { night: false, seed: 2 }) },
    L && { depth: L.y, draw: () => as('lucia', person(g, 'lucia', L)) },
    { depth: 655, draw: () => {
      const car = sprite(g, 'car-orange-rear', 520, 655, 400);
      hazards(g, car.rect, t);
      const sticker = heartSticker(g, car.rect.x + car.rect.w * 0.66, car.rect.y + car.rect.h * 0.2, car.rect.w * 0.05);
      return { plate: plateIn(g, car.place, 'LCJ 0924'), sticker, body: car.rect };
    } },
    truckP > 0 && truckP < 1 && { depth: 760, draw: () => {
      const bounce = Math.abs(Math.sin(t * 17)) * 2;
      const { rect: r } = sprite(g, 'truck-box', truckX, 760 - bounce, 880);
      kickup(g, t, r.x + r.w * 0.8, 748, -1, { n: 18, reach: 170, rise: 40, size: 9, color: '214,190,160', alpha: 0.32, seed: 4 });
      // The cargo box, and the lower cab in front of it.
      return { bodies: [{ x: r.x + r.w * 0.27, y: r.y, w: r.w * 0.73, h: r.h + bounce }, { x: r.x, y: r.y + r.h * 0.22, w: r.w * 0.27, h: r.h * 0.78 + bounce }] };
    } },
  ]);
  const lucia = drawn.find(d => d.lucia)?.lucia;
  const car = drawn.find(d => d.plate);
  return {
    rects: {
      plate: { rect: car.plate, depth: car.depth },
      face: target(lucia),
      sticker: { rect: car.sticker, depth: car.depth },
    },
    blockers: blockers(drawn),
    fx: { shake: truckP > 0 && truckP < 1 ? 0.7 * near(truckX, 1000) : 0, flash: 0 },
  };
}

const BANK = { door: { x: 60, y: 470, s: 0.78 }, rico: { x: 1010, y: 650, s: 1.06 } };

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
  const J = idle({ x: 430 + Math.sin(t * 0.8) * 4, y: 612, s: 1.0 }, t, 0.35);
  const L = idle({ x: 700, y: 640, s: 1.06, tattoo: true }, t + 1.4, 0.15);
  // Rico strolls in from the side door and stops to face the room.
  const R = t < 2.45 ? null : idle({ ...trip(t, 2.6, 9.4, BANK.door, BANK.rico, 'rico-walk'), alpha: seg(t, 2.45, 2.75), turn: seg(t, 9.45, 9.8) }, t, 0.2 * seg(t, 9.8, 10.2));
  const guard = t >= 5.4 && t < 10.6 ? trip(t, 5.4, 10.6, { x: 1420, y: 718, s: 1.4 }, { x: -170, y: 718, s: 1.4 }, 'guard-walk', steady) : null;
  const drawn = draw(g, [
    { depth: J.y, draw: () => as('jason', person(g, 'jason', J)) },
    { depth: L.y, draw: () => as('lucia', person(g, 'lucia', L)) },
    R && { depth: R.y, draw: () => as('rico', person(g, 'rico', R)) },
    guard && { depth: guard.y, draw: () => person(g, null, guard) },
  ]);
  // The silent alarm trips late in the tape.
  alarm(g, t, [[215, 125, 420], [1066, 125, 420]], seg(t, 8.2, 8.5));
  const pick = key => drawn.find(d => d[key])?.[key];
  const [jason, lucia, rico] = [pick('jason'), pick('lucia'), pick('rico')];
  return {
    rects: {
      jface: target(jason),
      tattoo: lucia.tattoo && { rect: lucia.tattoo, depth: lucia.depth },
      rico: target(rico),
      slip: { rect: slip, depth: -1 },
    },
    blockers: blockers(drawn),
    fx: { shake: 0, flash: 0 },
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
    // The jet ski skips from wave to wave, nose bucking, throwing a rooster tail of spray.
    jetP > 0 && jetP < 1 && { depth: 612, draw: () => {
      const x = lerp(-380, 1450, jetP), hop = Math.abs(Math.sin(t * 6.5)) * 12;
      const a = ART.jetski, w = 330, h = (w * a.h) / a.w;
      kickup(g, t, x - w * 0.36, 600, 1, { n: 26, reach: 230, rise: 70, size: 7, alpha: 0.7, seed: 9 });
      g.save();
      g.translate(x, 612 - hop);
      g.rotate(-Math.cos(t * 6.5) * 0.06);
      g.drawImage(IMG.jetski, -w / 2, -h, w, h);
      g.restore();
      kickup(g, t, x + w * 0.2, 606, -1, { n: 10, reach: 50, rise: 26, size: 5, alpha: 0.6, seed: 12 });
      return { body: { x: x - w / 2, y: 612 - hop - h, w, h: h + hop } };
    } },
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
    fx: { shake: jetP > 0 && jetP < 1 ? 0.12 * near(lerp(-380, 1450, jetP), 500) : 0, flash: 0 },
  };
}

const JEWELRY = {
  jason: { x: 360, y: 470, s: 0.82 }, lucia: { x: 470, y: 478, s: 0.84 },
  jcar: { x: 905, y: 668, s: 1.12 }, lcar: { x: 1080, y: 672, s: 1.12 },
  rico: { x: 1340, y: 520, s: 0.9 }, ricoStop: { x: 760, y: 540, s: 0.92 },
};

// Grabbing from the smashed window (a dip now and then), a turn, a dash to the car, then a nervous wait by it.
function jewelryRunner(t, start, from, to, sheet, seed) {
  const go = start + 0.25, stop = go + 1.15;
  if (t < start) return idle({ ...from, drop: 8 * Math.max(0, Math.sin(t * 2.2 + seed)) ** 4 * (1 - seg(t, start - 0.5, start)) }, t + seed, 0.4);
  // Turn away from the camera to run, and back round to it at the car.
  const turn = t < stop ? 1 - seg(t, start, go) : seg(t, stop + 0.05, stop + 0.35);
  return idle({ ...trip(t, go, stop, from, to, sheet, dash), turn }, t + seed, seg(t, stop + 0.35, stop + 1));
}

// The tourist's routine: camera at the chest, up to the eye, flash, lower it with a grin. Flashes at 2.2, 5.5 and 8.8 s.
function touristPhoto(t) {
  const u = (((t - 0.15) % 3.3) + 3.3) % 3.3;
  return { frame: u < 1.6 ? 0 : u < 2.0 ? 1 : u < 2.6 ? 2 : 3, flash: u < 2.05 ? 0 : clamp01((u - 2.05) / 0.02) * Math.exp(-(u - 2.07) * 12) };
}

function sceneJewelry(g, t) {
  g.drawImage(IMG['bg-jewelry'], 0, 0, W, H);
  neon(g, 'DIAMOND MILE JEWELERS', 150, 88, 44, '#ff4fd8', flicker(t, 4));
  const card = idCard(g, { x: 206, y: 590, w: 78, h: 48 });
  const { jason, lucia, jcar, lcar, rico, ricoStop } = JEWELRY;
  // The chopper arrives late and hangs over the towers, its searchlight hunting along the street.
  const heliIn = t >= 7.3;
  const light = heliIn && helicopter(g, t, lerp(1480, 1060, stroll(seg(t, 7.3, 9.0))), 112, 250, -1);
  const L = jewelryRunner(t, 5.3, lucia, lcar, 'lucia-run', 1.7);
  const J = jewelryRunner(t, 5.65, jason, jcar, 'jason-run', 0);
  // Rico strolls up the sidewalk from the right while the crew run, then stops to watch.
  const R = t < 4.5 ? null : idle({ ...trip(t, 4.5, 8.4, rico, ricoStop, 'rico-walk'), turn: seg(t, 8.45, 8.8) }, t, 0.15 * seg(t, 8.8, 9.2));
  const photo = touristPhoto(t);
  const tourist = { x: 590, y: 560, s: 0.95, sheet: 'tourist-photo', frame: photo.frame };
  const busP = seg(t, 5.8, 8.0);
  const busX = lerp(-1400, 1450, busP);
  const copP = seg(t, 2.9, 3.75);
  const copX = lerp(-640, 1920, copP);
  const drawn = draw(g, [
    { depth: tourist.y, draw: () => as('tourist', person(g, null, tourist)) },
    { depth: J.y, draw: () => as('jason', person(g, 'jason', J)) },
    { depth: L.y, draw: () => as('lucia', person(g, 'lucia', L)) },
    R && { depth: R.y, draw: () => as('rico', person(g, 'rico', R)) },
    { depth: 708, draw: () => {
      const car = sprite(g, 'car-red-rear', 1000, 708, 380);
      return { plate: plateIn(g, car.place, 'VC 2HOT'), body: car.rect };
    } },
    copP > 0 && copP < 1 && { depth: 752, draw: () => {
      kickup(g, t, copX - 250, 745, 1, { n: 18, reach: 200, rise: 26, size: 8, color: '190,205,255', alpha: 0.3, seed: 6 });
      return cruiser(g, t, copX, 752, 640, 1, { seed: 3 });
    } },
    busP > 0 && busP < 1 && { depth: 770, draw: () => {
      const a = ART['bus-city'], w = 1500, h = (w * a.h) / a.w, y = 770 - h - Math.abs(Math.sin(t * 12)) * 2;
      streaks(g, IMG['bus-city'], busX - w / 2, y, w, h, 1, 2, 0.035);
      g.drawImage(IMG['bus-city'], busX - w / 2, y, w, h);
      for (const fx of [0.2, 0.78]) kickup(g, t, busX - w / 2 + fx * w, 760, 1, { n: 14, reach: 220, rise: 34, size: 10, color: '190,205,255', alpha: 0.28, seed: 7 + fx });
      return { body: { x: busX - w / 2, y, w, h: 770 - y } };
    } },
  ]);
  const tour = drawn.find(d => d.tourist)?.tourist;
  // The flash goes off at the camera, just above the face box that the raised camera covers.
  const burst = photo.flash > 0.01 && cameraFlash(g, tour.face.x + tour.face.w * 0.5, tour.face.y + tour.face.h * 0.35, photo.flash);
  if (light) searchlight(g, light, { x: 930 + 240 * Math.sin((t - 8.2) * 1.2), y: 648, r: 135 }, seg(t, 8.0, 8.6));
  alarm(g, t, [[664, 128, 520], [128, 128, 460]]);
  rain(g, t);
  const pick = key => drawn.find(d => d[key]);
  const face = key => pick(key) && target(pick(key)[key]);
  const blocked = blockers(drawn);
  if (burst) blocked.push({ depth: 1e4, rect: burst });
  return {
    rects: {
      jface: face('jason'),
      lface: face('lucia'),
      plate: { rect: pick('plate').plate, depth: pick('plate').depth },
      rico: face('rico'),
      tourist: face('tourist'),
      card: { rect: card, depth: 638 },
    },
    blockers: blocked,
    fx: {
      shake: Math.max(busP > 0 && busP < 1 ? 0.85 * near(busX, 1300) : 0, copP > 0 && copP < 1 ? 0.45 * near(copX, 900) : 0),
      flash: 0.4 * photo.flash,
    },
  };
}

// Clocks shrink as the jobs get bigger; the tape's running time counts against the clock.
// `cues` are the tape's sound moments, played by sound.cue(name) as the tape reaches them.
export const CASES = [
  {
    id: 'kwik',
    title: 'Kwik Mart Stick-Up',
    place: 'Vice Beach',
    seconds: 90,
    payout: 12000,
    clip: 12,
    preview: 4.0,
    brief: 'Jason hit the Kwik Mart on Ocean Drive and walked straight past the pump camera to the getaway car.',
    tip: 'Jason ducks behind the canopy pillar while the chopper sweeps the lot.',
    draw: sceneKwik,
    cam: 'CAM 04',
    camPlace: 'KWIK MART #117 · VICE BEACH',
    time: '02:13:44',
    cues: [{ at: 2.2, name: 'siren' }, { at: 2.75, name: 'screech' }, { at: 3.1, name: 'rotor' }],
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
    preview: 3.6,
    brief: 'Toll camera caught the getaway car on the shoulder at sunset. Lucia stepped out to stretch. Of course she did.',
    tip: 'A box truck blocks the lane for a split second. Catch it covering both the plate and Lucia.',
    draw: sceneCauseway,
    cam: 'TOLL 5A',
    camPlace: 'LEONIDA CAUSEWAY · EASTBOUND',
    time: '19:47:02',
    cues: [{ at: 2.0, name: 'siren' }, { at: 4.5, name: 'horn' }, { at: 4.9, name: 'rumble' }],
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
    cues: [{ at: 8.2, name: 'alarm' }],
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
    cues: [{ at: 3.9, name: 'jetski' }, { at: 6.2, name: 'horn' }],
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
    preview: 10,
    brief: 'The big one. Street cam saw everything. Erase the crew and the plate, frame Rico, and leave the tourist alone.',
    tip: 'A bus sweeps the street while the crew run for the car. Wait for Rico to come up the sidewalk first.',
    draw: sceneJewelry,
    cam: 'CAM 22',
    camPlace: 'DIAMOND MILE · VICE CITY',
    time: '03:58:17',
    cues: [
      { at: 0.05, name: 'alarm' }, { at: 2.2, name: 'flash' }, { at: 2.7, name: 'siren' }, { at: 3.3, name: 'screech' },
      { at: 5.5, name: 'flash' }, { at: 5.9, name: 'rumble' }, { at: 7.2, name: 'rotor' }, { at: 8.8, name: 'flash' },
    ],
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
  const { rects, blockers: blocked, fx } = c.draw(g, t);
  const classify = spec => {
    const v = visibility(spec.at?.rect, spec.at?.depth ?? 0, blocked);
    return { ...spec, rect: v.rect, share: v.share, inShot: v.share >= IN_SHOT };
  };
  const all = c.targets(rects).map(classify);
  const surprise = c.surprise ? classify(c.surprise(rects)) : null;
  return {
    targets: all.filter(x => x.inShot).map(bare),
    gone: all.filter(x => !x.inShot && !(x.kind === 'keep' && x.mustShow)).map(bare),
    missing: all.filter(x => !x.inShot && x.kind === 'keep' && x.mustShow).map(bare),
    surprise: surprise?.inShot ? bare(surprise) : null,
    all,
    fx: { shake: clamp01(fx?.shake ?? 0), flash: clamp01(fx?.flash ?? 0) },
  };
}
const bare = ({ at: _at, share: _share, inShot: _inShot, ...target }) => target;

// Draws a live frame for the playing tape, with the fast overlay. Returns every target's status, plus `fx`:
// { shake, flash } (0..1) for the camera wobble and white-out the player should feel at this moment.
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
