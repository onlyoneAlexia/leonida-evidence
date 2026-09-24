// Composes the shareable end-of-run poster.

export function rankFor(stars, busted, cases, walked = false) {
  if (walked) return { title: 'Walked Away', line: `You bailed after ${cases} job${cases === 1 ? '' : 's'}. The crew is keeping your cut of the rest.` };
  if (busted) return { title: 'Guest of the State', line: `Five stars after ${cases} case${cases === 1 ? '' : 's'}. Lucia and Jason are not returning your calls.` };
  if (stars === 0) return { title: 'Ghost of Leonida', line: 'Not a single frame traced back to the crew. The VCPD has nothing.' };
  if (stars <= 2) return { title: 'Vice City Fixer', line: 'A few loose ends, but the crew walks. Rico is sweating.' };
  return { title: 'Sloppy Accomplice', line: 'The crew made it out. Barely. Maybe practise on your holiday photos.' };
}

function loadImage(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

export async function buildRapSheet({ alias, history, stars, cash, busted, rank }) {
  const PW = 1080;
  const PH = 1350;
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 0, PH);
  bg.addColorStop(0, '#1a0830');
  bg.addColorStop(0.55, '#5c1a5e');
  bg.addColorStop(1, '#ff6b3d');
  g.fillStyle = bg;
  g.fillRect(0, 0, PW, PH);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < PH; y += 4) g.fillRect(0, y, PW, 1);

  g.textAlign = 'center';
  g.fillStyle = '#ffd6f0';
  g.font = '600 26px "IBM Plex Mono", monospace';
  g.fillText('VICE CITY POLICE DEPARTMENT · LEONIDA', PW / 2, 70);

  const grad = g.createLinearGradient(0, 90, 0, 220);
  grad.addColorStop(0, '#ffe7a3');
  grad.addColorStop(1, '#ff4fd8');
  g.fillStyle = grad;
  g.font = '150px Anton, sans-serif';
  g.fillText(busted ? 'BUSTED' : 'RAP SHEET', PW / 2, 230);

  g.fillStyle = '#fff';
  g.font = '800 54px Montserrat, sans-serif';
  g.fillText(alias.toUpperCase(), PW / 2, 310);
  g.font = '600 30px Montserrat, sans-serif';
  g.fillStyle = '#ffd1a1';
  g.fillText(rank.title, PW / 2, 356);

  g.font = '64px Anton, sans-serif';
  const starW = 70;
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.18)';
    g.fillText('★', PW / 2 + (i - 2) * starW, 440);
  }

  // thumbnails: two columns up to four cases, 3 + 2 for five, centred between the stars and the total
  const n = history.length;
  const cols = n >= 5 ? 3 : Math.max(1, Math.min(n, 2));
  const rows = Math.ceil(n / cols);
  const gap = 30;
  const top = 470;
  const bottom = PH - 190;
  const tw = Math.min(470, (970 - gap * (cols - 1)) / cols, ((bottom - top + 12) / rows - 64) * (1280 / 720));
  const th = tw * (720 / 1280);
  const startY = top + 6 + (bottom - top - (rows * (th + 64) - 12)) / 2;
  const imgs = await Promise.all(history.map((h) => loadImage(h.edited)));
  history.forEach((h, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const x = (PW - (inRow * tw + (inRow - 1) * gap)) / 2 + (i % cols) * (tw + gap);
    const y = startY + row * (th + 64);
    g.fillStyle = '#000';
    g.fillRect(x - 6, y - 6, tw + 12, th + 12);
    if (imgs[i]) {
      const s = Math.min(tw / imgs[i].width, th / imgs[i].height);
      const iw = imgs[i].width * s;
      const ih = imgs[i].height * s;
      g.drawImage(imgs[i], x + (tw - iw) / 2, y + (th - ih) / 2, iw, ih);
    }
    const ok = h.heat === 0;
    const label = `${i + 1}. ${h.title.toUpperCase()}`;
    const verdict = ok ? 'DISMISSED' : `+${h.heat}★`;
    g.fillStyle = ok ? '#29e79a' : '#ff3b5c';
    g.fillRect(x - 6, y + th + 6, tw + 12, 40);
    g.fillStyle = '#0d0714';
    // Narrow 3-column tiles shrink the label until the title and verdict both fit.
    let size = 22;
    g.font = `700 ${size}px "IBM Plex Mono", monospace`;
    while (size > 14 && g.measureText(`${label}  ${verdict}`).width > tw - 14) g.font = `700 ${--size}px "IBM Plex Mono", monospace`;
    g.textAlign = 'left';
    g.fillText(label, x + 8, y + th + 26 + size / 3);
    g.textAlign = 'right';
    g.fillText(verdict, x + tw - 6, y + th + 26 + size / 3);
    g.textAlign = 'center';
  });

  g.fillStyle = '#fff';
  g.font = '72px Anton, sans-serif';
  g.fillText('$' + Math.round(cash).toLocaleString('en-US'), PW / 2, PH - 110);
  g.font = '600 24px "IBM Plex Mono", monospace';
  g.fillStyle = '#1a0830';
  g.fillText('LEONIDA EVIDENCE ROOM · #BuiltWithImageEditor', PW / 2, PH - 50);

  // A Blob encodes off the main thread and paints faster than a multi-megabyte data URL.
  return new Promise((resolve, reject) => {
    c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Poster could not be encoded'))), 'image/png');
  });
}
