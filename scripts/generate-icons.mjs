// Génère les icônes PNG de l'application (sans dépendance) : un dé sur fond
// orange chaleureux. Usage : npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const roundRect = (px, py, cx, cy, half, r) => {
  const qx = Math.abs(px - cx) - half + r;
  const qy = Math.abs(py - cy) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const TOP = hex('#F59A52');
const BOTTOM = hex('#D9592B');
const DIE = hex('#FFF8EE');
const SHADOW = hex('#9E3B17');
const PIP = hex('#3B2418');

/** Couleur d'un point (coordonnées normalisées 0..1). */
function shade(u, v, { maskable, rounded }) {
  let col = mix(TOP, BOTTOM, v);
  let alpha = 1;
  if (rounded) {
    const d = roundRect(u, v, 0.5, 0.5, 0.5, 0.22);
    if (d > 0) alpha = 0;
  }
  const scale = maskable ? 0.62 : 0.78;
  const half = 0.31 * scale / 0.78;
  const r = 0.09 * scale / 0.78;
  const cx = 0.5;
  const cy = 0.48;
  // ombre portée
  if (roundRect(u, v, cx + 0.015, cy + 0.035, half, r) <= 0) col = mix(col, SHADOW, 0.55);
  if (roundRect(u, v, cx, cy, half, r) <= 0) {
    col = DIE;
    const s = half * 0.55;
    const pr = half * 0.17;
    const pips = [[0, 0], [-s, -s], [s, s], [-s, s], [s, -s]];
    for (const [dx, dy] of pips) if (Math.hypot(u - cx - dx, v - cy - dy) <= pr) col = PIP;
  }
  return [...col, alpha * 255];
}

function render(size, opts) {
  const N = 4; // suréchantillonnage 4×4 pour l'anticrénelage
  return png(size, (x, y) => {
    const acc = [0, 0, 0, 0];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = shade((x + (i + 0.5) / N) / size, (y + (j + 0.5) / N) / size, opts);
      const a = c[3] / 255;
      acc[0] += c[0] * a; acc[1] += c[1] * a; acc[2] += c[2] * a; acc[3] += a;
    }
    if (acc[3] === 0) return [0, 0, 0, 0];
    return [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], (acc[3] / (N * N)) * 255].map(Math.round);
  });
}

mkdirSync('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}], // iOS arrondit lui-même ; pas de transparence
  ['favicon-32.png', 32, { rounded: true }],
];
for (const [name, size, opts] of out) {
  writeFileSync(`public/icons/${name}`, render(size, opts));
  console.log('écrit', name);
}
