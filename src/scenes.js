// Procedural CCTV stills for each case. Every scene is drawn in code so we
// know exactly where each piece of evidence sits (the forensics check needs it).

export const W = 1280;
export const H = 720;

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

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function sky(g, stops, horizon) {
  const grad = g.createLinearGradient(0, 0, 0, horizon);
  stops.forEach(([p, c]) => grad.addColorStop(p, c));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, horizon);
}

function stars(g, rand, n, maxY) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`;
    g.fillRect(rand() * W, rand() * maxY, 2, 2);
  }
}

function skyline(g, rand, baseY, color, windowColor, minH = 60, maxH = 220) {
  let x = -20;
  while (x < W) {
    const w = 40 + rand() * 90;
    const h = minH + rand() * (maxH - minH);
    g.fillStyle = color;
    g.fillRect(x, baseY - h, w, h);
    for (let wy = baseY - h + 10; wy < baseY - 8; wy += 14) {
      for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        if (rand() < 0.35) {
          g.fillStyle = windowColor;
          g.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += w + 4;
  }
}

function palm(g, x, baseY, h, color, lean = 0) {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 10;
  g.lineCap = 'round';
  const tx = x + lean;
  const ty = baseY - h;
  g.beginPath();
  g.moveTo(x, baseY);
  g.quadraticCurveTo(x + lean * 0.2, baseY - h * 0.5, tx, ty);
  g.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const len = h * 0.42;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.45 + len * 0.25;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty - 30, ex, ey);
    g.lineWidth = 7;
    g.stroke();
  }
  g.restore();
}

function neon(g, text, x, y, size, color, font = 'Anton') {
  g.save();
  g.font = `${size}px ${font}`;
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 8;
  g.fillStyle = '#fff';
  g.globalAlpha = 0.85;
  g.fillText(text, x, y);
  g.restore();
}

function hawaiian(g, x, y, w, h, base, flower, rand) {
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  for (let i = 0; i < (w * h) / 180; i++) {
    const fx = x + rand() * w;
    const fy = y + rand() * h;
    const r = 3 + rand() * 4;
    g.fillStyle = flower;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffe066';
    g.beginPath();
    g.arc(fx, fy, r * 0.45, 0, Math.PI * 2);
    g.fill();
  }
}

// Draws a stylised person standing with feet at (x, y). Returns evidence rects.
function person(g, o, rand) {
  const s = o.s ?? 1;
  const skin = o.skin;
  const hx = o.x;
  const hy = o.y - 290 * s;
  const shoulderY = o.y - 245 * s;
  const hipY = o.y - 135 * s;

  // legs
  g.fillStyle = o.pants;
  rr(g, hx - 38 * s, hipY, 34 * s, 135 * s, 8 * s);
  g.fill();
  rr(g, hx + 4 * s, hipY, 34 * s, 135 * s, 8 * s);
  g.fill();
  g.fillStyle = '#1b1b1f';
  rr(g, hx - 42 * s, o.y - 14 * s, 42 * s, 16 * s, 6 * s);
  g.fill();
  rr(g, hx + 2 * s, o.y - 14 * s, 42 * s, 16 * s, 6 * s);
  g.fill();

  // arms (skin) behind torso
  g.fillStyle = skin;
  rr(g, hx - 72 * s, shoulderY + 10 * s, 26 * s, 120 * s, 12 * s);
  g.fill();
  rr(g, hx + 46 * s, shoulderY + 10 * s, 26 * s, 120 * s, 12 * s);
  g.fill();

  // torso
  g.save();
  rr(g, hx - 52 * s, shoulderY, 104 * s, hipY - shoulderY + 6 * s, 18 * s);
  g.clip();
  if (o.pattern === 'hawaiian') {
    hawaiian(g, hx - 52 * s, shoulderY, 104 * s, hipY - shoulderY + 6 * s, o.shirt, o.flower, rand);
  } else {
    g.fillStyle = o.shirt;
    g.fillRect(hx - 52 * s, shoulderY, 104 * s, hipY - shoulderY + 6 * s);
    if (o.pattern === 'stripes') {
      g.fillStyle = o.flower;
      for (let i = 0; i < 12; i++) g.fillRect(hx - 52 * s, shoulderY + i * 12 * s, 104 * s, 4 * s);
    }
  }
  g.restore();
  // sleeves
  g.fillStyle = o.pattern === 'hawaiian' ? o.shirt : o.shirt;
  rr(g, hx - 74 * s, shoulderY, 32 * s, 42 * s, 10 * s);
  g.fill();
  rr(g, hx + 42 * s, shoulderY, 32 * s, 42 * s, 10 * s);
  g.fill();

  if (o.chain) {
    g.strokeStyle = '#f5c542';
    g.lineWidth = 4 * s;
    g.beginPath();
    g.arc(hx, shoulderY + 4 * s, 26 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  }

  let tattoo = null;
  if (o.tattoo) {
    // detailed rose + heart tattoo on the right forearm
    const tx = hx + 59 * s;
    const ty = shoulderY + 88 * s;
    g.save();
    g.strokeStyle = '#1d2a55';
    g.fillStyle = '#b3123c';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.arc(tx, ty - 10 * s, 9 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(tx, ty - 10 * s, (3 + i * 2) * s, i, i + 4);
      g.stroke();
    }
    g.strokeStyle = '#1f6b3a';
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx, ty + 28 * s);
    g.moveTo(tx, ty + 10 * s);
    g.lineTo(tx - 8 * s, ty + 4 * s);
    g.moveTo(tx, ty + 18 * s);
    g.lineTo(tx + 8 * s, ty + 12 * s);
    g.stroke();
    g.fillStyle = '#1d2a55';
    g.font = `bold ${11 * s}px IBM Plex Mono`;
    g.textAlign = 'center';
    g.fillText('L+J', tx, ty + 40 * s);
    g.restore();
    tattoo = { x: tx - 20 * s, y: ty - 26 * s, w: 40 * s, h: 72 * s };
  }

  // neck + head
  g.fillStyle = skin;
  g.fillRect(hx - 12 * s, hy + 20 * s, 24 * s, 30 * s);
  g.beginPath();
  g.ellipse(hx - 27 * s, hy + 2 * s, 6 * s, 10 * s, 0, 0, Math.PI * 2);
  g.ellipse(hx + 27 * s, hy + 2 * s, 6 * s, 10 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(hx, hy, 28 * s, 36 * s, 0, 0, Math.PI * 2);
  g.fill();

  // hair
  g.fillStyle = o.hair;
  if (o.hairStyle === 'long') {
    g.beginPath();
    g.ellipse(hx, hy - 14 * s, 32 * s, 28 * s, 0, Math.PI, 0);
    g.fill();
    rr(g, hx - 34 * s, hy - 16 * s, 12 * s, 70 * s, 6 * s);
    g.fill();
    rr(g, hx + 22 * s, hy - 16 * s, 12 * s, 70 * s, 6 * s);
    g.fill();
  } else if (o.hairStyle === 'short') {
    g.beginPath();
    g.ellipse(hx, hy - 18 * s, 29 * s, 22 * s, 0, Math.PI, 0);
    g.fill();
  }
  if (o.cap) {
    g.fillStyle = o.cap;
    g.beginPath();
    g.ellipse(hx, hy - 20 * s, 31 * s, 22 * s, 0, Math.PI, 0);
    g.fill();
    rr(g, hx - 6 * s, hy - 24 * s, 48 * s, 8 * s, 4 * s);
    g.fill();
  }

  // face details
  const eyeY = hy - 4 * s;
  g.fillStyle = o.hair;
  g.fillRect(hx - 19 * s, eyeY - 11 * s, 13 * s, 3 * s);
  g.fillRect(hx + 6 * s, eyeY - 11 * s, 13 * s, 3 * s);
  if (o.glasses) {
    g.fillStyle = '#111';
    rr(g, hx - 22 * s, eyeY - 7 * s, 19 * s, 12 * s, 4 * s);
    g.fill();
    rr(g, hx + 3 * s, eyeY - 7 * s, 19 * s, 12 * s, 4 * s);
    g.fill();
    g.fillRect(hx - 4 * s, eyeY - 4 * s, 8 * s, 2 * s);
    g.fillStyle = 'rgba(255,120,200,0.7)';
    g.fillRect(hx - 19 * s, eyeY - 5 * s, 6 * s, 2 * s);
    g.fillRect(hx + 6 * s, eyeY - 5 * s, 6 * s, 2 * s);
  } else if (o.blink) {
    g.strokeStyle = '#2a1a10';
    g.lineWidth = 2 * s;
    g.lineCap = 'round';
    for (const ex of [-12, 12]) {
      g.beginPath();
      g.moveTo(hx + (ex - 6) * s, eyeY + 1 * s);
      g.quadraticCurveTo(hx + ex * s, eyeY + 4 * s, hx + (ex + 6) * s, eyeY + 1 * s);
      g.stroke();
    }
  } else {
    for (const ex of [-12, 12]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(hx + ex * s, eyeY, 6 * s, 4 * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = o.eye ?? '#3b2412';
      g.beginPath();
      g.arc(hx + ex * s, eyeY, 3 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(hx + ex * s, eyeY, 1.4 * s, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2 * s;
  g.beginPath();
  g.moveTo(hx, eyeY + 2 * s);
  g.lineTo(hx - 4 * s, eyeY + 14 * s);
  g.lineTo(hx + 2 * s, eyeY + 15 * s);
  g.stroke();
  g.fillStyle = o.lips ?? '#8a3b36';
  rr(g, hx - 9 * s, eyeY + 22 * s, 18 * s, 5 * s, 3 * s);
  g.fill();
  if (o.beard) {
    // stubble along the jaw, then redraw the mouth on top
    g.save();
    g.beginPath();
    g.ellipse(hx, hy, 28 * s, 36 * s, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = o.hair;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.ellipse(hx, hy + 30 * s, 30 * s, 22 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(hx - 12 * s, eyeY + 16 * s, 24 * s, 6 * s);
    g.globalAlpha = 0.8;
    for (let i = 0; i < 60; i++) {
      g.fillRect(hx + (rand() - 0.5) * 50 * s, hy + (14 + rand() * 20) * s, 1.5 * s, 1.5 * s);
    }
    g.restore();
    g.fillStyle = o.lips ?? '#8a3b36';
    rr(g, hx - 9 * s, eyeY + 22 * s, 18 * s, 5 * s, 3 * s);
    g.fill();
  }
  if (o.earring) {
    g.fillStyle = '#f5c542';
    g.beginPath();
    g.arc(hx - 27 * s, hy + 14 * s, 3 * s, 0, Math.PI * 2);
    g.fill();
  }

  const face = { x: hx - 38 * s, y: hy - 46 * s, w: 76 * s, h: 92 * s };
  return { face, tattoo };
}

function plate(g, x, y, w, text) {
  const h = w * 0.5;
  g.save();
  g.fillStyle = '#f4f1e8';
  rr(g, x, y, w, h, 6);
  g.fill();
  g.strokeStyle = '#222';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#d2224b';
  g.font = `700 ${w * 0.13}px IBM Plex Mono`;
  g.textAlign = 'center';
  g.fillText('LEONIDA', x + w / 2, y + h * 0.28);
  g.fillStyle = '#10204a';
  g.font = `700 ${w * 0.24}px IBM Plex Mono`;
  g.fillText(text, x + w / 2, y + h * 0.72);
  g.fillStyle = '#2e8b57';
  g.font = `${w * 0.09}px IBM Plex Mono`;
  g.fillText('SUNSHINE STATE', x + w / 2, y + h * 0.92);
  g.restore();
  return { x: x - 6, y: y - 6, w: w + 12, h: h + 12 };
}

// Rear view of a car, wheels resting on groundY. Returns the plate rect.
function carRear(g, cx, groundY, w, color, plateText) {
  const h = w * 0.55;
  const top = groundY - h;
  g.save();
  g.fillStyle = '#0c0c10';
  rr(g, cx - w * 0.44, groundY - 34, w * 0.18, 40, 8);
  g.fill();
  rr(g, cx + w * 0.26, groundY - 34, w * 0.18, 40, 8);
  g.fill();
  g.fillStyle = color;
  rr(g, cx - w * 0.38, top, w * 0.76, h * 0.45, 30);
  g.fill();
  g.fillStyle = 'rgba(120,190,255,0.55)';
  rr(g, cx - w * 0.3, top + 10, w * 0.6, h * 0.3, 18);
  g.fill();
  g.fillStyle = color;
  rr(g, cx - w / 2, top + h * 0.38, w, h * 0.5, 22);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(cx - w / 2, top + h * 0.62, w, 4);
  g.fillStyle = '#ff2240';
  g.shadowColor = '#ff2240';
  g.shadowBlur = 20;
  rr(g, cx - w * 0.47, top + h * 0.45, w * 0.2, h * 0.1, 6);
  g.fill();
  rr(g, cx + w * 0.27, top + h * 0.45, w * 0.2, h * 0.1, 6);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#1a1a1f';
  rr(g, cx - w / 2, top + h * 0.84, w, h * 0.12, 8);
  g.fill();
  g.restore();
  return plate(g, cx - w * 0.14, top + h * 0.52, w * 0.28, plateText);
}

function ground(g, y, color, lines) {
  g.fillStyle = color;
  g.fillRect(0, y, W, H - y);
  if (lines) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = -100; x < W; x += 160) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 60, y);
      g.lineTo(x + 66, y);
      g.lineTo(x + 12, H);
      g.fill();
    }
  }
}

// CCTV overlay: scanlines, grain, vignette and the burned-in timestamp.
function cctv(g, rand, cam, place, time) {
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
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);

  g.save();
  g.font = '600 22px IBM Plex Mono';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(20, 18, g.measureText(`${cam}  ${place}`).width + 28, 38);
  g.fillStyle = '#e8ffe8';
  g.fillText(`${cam}  ${place}`, 34, 38);
  g.fillStyle = '#ff2b2b';
  g.beginPath();
  g.arc(W - 118, 38, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.fillText('REC', W - 100, 38);

  const stamp = `09/24/2026  ${time}  VCPD-NET`;
  g.font = '600 24px IBM Plex Mono';
  const tw = g.measureText(stamp).width;
  const box = { x: 20, y: H - 64, w: tw + 32, h: 44 };
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(box.x, box.y, box.w, box.h);
  g.fillStyle = '#e8ffe8';
  g.fillText(stamp, box.x + 16, box.y + box.h / 2);
  g.restore();
  return { x: box.x - 4, y: box.y - 4, w: box.w + 8, h: box.h + 8 };
}

const JASON = {
  skin: '#d9a47a', shirt: '#1f7a8c', flower: '#ff7eb6', pattern: 'hawaiian',
  pants: '#3a3a44', hair: '#3b2a1e', hairStyle: 'short', beard: true, cap: '#20202a',
};
const LUCIA = {
  skin: '#b97a56', shirt: '#161622', pattern: 'plain', pants: '#26324f',
  hair: '#1c120c', hairStyle: 'long', earring: true, lips: '#a23a4a', tattoo: false,
};
const RICO = {
  skin: '#8a5a3c', shirt: '#f0f0f0', flower: '#c0392b', pattern: 'stripes',
  pants: '#111', hair: '#1a1a1a', hairStyle: 'none', beard: true, chain: true, glasses: true,
};

function sceneKwikMart(g, rand) {
  sky(g, [[0, '#140a2a'], [0.55, '#5a1b63'], [1, '#ff6b3d']], 420);
  stars(g, rand, 80, 200);
  skyline(g, rand, 420, '#1d1030', 'rgba(255,210,120,0.8)');
  palm(g, 80, 470, 260, '#0b0612', 20);
  palm(g, 1210, 470, 300, '#0b0612', -30);
  ground(g, 460, '#27212e', true);

  // store
  g.fillStyle = '#e9d6bb';
  g.fillRect(700, 250, 560, 250);
  g.fillStyle = '#233447';
  g.fillRect(730, 320, 500, 150);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 24; i++) {
      g.fillStyle = ['#ff5a5f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b'][(i + row) % 5];
      g.fillRect(740 + i * 20, 340 + row * 42, 14, 26);
    }
  }
  neon(g, 'KWIK MART', 790, 285, 50, '#ff3fa4');
  neon(g, '24/7', 1120, 285, 44, '#29e7ff');

  // canopy + pumps
  g.fillStyle = '#f2f2f2';
  g.fillRect(40, 190, 620, 40);
  g.fillStyle = '#e63946';
  g.fillRect(40, 222, 620, 10);
  g.fillStyle = '#cfcfd6';
  g.fillRect(90, 232, 22, 260);
  g.fillRect(590, 232, 22, 260);
  for (const px of [160, 520]) {
    g.fillStyle = '#e63946';
    rr(g, px, 360, 60, 120, 8);
    g.fill();
    g.fillStyle = '#9ef';
    g.fillRect(px + 10, 375, 40, 22);
  }
  const plateR = carRear(g, 250, 560, 230, '#6c2bd9', 'KWK 118');
  void plateR;
  const j = person(g, { ...JASON, x: 430, y: 640, s: 1.25 }, rand);
  return { face: j.face };
}

function sceneCauseway(g, rand) {
  sky(g, [[0, '#2b0f4c'], [0.5, '#c2367a'], [1, '#ffb347']], 400);
  g.fillStyle = '#ffdd7a';
  g.beginPath();
  g.arc(980, 380, 70, 0, Math.PI * 2);
  g.fill();
  skyline(g, rand, 400, '#3b1848', 'rgba(255,230,160,0.7)', 40, 160);
  // water
  const wg = g.createLinearGradient(0, 400, 0, 500);
  wg.addColorStop(0, '#ff8a5c');
  wg.addColorStop(1, '#3a1a5c');
  g.fillStyle = wg;
  g.fillRect(0, 400, W, 100);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(255,220,160,0.5)';
    g.fillRect(900 + (rand() - 0.5) * 300, 405 + rand() * 90, 30 + rand() * 40, 2);
  }
  ground(g, 500, '#35303c', true);
  // railing
  g.fillStyle = '#ddd';
  g.fillRect(0, 488, W, 8);
  for (let x = 0; x < W; x += 40) g.fillRect(x, 470, 6, 26);
  g.fillRect(0, 468, W, 5);
  // sign
  g.fillStyle = '#0c6b3c';
  rr(g, 60, 110, 440, 110, 10);
  g.fill();
  g.strokeStyle = '#fff';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#fff';
  g.font = '700 34px Montserrat';
  g.fillText('LEONIDA CAUSEWAY', 84, 158);
  g.font = '600 26px Montserrat';
  g.fillText('VICE CITY  →  EXIT 5A', 84, 196);
  g.fillStyle = '#888';
  g.fillRect(240, 220, 12, 260);

  const plateR = carRear(g, 560, 660, 360, '#ff9f1c', 'LCJ 0924');
  const l = person(g, { ...LUCIA, x: 900, y: 650, s: 1.3 }, rand);
  return { plate: plateR, face: l.face };
}

function sceneBank(g, rand) {
  // marble interior
  g.fillStyle = '#efe6d8';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(150,130,110,${0.15 + rand() * 0.2})`;
    g.lineWidth = 1 + rand() * 2;
    g.beginPath();
    const y = rand() * 460;
    g.moveTo(0, y);
    g.bezierCurveTo(300, y + (rand() - 0.5) * 80, 900, y + (rand() - 0.5) * 80, W, y + (rand() - 0.5) * 60);
    g.stroke();
  }
  for (const px of [60, 360, 860, 1160]) {
    g.fillStyle = '#d8ccb8';
    g.fillRect(px, 60, 60, 420);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let k = 0; k < 5; k++) g.fillRect(px + 8 + k * 11, 60, 4, 420);
  }
  g.fillStyle = '#1d3c34';
  g.fillRect(420, 60, 440, 80);
  g.fillStyle = '#f5c542';
  g.font = '44px Anton';
  g.textAlign = 'center';
  g.fillText('BANK OF LEONIDA', 640, 118);
  g.textAlign = 'left';
  // counter
  g.fillStyle = '#5b3a29';
  g.fillRect(0, 380, W, 110);
  g.fillStyle = '#7a4f38';
  g.fillRect(0, 380, W, 16);
  for (let x = 160; x < W; x += 260) {
    g.fillStyle = 'rgba(200,230,255,0.35)';
    g.fillRect(x, 240, 180, 140);
    g.strokeStyle = '#c9a96e';
    g.lineWidth = 4;
    g.strokeRect(x, 240, 180, 140);
  }
  // floor checker
  for (let y = 490; y < H; y += 46) {
    for (let x = 0; x < W; x += 46) {
      g.fillStyle = ((x + y) / 46) % 2 === 0 ? '#2b2b33' : '#e7e1d6';
      g.fillRect(x, y, 46, 46);
    }
  }
  const j = person(g, { ...JASON, x: 280, y: 690, s: 1.25, cap: null, glasses: false }, rand);
  const l = person(g, { ...LUCIA, x: 640, y: 700, s: 1.35, tattoo: true, shirt: '#3b0f2e' }, rand);
  const r = person(g, { ...RICO, x: 1010, y: 690, s: 1.25 }, rand);
  return { jface: j.face, tattoo: l.tattoo, rico: r.face };
}

function sceneMarina(g, rand) {
  sky(g, [[0, '#2aa7d9'], [0.7, '#9fe3ff'], [1, '#ffe1b3']], 300);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    const cx = rand() * W;
    const cy = 60 + rand() * 120;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(cx + k * 26, cy + (k % 2) * 8, 22 + rand() * 10, 0, Math.PI * 2);
      g.fill();
    }
  }
  palm(g, 1180, 330, 220, '#2d4a2a', -20);
  palm(g, 1080, 320, 180, '#2d4a2a', 15);
  const sea = g.createLinearGradient(0, 300, 0, H);
  sea.addColorStop(0, '#1fb6c9');
  sea.addColorStop(1, '#0a4f73');
  g.fillStyle = sea;
  g.fillRect(0, 300, W, H - 300);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(rand() * W, 300 + rand() * 420, 20 + rand() * 30, 2);
  }

  // rival boat (background)
  g.fillStyle = '#f7f7f7';
  g.beginPath();
  g.moveTo(760, 330);
  g.lineTo(1150, 330);
  g.lineTo(1110, 400);
  g.lineTo(790, 400);
  g.fill();
  g.fillStyle = '#c0392b';
  g.fillRect(790, 370, 330, 10);
  g.fillStyle = '#e0e0e0';
  g.fillRect(850, 280, 180, 50);
  g.fillStyle = '#10204a';
  g.font = '700 30px Montserrat';
  g.fillText("RICO'S REVENGE", 820, 360);
  const ricoBoat = { x: 810, y: 326, w: 280, h: 46 };

  // our boat
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(40, 430);
  g.lineTo(640, 430);
  g.lineTo(590, 560);
  g.lineTo(90, 560);
  g.fill();
  g.fillStyle = '#ff5fa2';
  g.fillRect(80, 500, 520, 14);
  g.fillStyle = '#e8e8e8';
  g.fillRect(160, 360, 260, 70);
  g.fillStyle = 'rgba(40,120,180,0.7)';
  g.fillRect(175, 372, 230, 30);
  g.fillStyle = '#10204a';
  g.font = '700 40px IBM Plex Mono';
  g.fillText('FL 4471 VC', 200, 480);
  const reg = { x: 190, y: 440, w: 280, h: 54 };

  // dock
  g.fillStyle = '#8a5a34';
  g.fillRect(0, 590, W, 130);
  for (let x = 0; x < W; x += 70) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x, 590, 4, 130);
  }
  // duffel bag with cash
  const bx = 720;
  const by = 560;
  g.fillStyle = '#15151a';
  rr(g, bx, by, 220, 100, 40);
  g.fill();
  g.strokeStyle = '#444';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(bx + 110, by + 4, 50, Math.PI, 0);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#6fbf73';
    g.save();
    g.translate(bx + 30 + i * 22, by + 10 + (i % 3) * 6);
    g.rotate((rand() - 0.5) * 0.8);
    g.fillRect(-20, -8, 40, 18);
    g.fillStyle = '#2e7d32';
    g.font = '700 12px IBM Plex Mono';
    g.fillText('$100', -16, 6);
    g.restore();
  }
  g.fillStyle = '#f5c542';
  g.font = '64px Anton';
  g.fillText('$', bx + 92, by + 86);
  const bag = { x: bx - 10, y: by - 50, w: 240, h: 164 };
  return { bag, reg, ricoBoat };
}

function sceneJewelry(g, rand) {
  sky(g, [[0, '#0b0620'], [1, '#3a0f4a']], 300);
  stars(g, rand, 60, 200);
  skyline(g, rand, 300, '#150a26', 'rgba(255,90,200,0.7)', 80, 240);
  ground(g, 540, '#1d1a24', true);
  // storefront
  g.fillStyle = '#231a33';
  g.fillRect(0, 180, W, 360);
  g.fillStyle = '#0e0b16';
  g.fillRect(40, 280, 700, 240);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = '#9ff';
    g.save();
    g.translate(80 + i * 48, 360 + (i % 2) * 60);
    g.rotate(Math.PI / 4);
    g.fillRect(-8, -8, 16, 16);
    g.restore();
  }
  neon(g, 'DIAMOND MILE JEWELERS', 60, 230, 54, '#ff4fd8');
  // shattered glass
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.moveTo(420, 400);
    const a = rand() * Math.PI * 2;
    g.lineTo(420 + Math.cos(a) * 160, 400 + Math.sin(a) * 110);
    g.stroke();
  }
  const r = person(g, { ...RICO, x: 1150, y: 600, s: 0.95 }, rand);
  const plateR = carRear(g, 880, 700, 330, '#e11d48', 'VC 2HOT');
  const j = person(g, { ...JASON, x: 200, y: 700, s: 1.2 }, rand);
  const l = person(g, { ...LUCIA, x: 480, y: 705, s: 1.25 }, rand);
  return { jface: j.face, lface: l.face, plate: plateR, rico: r.face };
}

export const CASES = [
  {
    id: 'kwik',
    title: 'Kwik Mart Stick-Up',
    place: 'Vice Beach',
    seconds: 90,
    payout: 12000,
    brief: 'Jason hit the Kwik Mart on Ocean Drive and looked straight into the pump camera. Classic.',
    draw: sceneKwikMart,
    cam: 'CAM 04',
    camPlace: 'KWIK MART #117 · VICE BEACH',
    time: '02:13:44',
    targets: (r) => [
      { key: 'face', kind: 'hide', label: "Jason's face", rect: r.face },
    ],
  },
  {
    id: 'causeway',
    title: 'Causeway Getaway',
    place: 'Leonida Causeway',
    seconds: 80,
    payout: 18000,
    brief: 'Toll camera caught the getaway car at sunset. Lucia stepped out to stretch. Of course she did.',
    draw: sceneCauseway,
    cam: 'TOLL 5A',
    camPlace: 'LEONIDA CAUSEWAY · EASTBOUND',
    time: '19:47:02',
    targets: (r) => [
      { key: 'plate', kind: 'hide', label: 'Licence plate', rect: r.plate },
      { key: 'face', kind: 'hide', label: "Lucia's face", rect: r.face },
    ],
  },
  {
    id: 'bank',
    title: 'Bank of Leonida',
    place: 'Downtown Vice City',
    seconds: 80,
    payout: 30000,
    brief: "Lobby cam. Rico's crew was casing the same bank. Scrub Jason, lose Lucia's tattoo — and leave Rico's face for the cops.",
    draw: sceneBank,
    cam: 'CAM 11',
    camPlace: 'BANK OF LEONIDA · LOBBY',
    time: '10:02:31',
    targets: (r) => [
      { key: 'jface', kind: 'hide', label: "Jason's face", rect: r.jface },
      { key: 'tattoo', kind: 'hide', label: "Lucia's L+J tattoo", rect: r.tattoo },
      { key: 'rico', kind: 'keep', label: "Rico's face (frame him)", rect: r.rico },
    ],
  },
  {
    id: 'marina',
    title: 'Keys Marina Drop',
    place: 'Leonida Keys',
    seconds: 70,
    payout: 42000,
    brief: 'Harbour patrol drone photo. The cash bag is on the dock and our boat reg is readable. Rico’s boat stays in shot.',
    draw: sceneMarina,
    cam: 'DRONE 2',
    camPlace: 'HARBOUR PATROL · LEONIDA KEYS',
    time: '14:26:10',
    targets: (r) => [
      { key: 'bag', kind: 'hide', label: 'Duffel bag of cash', rect: r.bag },
      { key: 'reg', kind: 'hide', label: 'Boat registration', rect: r.reg },
      { key: 'ricoBoat', kind: 'keep', label: "Rico's boat name", rect: r.ricoBoat },
    ],
  },
  {
    id: 'jewelry',
    title: 'Diamond Mile',
    place: 'Vice City Strip',
    seconds: 75,
    payout: 75000,
    brief: 'The big one. Street cam saw everything. Three things to erase, and Rico takes the fall.',
    draw: sceneJewelry,
    cam: 'CAM 22',
    camPlace: 'DIAMOND MILE · VICE CITY',
    time: '03:58:17',
    targets: (r) => [
      { key: 'jface', kind: 'hide', label: "Jason's face", rect: r.jface },
      { key: 'lface', kind: 'hide', label: "Lucia's face", rect: r.lface },
      { key: 'plate', kind: 'hide', label: 'Licence plate', rect: r.plate },
      { key: 'rico', kind: 'keep', label: "Rico's face (frame him)", rect: r.rico },
    ],
  },
];

export async function ensureFonts() {
  await Promise.all([
    document.fonts.load('44px Anton'),
    document.fonts.load('600 22px "IBM Plex Mono"'),
    document.fonts.load('700 22px "IBM Plex Mono"'),
    document.fonts.load('700 30px Montserrat'),
    document.fonts.load('600 26px Montserrat'),
  ]);
}

// Renders a case to a canvas. Returns { canvas, dataUrl, targets }.
export function renderCase(c, index) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const rand = rng(1000 + index * 77);
  const rects = c.draw(g, rand);
  const stamp = cctv(g, rand, c.cam, c.camPlace, c.time);
  const targets = [
    ...c.targets(rects),
    { key: 'stamp', kind: 'keep', label: 'CCTV timestamp', rect: stamp },
  ].map((t) => ({ ...t, rect: clampRect(t.rect) }));
  return { canvas, dataUrl: canvas.toDataURL('image/png'), targets };
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
