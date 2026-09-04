// ─── Cartoon piece artwork ────────────────────────────────────────────────────

// Pieces are drawn from primitives straight onto each piece's own Graphics
// object, centred on (0,0) and already at final pixel size — so the existing
// move tweens (which animate the Graphics position) and the dim-when-stuck
// alpha handling keep working untouched, with no image assets to load.

// Phaser's fillEllipse can't be rotated, so ovals are emitted as polygons —
// used for heads, muzzles and the sheep's drooping ears.
function fillOval(g, cx, cy, rx, ry, angle = 0, steps = 24) {
  const pts = [];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
    pts.push({ x: cx + x * cos - y * sin, y: cy + x * sin + y * cos });
  }
  g.fillPoints(pts, true);
}

// Fluffy grey ruff, big pointed ears, amber slanted eyes, long snout and a
// pair of fangs — cartoon proportions (oversized head, oversized eyes) with a
// silhouette deliberately spiky, so it never reads as a cat.
function drawWolfArt(g) {
  const COAT = 0x8b95ad, COAT_DARK = 0x5c6580, BLAZE = 0xa3adc4;
  const MUZZLE = 0xeceff8, INNER_EAR = 0xd08f97, EYE = 0xffcf3d, INK = 0x20222e;

  // Ground shadow — gives the token a little lift off the board lines
  g.fillStyle(0x000000, 0.28);
  fillOval(g, 0, 22, 18, 5);

  // Spiky neck ruff behind the head: a star polygon of alternating radii, so
  // the outline is shaggy fur rather than a smooth disc.
  const ruff = [];
  const spikes = 11;
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 25 : 18;
    ruff.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.94 + 1 });
  }
  g.fillStyle(COAT_DARK, 1);
  g.fillPoints(ruff, true);

  // Ears — tall, splayed outward
  g.fillStyle(COAT_DARK, 1);
  g.fillTriangle(-19, -6, -24.5, -28, -4, -17);
  g.fillTriangle(19, -6, 24.5, -28, 4, -17);
  g.fillStyle(INNER_EAR, 1);
  g.fillTriangle(-16.5, -9, -20, -23, -7.5, -16);
  g.fillTriangle(16.5, -9, 20, -23, 7.5, -16);

  // Head + lighter forehead blaze — wider than tall, so the skull reads canine
  g.fillStyle(COAT, 1);
  fillOval(g, 0, -1, 18.5, 14.8);
  g.fillStyle(BLAZE, 1);
  fillOval(g, 0, -8, 7.5, 8);

  // Fur tuft between the ears
  g.fillStyle(COAT_DARK, 1);
  g.fillTriangle(-6, -12, -1, -14, -3.5, -22);
  g.fillTriangle(6, -12, 1, -14, 3.5, -22);

  // Snout: a bridge running up between the eyes plus a rounded muzzle, which
  // is what separates a canine profile from a feline one.
  g.fillStyle(MUZZLE, 1);
  fillOval(g, 0, 1, 6.5, 9);
  fillOval(g, 0, 9.5, 12.5, 8.5);

  // Nose
  g.fillStyle(INK, 1);
  fillOval(g, 0, 3.2, 4.2, 3.0);
  g.fillTriangle(-3.2, 3.5, 3.2, 3.5, 0, 6.8);

  // Open grin: a dark mouth with two fangs hanging into it and a bit of
  // tongue — fangs need the dark backing to be visible on the pale muzzle.
  g.fillStyle(INK, 1);
  fillOval(g, 0, 14, 7.2, 4.6);
  g.fillStyle(0xe0666f, 1);
  fillOval(g, 0, 16.4, 3.4, 2.1);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(-4.7, 10.6, -1.7, 10.6, -3.2, 15.2);
  g.fillTriangle(4.7, 10.6, 1.7, 10.6, 3.2, 15.2);

  // Eyes — slanted outward for a predatory squint
  g.fillStyle(EYE, 1);
  fillOval(g, -8, -3.5, 5.4, 4.4, 0.22);
  fillOval(g, 8, -3.5, 5.4, 4.4, -0.22);
  g.fillStyle(INK, 1);
  fillOval(g, -7.4, -2.8, 2.3, 3.1);
  fillOval(g, 7.4, -2.8, 2.3, 3.1);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(-9.2, -5.0, 1.2);
  g.fillCircle(6.4, -5.0, 1.2);

  // Angled brows
  g.lineStyle(3, COAT_DARK, 1);
  g.lineBetween(-13.5, -11, -4, -7.5);
  g.lineBetween(13.5, -11, 4, -7.5);
}

// A scalloped wool cloud (the opposite silhouette to the wolf's spikes) around
// a cream face with big eyes, blushed cheeks and droopy ears.
function drawSheepArt(g) {
  const WOOL = 0xfbfaf3, WOOL_SHADE = 0xd3d3c6;
  const FACE = 0xf7ddc6, FACE_EDGE = 0xd6ab8c, SNOUT = 0xecc1a6;
  const EAR = 0xe9c6ac, BLUSH = 0xf0928f, INK = 0x2b2118;

  g.fillStyle(0x000000, 0.28);
  fillOval(g, 0, 22, 17, 5);

  // Wool: a ring of puffs (shaded copies first, lighter ones offset up over
  // them) plus a central mass — reads as fluff without needing gradients.
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    puffs.push({ x: Math.cos(a) * 15, y: Math.sin(a) * 14 - 1, r: 9 });
  }
  g.fillStyle(WOOL_SHADE, 1);
  for (const { x, y, r } of puffs) g.fillCircle(x, y + 2.5, r);
  g.fillStyle(WOOL, 1);
  for (const { x, y, r } of puffs) g.fillCircle(x, y, r);
  fillOval(g, 0, -2, 15, 13.5);

  // Droopy ears, tucked behind the face
  g.fillStyle(EAR, 1);
  fillOval(g, -16, 1, 8, 4.3, -0.38);
  fillOval(g, 16, 1, 8, 4.3, 0.38);

  // Face, outlined so the cream reads against the white wool, with a wool
  // fringe overlapping its top edge
  g.fillStyle(FACE_EDGE, 1);
  fillOval(g, 0, 6, 12, 11);
  g.fillStyle(FACE, 1);
  fillOval(g, 0, 6, 11, 10);
  g.fillStyle(WOOL, 1);
  fillOval(g, 0, -4, 11.5, 8);

  // Blushed cheeks
  g.fillStyle(BLUSH, 0.35);
  g.fillCircle(-8, 8.5, 3.2);
  g.fillCircle(8, 8.5, 3.2);

  // Eyes
  g.fillStyle(INK, 1);
  fillOval(g, -5, 4.5, 2.9, 3.4);
  fillOval(g, 5, 4.5, 2.9, 3.4);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(-5.9, 3.3, 1.2);
  g.fillCircle(4.1, 3.3, 1.2);

  // Snout, nostrils, smile
  g.fillStyle(SNOUT, 1);
  fillOval(g, 0, 11.5, 5.6, 3.8);
  g.fillStyle(INK, 1);
  g.fillCircle(-1.9, 10.6, 0.85);
  g.fillCircle(1.9, 10.6, 0.85);
  g.lineStyle(1.4, INK, 1);
  g.lineBetween(-2.8, 13.2, 0, 14.3);
  g.lineBetween(0, 14.3, 2.8, 13.2);
}

export { drawWolfArt, drawSheepArt };
