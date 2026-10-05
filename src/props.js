import * as THREE from 'three';
import * as TX from './textures.js';

// ---------- material + mesh helpers ----------
const matCache = new Map();
export function M(color, o = {}) {
  const key = o.unique ? null : `${color}|${o.r}|${o.m}|${o.e}|${o.ei}|${o.flat}|${o.map ? o.map.uuid : ''}|${o.t}|${o.o}|${o.side}`;
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.r ?? 0.82, metalness: o.m ?? 0, flatShading: o.flat ?? false,
    emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, map: o.map || null,
    transparent: !!o.t, opacity: o.o ?? 1, side: o.side ?? THREE.FrontSide,
  });
  if (key) matCache.set(key, m);
  return m;
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
export const cyl = (rt, rb, h, mat, x, y, z, p, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
export const sph = (r, mat, x, y, z, p, ws = 14, hs = 10) => mesh(new THREE.SphereGeometry(r, ws, hs), mat, x, y, z, p);

const WOOD = '#6b4226', WOOD_D = '#4a2c18', WOOD_L = '#9a6a3e', BRASS = '#d4a23a';
const brass = () => M(BRASS, { m: 0.8, r: 0.35 });

// a glowing material that turns on when the room is cleaned
function glowMat(color) { return M(color, { unique: true, e: color, ei: 0.05 }); }

// ---------- furniture builders ----------
// Each returns { obj, w, d, h, solid, glow[], anim(t,dt), flutter }
// "Front" faces +Z at rot 0.
const B = {};

B.sofa = (o) => {
  const g = new THREE.Group(); const c = M(o.color || '#7a3050', { map: TX.cloth(o.color || '#7a3050') });
  const W = 2.4, D = 1.0;
  box(W, 0.45, D, c, 0, 0.35, 0, g);
  box(W, 0.8, 0.28, c, 0, 0.75, -D / 2 + 0.14, g);
  box(0.26, 0.65, D, c, -W / 2 + 0.13, 0.55, 0, g); box(0.26, 0.65, D, c, W / 2 - 0.13, 0.55, 0, g);
  const cush = M(o.color || '#7a3050', { r: 0.9 });
  for (let i = -1; i <= 1; i += 2) { const k = box(0.92, 0.16, 0.7, cush, i * 0.48, 0.64, 0.08, g); k.scale.set(1, 1, 1); }
  for (const x of [-1.05, 1.05]) for (const z of [-0.4, 0.4]) cyl(0.05, 0.04, 0.14, M(WOOD_D), x, 0.07, z, g, 8);
  return { obj: g, w: W, d: D, h: 1.2 };
};

B.armchair = (o) => {
  const g = new THREE.Group(); const col = o.color || '#3a5a7a'; const c = M(col, { map: TX.cloth(col) });
  box(1.0, 0.45, 0.95, c, 0, 0.35, 0, g);
  box(1.0, 0.9, 0.24, c, 0, 0.85, -0.36, g);
  box(0.2, 0.6, 0.95, c, -0.45, 0.6, 0, g); box(0.2, 0.6, 0.95, c, 0.45, 0.6, 0, g);
  box(0.62, 0.14, 0.62, M(col, { r: 0.9 }), 0, 0.64, 0.08, g);
  return { obj: g, w: 1.05, d: 0.95, h: 1.3 };
};

B.table = (o) => {
  const g = new THREE.Group(); const W = o.w || 1.8, D = o.d || 1.0, H = o.h || 0.8;
  const wood = M(o.wood || WOOD);
  box(W, 0.08, D, wood, 0, H, 0, g);
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) for (const z of [-D / 2 + 0.1, D / 2 - 0.1]) box(0.08, H, 0.08, wood, x, H / 2, z, g);
  let flutter = null;
  if (o.cloth) {
    const cm = M(o.cloth, { side: THREE.DoubleSide, r: 0.95 });
    box(W + 0.1, 0.02, D + 0.1, cm, 0, H + 0.05, 0, g);
    const geo = new THREE.PlaneGeometry(W + 0.1, 0.45, 8, 3);
    const skirt = mesh(geo, cm, 0, H - 0.17, D / 2 + 0.05, g);
    flutter = { mesh: skirt, base: geo.attributes.position.array.slice(), wind: 0, axis: 'z' };
  }
  const glow = [];
  if (o.candle) {
    box(0.08, 0.02, 0.08, brass(), 0.25, H + 0.06, 0, g);
    for (const dx of [0.15, 0.25, 0.35]) {
      cyl(0.025, 0.025, 0.22, M('#f3ead0'), dx, H + 0.18, 0, g, 6);
      const f = glowMat('#ffb347'); const fl = sph(0.035, f, dx, H + 0.32, 0, g, 6, 5); fl.castShadow = false; fl.scale.y = 1.6;
      glow.push(f);
    }
  }
  if (o.vase) {
    cyl(0.1, 0.13, 0.32, M('#3f6fa8', { r: 0.3 }), -W * 0.25, H + 0.2, 0, g);
    for (let i = 0; i < 4; i++) sph(0.08, M(['#e85a7a', '#f5c542', '#ffffff', '#c86ad8'][i]), -W * 0.25 + (Math.random() - 0.5) * 0.18, H + 0.45 + Math.random() * 0.1, (Math.random() - 0.5) * 0.18, g, 6, 5);
  }
  return { obj: g, w: W, d: D, h: H + 0.1, glow, flutter };
};

B.coffeeTable = (o) => B.table({ w: 1.4, d: 0.8, h: 0.45, wood: WOOD_D, ...o });

B.chair = (o) => {
  const g = new THREE.Group(); const wood = M(o.wood || WOOD); const seat = M(o.color || '#8a3a3a');
  box(0.55, 0.08, 0.55, wood, 0, 0.48, 0, g);
  box(0.5, 0.06, 0.48, seat, 0, 0.54, 0.02, g);
  for (const x of [-0.23, 0.23]) for (const z of [-0.23, 0.23]) box(0.05, 0.48, 0.05, wood, x, 0.24, z, g);
  box(0.55, 0.6, 0.06, wood, 0, 0.82, -0.25, g);
  return { obj: g, w: 0.55, d: 0.55, h: 1.1 };
};

B.bookshelf = (o) => {
  const g = new THREE.Group(); const W = o.w || 2.0, H = o.h || 2.6, D = 0.5; const wood = M(WOOD_D);
  box(W, H, 0.06, wood, 0, H / 2, -D / 2 + 0.03, g);
  box(0.08, H, D, wood, -W / 2 + 0.04, H / 2, 0, g); box(0.08, H, D, wood, W / 2 - 0.04, H / 2, 0, g);
  box(W, 0.1, D, wood, 0, H - 0.05, 0, g);
  const bm = M('#ffffff', { map: TX.books() });
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const y = 0.08 + r * (H - 0.2) / rows;
    box(W - 0.1, 0.05, D - 0.05, wood, 0, y, 0, g);
    const tex = bm.map.clone(); tex.needsUpdate = true; tex.repeat.set(W / 2, 0.5); tex.offset.set(Math.random(), r % 2 ? 0.5 : 0);
    const bk = mesh(new THREE.BoxGeometry(W - 0.18, (H - 0.2) / rows - 0.12, D - 0.12), M('#ffffff', { map: tex }), 0, y + ((H - 0.2) / rows) / 2 - 0.02, 0.02, g);
    bk.castShadow = false;
  }
  return { obj: g, w: W, d: D, h: H };
};

B.fireplace = () => {
  const g = new THREE.Group(); const stone = M('#8a8090', { flat: true }); const dark = M('#140c10');
  box(2.4, 1.6, 0.6, stone, 0, 0.8, 0, g);
  box(1.3, 1.0, 0.1, dark, 0, 0.55, 0.26, g);
  box(2.7, 0.14, 0.75, M(WOOD_D), 0, 1.66, 0.05, g);
  const fire = glowMat('#ff7a1a'); fire.emissiveIntensity = 2.2;
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const f = mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.06, 0.45, 6), fire, -0.35 + i * 0.23, 0.32, 0.18, g, false);
    f.userData.dynamic = true; flames.push(f);
  }
  const logs = M('#3a2010');
  cyl(0.07, 0.07, 0.9, logs, 0, 0.12, 0.18, g).rotation.z = Math.PI / 2;
  const anim = (t) => {
    flames.forEach((f, i) => { const s = 0.8 + Math.sin(t * 9 + i * 2.1) * 0.15 + Math.sin(t * 23 + i) * 0.08; f.scale.set(1, s, 1); });
    fire.emissiveIntensity = 2 + Math.sin(t * 13) * 0.4;
  };
  return { obj: g, w: 2.4, d: 0.6, h: 1.7, anim };
};

B.piano = () => {
  const g = new THREE.Group(); const black = M('#151018', { r: 0.25, m: 0.1 });
  const body = box(1.5, 0.35, 1.9, black, 0, 0.95, 0, g);
  const shape = new THREE.Shape(); shape.moveTo(-0.75, -0.95); shape.lineTo(0.75, -0.95); shape.lineTo(0.75, 0.2); shape.quadraticCurveTo(0.6, 0.95, -0.1, 0.95); shape.lineTo(-0.75, 0.95); shape.closePath();
  body.geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false }); body.geometry.rotateX(-Math.PI / 2); body.position.y = 0.78;
  const lid = mesh(new THREE.ShapeGeometry(shape), black, 0, 1.14, 0, g);
  lid.geometry.rotateX(-Math.PI / 2); lid.rotation.z = 0.5; lid.position.x = 0.2;
  box(1.4, 0.06, 0.28, M('#f5f0e6'), 0, 0.98, 1.05, g);
  for (let i = 0; i < 9; i++) box(0.05, 0.04, 0.16, black, -0.6 + i * 0.15, 1.02, 1.0, g);
  for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [0, -0.8]]) box(0.1, 0.78, 0.1, black, x, 0.39, z, g);
  box(0.6, 0.06, 0.32, black, 0, 0.48, 1.5, g);
  return { obj: g, w: 1.6, d: 2.1, h: 1.5 };
};

B.clock = () => {
  const g = new THREE.Group(); const wood = M(WOOD);
  box(0.62, 2.2, 0.42, wood, 0, 1.1, 0, g);
  box(0.72, 0.18, 0.5, M(WOOD_D), 0, 2.27, 0, g);
  const face = cyl(0.22, 0.22, 0.04, M('#f3ead0', { unique: true, e: '#f3ead0', ei: 0.05 }), 0, 1.85, 0.22, g, 20); face.rotation.x = Math.PI / 2;
  const hands = box(0.02, 0.16, 0.01, M('#111'), 0, 1.9, 0.25, g); hands.userData.dynamic = true;
  box(0.4, 0.95, 0.02, M('#2a1a10'), 0, 0.95, 0.21, g);
  const pend = new THREE.Group(); pend.position.set(0, 1.45, 0.23); g.add(pend); pend.userData.dynamic = true; pend.userData.mergeLocal = true;
  box(0.02, 0.7, 0.02, brass(), 0, -0.35, 0, pend); cyl(0.1, 0.1, 0.03, brass(), 0, -0.72, 0, pend, 14).rotation.x = Math.PI / 2;
  const anim = (t) => { pend.rotation.z = Math.sin(t * 2.4) * 0.3; hands.rotation.z = -t * 0.3; };
  return { obj: g, w: 0.7, d: 0.5, h: 2.4, anim, glow: [face.material] };
};

B.plant = (o) => {
  const g = new THREE.Group();
  cyl(0.28, 0.2, 0.5, M(o.pot || '#a0522d'), 0, 0.25, 0, g);
  const leaf = M('#3f7a3a', { flat: true }); const leaf2 = M('#5a9a48', { flat: true });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2; const l = mesh(new THREE.ConeGeometry(0.12, 0.9 + Math.random() * 0.4, 4), i % 2 ? leaf : leaf2, Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12, g);
    l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  return { obj: g, w: 0.6, d: 0.6, h: 1.4 };
};

B.lamp = () => {
  const g = new THREE.Group();
  cyl(0.22, 0.25, 0.06, brass(), 0, 0.03, 0, g);
  cyl(0.03, 0.03, 1.5, brass(), 0, 0.78, 0, g, 8);
  const shade = glowMat('#ffd27a'); shade.side = THREE.DoubleSide;
  cyl(0.22, 0.38, 0.4, shade, 0, 1.6, 0, g, 16);
  return { obj: g, w: 0.5, d: 0.5, h: 1.8, glow: [shade] };
};

B.bed = (o) => {
  const g = new THREE.Group(); const wood = M(WOOD_L); const col = o.color || '#6a8ad0';
  box(1.6, 0.35, 2.2, wood, 0, 0.25, 0, g);
  box(1.5, 0.22, 2.1, M('#f2efe8'), 0, 0.53, 0, g);
  box(1.56, 0.12, 1.4, M(col, { map: TX.cloth(col) }), 0, 0.66, 0.35, g);
  box(1.0, 0.18, 0.4, M('#ffffff'), 0, 0.72, -0.75, g);
  box(1.7, 1.2, 0.12, wood, 0, 0.6, -1.08, g);
  box(1.7, 0.7, 0.1, wood, 0, 0.35, 1.08, g);
  return { obj: g, w: 1.7, d: 2.2, h: 1.2 };
};

B.crib = () => {
  const g = new THREE.Group(); const w = M('#f2e6d0');
  box(1.0, 0.1, 1.4, w, 0, 0.45, 0, g);
  box(0.9, 0.15, 1.3, M('#a8d8f0'), 0, 0.55, 0, g);
  for (const x of [-0.48, 0.48]) for (let z = -0.65; z <= 0.66; z += 0.16) box(0.04, 0.6, 0.04, w, x, 0.75, z, g);
  for (const z of [-0.68, 0.68]) for (let x = -0.45; x <= 0.46; x += 0.15) box(0.04, 0.6, 0.04, w, x, 0.75, z, g);
  for (const x of [-0.48, 0.48]) box(0.07, 0.05, 1.42, w, x, 1.07, 0, g);
  for (const x of [-0.48, 0.48]) for (const z of [-0.68, 0.68]) box(0.08, 1.1, 0.08, w, x, 0.55, z, g);
  // mobile
  const mob = new THREE.Group(); mob.position.set(0, 1.9, 0); g.add(mob); mob.userData.dynamic = true; mob.userData.mergeLocal = true;
  box(0.02, 0.5, 0.02, w, 0.45, 1.6, -0.6, g);
  const cols = ['#ffcf4a', '#ff7a8a', '#7ad0ff', '#9aff7a'];
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; sph(0.07, M(cols[i], { e: cols[i], ei: 0.25 }), Math.cos(a) * 0.3, -0.2, Math.sin(a) * 0.3, mob, 8, 6); }
  const anim = (t) => { mob.rotation.y = t * 0.6; };
  return { obj: g, w: 1.05, d: 1.45, h: 1.2, anim };
};

B.toychest = () => {
  const g = new THREE.Group();
  box(1.1, 0.6, 0.65, M('#d0503a'), 0, 0.3, 0, g);
  box(1.14, 0.1, 0.69, M('#f0c040'), 0, 0.65, 0, g);
  const star = M('#ffffff', { e: '#ffffff', ei: 0.2 });
  sph(0.1, star, 0, 0.32, 0.33, g, 5, 2).scale.set(1, 1, 0.2);
  return { obj: g, w: 1.15, d: 0.7, h: 0.7 };
};

B.rockinghorse = () => {
  const g = new THREE.Group(); const body = M('#e8d0a0'); const red = M('#c03030');
  for (const x of [-0.18, 0.18]) {
    const r = mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 24, Math.PI * 0.5), red, x, 1.0, 0, g);
    r.rotation.set(0, Math.PI / 2, Math.PI * 1.25);
  }
  box(0.35, 0.4, 0.8, body, 0, 0.62, 0, g);
  box(0.25, 0.5, 0.25, body, 0, 0.95, 0.4, g).rotation.x = -0.4;
  box(0.22, 0.2, 0.36, body, 0, 1.15, 0.6, g);
  box(0.06, 0.4, 0.3, M('#5a3010'), 0, 1.0, 0.25, g).rotation.x = -0.4;
  for (const x of [-0.12, 0.12]) for (const z of [-0.3, 0.3]) box(0.08, 0.4, 0.08, body, x, 0.3, z, g);
  g.userData.dynamic = true; g.userData.mergeLocal = true;
  return { obj: g, w: 0.5, d: 1.2, h: 1.3, anim: (t) => { g.rotation.x = Math.sin(t * 1.5) * 0.08; } };
};

B.blocks = () => {
  const g = new THREE.Group(); const cols = ['#e84a5f', '#f6c445', '#4aa3e8', '#5ac86a', '#b06ae8'];
  const pos = [[0, 0, 0], [0.42, 0, 0.05], [0.2, 0.4, 0.02], [-0.4, 0, 0.2], [-0.35, 0, -0.3]];
  pos.forEach(([x, y, z], i) => { const b = box(0.38, 0.38, 0.38, M(cols[i % cols.length]), x, 0.19 + y, z, g); b.rotation.y = Math.random(); });
  return { obj: g, w: 1.0, d: 0.9, h: 0.8 };
};

B.counter = (o) => {
  const g = new THREE.Group(); const W = o.w || 2.0; const cab = M(o.color || '#6a8a9a');
  box(W, 0.9, 0.7, cab, 0, 0.45, 0, g);
  box(W + 0.04, 0.08, 0.74, M('#e8e4dc', { r: 0.4 }), 0, 0.94, 0, g);
  const n = Math.max(1, Math.round(W / 0.6));
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * (W / n);
    box(W / n - 0.08, 0.7, 0.03, M(o.color2 || '#7a9aaa'), x, 0.45, 0.36, g);
    box(0.12, 0.03, 0.04, brass(), x, 0.72, 0.39, g);
  }
  if (o.sink) {
    box(0.7, 0.05, 0.45, M('#b8c4c8', { m: 0.6, r: 0.3 }), 0, 0.97, 0, g);
    const tap = cyl(0.025, 0.025, 0.35, M('#ccc', { m: 0.9, r: 0.2 }), 0, 1.15, -0.25, g, 8);
    box(0.03, 0.03, 0.18, tap.material, 0, 1.32, -0.17, g);
  }
  // a few dishes on top
  for (let i = 0; i < 2; i++) cyl(0.12, 0.08, 0.12, M(['#f0e0d0', '#d06a4a'][i]), W / 2 - 0.3 - i * 0.35, 1.04, -0.1, g);
  return { obj: g, w: W, d: 0.7, h: 1.0 };
};

B.stove = () => {
  const g = new THREE.Group(); const body = M('#e8e0d0', { r: 0.4 });
  box(0.9, 0.9, 0.7, body, 0, 0.45, 0, g);
  box(0.7, 0.45, 0.03, M('#2a2a2a', { r: 0.2 }), 0, 0.4, 0.36, g);
  box(0.5, 0.04, 0.05, M('#aaa', { m: 0.9 }), 0, 0.68, 0.38, g);
  for (const [x, z] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) cyl(0.12, 0.12, 0.02, M('#222'), x, 0.91, z, g);
  box(0.9, 0.35, 0.08, body, 0, 1.08, -0.31, g);
  const pot = cyl(0.17, 0.15, 0.22, M('#5a6a7a', { m: 0.6, r: 0.4 }), -0.2, 1.03, 0.15, g);
  void pot;
  return { obj: g, w: 0.9, d: 0.7, h: 1.2 };
};

B.fridge = () => {
  const g = new THREE.Group(); const body = M('#9ad8c8', { r: 0.35 });
  box(0.9, 1.9, 0.75, body, 0, 0.95, 0, g);
  box(0.92, 0.02, 0.77, M('#5a8a7a'), 0, 1.35, 0, g);
  box(0.05, 0.35, 0.06, M('#ddd', { m: 0.9, r: 0.2 }), -0.35, 1.6, 0.4, g);
  box(0.05, 0.5, 0.06, M('#ddd', { m: 0.9, r: 0.2 }), -0.35, 0.95, 0.4, g);
  sph(0.05, M('#ff5a5a'), 0.2, 1.7, 0.38, g, 6, 4); sph(0.05, M('#ffd84a'), 0.1, 1.55, 0.38, g, 6, 4);
  return { obj: g, w: 0.9, d: 0.75, h: 1.9 };
};

B.washer = () => {
  const g = new THREE.Group(); const body = M('#f2f2f2', { r: 0.3 });
  box(0.8, 0.95, 0.75, body, 0, 0.475, 0, g);
  const door = cyl(0.26, 0.26, 0.05, M('#6ab0d8', { r: 0.1, m: 0.2, unique: true, e: '#204060', ei: 0.4 }), 0, 0.45, 0.38, g, 20); door.rotation.x = Math.PI / 2; door.userData.dynamic = true;
  const ring = mesh(new THREE.TorusGeometry(0.27, 0.04, 6, 20), M('#bbb', { m: 0.8, r: 0.3 }), 0, 0.45, 0.4, g);
  void ring;
  box(0.6, 0.1, 0.05, M('#ccc'), 0, 0.85, 0.37, g);
  const anim = (t) => { door.rotation.y = t * 3; };
  return { obj: g, w: 0.8, d: 0.75, h: 1.0, anim };
};

B.desk = (o) => {
  const g = new THREE.Group(); const wood = M(WOOD_D);
  box(1.7, 0.08, 0.85, wood, 0, 0.78, 0, g);
  box(0.5, 0.74, 0.8, wood, -0.58, 0.37, 0, g); box(0.5, 0.74, 0.8, wood, 0.58, 0.37, 0, g);
  for (let i = 0; i < 3; i++) { box(0.42, 0.2, 0.02, M(WOOD), 0.58, 0.15 + i * 0.24, 0.41, g); box(0.1, 0.03, 0.03, brass(), 0.58, 0.18 + i * 0.24, 0.43, g); }
  const lampShade = glowMat('#7fd88a'); lampShade.side = THREE.DoubleSide;
  cyl(0.02, 0.02, 0.35, brass(), -0.55, 0.98, -0.2, g, 6);
  const sh = cyl(0.04, 0.14, 0.12, lampShade, -0.5, 1.15, -0.15, g, 12); sh.rotation.x = 0.4;
  for (let i = 0; i < 4; i++) { const p = box(0.32, 0.01, 0.42, M('#f4efe0'), 0.1 + Math.random() * 0.2, 0.83 + i * 0.012, Math.random() * 0.1, g); p.rotation.y = Math.random() - 0.5; }
  void o;
  return { obj: g, w: 1.7, d: 0.85, h: 1.2, glow: [lampShade] };
};

B.globe = () => {
  const g = new THREE.Group();
  cyl(0.25, 0.3, 0.08, M(WOOD_D), 0, 0.04, 0, g);
  cyl(0.04, 0.04, 0.7, M(WOOD_D), 0, 0.4, 0, g, 8);
  const ring = mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 24), brass(), 0, 1.05, 0, g); ring.rotation.y = Math.PI / 2;
  const earth = new THREE.Group(); earth.position.y = 1.05; earth.rotation.z = 0.4; g.add(earth); earth.userData.dynamic = true; earth.userData.mergeLocal = true;
  sph(0.32, M('#3a7ab8', { r: 0.5 }), 0, 0, 0, earth, 18, 12);
  for (let i = 0; i < 6; i++) { const c = sph(0.12, M('#6aa84a', { flat: true }), 0, 0, 0, earth, 6, 4); const a = i * 1.1, b = (i % 3 - 1) * 0.6; c.position.set(Math.cos(a) * Math.cos(b) * 0.24, Math.sin(b) * 0.24, Math.sin(a) * Math.cos(b) * 0.24); c.scale.set(1, 0.6, 1); }
  return { obj: g, w: 0.7, d: 0.7, h: 1.4, anim: (t) => { earth.rotation.y = t * 0.4; } };
};

B.pedestal = (o) => {
  const g = new THREE.Group(); const marble = M('#e8e4ec', { r: 0.4 });
  box(0.6, 0.12, 0.6, marble, 0, 0.06, 0, g);
  cyl(0.2, 0.22, 1.0, marble, 0, 0.62, 0, g, 10);
  box(0.6, 0.12, 0.6, marble, 0, 1.18, 0, g);
  const bust = M(o.gold ? BRASS : '#d8d4dc', { r: 0.3, m: o.gold ? 0.8 : 0 });
  box(0.5, 0.2, 0.3, bust, 0, 1.35, 0, g);
  cyl(0.08, 0.1, 0.15, bust, 0, 1.5, 0, g);
  sph(0.19, bust, 0, 1.72, 0, g);
  sph(0.07, bust, 0, 1.7, 0.18, g);
  return { obj: g, w: 0.6, d: 0.6, h: 1.9 };
};

B.armor = () => {
  const g = new THREE.Group(); const steel = M('#a8b0c0', { m: 0.85, r: 0.3 });
  box(0.7, 0.1, 0.5, M('#3a3040'), 0, 0.05, 0, g);
  for (const x of [-0.12, 0.12]) cyl(0.08, 0.07, 0.8, steel, x, 0.5, 0, g, 8);
  cyl(0.22, 0.17, 0.6, steel, 0, 1.2, 0, g, 10);
  sph(0.2, steel, 0, 1.55, 0, g, 10, 8).scale.set(1.4, 0.6, 1);
  for (const x of [-0.3, 0.3]) cyl(0.06, 0.06, 0.6, steel, x, 1.15, 0.02, g, 8);
  cyl(0.15, 0.15, 0.3, steel, 0, 1.78, 0, g, 10);
  box(0.2, 0.03, 0.05, M('#111'), 0, 1.8, 0.14, g);
  const plume = M('#c03040'); const p = sph(0.08, plume, 0, 2.0, -0.05, g, 6, 4); p.scale.set(0.6, 1.6, 1.2);
  const sp = cyl(0.02, 0.02, 2.2, M(WOOD_D), 0.38, 1.1, 0.1, g, 6); void sp;
  mesh(new THREE.ConeGeometry(0.06, 0.25, 4), steel, 0.38, 2.3, 0.1, g);
  return { obj: g, w: 0.8, d: 0.55, h: 2.2 };
};

B.bench = () => {
  const g = new THREE.Group(); const c = M('#5a2a4a', { map: TX.cloth('#5a2a4a') });
  box(1.6, 0.18, 0.5, c, 0, 0.45, 0, g);
  for (const x of [-0.7, 0.7]) for (const z of [-0.18, 0.18]) cyl(0.04, 0.03, 0.38, M(WOOD_D), x, 0.19, z, g, 6);
  return { obj: g, w: 1.6, d: 0.5, h: 0.6 };
};

B.trunk = () => {
  const g = new THREE.Group(); const w = M('#6a4a2a');
  box(1.2, 0.6, 0.7, w, 0, 0.3, 0, g);
  const lid = mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12, 1, false, 0, Math.PI), w, 0, 0.6, 0, g); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2;
  for (const x of [-0.4, 0.4]) box(0.08, 0.95, 0.74, brass(), x, 0.47, 0, g);
  box(0.14, 0.14, 0.05, brass(), 0, 0.6, 0.37, g);
  return { obj: g, w: 1.2, d: 0.75, h: 1.0 };
};

B.crates = (o) => {
  const g = new THREE.Group(); const n = o.n || 3;
  const mat = M('#ffffff', { map: TX.cardboard(true) });
  const plain = M('#b98a55');
  const spots = [[0, 0, 0, 0.8], [0.75, 0, 0.1, 0.7], [0.3, 0.8, 0.05, 0.6], [-0.7, 0, 0.05, 0.6], [0.4, 0, -0.75, 0.65]];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [x, y, z, s] = spots[i];
    const mats = [plain, plain, plain, plain, mat, plain];
    const b = mesh(new THREE.BoxGeometry(s, s, s), mats, x, y + s / 2, z, g); b.rotation.y = (Math.random() - 0.5) * 0.5;
  }
  return { obj: g, w: n > 3 ? 2.0 : 1.6, d: n > 4 ? 1.7 : 0.9, h: 1.4 };
};

B.sheet = (o) => {
  const g = new THREE.Group(); const sheet = M('#e8e4f0', { flat: true, r: 0.95 });
  const geo = new THREE.SphereGeometry(0.8, 12, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const n = Math.sin(x * 9.1 + y * 7.3 + z * 5.7) * 0.04; p.setY(i, y < 0 ? y * 0.2 : y * (1.2 + n)); p.setX(i, x * (1.3 + n)); p.setZ(i, z * (0.85 + n)); }
  geo.computeVertexNormals();
  const m = mesh(geo, sheet, 0, 0.3, 0, g); m.userData.dynamic = true;
  m.scale.set(o.sx || 1, o.sy || 1, 1);
  return { obj: g, w: 2.1 * (o.sx || 1), d: 1.4, h: 1.3, anim: (t) => { m.scale.y = (o.sy || 1) * (1 + Math.sin(t * 1.3 + (o.seed || 0)) * 0.015); } };
};

B.barrel = () => {
  const g = new THREE.Group(); const w = M('#7a4a2a');
  cyl(0.35, 0.32, 0.9, w, 0, 0.45, 0, g, 12);
  for (const y of [0.15, 0.75]) mesh(new THREE.TorusGeometry(0.35, 0.025, 4, 16), M('#444', { m: 0.7 }), 0, y, 0, g).rotation.x = Math.PI / 2;
  return { obj: g, w: 0.75, d: 0.75, h: 0.9 };
};

B.post = () => {
  const g = new THREE.Group();
  box(0.35, 3.6, 0.35, M('#5a3a22'), 0, 1.8, 0, g);
  return { obj: g, w: 0.4, d: 0.4, h: 3.6 };
};

B.dresser = (o) => {
  const g = new THREE.Group(); const c = M(o.color || '#e8c8a0');
  box(1.3, 1.0, 0.55, c, 0, 0.5, 0, g);
  for (let i = 0; i < 3; i++) { box(1.18, 0.26, 0.03, M(o.color2 || '#f6dcb8'), 0, 0.2 + i * 0.3, 0.28, g); sph(0.04, brass(), 0, 0.2 + i * 0.3, 0.31, g, 6, 4); }
  const lamp = glowMat('#ffcf8a'); cyl(0.1, 0.18, 0.2, lamp, 0.4, 1.3, 0, g, 12); cyl(0.02, 0.02, 0.2, brass(), 0.4, 1.1, 0, g, 6);
  return { obj: g, w: 1.3, d: 0.55, h: 1.4, glow: [lamp] };
};

// ---------- decorations (not solid) ----------
B.rug = (o) => {
  const g = new THREE.Group();
  const m = mesh(new THREE.PlaneGeometry(o.w || 4, o.d || 3), M('#ffffff', { map: TX.rugTex(o.color, o.accent, `${o.w}${o.d}`) }), 0, 0.012, 0, g, false);
  m.rotation.x = -Math.PI / 2;
  return { obj: g, w: 0, d: 0, h: 0, solid: false };
};
B.runner = (o) => {
  const g = new THREE.Group(); const L = o.len || 8, W = o.w || 2;
  const tex = TX.carpet(o.color || '#7a2a3a', o.accent || '#d9a441').clone(); tex.needsUpdate = true; tex.repeat.set(1, L / W);
  const m = mesh(new THREE.PlaneGeometry(W, L), M('#ffffff', { map: tex }), 0, 0.011, 0, g, false);
  m.rotation.x = -Math.PI / 2;
  return { obj: g, w: 0, d: 0, h: 0, solid: false };
};

export function buildProp(type, opts = {}) {
  const f = B[type];
  if (!f) throw new Error('Unknown prop ' + type);
  const r = f(opts);
  r.solid = r.solid ?? true;
  r.glow = r.glow || [];
  return r;
}

// ---------- wall-mounted items ----------
export function buildWallItem(kind, o = {}) {
  const g = new THREE.Group();
  const frameM = M(o.frame || BRASS, { m: 0.6, r: 0.4 });
  let curtains = null; const glow = [];
  if (kind === 'portrait' || kind === 'landscape') {
    const big = o.big ? 1.5 : 1;
    const W = (kind === 'portrait' ? 0.9 : 1.3) * big, H = (kind === 'portrait' ? 1.15 : 0.9) * big;
    box(W + 0.16, H + 0.16, 0.06, frameM, 0, 0, 0.03, g).castShadow = false;
    const tex = kind === 'portrait' ? TX.portrait(o.seed || 1) : TX.landscape(o.seed || 1);
    mesh(new THREE.PlaneGeometry(W, H), M('#ffffff', { map: tex, r: 0.6 }), 0, 0, 0.07, g, false);
  } else if (kind === 'window') {
    const W = o.w || 1.4, H = o.h || 1.8;
    const glass = M('#7fa8e8', { e: '#4a70c0', ei: 0.9, r: 0.2 });
    mesh(new THREE.PlaneGeometry(W, H), glass, 0, 0, 0.02, g, false);
    const fm = M('#e8e0d0');
    box(W + 0.2, 0.12, 0.12, fm, 0, H / 2 + 0.06, 0.06, g); box(W + 0.3, 0.12, 0.25, fm, 0, -H / 2 - 0.06, 0.1, g);
    box(0.1, H, 0.1, fm, -W / 2 - 0.05, 0, 0.05, g); box(0.1, H, 0.1, fm, W / 2 + 0.05, 0, 0.05, g);
    box(0.05, H, 0.06, fm, 0, 0, 0.04, g); box(W, 0.05, 0.06, fm, 0, 0, 0.04, g);
    // moon silhouette outside
    const moon = M('#fff6d0', { e: '#fff6d0', ei: 1 });
    mesh(new THREE.CircleGeometry(0.18, 16), moon, W * 0.22, H * 0.25, 0.015, g, false);
    // curtains (flutter when vacuumed)
    const cm = M(o.curtain || '#8a2a3a', { side: THREE.DoubleSide, r: 0.95, map: TX.cloth(o.curtain || '#8a2a3a') });
    curtains = [];
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.55, H + 0.5, 6, 10);
      const c = mesh(geo, cm, s * (W / 2 + 0.05), -0.1, 0.18, g);
      curtains.push({ mesh: c, base: geo.attributes.position.array.slice(), wind: 0, axis: 'z' });
    }
    box(W + 1.4, 0.06, 0.06, brass(), 0, H / 2 + 0.25, 0.2, g);
  } else if (kind === 'roundwindow') {
    const glass = M('#8ab0f0', { e: '#5a80d0', ei: 1.0 });
    mesh(new THREE.CircleGeometry(0.9, 24), glass, 0, 0, 0.02, g, false);
    mesh(new THREE.TorusGeometry(0.92, 0.08, 6, 24), M('#5a3a22'), 0, 0, 0.05, g);
    box(1.8, 0.06, 0.06, M('#5a3a22'), 0, 0, 0.05, g); box(0.06, 1.8, 0.06, M('#5a3a22'), 0, 0, 0.05, g);
  } else if (kind === 'sconce') {
    box(0.12, 0.3, 0.06, brass(), 0, 0, 0.03, g);
    const f = glowMat('#ffb347'); const fl = sph(0.07, f, 0, 0.25, 0.12, g, 8, 6); fl.scale.y = 1.6; fl.castShadow = false;
    glow.push(f);
  } else if (kind === 'shelf') {
    box(1.4, 0.06, 0.3, M(WOOD), 0, 0, 0.15, g);
    const cols = ['#e84a5f', '#4aa3e8', '#f6c445', '#5ac86a'];
    for (let i = 0; i < 4; i++) box(0.2, 0.3, 0.2, M(cols[i]), -0.5 + i * 0.33, 0.18, 0.15, g);
  } else if (kind === 'pennants') {
    const cols = ['#e84a5f', '#f6c445', '#4aa3e8', '#5ac86a', '#b06ae8'];
    for (let i = 0; i < 9; i++) {
      const t = mesh(new THREE.ConeGeometry(0.14, 0.3, 3), M(cols[i % 5]), -2 + i * 0.5, -Math.sin((i / 8) * Math.PI) * 0.3, 0.05, g, false);
      t.rotation.z = Math.PI;
    }
  }
  return { obj: g, curtains, glow };
}

// ---------- keys, coins, chest ----------
export const KEY_COLORS = { blue: '#4aa3ff', green: '#4ae87a', red: '#ff4a5a', gold: '#ffcf4a' };

export function buildKey(color) {
  const g = new THREE.Group(); const m = M(KEY_COLORS[color], { m: 0.6, r: 0.25, e: KEY_COLORS[color], ei: 0.6 });
  mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 18), m, 0, 0.22, 0, g);
  cyl(0.04, 0.04, 0.45, m, 0, -0.15, 0, g, 8);
  box(0.12, 0.05, 0.05, m, 0.07, -0.3, 0, g); box(0.09, 0.05, 0.05, m, 0.05, -0.18, 0, g);
  return g;
}

export function buildChest() {
  const g = new THREE.Group(); const wood = M('#8a4a20'); const gold = M(BRASS, { m: 0.8, r: 0.3 });
  box(0.9, 0.5, 0.6, wood, 0, 0.25, 0, g);
  for (const x of [-0.35, 0.35]) box(0.08, 0.52, 0.62, gold, x, 0.26, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); g.add(lid);
  const top = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI), wood, 0, 0, 0.3, lid);
  top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2;
  for (const x of [-0.35, 0.35]) { const b = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 12, 1, false, 0, Math.PI), gold, x, 0, 0.3, lid); b.rotation.z = Math.PI / 2; b.rotation.y = Math.PI / 2; }
  box(0.14, 0.18, 0.06, gold, 0, 0.45, 0.31, g);
  const glow = M('#fff0a0', { e: '#ffd040', ei: 3, unique: true, t: true, o: 0 });
  const light = mesh(new THREE.CylinderGeometry(0.05, 0.4, 1.4, 12, 1, true), glow, 0, 1.1, 0, g, false);
  return { obj: g, lid, light };
}
