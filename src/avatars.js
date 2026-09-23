// One shared atlas keeps the homepage crew and CCTV characters visually consistent.
// Face bounds are measured in each equal-width atlas cell, not in scene pixels.
const SPRITES = {
  fixer: { column: 0, face: [0.405, 0.065, 0.285, 0.135] },
  jason: { column: 1, face: [0.415, 0.062, 0.285, 0.125] },
  lucia: { column: 2, face: [0.345, 0.078, 0.285, 0.13], tattoo: [0.194, 0.425, 0.072, 0.08] },
  rico: { column: 3, face: [0.385, 0.072, 0.29, 0.128] },
};

let atlas;
let loading;

export function loadAvatarArt() {
  if (!loading) {
    loading = new Promise((resolve) => {
      const image = new Image();
      const timeout = setTimeout(() => resolve(false), 10000);
      image.onload = () => { clearTimeout(timeout); atlas = image; resolve(true); };
      // Keep the procedural characters available if an asset cannot be fetched.
      image.onerror = () => { clearTimeout(timeout); resolve(false); };
      image.src = '/art/crew-sprites-v2.webp';
    });
  }
  return loading;
}

function mappedRect(bounds, x, y, width, height) {
  return {
    x: x + bounds[0] * width,
    y: y + bounds[1] * height,
    w: bounds[2] * width,
    h: bounds[3] * height,
  };
}

function drawTattoo(g, rect) {
  g.save();
  g.translate(rect.x, rect.y);
  g.scale(rect.w / 24, rect.h / 56);
  g.strokeStyle = '#30203f';
  g.lineWidth = 1.8;
  g.fillStyle = '#76203b';
  g.beginPath();
  g.arc(12, 10, 7, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(12, 10, 3, 0.3, 5.7);
  g.moveTo(12, 17);
  g.lineTo(12, 37);
  g.moveTo(12, 24);
  g.lineTo(5, 20);
  g.moveTo(12, 29);
  g.lineTo(19, 25);
  g.stroke();
  g.fillStyle = '#30203f';
  g.font = '700 10px "IBM Plex Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText('L+J', 12, 49);
  g.restore();
}

export function drawAvatar(g, options) {
  const sprite = SPRITES[options.avatar];
  if (!atlas || !sprite) return null;

  const cellWidth = atlas.naturalWidth / 4;
  const height = 340 * (options.s ?? 1);
  const width = height * cellWidth / atlas.naturalHeight;
  const x = options.x - width / 2;
  const y = options.y - height;
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(atlas, sprite.column * cellWidth, 0, cellWidth, atlas.naturalHeight, x, y, width, height);
  g.restore();

  const face = mappedRect(sprite.face, x, y, width, height);
  const tattoo = options.tattoo && sprite.tattoo ? mappedRect(sprite.tattoo, x, y, width, height) : null;
  if (tattoo) drawTattoo(g, tattoo);
  return { face, tattoo };
}
