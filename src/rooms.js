import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { M, mesh, box, cyl, sph, buildProp, buildWallItem, KEY_COLORS } from './props.js';

// ---------------------------------------------------------------------------
// Mansion layout. Rooms are centred on the origin; north wall at z = -d/2.
// The camera looks north, so the south wall is a low cut-away.
// ---------------------------------------------------------------------------
export const MANSION = [
  {
    id: 'foyer', name: 'Grand Foyer', grid: [1, 2], w: 16, d: 12,
    floor: { type: 'checker', a: '#e9dcc6', b: '#4a3560' },
    wall: { base: '#5b3a6e', accent: '#6d4a84', style: 'damask' }, wainscot: '#3a2238',
    clean: '#ffd9a0',
    doors: [{ side: 'N', at: 0, to: 'gallery', lock: 'blue' }, { side: 'W', at: 0, to: 'parlor' }, { side: 'E', at: 0, to: 'kitchen' }, { side: 'S', at: 0, to: null }],
    items: [
      ['runner', 0, 0.5, 0, { len: 11, w: 2.2 }],
      ['clock', -3.4, -5.55, 0, { search: ['c3'] }],
      ['plant', -1.8, -5.45], ['plant', 1.8, -5.45],
      ['pedestal', 3.6, -5.4, 0, { search: ['b1'] }],
      ['armor', 5.6, -5.4, 0],
      ['bench', -7.4, -2.8, 1, { search: ['heart'] }],
      ['table', 7.25, -3, 3, { w: 1.3, d: 0.7, cloth: '#6a2040', candle: true, search: ['c3'] }],
      ['table', 7.25, 3.4, 3, { w: 1.3, d: 0.7, vase: true }],
      ['armchair', -6.6, 3.5, 1, { color: '#7a3050' }], ['lamp', -7.4, 5.1],
      ['plant', 7.3, 5.2], ['crates', 4.6, 3.2, 0, { n: 3, search: ['c3'] }],
    ],
    walls: [['N', -6.2, 2.1, 'window', { curtain: '#7a2a3a', loot: ['c3'] }], ['N', 6.7, 2.1, 'window', { curtain: '#7a2a3a' }],
      ['N', -2.1, 2.9, 'portrait', { seed: 3 }], ['N', 2.1, 2.9, 'portrait', { seed: 8 }],
      ['W', -3, 2.4, 'landscape', { seed: 2 }], ['W', 3.6, 2.4, 'portrait', { seed: 11 }],
      ['E', -3, 2.4, 'portrait', { seed: 5 }], ['E', 3.4, 2.4, 'landscape', { seed: 7 }],
      ['N', -4.6, 2.6, 'sconce'], ['N', 4.6, 2.6, 'sconce']],
    enemies: [['dust', -3, 1], ['dust', 3, 2.5], ['dust', 0.5, -2.5]],
    junk: 7, dust: 6, heaps: 4,
    reward: { loot: ['b1', 'c5'] },
  },
  {
    id: 'parlor', name: 'The Parlor', grid: [0, 2], w: 14, d: 11,
    floor: { type: 'wood', a: '#8a5a3a' },
    wall: { base: '#2f4a3a', accent: '#3d5c4a', style: 'stripes' }, wainscot: '#2a1a12',
    clean: '#ffcf90',
    doors: [{ side: 'E', at: 0, to: 'foyer' }],
    items: [
      ['fireplace', 0, -5.05, 0],
      ['rug', 0, -0.4, 0, { w: 6, d: 4.2, color: '#6a2a3a', accent: '#e0b050' }],
      ['sofa', 0, 1.7, 2, { color: '#7a3050', search: ['c3'] }],
      ['armchair', -2.7, -1.5, 1, { color: '#3a5a7a' }], ['armchair', 2.7, -1.5, 3, { color: '#3a5a7a', search: ['heart'] }],
      ['coffeeTable', 0, -0.4, 0, { search: ['b1'] }],
      ['piano', -5.0, 3.2, 1],
      ['bookshelf', -4.6, -5.2, 0, { w: 2.2 }], ['bookshelf', 4.6, -5.2, 0, { w: 2.2, search: ['c3'] }],
      ['lamp', -6.4, -3.6], ['plant', 6.4, 4.7],
      ['clock', 6.65, -3.4, 3],
      ['table', 4.4, 3.4, 0, { w: 1.4, d: 0.9, cloth: '#e8e0d0', candle: true, search: ['c3'] }],
      ['chair', 4.4, 4.4, 2, {}], ['chair', 3.3, 3.4, 1, {}],
    ],
    walls: [['N', 0, 2.75, 'portrait', { seed: 21, big: true }],
      ['W', -2.6, 2.1, 'window', { curtain: '#2a5a8a', loot: ['b1'] }], ['W', 1.8, 2.1, 'window', { curtain: '#2a5a8a' }],
      ['E', 3.6, 2.4, 'landscape', { seed: 4 }], ['N', -2.0, 2.6, 'sconce'], ['N', 2.0, 2.6, 'sconce']],
    enemies: [['sock', -3, 3.2], ['sock', 1.6, 2.8], ['dust', -5, -2], ['dust', 5, -1.6]],
    junk: 8, dust: 5, heaps: 4,
    reward: { key: 'blue', loot: ['c3'] },
    hint: 'Some laundry piles look a little <b>too</b> alive... <b>Flash</b> them!',
  },
  {
    id: 'kitchen', name: 'The Kitchen', grid: [2, 2], w: 14, d: 11,
    floor: { type: 'tile', a: '#d8ebe6', b: '#8aa39e' },
    wall: { base: '#e6d6a8', accent: '#d8c690', style: 'dots' }, wainscot: '#4a7a8a',
    clean: '#fff0c8',
    doors: [{ side: 'W', at: 0, to: 'foyer' }],
    items: [
      ['counter', -3.1, -5.1, 0, { w: 3.6, sink: true }], ['stove', 0.6, -5.1, 0, { search: ['c3'] }],
      ['counter', 2.85, -5.1, 0, { w: 2.6 }], ['fridge', 5.5, -5.05, 0, { search: ['heart', 'c3'] }],
      ['counter', 6.6, -1.6, 3, { w: 2.4 }],
      ['table', -0.5, 1.4, 0, { w: 3, d: 1.4, cloth: '#d8e8f0', vase: true, search: ['b1'] }],
      ['chair', -1.4, 2.6, 2, { color: '#4a7a8a' }], ['chair', 0.4, 2.6, 2, { color: '#4a7a8a' }],
      ['chair', -1.4, 0.2, 0, { color: '#4a7a8a' }], ['chair', 0.4, 0.2, 0, { color: '#4a7a8a' }],
      ['washer', 6.4, 3.4, 3, { search: ['c3'] }], ['washer', 6.4, 4.5, 3],
      ['barrel', -6.2, 4.5, 0, { search: ['b1'] }], ['crates', -5.9, 2.4, 1, { n: 2 }], ['plant', 3.4, 4.9],
    ],
    walls: [['N', -3.1, 2.3, 'window', { curtain: '#e8a040', w: 1.6, h: 1.3 }], ['N', 2.85, 2.3, 'window', { curtain: '#e8a040', w: 1.4, h: 1.3, loot: ['c3'] }],
      ['W', -3.6, 2.3, 'shelf'], ['W', 3.4, 2.3, 'shelf'], ['E', 3.6, 2.4, 'landscape', { seed: 9 }]],
    enemies: [['dust', -4, 2], ['dust', 3, 2.8], ['dust', -2, -2.8], ['sock', 4.6, 1.2], ['sock', -2.4, -3.4]],
    junk: 10, dust: 7, heaps: 4,
    reward: { key: 'green', loot: ['c3'] },
    hint: 'Dust bunnies <b>breed</b> in kitchens. Show them who\'s boss!',
  },
  {
    id: 'gallery', name: 'Portrait Gallery', grid: [1, 1], w: 20, d: 9,
    floor: { type: 'wood', a: '#7a5038' },
    wall: { base: '#7e3446', accent: '#904456', style: 'damask' }, wainscot: '#3a1a28',
    clean: '#ffd9a0',
    doors: [{ side: 'S', at: 0, to: 'foyer' }, { side: 'W', at: 0, to: 'library', lock: 'green' }, { side: 'E', at: 0, to: 'nursery', lock: 'red' }, { side: 'N', at: 0, to: 'attic', lock: 'gold' }],
    items: [
      ['runner', 0, 0, 1, { len: 17, w: 2, color: '#2a3a6a', accent: '#d9a441' }],
      ['pedestal', -6.5, -3.9, 0, { search: ['c3'] }], ['pedestal', 6.5, -3.9, 0, { gold: true, search: ['b1'] }],
      ['armor', -2.5, -3.9, 0], ['armor', 2.5, -3.9, 0, { search: ['heart'] }],
      ['bench', -4.5, 1.8, 0], ['bench', 4.5, 1.8, 0],
      ['plant', -9.2, -3.8], ['plant', 9.2, -3.8], ['plant', -9.2, 3.8], ['plant', 9.2, 3.8],
    ],
    walls: [['N', -8.3, 2.3, 'portrait', { seed: 31 }], ['N', -4.6, 2.3, 'portrait', { seed: 32, big: true }], ['N', 4.6, 2.3, 'portrait', { seed: 33, big: true }], ['N', 8.3, 2.3, 'portrait', { seed: 34 }],
      ['N', -1.8, 2.6, 'sconce'], ['N', 1.8, 2.6, 'sconce'], ['W', -2.6, 2.4, 'landscape', { seed: 35 }], ['E', 2.6, 2.4, 'landscape', { seed: 36 }]],
    enemies: [['box', 0, -1.6], ['paper', -6.5, 0.5], ['paper', 6.5, 0.5]],
    junk: 8, dust: 6, heaps: 4,
    reward: { loot: ['bar', 'heart'] },
    hint: 'Box Brutes shrug off flashes... unless their <b>flaps are open</b>!',
  },
  {
    id: 'library', name: 'The Library', grid: [0, 1], w: 15, d: 12,
    floor: { type: 'carpet', a: '#2a3a5a', b: '#c9a441' },
    wall: { base: '#3a2a20', accent: '#4a3a2a', style: 'stripes' }, wainscot: '#1e140e',
    clean: '#ffd28a',
    doors: [{ side: 'E', at: 0, to: 'gallery' }],
    items: [
      ['bookshelf', -5.4, -5.75, 0, { w: 2.6, h: 3 }], ['bookshelf', -2.4, -5.75, 0, { w: 2.6, h: 3, search: ['c3'] }],
      ['bookshelf', 2.4, -5.75, 0, { w: 2.6, h: 3 }], ['bookshelf', 5.4, -5.75, 0, { w: 2.6, h: 3, search: ['b1'] }],
      ['bookshelf', -7.25, -2.4, 1, { w: 2.4, h: 3 }], ['bookshelf', -7.25, 2.4, 1, { w: 2.4, h: 3, search: ['c3'] }],
      ['desk', -2.2, 0.6, 0, { search: ['gem'] }], ['chair', -2.2, -0.3, 0, {}],
      ['globe', 3.6, -2.2], ['armchair', 2.6, 2.6, 2, { color: '#6a3a2a' }], ['armchair', 4.6, 2.6, 2, { color: '#6a3a2a', search: ['heart'] }],
      ['coffeeTable', 3.6, 3.9, 0, { search: ['c3'] }], ['lamp', 6.6, 4.9], ['lamp', -6.6, 5.1], ['plant', 6.6, -3.8],
      ['rug', 3.6, 3.2, 0, { w: 4.2, d: 3, color: '#5a2a2a', accent: '#c9a441' }],
    ],
    walls: [['N', 0, 2.2, 'window', { curtain: '#3a2a6a', h: 2.0, loot: ['c3'] }], ['E', -3.6, 2.4, 'portrait', { seed: 41 }], ['E', 3.6, 2.4, 'portrait', { seed: 42 }],
      ['W', 0, 2.6, 'sconce']],
    enemies: [['paper', -3, -2], ['paper', 3, -0.5], ['paper', 0, 3], ['sock', -5, 4]],
    junk: 10, dust: 6, heaps: 4,
    reward: { key: 'red', loot: ['c3'] },
    hint: 'Paper Wraiths fling notes. <b>Vacuum</b> their paper planes right out of the air!',
  },
  {
    id: 'nursery', name: 'The Nursery', grid: [2, 1], w: 14, d: 11,
    floor: { type: 'wood', a: '#c08a5a' },
    wall: { base: '#5a6ab0', accent: '#f6d06a', style: 'stars' }, wainscot: '#e8d8c0',
    clean: '#fff0d0',
    doors: [{ side: 'W', at: 0, to: 'gallery' }],
    items: [
      ['bed', -4.4, -4.25, 0, { color: '#e87a9a', search: ['heart'] }], ['crib', 4.6, -4.7, 0, { search: ['c3'] }],
      ['toychest', 0.4, -5.1, 0, { search: ['gem', 'c3'] }], ['dresser', 6.65, -1.4, 3, { search: ['b1'] }],
      ['rockinghorse', 3.6, 1.8, 1], ['blocks', -2.4, 2.2, 0], ['blocks', 1.8, 3.8, 0],
      ['rug', 0, 0.6, 0, { w: 5, d: 4, color: '#3a9a8a', accent: '#f6d06a' }],
      ['plant', -6.4, 4.7], ['armchair', -6.0, 0.3, 1, { color: '#f0a0b0' }],
    ],
    walls: [['N', -1.6, 2.2, 'window', { curtain: '#f0a0c0', loot: ['b1'] }], ['N', 2.2, 2.8, 'pennants'], ['E', 3.4, 2.4, 'shelf'], ['E', 3.4, 1.5, 'shelf'],
      ['W', -3.4, 2.4, 'landscape', { seed: 51 }]],
    enemies: [['box', 2.6, -1], ['dust', -3.6, 3.2], ['dust', 4.6, 3.8], ['dust', -1.5, -2.5], ['sock', -0.8, 4.2], ['paper', 2, 2]],
    junk: 12, dust: 6, heaps: 4, junkKinds: ['block', 'block', 'sock', 'paper', 'book'],
    reward: { key: 'gold', loot: ['c3'] },
    hint: 'The toys have teamed up with the laundry. Stay sharp!',
  },
  {
    id: 'attic', name: 'The Attic', grid: [1, 0], w: 18, d: 13, height: 3.6,
    floor: { type: 'wood', a: '#94704c' },
    wall: { base: '#7a5a40', accent: '#8a6a48', style: 'planks' }, wainscot: '#4a3420',
    clean: '#ffd9a0', boss: true,
    doors: [{ side: 'S', at: 0, to: 'gallery' }],
    items: [
      ['post', -5, -2.5], ['post', 5, -2.5], ['post', -5, 3], ['post', 5, 3],
      ['crates', -7.6, -5.4, 0, { n: 5, search: ['c3'] }], ['crates', 7.4, -5.4, 0, { n: 4, search: ['b1'] }],
      ['trunk', -7.9, 1, 1, { search: ['heart'] }], ['trunk', 7.9, 0, 3, { search: ['c3'] }],
      ['sheet', -3.2, -5.4, 0, { sx: 0.9, seed: 1 }], ['sheet', 3.2, -5.6, 0, { sx: 0.8, sy: 1.2, seed: 2 }],
      ['barrel', -7.9, 5.4], ['barrel', 7.9, 5.4, 0, { search: ['heart'] }], ['barrel', 7.2, 5.6],
    ],
    walls: [['N', 0, 2.0, 'roundwindow']],
    enemies: [['boss', 0, -1.2]],
    junk: 8, dust: 4, heaps: 0,
    reward: { final: true },
  },
];
export const ROOMS = Object.fromEntries(MANSION.map((r) => [r.id, r]));

export function makeJunk(kind) {
  let m;
  const pal = ['#e84a5f', '#4aa3e8', '#f6c445', '#5ac86a', '#b06ae8', '#f08a3a'];
  const col = pal[(Math.random() * pal.length) | 0];
  if (kind === 'paper') { m = mesh(new THREE.IcosahedronGeometry(0.13, 0), M('#f2ede0', { flat: true })); m.userData.y = 0.11; }
  else if (kind === 'sock') {
    m = new THREE.Group(); const c = M(col, { r: 0.95 });
    const a = mesh(new THREE.CapsuleGeometry(0.06, 0.26, 3, 6), c, 0, 0, 0, m); a.rotation.x = Math.PI / 2;
    const b = mesh(new THREE.CapsuleGeometry(0.06, 0.12, 3, 6), c, 0.08, 0, 0.17, m); b.rotation.z = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.06, 0.02, 4, 8), M('#ffffff'), 0, 0, -0.18, m);
    m.userData.y = 0.06;
  } else if (kind === 'can') { m = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10), M(col, { m: 0.6, r: 0.3 })); m.rotation.z = Math.PI / 2; m.userData.y = 0.07; }
  else if (kind === 'book') { m = mesh(new THREE.BoxGeometry(0.32, 0.07, 0.24), M(col)); m.userData.y = 0.035; }
  else { m = mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), M(col, { flat: true })); m.userData.y = 0.11; }
  return m;
}

const T = 0.3;       // wall thickness
const DOOR_W = 1.8;  // door opening width
const DOOR_H = 2.7;

// helper: box geometry whose UVs are in world units (so textures don't stretch)
function worldBox(w, h, d, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / scale, uv.getY(i) * dims[f][1] / scale);
  }
  return g;
}

function segments(L, gaps) {
  // intervals of [-L/2, L/2] that are not inside door gaps
  const out = []; let u = -L / 2;
  const sorted = [...gaps].sort((a, b) => a - b);
  for (const c of sorted) { const a = c - DOOR_W / 2, b = c + DOOR_W / 2; if (a > u) out.push([u, a]); u = Math.max(u, b); }
  if (u < L / 2) out.push([u, L / 2]);
  return out;
}

// the side a door sits on -> wall-local u coordinate
function uFor(side, at) { return side === 'N' ? at : side === 'S' ? -at : side === 'W' ? -at : at; }

export class Room {
  constructor(def, game) {
    this.def = def; this.game = game;
    this.group = new THREE.Group(); this.group.visible = false;
    this.hw = def.w / 2; this.hd = def.d / 2; this.H = def.height || 4;
    this.colliders = []; this.doors = []; this.searchables = []; this.flutters = [];
    this.glow = []; this.anims = []; this.cobwebs = []; this.dustPiles = []; this.junk = []; this.heaps = [];
    this.cleanLevel = 0;
    this._build();
    this._merge();
  }

  // Merge static, opaque meshes into one mesh per material: a few dozen draw calls instead of hundreds.
  // Movable sub-objects (doors, searchable furniture...) are merged on their own so they can still move.
  _merge() {
    this._mergeInto(this.group);
    const locals = []; this.group.traverse((o) => { if (o.userData.mergeLocal) locals.push(o); });
    for (const l of locals) this._mergeInto(l);
  }

  _mergeInto(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map(); const remove = [];
    const owner = (o) => { for (let a = o; a; a = a.parent) { if (a === root) return root; if (a.userData.dynamic) return a; } return null; };
    root.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || o.material.transparent || owner(o) !== root) return;
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      if (!geo.attributes.uv || !geo.attributes.normal) { geo.dispose(); return; }
      geo.morphAttributes = {};
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const key = o.material.uuid + (o.castShadow ? '|s' : '|n');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
      buckets.get(key).geos.push(geo);
      remove.push(o);
    });
    for (const o of remove) { o.removeFromParent(); o.geometry.dispose(); }
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const m = new THREE.Mesh(merged, b.mat); m.castShadow = b.cast; m.receiveShadow = true;
      root.add(m);
    }
  }

  _build() {
    const d = this.def, g = this.group;
    // floor
    let ftex, fscale = 2;
    if (d.floor.type === 'checker') { ftex = TX.checkerFloor(d.floor.a, d.floor.b); fscale = 2.4; }
    else if (d.floor.type === 'tile') { ftex = TX.tileFloor(d.floor.a, d.floor.b); fscale = 2; }
    else if (d.floor.type === 'carpet') { ftex = TX.carpet(d.floor.a, d.floor.b); fscale = 3; }
    else { ftex = TX.woodFloor(d.floor.a); fscale = 4; }
    const fg = new THREE.PlaneGeometry(d.w + 2 * T, d.d + 2 * T);
    const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (d.w + 2 * T) / fscale, uv.getY(i) * (d.d + 2 * T) / fscale);
    const floor = mesh(fg, M('#ffffff', { map: ftex, r: d.floor.type === 'tile' || d.floor.type === 'checker' ? 0.45 : 0.85 }), 0, 0, 0, g, false);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    // dark void under/around the room so the cut-away edge reads cleanly
    const under = mesh(new THREE.PlaneGeometry(200, 200), M('#07020f'), 0, -0.02, 0, g, false); under.rotation.x = -Math.PI / 2;

    // walls
    const wallMat = M('#ffffff', { map: TX.wallpaper(d.wall.base, d.wall.accent, d.wall.style), r: 0.9 });
    const wainMat = M(d.wainscot, { r: 0.7 });
    const trimMat = M('#2a1810', { r: 0.6 });
    const sides = {
      N: { pos: [0, 0, -this.hd], rot: 0, L: d.w + 2 * T },
      S: { pos: [0, 0, this.hd], rot: Math.PI, L: d.w + 2 * T },
      W: { pos: [-this.hw, 0, 0], rot: Math.PI / 2, L: d.d },
      E: { pos: [this.hw, 0, 0], rot: -Math.PI / 2, L: d.d },
    };
    this.wallGroups = {};
    for (const s of ['N', 'S', 'W', 'E']) {
      const info = sides[s];
      const wg = new THREE.Group(); wg.position.set(...info.pos); wg.rotation.y = info.rot; g.add(wg);
      this.wallGroups[s] = wg;
      const gaps = d.doors.filter((x) => x.side === s).map((x) => uFor(s, x.at));
      const low = s === 'S';
      const H = low ? 0.55 : this.H;
      for (const [a, b] of segments(info.L, gaps)) {
        const len = b - a, cx = (a + b) / 2;
        const wm = mesh(worldBox(len, H, T, 2.2), low ? trimMat : wallMat, cx, H / 2, -T / 2, wg, !low);
        wm.receiveShadow = true;
        if (!low) {
          mesh(worldBox(len, 1.1, 0.05), wainMat, cx, 0.55, 0.025, wg, false);
          box(len, 0.08, 0.09, trimMat, cx, 1.12, 0.045, wg).castShadow = false;
          box(len, 0.18, 0.12, trimMat, cx, this.H - 0.09, 0.06, wg).castShadow = false;
        }
      }
      if (!low) for (const u of gaps) {
        mesh(worldBox(DOOR_W, this.H - DOOR_H, T, 2.2), wallMat, u, DOOR_H + (this.H - DOOR_H) / 2, -T / 2, wg, true);
        box(DOOR_W, 0.18, 0.12, trimMat, u, this.H - 0.09, 0.06, wg).castShadow = false;
      }
    }
    // dark caps on top of walls (seen from above)
    const cap = M('#140a1c');
    box(d.w + 2 * T, 0.02, T, cap, 0, this.H + 0.01, -this.hd - T / 2, g);
    box(T, 0.02, d.d + T, cap, -this.hw - T / 2, this.H + 0.01, -T / 2, g);
    box(T, 0.02, d.d + T, cap, this.hw + T / 2, this.H + 0.01, -T / 2, g);

    // doors
    for (const dd of d.doors) this._door(dd);

    // furniture
    for (const it of d.items) {
      const [type, x, z, rot = 0, opts = {}] = it;
      const p = buildProp(type, opts);
      const holder = new THREE.Group(); holder.position.set(x, 0, z); holder.rotation.y = (rot * Math.PI) / 2; holder.add(p.obj); g.add(holder);
      if (p.flutter) p.flutter.mesh.userData.dynamic = true;
      if (opts.search) { p.obj.userData.dynamic = true; p.obj.userData.mergeLocal = true; }
      const swap = rot % 2 === 1;
      const w = swap ? p.d : p.w, dp = swap ? p.w : p.d;
      if (p.solid && w > 0) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dp / 2, maxZ: z + dp / 2, h: p.h });
      if (p.anim) this.anims.push(p.anim);
      if (p.flutter) { p.flutter.loot = null; this.flutters.push(p.flutter); }
      this.glow.push(...p.glow);
      if (opts.search) this.searchables.push({ x, z, r: Math.max(w, dp) / 2 + 0.9, obj: p.obj, loot: opts.search, searched: false, type, idx: this.searchables.length });
    }

    // wall items
    for (const [side, u0, y, kind, o = {}] of d.walls || []) {
      const wi = buildWallItem(kind, o);
      wi.obj.position.set(uFor(side, u0), y, 0.0); this.wallGroups[side].add(wi.obj);
      if (wi.curtains) wi.curtains.forEach((c) => (c.mesh.userData.dynamic = true));
      this.glow.push(...wi.glow);
      if (wi.curtains) {
        wi.curtains.forEach((c, i) => { c.loot = i === 0 && o.loot ? o.loot : null; c.owner = wi.obj; this.flutters.push(c); });
      }
    }

    // cobwebs in the back corners
    const webMat = new THREE.MeshBasicMaterial({ map: TX.webTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 });
    for (const sx of [-1, 1]) {
      const w = mesh(new THREE.PlaneGeometry(2.2, 2.2), webMat.clone(), sx * (this.hw - 0.02), this.H - 1.1, -this.hd + 1.1, g, false);
      w.rotation.y = sx * -Math.PI / 2; if (sx < 0) w.scale.x = -1;
      this.cobwebs.push(w);
      const w2 = mesh(new THREE.PlaneGeometry(1.8, 1.8), webMat.clone(), sx * (this.hw - 0.9), this.H - 0.9, -this.hd + 0.02, g, false);
      if (sx > 0) w2.scale.x = -1;
      this.cobwebs.push(w2);
    }

    // mess heaps (decor that poofs away when the room is cleaned)
    const taken = [];
    for (let i = 0; i < (d.heaps || 0); i++) {
      const p = this.freeSpot(0.8, 0, taken); if (!p) continue;
      taken.push({ ...p, r: 1.6 });
      const hg = this._heap(); hg.position.set(p.x, 0, p.z); g.add(hg); this.heaps.push(hg); hg.userData.dynamic = true; hg.userData.mergeLocal = true;
    }
    // dust piles you can vacuum away
    const dustMat = new THREE.MeshStandardMaterial({ map: TX.dustTex(), transparent: true, depthWrite: false, color: '#b0a49a', roughness: 1 });
    const fluff = M('#a89c92', { flat: true, r: 1 });
    for (let i = 0; i < (d.dust || 0); i++) {
      const p = this.freeSpot(0.6, 0, taken); if (!p) continue;
      taken.push({ ...p, r: 1.2 });
      const dg = new THREE.Group(); dg.position.set(p.x, 0, p.z); g.add(dg); dg.userData.dynamic = true; dg.userData.mergeLocal = true;
      const r = 0.6 + Math.random() * 0.35;
      const decal = mesh(new THREE.PlaneGeometry(r * 2, r * 2), dustMat, 0, 0.02 + i * 0.001, 0, dg, false); decal.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 4; k++) { const b = sph(0.07 + Math.random() * 0.07, fluff, (Math.random() - 0.5) * r, 0.03, (Math.random() - 0.5) * r, dg, 6, 4); b.scale.y = 0.6; b.castShadow = false; }
      this.dustPiles.push({ obj: dg, x: p.x, z: p.z, r, amount: 1 });
    }
    // loose junk (light enough to be sucked up)
    const kinds = d.junkKinds || ['paper', 'paper', 'sock', 'can', 'book'];
    for (let i = 0; i < (d.junk || 0); i++) {
      const p = this.freeSpot(0.3, 0, taken); if (!p) continue;
      const kind = kinds[(Math.random() * kinds.length) | 0];
      const m = makeJunk(kind); m.position.set(p.x, m.userData.y, p.z); m.rotation.y = Math.random() * 6; g.add(m); m.userData.dynamic = true;
      m.traverse((o) => { o.castShadow = false; });
      this.junk.push({ mesh: m, x: p.x, z: p.z, vx: 0, vz: 0, r: 0.22, kind, alive: true, spin: 0 });
    }
  }

  _heap() {
    const g = new THREE.Group(); const cols = ['#c8b89a', '#8a6a4a', '#b05a5a', '#5a7ab0', '#e8e0d0', '#7a9a5a', '#a07ac0'];
    for (let i = 0; i < 9; i++) {
      const c = M(cols[i % 4], { flat: true });
      const k = Math.random();
      const geo = k < 0.4 ? new THREE.BoxGeometry(0.3 + Math.random() * 0.3, 0.1 + Math.random() * 0.2, 0.3 + Math.random() * 0.3)
        : k < 0.7 ? new THREE.IcosahedronGeometry(0.15 + Math.random() * 0.1, 0) : new THREE.CylinderGeometry(0.08, 0.08, 0.3, 6);
      const m = mesh(geo, c, (Math.random() - 0.5) * 0.9, 0.08 + Math.random() * 0.25, (Math.random() - 0.5) * 0.9, g);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); m.castShadow = false;
    }
    return g;
  }

  _door(dd) {
    const s = dd.side; const wg = this.wallGroups[s]; const u = uFor(s, dd.at);
    const dg = new THREE.Group(); dg.position.set(u, 0, 0); wg.add(dg);
    const frame = M('#3a2214', { r: 0.6 });
    const door = { ...dd, group: dg, leaf: null, lockObj: null, sealObj: null, opening: 0 };
    // world-space trigger point + inward normal
    const n = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[s];
    door.x = s === 'N' || s === 'S' ? dd.at : (s === 'W' ? -this.hw : this.hw);
    door.z = s === 'W' || s === 'E' ? dd.at : (s === 'N' ? -this.hd : this.hd);
    door.nx = n[0]; door.nz = n[1];
    if (s === 'S') {
      // cut-away side: door mat + glowing arrow
      const mat = mesh(new THREE.PlaneGeometry(1.8, 0.9), M('#5a2a2a', { map: TX.carpet('#5a2a2a', '#d9a441') }), 0, 0.015, 0.5, dg, false); mat.rotation.x = -Math.PI / 2;
      for (const x of [-1, 1]) box(0.22, 0.9, 0.3, frame, x * (DOOR_W / 2 + 0.11), 0.45, -0.15, dg);
      const arrowShape = new THREE.Shape(); arrowShape.moveTo(0, 0.35); arrowShape.lineTo(0.3, 0); arrowShape.lineTo(0.12, 0); arrowShape.lineTo(0.12, -0.3); arrowShape.lineTo(-0.12, -0.3); arrowShape.lineTo(-0.12, 0); arrowShape.lineTo(-0.3, 0); arrowShape.closePath();
      const am = M('#ffcf4a', { e: '#ffcf4a', ei: 0.8, unique: true });
      const arrow = mesh(new THREE.ShapeGeometry(arrowShape), am, 0, 0.03, 0.6, dg, false); arrow.rotation.x = -Math.PI / 2;
      door.arrow = arrow; arrow.userData.dynamic = true;
      this.anims.push((t) => { arrow.position.z = 0.6 + Math.sin(t * 4) * 0.08; });
    } else {
      // frame
      box(0.16, DOOR_H + 0.1, 0.4, frame, -DOOR_W / 2 - 0.02, (DOOR_H + 0.1) / 2, 0, dg);
      box(0.16, DOOR_H + 0.1, 0.4, frame, DOOR_W / 2 + 0.02, (DOOR_H + 0.1) / 2, 0, dg);
      box(DOOR_W + 0.36, 0.2, 0.42, frame, 0, DOOR_H + 0.05, 0, dg);
      // dark doorway behind leaf
      mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), M('#05020a'), 0, DOOR_H / 2, -T + 0.01, dg, false);
      // leaf on a hinge
      const hinge = new THREE.Group(); hinge.position.set(-DOOR_W / 2 + 0.05, 0, -0.12); dg.add(hinge);
      const lm = M('#7a4a28', { r: 0.6 });
      box(DOOR_W - 0.1, DOOR_H - 0.05, 0.08, lm, (DOOR_W - 0.1) / 2, (DOOR_H - 0.05) / 2, 0, hinge);
      for (const y of [0.7, 1.9]) box(DOOR_W - 0.5, 0.7, 0.03, M('#6a3c20'), (DOOR_W - 0.1) / 2, y, 0.05, hinge);
      sph(0.06, M('#d4a23a', { m: 0.8, r: 0.3 }), DOOR_W - 0.35, 1.25, 0.08, hinge, 8, 6);
      door.leaf = hinge; hinge.userData.dynamic = true; hinge.userData.mergeLocal = true;
    }
    if (dd.to === null) {
      // front door: permanently barred
      const bar = M('#4a2a14');
      for (const a of [-0.5, 0.5]) { const p = box(2.2, 0.18, 0.08, bar, 0, 0.45, 0.2, dg); p.rotation.z = a * 0.3; }
    }
    if (dd.lock) {
      const lg = new THREE.Group(); lg.position.set(0, s === 'S' ? 0.9 : 1.35, s === 'S' ? 0.3 : 0.05); dg.add(lg);
      const col = KEY_COLORS[dd.lock];
      const lm = M(col, { unique: true, e: col, ei: 0.6, m: 0.5, r: 0.3 });
      box(0.5, 0.42, 0.14, lm, 0, 0, 0, lg);
      mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 14, Math.PI), M('#c8c8d0', { m: 0.9, r: 0.2 }), 0, 0.2, 0, lg);
      box(0.07, 0.14, 0.02, M('#111'), 0, -0.04, 0.08, lg);
      door.lockObj = lg; door.lockMat = lm; lg.userData.dynamic = true; lg.userData.mergeLocal = true;
      this.anims.push((t) => { if (door.lockObj) { lm.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.35; lg.rotation.z = Math.sin(t * 2) * 0.05; } });
    }
    // seal: crossed planks shown while the room is messy
    if (dd.to !== null) {
      const sg = new THREE.Group(); sg.position.set(0, s === 'S' ? 0.45 : 1.3, s === 'S' ? 0.25 : 0.12); dg.add(sg);
      const pm = M('#8a6a42', { flat: true });
      for (const a of [-1, 1]) { const p = box(s === 'S' ? 2.2 : 2.3, 0.24, 0.07, pm, 0, 0, 0.05 + (a > 0 ? 0.07 : 0), sg); p.rotation.z = a * (s === 'S' ? 0.15 : 0.75); }
      for (let i = 0; i < 4; i++) sph(0.04, M('#888', { m: 0.8 }), (i % 2 ? 1 : -1) * 0.5, (i < 2 ? 1 : -1) * (s === 'S' ? 0.05 : 0.45), 0.15, sg, 6, 4);
      // purple clutter glow
      const sm = new THREE.MeshBasicMaterial({ color: '#b06aff', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
      const sw = mesh(new THREE.PlaneGeometry(DOOR_W, s === 'S' ? 0.8 : DOOR_H), sm, 0, s === 'S' ? 0 : -0.15, -0.02, sg, false);
      if (s !== 'S') sw.position.y = DOOR_H / 2 - 1.3;
      door.sealObj = sg; door.sealMat = sm; sg.userData.dynamic = true; sg.userData.mergeLocal = true;
      this.anims.push((t) => { sm.opacity = 0.18 + Math.sin(t * 3 + u) * 0.08; });
    }
    this.doors.push(door);
  }

  // pick a random free spot on the floor
  freeSpot(r = 0.5, seed = 0, avoid = null) {
    for (let tries = 0; tries < 60; tries++) {
      const x = (Math.random() * 2 - 1) * (this.hw - 1 - r);
      const z = (Math.random() * 2 - 1) * (this.hd - 1 - r);
      if (this.colliders.some((c) => x > c.minX - r - 0.2 && x < c.maxX + r + 0.2 && z > c.minZ - r - 0.2 && z < c.maxZ + r + 0.2)) continue;
      if (this.doors.some((dd) => Math.hypot(x - dd.x, z - dd.z) < 2)) continue;
      if (avoid && avoid.some((p) => Math.hypot(x - p.x, z - p.z) < (p.r || 1))) continue;
      return { x, z };
    }
    void seed;
    return null;
  }

  // circle vs room bounds + furniture
  collide(p, r, h = 2) {
    let hit = false;
    const minX = -this.hw + r, maxX = this.hw - r, minZ = -this.hd + r, maxZ = this.hd - r;
    if (p.x < minX) { p.x = minX; hit = true; } if (p.x > maxX) { p.x = maxX; hit = true; }
    if (p.z < minZ) { p.z = minZ; hit = true; } if (p.z > maxZ) { p.z = maxZ; hit = true; }
    for (const c of this.colliders) {
      if (h < 0 && c.h < 1.2) continue; // flyers pass over low furniture
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX)), cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), push = r - d; p.x += (dx / d) * push; p.z += (dz / d) * push; }
        else {
          // centre inside the box: push out along the shallowest axis
          const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
          if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
        }
      }
    }
    return hit;
  }

  // ray-march line of sight across furniture taller than the flashlight
  blocked(ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25);
    for (let i = 1; i < steps; i++) {
      const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const c of this.colliders) if (c.h > 1.5 && x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }

  update(t, dt) {
    for (const a of this.anims) a(t, dt);
    for (const f of this.flutters) {
      f.wind = Math.max(0, f.wind - dt * 1.5);
      if (f.wind <= 0.001 && !f.dirty) continue;
      f.dirty = f.wind > 0.001;
      const pos = f.mesh.geometry.attributes.position; const base = f.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const hang = f.axis === 'z' ? (0.5 - by / ((f.mesh.geometry.parameters.height) || 1)) : 1;
        pos.setZ(i, base[i * 3 + 2] + Math.sin(t * 14 + bx * 6 + by * 3) * 0.12 * f.wind * Math.max(0, hang) + f.wind * 0.25 * Math.max(0, hang));
      }
      pos.needsUpdate = true;
    }
  }

  setCleanVisuals(level) {
    this.cleanLevel = level;
    for (const m of this.glow) m.emissiveIntensity = 0.05 + level * 1.6;
    for (const w of this.cobwebs) { w.material.opacity = 0.8 * (1 - level); w.visible = level < 0.99; }
  }
}
