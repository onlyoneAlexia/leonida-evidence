// Composes the shareable end-of-run poster.

export function rankFor(stars, busted, cases) {
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
  g.font = '600 26px "IBM Plex Mono"';
  g.fillText('VICE CITY POLICE DEPARTMENT · LEONIDA', PW / 2, 70);

  const grad = g.createLinearGradient(0, 90, 0, 220);
  grad.addColorStop(0, '#ffe7a3');
  grad.addColorStop(1, '#ff4fd8');
  g.fillStyle = grad;
  g.font = '150px Anton';
  g.fillText(busted ? 'BUSTED' : 'RAP SHEET', PW / 2, 230);

  g.fillStyle = '#fff';
  g.font = '800 54px Montserrat';
  g.fillText(alias.toUpperCase(), PW / 2, 310);
  g.font = '600 30px Montserrat';
  g.fillStyle = '#ffd1a1';
  g.fillText(rank.title, PW / 2, 356);

  g.font = '64px Anton';
  const starW = 70;
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.18)';
    g.fillText('★', PW / 2 + (i - 2) * starW, 440);
  }

  // thumbnails
  const cols = 2;
  const tw = 470;
  const th = tw * (720 / 1280);
  const gap = 30;
  const startX = (PW - (cols * tw + gap)) / 2;
  const startY = 480;
  const imgs = await Promise.all(history.map((h) => loadImage(h.edited)));
  history.forEach((h, i) => {
    const x = startX + (i % cols) * (tw + gap);
    const y = startY + Math.floor(i / cols) * (th + 64);
    g.fillStyle = '#000';
    g.fillRect(x - 6, y - 6, tw + 12, th + 12);
    if (imgs[i]) {
      const s = Math.min(tw / imgs[i].width, th / imgs[i].height);
      const iw = imgs[i].width * s;
      const ih = imgs[i].height * s;
      g.drawImage(imgs[i], x + (tw - iw) / 2, y + (th - ih) / 2, iw, ih);
    }
    const ok = h.heat === 0;
    g.fillStyle = ok ? '#29e79a' : '#ff3b5c';
    g.fillRect(x - 6, y + th + 6, tw + 12, 40);
    g.fillStyle = '#0d0714';
    g.font = '700 22px "IBM Plex Mono"';
    g.textAlign = 'left';
    g.fillText(`${i + 1}. ${h.title.toUpperCase()}`, x + 8, y + th + 34);
    g.textAlign = 'right';
    g.fillText(ok ? 'DISMISSED' : `+${h.heat}★`, x + tw - 6, y + th + 34);
    g.textAlign = 'center';
  });

  g.fillStyle = '#fff';
  g.font = '72px Anton';
  g.fillText('$' + Math.round(cash).toLocaleString('en-US'), PW / 2, PH - 110);
  g.font = '600 24px "IBM Plex Mono"';
  g.fillStyle = '#1a0830';
  g.fillText('LEONIDA EVIDENCE ROOM · #BuiltWithImageEditor', PW / 2, PH - 50);

  return c.toDataURL('image/png');
}
