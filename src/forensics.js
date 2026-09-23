// VCPD forensics: compares the doctored still against the original tape.
//
// 1. Align: if the player cropped, find where the edited image sits inside the original.
// 2. Colour fit: learn a global colour transform so filters/brightness alone don't count as tampering.
// 3. Cells: split every evidence box into small cells and flag cells that were covered,
//    painted, blurred or cropped away.

const CELL = 8; // px

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

function pixels(source, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
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

// Mean absolute difference of edited (small) placed at (ox, oy) in original.
function mad(orig, edit, ox, oy, step) {
  let s = 0;
  let n = 0;
  for (let y = 0; y < edit.h; y += step) {
    const oRow = (y + oy) * orig.w + ox;
    const eRow = y * edit.w;
    for (let x = 0; x < edit.w; x += step) {
      s += Math.abs(orig.data[oRow + x] - edit.data[eRow + x]);
      n++;
    }
  }
  return s / n;
}

function align(oL, eL, W, H, w, h) {
  if (w === W && h === H) return { ox: 0, oy: 0, err: 0 };
  if (w > W || h > H) return null;
  const F = 8;
  const oS = shrink(oL, W, H, F);
  const eS = shrink(eL, w, h, F);
  let best = { ox: 0, oy: 0, err: Infinity };
  for (let oy = 0; oy <= oS.h - eS.h; oy++) {
    for (let ox = 0; ox <= oS.w - eS.w; ox++) {
      const e = mad(oS, eS, ox, oy, 2);
      if (e < best.err) best = { ox, oy, err: e };
    }
  }
  // refine at full res around the coarse hit
  const oF = { data: oL, w: W, h: H };
  const eF = { data: eL, w, h };
  let fine = { ox: best.ox * F, oy: best.oy * F, err: Infinity };
  for (let oy = Math.max(0, best.oy * F - F); oy <= Math.min(H - h, best.oy * F + F); oy++) {
    for (let ox = Math.max(0, best.ox * F - F); ox <= Math.min(W - w, best.ox * F + F); ox++) {
      const e = mad(oF, eF, ox, oy, 4);
      if (e < fine.err) fine = { ox, oy, err: e };
    }
  }
  return fine;
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

// Fits edited = A * [r g b 1] per channel over overlapping pixels (robust, 2 passes).
function colourFit(O, E, ox, oy) {
  let coef = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ];
  const apply = (r, g, b, ch) => coef[ch][0] * r + coef[ch][1] * g + coef[ch][2] * b + coef[ch][3];
  for (let pass = 0; pass < 2; pass++) {
    const AtA = [...Array(4)].map(() => [0, 0, 0, 0]);
    const Atb = [0, 1, 2].map(() => [0, 0, 0, 0]);
    for (let y = 0; y < E.height; y += 3) {
      for (let x = 0; x < E.width; x += 3) {
        const oi = ((y + oy) * O.width + (x + ox)) * 4;
        const ei = (y * E.width + x) * 4;
        const v = [O.data[oi], O.data[oi + 1], O.data[oi + 2], 1];
        if (pass === 1) {
          let res = 0;
          for (let ch = 0; ch < 3; ch++) res += Math.abs(apply(v[0], v[1], v[2], ch) - E.data[ei + ch]);
          if (res / 3 > 30) continue;
        }
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) AtA[i][j] += v[i] * v[j];
          for (let ch = 0; ch < 3; ch++) Atb[ch][i] += v[i] * E.data[ei + ch];
        }
      }
    }
    const next = Atb.map((b) => solve4(AtA, b));
    if (next.some((n) => !n)) break;
    coef = next;
  }
  return apply;
}

// Returns { changed: boolean[] per cell, cells: [{x,y,w,h,changed}] } for a rect in original coords.
function inspectRect(rect, O, E, ox, oy, fit) {
  const cells = [];
  for (let cy = rect.y; cy < rect.y + rect.h; cy += CELL) {
    for (let cx = rect.x; cx < rect.x + rect.w; cx += CELL) {
      const cw = Math.min(CELL, rect.x + rect.w - cx);
      const ch = Math.min(CELL, rect.y + rect.h - cy);
      const ex = cx - ox;
      const ey = cy - oy;
      if (ex < 0 || ey < 0 || ex + cw > E.width || ey + ch > E.height) {
        cells.push({ x: cx, y: cy, w: cw, h: ch, changed: true, cropped: true, detail: true });
        continue;
      }
      let res = 0;
      let n = 0;
      let so = 0;
      let so2 = 0;
      let se = 0;
      let se2 = 0;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const oi = ((cy + y) * O.width + cx + x) * 4;
          const ei = ((ey + y) * E.width + ex + x) * 4;
          const r = O.data[oi];
          const g = O.data[oi + 1];
          const b = O.data[oi + 2];
          let lo = 0;
          let le = 0;
          for (let c = 0; c < 3; c++) {
            const p = fit(r, g, b, c);
            res += Math.abs(p - E.data[ei + c]);
            lo += p;
            le += E.data[ei + c];
          }
          lo /= 3;
          le /= 3;
          so += lo;
          so2 += lo * lo;
          se += le;
          se2 += le * le;
          n++;
        }
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
  // Try the export as-is (a crop at native scale) and scaled to fit (a resized export);
  // keep whichever lines up with the original tape best.
  const nw = im.naturalWidth;
  const nh = im.naturalHeight;
  const k = Math.min(W / nw, H / nh);
  const sizes = [[nw, nh], [Math.floor(nw * k), Math.floor(nh * k)]].filter(
    ([sw, sh], i) => sw <= W && sh <= H && sw > 0 && sh > 0 && (i === 0 || sw !== nw),
  );
  let best = null;
  for (const [sw, sh] of sizes) {
    const img = pixels(im, sw, sh);
    const a = align(oL, luma(img), W, H, sw, sh);
    if (a && (!best || a.err < best.al.err)) best = { al: a, E: img, w: sw, h: sh };
  }
  const al = best?.al ?? null;
  const E = best?.E ?? pixels(im, W, H);
  const w = best?.w ?? W;
  const h = best?.h ?? H;

  const unrecognisable = !al || al.err > 40;
  const ox = al?.ox ?? 0;
  const oy = al?.oy ?? 0;
  const fit = unrecognisable ? null : colourFit(O, E, ox, oy);

  const results = targets.map((t) => {
    const cells = unrecognisable
      ? [{ ...t.rect, changed: true }]
      : inspectRect(t.rect, O, E, ox, oy, fit);
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
    const all = inspectRect({ x: 0, y: 0, w: W, h: H }, O, E, ox, oy, fit);
    const inTarget = (c) =>
      targets.some((t) => c.x + c.w > t.rect.x && c.x < t.rect.x + t.rect.w && c.y + c.h > t.rect.y && c.y < t.rect.y + t.rect.h);
    const rest = all.filter((c) => !inTarget(c));
    subtle = rest.filter((c) => !c.changed).length / rest.length;
  }

  return { results, subtle, unrecognisable, offset: { ox, oy }, size: { w, h } };
}
