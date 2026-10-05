// Rasterises the app icon to PNG with a tiny SDF painter + PNG encoder (no deps).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// signed distance helpers (negative = inside)
const sdBox = (x, y, cx, cy, hw, hh, r = 0) => { const dx = Math.abs(x - cx) - hw + r, dy = Math.abs(y - cy) - hh + r; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r; };
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const sdTri = (x, y, ax, ay, bx, by, cx, cy) => {
  // inside test with edge distance
  const e = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]];
  let d = Infinity, s = 1;
  for (const [x0, y0, x1, y1] of e) {
    const ex = x1 - x0, ey = y1 - y0, wx = x - x0, wy = y - y0;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if (ex * wy - ey * wx < 0) s = -1;
  }
  return s > 0 ? -d : d; // assumes clockwise winding in y-down space
};

function paint(x, y, maskable) {
  // background
  const top = hex('#4a2380'), bot = hex('#140a26');
  let col = mix(top, bot, y);
  let a = 1;
  if (!maskable) { const d = sdBox(x, y, 0.5, 0.5, 0.5, 0.5, 0.2); a = Math.max(0, Math.min(1, 0.5 - d * 400)); }
  // content scaled into the safe zone for maskable icons
  const s = maskable ? 0.78 : 0.92;
  const u = (x - 0.5) / s + 0.5, v = (y - 0.5) / s + 0.5;
  const layer = (d, c, soft = 0.004) => { const t = Math.max(0, Math.min(1, 0.5 - d / soft)); col = mix(col, c, t); };
  // moon + halo
  const md = sdCircle(u, v, 0.73, 0.24, 0.1);
  col = mix(col, hex('#ffe9a8'), Math.max(0, 0.35 - Math.max(0, md) * 2.2) * 0.6);
  layer(md, hex('#fff3c8'));
  layer(sdCircle(u, v, 0.69, 0.21, 0.025), hex('#f0d890'));
  // mansion silhouette
  const sil = hex('#0b0514');
  layer(sdBox(u, v, 0.5, 0.64, 0.25, 0.17), sil);
  layer(sdTri(u, v, 0.5, 0.26, 0.82, 0.48, 0.18, 0.48), sil);
  layer(sdBox(u, v, 0.66, 0.36, 0.05, 0.14), sil);
  layer(sdTri(u, v, 0.66, 0.15, 0.73, 0.24, 0.59, 0.24), sil);
  // glowing windows + door
  const gold = hex('#ffcf4a');
  for (const [wx, wy] of [[0.37, 0.56], [0.63, 0.56], [0.37, 0.69], [0.63, 0.69], [0.5, 0.41]]) layer(sdBox(u, v, wx, wy, 0.04, 0.045, 0.008), gold);
  layer(sdBox(u, v, 0.5, 0.74, 0.05, 0.07, 0.03), hex('#ff9a3d'));
  // teal vacuum swoosh
  const ring = Math.abs(sdCircle(u, v, 0.5, 0.18, 0.72)) - 0.035;
  if (v > 0.78) layer(ring, hex('#4fe3c1'));
  // sparkle
  const rh = (cx, cy, a, b) => (Math.abs(u - cx) / a + Math.abs(v - cy) / b - 1) * Math.min(a, b);
  for (const [cx, cy, k] of [[0.24, 0.3, 1], [0.86, 0.5, 0.6]]) layer(Math.min(rh(cx, cy, 0.016 * k, 0.07 * k), rh(cx, cy, 0.07 * k, 0.016 * k)), hex('#ffffff'), 0.003);
  return [...col, a];
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4); const ss = 3;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, al = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const [cr, cg, cb, ca] = paint((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, maskable);
      r += cr * ca; g += cg * ca; b += cb * ca; al += ca;
    }
    const n = ss * ss, i = (py * size + px) * 4;
    buf[i] = al ? r / al : 0; buf[i + 1] = al ? g / al : 0; buf[i + 2] = al ? b / al : 0; buf[i + 3] = (al / n) * 255;
  }
  return png(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, false));
writeFileSync('public/icons/icon-512.png', render(512, false));
writeFileSync('public/icons/icon-maskable-512.png', render(512, true));
console.log('icons written');
