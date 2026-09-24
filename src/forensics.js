// VCPD forensics: compares the doctored still against the original tape.
//
// 1. Align: find how the export sits on the tape. Unlayer's Crop cuts at whole pixels, flips and turns in quarter
//    turns losslessly, and straightens in whole degrees about the centre at native scale (bilinear), shrinking the
//    crop box to fit. So try every flip and quarter turn with a translation search, then straightening angles.
// 2. Colour fit: learn a global colour transform so filters/brightness alone don't count as tampering.
// 3. Cells: split every evidence box into small cells and flag cells that were covered,
//    painted, blurred or cropped away. Cells are compared against the tape put through the same transform,
//    so a straightened export is resampled once, exactly as the editor did, and never blurred twice.

const CELL = 8; // px
const F = 8; // coarse search scale
const CLEAN = 8; // an untransformed alignment this close needs no wider search

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function pixels(source, w, h) {
  const g = canvas(w, h).getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}

function luma(img) {
  const { data, width, height } = img;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; p < out.length; i += 4, p++) {
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

function shrink(src, w, h, f) {
  const nw = Math.floor(w / f);
  const nh = Math.floor(h / f);
  const out = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let s = 0;
      for (let dy = 0; dy < f; dy++) {
        const row = (y * f + dy) * w + x * f;
        for (let dx = 0; dx < f; dx++) s += src[row + dx];
      }
      out[y * nw + x] = s / (f * f);
    }
  }
  return { data: out, w: nw, h: nh };
}

// Mean absolute difference of edited (small) placed at (ox, oy) in original. Samples the original misses
// (outside a straightened picture, NaN) count as a bad match. Gives up (Infinity) as soon as it can't beat `bound`,
// which never changes which placement a search picks.
function mad(orig, edit, ox, oy, step, bound = Infinity) {
  const limit = bound * Math.ceil(edit.h / step) * Math.ceil(edit.w / step) * (1 + 1e-9);
  let s = 0;
  let n = 0;
  for (let y = 0; y < edit.h; y += step) {
    const oRow = (y + oy) * orig.w + ox;
    const eRow = y * edit.w;
    for (let x = 0; x < edit.w; x += step) {
      const d = Math.abs(orig.data[oRow + x] - edit.data[eRow + x]);
      s += d === d ? d : 64;
      n++;
    }
    if (s > limit) return Infinity;
  }
  return s / n;
}

// Best whole-pixel position of `eS` inside `oS` (both shrunk by F), then refined at full res. With `near`, only
// positions within 2 of it are tried.
function coarse(oS, eS, near) {
  let best = { ox: 0, oy: 0, err: Infinity };
  const [x0, x1] = near ? [Math.max(0, near.ox - 2), Math.min(oS.w - eS.w, near.ox + 2)] : [0, oS.w - eS.w];
  const [y0, y1] = near ? [Math.max(0, near.oy - 2), Math.min(oS.h - eS.h, near.oy + 2)] : [0, oS.h - eS.h];
  for (let oy = y0; oy <= y1; oy++) {
    for (let ox = x0; ox <= x1; ox++) {
      const e = mad(oS, eS, ox, oy, 2, best.err);
      if (e < best.err) best = { ox, oy, err: e };
    }
  }
  return best;
}

function fine(oL, eL, W, H, w, h, best) {
  if (w === W && h === H) return { ox: 0, oy: 0, err: mad({ data: oL, w: W, h: H }, { data: eL, w, h }, 0, 0, 4) };
  const oF = { data: oL, w: W, h: H };
  const eF = { data: eL, w, h };
  let out = { ox: best.ox * F, oy: best.oy * F, err: Infinity };
  for (let oy = Math.max(0, best.oy * F - F); oy <= Math.min(H - h, best.oy * F + F); oy++) {
    for (let ox = Math.max(0, best.ox * F - F); ox <= Math.min(W - w, best.ox * F + F); ox++) {
      const e = mad(oF, eF, ox, oy, 4, out.err);
      if (e < out.err) out = { ox, oy, err: e };
    }
  }
  return out;
}

// fine() for flipped and turned candidates: every other pixel over the window first, then to the pixel around the best.
function fineFast(oL, eL, W, H, w, h, best) {
  if (w === W && h === H) return fine(oL, eL, W, H, w, h, best);
  const oF = { data: oL, w: W, h: H };
  const eF = { data: eL, w, h };
  let out = { ox: best.ox * F, oy: best.oy * F, err: Infinity };
  for (const [reach, stride, step] of [[F, 2, 8], [2, 1, 4]]) {
    const { ox: cx, oy: cy } = out;
    out = { ox: cx, oy: cy, err: Infinity };
    for (let oy = Math.max(0, cy - reach); oy <= Math.min(H - h, cy + reach); oy += stride) {
      for (let ox = Math.max(0, cx - reach); ox <= Math.min(W - w, cx + reach); ox += stride) {
        const e = mad(oF, eF, ox, oy, step, out.err);
        if (e < out.err) out = { ox, oy, err: e };
      }
    }
  }
  return out;
}

// Affine maps in canvas order [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f.
const mul = ([a1, b1, c1, d1, e1, f1], [a2, b2, c2, d2, e2, f2]) => [
  a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1,
];
const invert = ([a, b, c, d, e, f]) => {
  const k = a * d - b * c;
  return [d / k, -b / k, -c / k, a / k, (c * f - d * e) / k, (b * e - a * f) / k];
};
const move = (x, y) => [1, 0, 0, 1, x, y];
const spin = (deg) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

// Crop's flip and rotate buttons: every combination is a mirror (or not) followed by quarter turns clockwise.
const TURNS = [0, 90, 180, 270].flatMap((rotate) => [false, true].map((flipX) => ({ flipX, rotate })));

// Maps a w x h picture onto itself flipped and turned; returns the map and the turned picture's size.
function turn({ flipX, rotate }, w, h) {
  let m = flipX ? [-1, 0, 0, 1, w, 0] : [1, 0, 0, 1, 0, 0];
  if (rotate === 90) m = mul([0, 1, -1, 0, h, 0], m);
  if (rotate === 180) m = mul([-1, 0, 0, -1, w, h], m);
  if (rotate === 270) m = mul([0, -1, 1, 0, 0, w], m);
  return { m, w: rotate % 180 ? h : w, h: rotate % 180 ? w : h };
}

// Resamples `src` (sw x sh) through map `m` (source -> destination) into dw x dh: nearest for whole-pixel maps
// (flips and turns stay exact), bilinear otherwise. Destination pixels the source doesn't reach are NaN.
function warp(src, sw, sh, m, dw, dh, bilinear) {
  const [a, b, c, d, e, f] = invert(m);
  const out = new Float32Array(dw * dh);
  if (!bilinear) {
    // Whole-pixel maps step one source pixel per destination pixel.
    for (let v = 0; v < dh; v++) {
      let x = a * 0.5 + c * (v + 0.5) + e;
      let y = b * 0.5 + d * (v + 0.5) + f;
      for (let u = 0, i = v * dw; u < dw; u++, i++, x += a, y += b) out[i] = x >= 0 && y >= 0 && x < sw && y < sh ? src[(y | 0) * sw + (x | 0)] : NaN;
    }
    return out;
  }
  for (let v = 0; v < dh; v++) {
    for (let u = 0; u < dw; u++) out[v * dw + u] = sample(src, sw, sh, a * (u + 0.5) + c * (v + 0.5) + e - 0.5, b * (u + 0.5) + d * (v + 0.5) + f - 0.5);
  }
  return out;
}

function sample(src, w, h, x, y) {
  if (x < -0.01 || y < -0.01 || x > w - 0.99 || y > h - 0.99) return NaN;
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const i = y0 * w + x0;
  return (src[i] * (1 - fx) + src[i + 1] * fx) * (1 - fy) + (src[i + w] * (1 - fx) + src[i + w + 1] * fx) * fy;
}

// Where the export sits: the map from tape pixels to export pixels for a flip/turn, a straightening angle and
// the crop's top-left corner (ou, ov) on the straightened canvas. Straightening turns the picture about its centre
// onto a canvas big enough to hold it, the way the editor does.
function placement(D, angle, ou, ov, W, H) {
  const t = turn(D, W, H);
  if (!angle) return mul(move(-ou, -ov), t.m);
  const r = (Math.abs(angle) * Math.PI) / 180;
  const cw = t.w * Math.cos(r) + t.h * Math.sin(r), ch = t.w * Math.sin(r) + t.h * Math.cos(r);
  return mul(move(cw / 2 - ou, ch / 2 - ov), mul(spin(angle), mul(move(-t.w / 2, -t.h / 2), t.m)));
}

// The editor's own crop for a straightened picture: the largest centred box of the same shape, at native scale.
function straightCrop(angle, w, h) {
  const r = (Math.abs(angle) * Math.PI) / 180;
  const k = Math.cos(r) + (Math.max(w, h) / Math.min(w, h)) * Math.sin(r);
  const cw = w * Math.cos(r) + h * Math.sin(r), ch = w * Math.sin(r) + h * Math.cos(r);
  return { w: Math.floor(w / k), h: Math.floor(h / k), ou: Math.floor((cw - w / k) / 2), ov: Math.floor((ch - h / k) / 2) };
}

// Full-res check of a placement: export luma against the tape sampled where each export pixel came from, after
// fitting brightness and contrast, so a filter doesn't read as a bad match. Export pixels the tape doesn't cover
// count as a bad match, unless they're transparent (rounded or open corners).
const pairs = { o: new Float32Array(0), e: new Float32Array(0) };
function score(oL, W, H, E, eL, m, step = 6) {
  const [a, b, c, d, e, f] = invert(m);
  const cap = Math.ceil(E.width / step) * Math.ceil(E.height / step);
  if (pairs.o.length < cap) Object.assign(pairs, { o: new Float32Array(cap), e: new Float32Array(cap) });
  let n = 0;
  let out = 0;
  let so = 0, se = 0, soo = 0, soe = 0;
  const Ed = E.data;
  for (let v = step >> 1; v < E.height; v += step) {
    for (let u = step >> 1; u < E.width; u += step) {
      const i = v * E.width + u;
      if (Ed[i * 4 + 3] < 128) continue;
      // Bilinear, inlined: this runs for every candidate placement.
      const x = a * (u + 0.5) + c * (v + 0.5) + e - 0.5;
      const y = b * (u + 0.5) + d * (v + 0.5) + f - 0.5;
      if (x < 0 || y < 0 || x > W - 1 || y > H - 1) { out++; continue; }
      const x0 = x < W - 1 ? x | 0 : W - 2;
      const y0 = y < H - 1 ? y | 0 : H - 2;
      const fx = x - x0;
      const fy = y - y0;
      const k = y0 * W + x0;
      const o = (oL[k] * (1 - fx) + oL[k + 1] * fx) * (1 - fy) + (oL[k + W] * (1 - fx) + oL[k + W + 1] * fx) * fy;
      pairs.o[n] = o;
      pairs.e[n] = eL[i];
      so += o; se += eL[i]; soo += o * o; soe += o * eL[i];
      n++;
    }
  }
  if (!n) return Infinity;
  const vo = soo / n - (so / n) ** 2;
  const gain = vo > 1 ? Math.max(0.3, Math.min(3, (soe / n - (so / n) * (se / n)) / vo)) : 1;
  const bias = se / n - gain * (so / n);
  let s = 0;
  for (let k = 0; k < n; k++) s += Math.abs(pairs.e[k] - gain * pairs.o[k] - bias);
  return (s + out * 64) / (n + out);
}

// Every flip and turn of the tape at whole-pixel offsets, tried at low res, best first.
function turned(oS, v, W, H) {
  const out = [];
  for (const D of TURNS) {
    const t = turn(D, W, H);
    if (v.w > t.w || v.h > t.h) continue;
    const lo = turn(D, oS.w, oS.h);
    out.push({ D, t, c: coarse({ data: warp(oS.data, oS.w, oS.h, lo.m, lo.w, lo.h, false), w: lo.w, h: lo.h }, v.eS) });
  }
  return out.sort((p, q) => p.c.err - q.c.err);
}

// The tape flipped and turned by D, then straightened by `angle` onto its canvas, shrunk by f (from `s`, the tape
// already shrunk by f). Canvas corners the tape doesn't reach are NaN.
function bentLow(s, D, angle) {
  const lo = turn(D, s.w, s.h);
  const sD = warp(s.data, s.w, s.h, lo.m, lo.w, lo.h, false);
  const r = (Math.abs(angle) * Math.PI) / 180;
  const cw = Math.ceil(lo.w * Math.cos(r) + lo.h * Math.sin(r));
  const ch = Math.ceil(lo.w * Math.sin(r) + lo.h * Math.cos(r));
  return { data: warp(sD, lo.w, lo.h, placement(TURNS[0], angle, 0, 0, lo.w, lo.h), cw, ch, true), w: cw, h: ch };
}

// Straightened placements: the editor's own crop at each angle that fits the export's size, plus a sweep of angles
// for the likeliest flips and turns (every 3° at 1/16 scale, then to the degree at 1/8 around the best hits); with no
// `flips`, only the editor's own crop. Returns the best, its crop corner settled to the pixel by full-res score.
function straightened(oL, oS, oS2, W, H, v, flips) {
  const cands = [];
  for (const D of TURNS) {
    const t = turn(D, W, H);
    for (let deg = 1; deg <= 45; deg++) {
      const k = straightCrop(deg, t.w, t.h);
      if (Math.abs(k.w - v.w) <= 1 && Math.abs(k.h - v.h) <= 1) for (const a of [deg, -deg]) cands.push({ D, angle: a, ou: k.ou, ov: k.ov });
    }
  }
  // Walk a crop corner downhill to the pixel.
  const at = (c, ou, ov) => score(oL, W, H, v.E, v.eL, placement(c.D, c.angle, ou, ov, W, H), 8);
  const settle = (c, strides) => {
    let hit = { ...c, err: at(c, c.ou, c.ov) };
    for (const stride of strides) {
      for (let moved = true, steps = 0; moved && steps < 12; steps++) {
        moved = false;
        const from = hit;
        for (const [du, dv] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const ou = from.ou + du * stride, ov = from.ov + dv * stride;
          const err = at(c, ou, ov);
          if (err < hit.err) { hit = { ...c, ou, ov, err }; moved = true; }
        }
      }
    }
    return hit;
  };
  const done = (best) => best && { ...best, err: score(oL, W, H, v.E, v.eL, placement(best.D, best.angle, best.ou, best.ov, W, H)) };
  // The editor's own crop usually settles it: straightened and left alone. Settle the two likeliest.
  let best = null;
  for (const c of cands.map((c) => ({ ...c, err: at(c, c.ou, c.ov) })).sort((p, q) => p.err - q.err).slice(0, 2)) {
    const hit = settle(c, [1]);
    if (!best || hit.err < best.err) best = hit;
  }
  if (!flips || (best && best.err < CLEAN)) return done(best);
  const eS2 = shrink(v.eL, v.w, v.h, F * 2);
  const near = [];
  // The likeliest flip or turn first; the next only if that finds nothing that lines up.
  for (const D of flips) {
    if (near[0]?.low < 14) break;
    const sweep = [];
    for (let angle = -45; angle <= 45; angle += 3) {
      const ref = bentLow(oS2, D, angle);
      if (eS2.w <= ref.w && eS2.h <= ref.h) sweep.push({ angle, c: coarse(ref, eS2) });
    }
    for (const { angle, c } of sweep.sort((p, q) => p.c.err - q.c.err).slice(0, 3)) {
      for (let a = angle - 2; a <= angle + 2; a++) {
        if (!a || Math.abs(a) > 45 || near.some((n) => n.D === D && n.angle === a)) continue;
        const ref = bentLow(oS, D, a);
        if (v.eS.w > ref.w || v.eS.h > ref.h) continue;
        const hit = coarse(ref, v.eS, { ox: c.ox * 2, oy: c.oy * 2 });
        near.push({ D, angle: a, ou: hit.ox * F, ov: hit.oy * F, low: hit.err });
      }
    }
    near.sort((p, q) => p.low - q.low);
  }
  // The best low-res hit either side of its angle, and the runner-up.
  const top = near[0] ? [near[0], ...[-1, 1].map((d) => ({ ...near[0], angle: near[0].angle + d })).filter((c) => c.angle && Math.abs(c.angle) <= 45)] : [];
  if (near[1]) top.push(near[1]);
  for (const c of top) {
    const hit = settle(c, [4, 2, 1]);
    if (!best || hit.err < best.err) best = hit;
  }
  return done(best);
}

// The tape seen through placement `m`, in export pixels: exactly what the export shows where nothing was edited.
function reference(original, m, w, h, smooth) {
  const g = canvas(w, h).getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = smooth;
  g.setTransform(...m);
  g.drawImage(original, 0, 0);
  return g.getImageData(0, 0, w, h);
}

// Solve 4x4 linear system (Gaussian elimination).
function solve4(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-9) return null;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 5; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[4] / row[i]);
}

// Fits edited = A * [r g b 1] per channel over the export (robust, 2 passes); returns A, one row per channel.
// R is the tape in export pixels; with `clear`, pixels either side has no picture for (transparent, off a turned
// tape) are skipped. Sums are kept in plain locals (AtA is symmetric) in the same order as ever, for speed.
function colourFit(R, E, clear) {
  let coef = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ];
  const Rd = R.data;
  const Ed = E.data;
  for (let pass = 0; pass < 2; pass++) {
    const [p, q, s] = coef;
    let rr = 0, rg = 0, rb = 0, r1 = 0, gg = 0, gb = 0, g1 = 0, bb = 0, b1 = 0, n = 0;
    let rR = 0, gR = 0, bR = 0, oR = 0, rG = 0, gG = 0, bG = 0, oG = 0, rB = 0, gB = 0, bB = 0, oB = 0;
    for (let y = 0; y < E.height; y += 3) {
      for (let x = 0; x < E.width; x += 3) {
        const i = (y * E.width + x) * 4;
        if (clear && (Rd[i + 3] < 255 || Ed[i + 3] < 255)) continue;
        const r = Rd[i], g = Rd[i + 1], b = Rd[i + 2];
        const er = Ed[i], eg = Ed[i + 1], eb = Ed[i + 2];
        if (pass === 1) {
          let res = 0;
          res += Math.abs(p[0] * r + p[1] * g + p[2] * b + p[3] - er);
          res += Math.abs(q[0] * r + q[1] * g + q[2] * b + q[3] - eg);
          res += Math.abs(s[0] * r + s[1] * g + s[2] * b + s[3] - eb);
          if (res / 3 > 30) continue;
        }
        rr += r * r; rg += r * g; rb += r * b; r1 += r;
        gg += g * g; gb += g * b; g1 += g;
        bb += b * b; b1 += b;
        n += 1;
        rR += r * er; gR += g * er; bR += b * er; oR += er;
        rG += r * eg; gG += g * eg; bG += b * eg; oG += eg;
        rB += r * eb; gB += g * eb; bB += b * eb; oB += eb;
      }
    }
    const AtA = [[rr, rg, rb, r1], [rg, gg, gb, g1], [rb, gb, bb, b1], [r1, g1, b1, n]];
    const next = [[rR, gR, bR, oR], [rG, gG, bG, oG], [rB, gB, bB, oB]].map((b) => solve4(AtA, b));
    if (next.some((n) => !n)) break;
    coef = next;
  }
  return coef;
}

// Cells of a rect in tape coords. `place` maps tape pixels to export pixels (`moved` if it flips, turns or tilts;
// otherwise it only shifts); R is the tape and E the export, both in export pixels, and `fit` the colour fit.
function inspectRect(rect, R, E, place, fit, moved) {
  const [a, b, c, d, e, f] = place;
  const w = E.width;
  const h = E.height;
  const Rd = R.data;
  const Ed = E.data;
  const [p, q, s] = fit;
  const cells = [];
  for (let cy = rect.y; cy < rect.y + rect.h; cy += CELL) {
    for (let cx = rect.x; cx < rect.x + rect.w; cx += CELL) {
      const cw = Math.min(CELL, rect.x + rect.w - cx);
      const ch = Math.min(CELL, rect.y + rect.h - cy);
      const ex = cx + e;
      const ey = cy + f;
      let cropped = !moved && (ex < 0 || ey < 0 || ex + cw > w || ey + ch > h);
      let res = 0;
      let n = 0;
      let so = 0;
      let so2 = 0;
      let se = 0;
      let se2 = 0;
      for (let y = 0; y < ch && !cropped; y++) {
        for (let x = 0; x < cw; x++) {
          let i;
          if (moved) {
            const uf = a * (cx + x + 0.5) + c * (cy + y + 0.5) + e;
            const vf = b * (cx + x + 0.5) + d * (cy + y + 0.5) + f;
            if (!(uf >= 0 && vf >= 0 && uf < w && vf < h)) { cropped = true; break; }
            i = ((vf | 0) * w + (uf | 0)) * 4;
          } else i = ((ey + y) * w + ex + x) * 4;
          const r = Rd[i];
          const g = Rd[i + 1];
          const bl = Rd[i + 2];
          const q0 = p[0] * r + p[1] * g + p[2] * bl + p[3];
          const q1 = q[0] * r + q[1] * g + q[2] * bl + q[3];
          const q2 = s[0] * r + s[1] * g + s[2] * bl + s[3];
          res += Math.abs(q0 - Ed[i]);
          res += Math.abs(q1 - Ed[i + 1]);
          res += Math.abs(q2 - Ed[i + 2]);
          const lo = (q0 + q1 + q2) / 3;
          const le = (Ed[i] + Ed[i + 1] + Ed[i + 2]) / 3;
          so += lo;
          so2 += lo * lo;
          se += le;
          se2 += le * le;
          n++;
        }
      }
      if (cropped) {
        cells.push({ x: cx, y: cy, w: cw, h: ch, changed: true, cropped: true, detail: true });
        continue;
      }
      res /= n * 3;
      const sdO = Math.sqrt(Math.max(0, so2 / n - (so / n) ** 2));
      const sdE = Math.sqrt(Math.max(0, se2 / n - (se / n) ** 2));
      const blurred = sdO > 14 && sdE < sdO * 0.5;
      cells.push({ x: cx, y: cy, w: cw, h: ch, changed: res > 26 || blurred, detail: sdO > 12 });
    }
  }
  return cells;
}

export async function analyse(original, editedDataUrl, targets) {
  const W = original.width;
  const H = original.height;
  const O = pixels(original, W, H);
  const im = await loadImage(editedDataUrl);
  const oL = luma(O);
  const oS = shrink(oL, W, H, F);
  const nw = im.naturalWidth;
  const nh = im.naturalHeight;
  const variants = new Map();
  const variant = (w, h) => {
    const key = `${w}x${h}`;
    if (!variants.has(key)) {
      const E = pixels(im, w, h);
      const eL = luma(E);
      variants.set(key, { E, eL, w, h, eS: shrink(eL, w, h, F) });
    }
    return variants.get(key);
  };

  // A straightened export the editor cropped for itself gives its angle away by its size: check that first.
  const straightSized = TURNS.some((D) => {
    const t = turn(D, W, H);
    return [...Array(45)].some((_, i) => { const c = straightCrop(i + 1, t.w, t.h); return Math.abs(c.w - nw) <= 1 && Math.abs(c.h - nh) <= 1; });
  });
  const own = straightSized ? straightened(oL, oS, null, W, H, variant(nw, nh), null) : null;

  // Untransformed next, as it always was: the export as-is (a crop at native scale) and scaled to fit (a resized
  // export), keeping whichever lines up with the original tape best.
  const k = Math.min(W / nw, H / nh);
  const sizes = [[nw, nh], [Math.floor(nw * k), Math.floor(nh * k)]].filter(
    ([sw, sh], i) => sw <= W && sh <= H && sw > 0 && sh > 0 && (i === 0 || sw !== nw),
  );
  let pick = null;
  for (const [sw, sh] of own?.err < CLEAN ? [] : sizes) {
    const v = variant(sw, sh);
    const al = sw === W && sh === H ? { ox: 0, oy: 0, err: 0 } : fine(oL, v.eL, W, H, sw, sh, coarse(oS, v.eS));
    if (!pick || al.err < pick.err) pick = { v, D: TURNS[0], angle: 0, ou: al.ox, ov: al.oy, err: al.err };
  }
  // A lightly edited frame or a clean crop needs no wider search. Otherwise try flips and quarter turns (whole-pixel
  // exact), then straightening, and take one only if it lines up clearly better than the plain reading.
  const plain = pick ? score(oL, W, H, pick.v.E, pick.v.eL, placement(TURNS[0], 0, pick.ou, pick.ov, W, H)) : Infinity;
  if (own?.err < CLEAN) pick = { v: variant(nw, nh), ...own };
  else if (plain >= CLEAN || straightSized) {
    const native = variant(nw, nh);
    const lows = turned(oS, native, W, H);
    let alt = null;
    for (const c of lows.filter((c) => c.D.flipX || c.D.rotate).slice(0, 3)) {
      const al = nw === c.t.w && nh === c.t.h ? { ox: 0, oy: 0 } : fineFast(warp(oL, W, H, c.t.m, c.t.w, c.t.h, false), native.eL, c.t.w, c.t.h, nw, nh, c.c);
      const err = score(oL, W, H, native.E, native.eL, placement(c.D, 0, al.ox, al.oy, W, H));
      if (!alt || err < alt.err) alt = { v: native, D: c.D, angle: 0, ou: al.ox, ov: al.oy, err };
    }
    if (own && (!alt || own.err < alt.err)) alt = { v: native, ...own };
    // Straightening always shrinks the crop, so an export the full size of the tape (either way up) wasn't straightened.
    const whole = (nw === W && nh === H) || (nw === H && nh === W);
    if (!whole && (!alt || alt.err >= CLEAN)) {
      const flips = lows.slice(0, 2).map((c) => c.D);
      const bent = straightened(oL, oS, shrink(oL, W, H, F * 2), W, H, native, flips.length ? flips : [TURNS[0]]);
      if (bent && (!alt || bent.err < alt.err)) alt = { v: native, ...bent };
    }
    if (alt && alt.err < Math.min(30, plain * 0.8)) pick = alt;
  }

  const unrecognisable = !pick || pick.err > 40;
  const v = pick?.v ?? variant(nw, nh);
  const E = v.E;
  const w = v.w;
  const h = v.h;
  const D = pick?.D ?? TURNS[0];
  const angle = pick?.angle ?? 0;
  const m = placement(D, angle, pick?.ou ?? 0, pick?.ov ?? 0, W, H);
  const R = reference(original, m, w, h, angle !== 0);
  const moved = angle !== 0 || D.flipX || D.rotate !== 0;
  const fit = unrecognisable ? null : colourFit(R, E, moved);
  // Burned-in text only reads true the right way up: flipped, turned or tilted, it's been tampered with.
  const tilted = !unrecognisable && moved;

  const results = targets.map((t) => {
    if (tilted && t.kind === 'keep' && t.text) return { ...t, changed: 1, pass: false, turned: true, cells: [{ ...t.rect, changed: true }] };
    const cells = unrecognisable
      ? [{ ...t.rect, changed: true }]
      : inspectRect(t.rect, R, E, m, fit, moved);
    // Judge on the cells that carry the evidence (edges, features, text), not flat background.
    const detail = cells.filter((c) => c.detail);
    const judged = detail.length >= 4 ? detail : cells;
    const changed = judged.filter((c) => c.changed).length / judged.length;
    const pass = t.kind === 'hide' ? changed >= 0.7 : changed <= 0.3;
    return { ...t, changed, pass, cells };
  });

  // Subtlety: how much of the rest of the frame survived untouched.
  let subtle = 0;
  if (!unrecognisable) {
    const all = inspectRect({ x: 0, y: 0, w: W, h: H }, R, E, m, fit, moved);
    const inTarget = (c) =>
      targets.some((t) => c.x + c.w > t.rect.x && c.x < t.rect.x + t.rect.w && c.y + c.h > t.rect.y && c.y < t.rect.y + t.rect.h);
    const rest = all.filter((c) => !inTarget(c));
    subtle = rest.filter((c) => !c.changed).length / rest.length;
  }

  // Where the export lands on the tape (its bounding box, for the before/after comparison) and how it was turned.
  const back = invert(m);
  const xs = [[0, 0], [w, 0], [0, h], [w, h]].map(([u, q]) => [back[0] * u + back[2] * q + back[4], back[1] * u + back[3] * q + back[5]]);
  const x0 = Math.round(Math.min(...xs.map((p) => p[0])));
  const y0 = Math.round(Math.min(...xs.map((p) => p[1])));
  const box = { w: Math.round(Math.max(...xs.map((p) => p[0]))) - x0, h: Math.round(Math.max(...xs.map((p) => p[1]))) - y0 };
  const transform = { flipX: D.flipX && D.rotate !== 180, flipY: D.flipX && D.rotate === 180, rotate: D.flipX && D.rotate === 180 ? 0 : D.rotate, angle };
  return { results, subtle, unrecognisable, offset: { ox: x0, oy: y0 }, size: box, transform };
}
