import * as THREE from 'three';
import { M, mesh, box, cyl, sph } from './props.js';
import { makeJunk } from './rooms.js';
import * as TX from './textures.js';

// Moonlit mansion exterior shown behind the title menu.
export function buildTitleScene() {
  const g = new THREE.Group();
  const wall = M('#3e2c55', { map: TX.wallpaper('#3e2c55', '#46325e', 'planks') });
  const roof = M('#1e1430', { flat: true });
  const trim = M('#1a1020');
  const winMats = [];
  const win = (parent, x, y, z, w = 0.7, h = 1.0, rotY = 0) => {
    const m = M('#ffcf6a', { unique: true, e: '#ffb040', ei: 1.5 });
    winMats.push(m);
    const p = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, parent, false); p.rotation.y = rotY;
    const f = box(w + 0.15, 0.1, 0.1, trim, x, y - h / 2, z + 0.03, parent); f.rotation.y = rotY;
    const f2 = box(0.06, h, 0.05, trim, x, y, z + 0.02, parent); f2.rotation.y = rotY;
    return p;
  };
  // ground
  const ground = mesh(new THREE.CircleGeometry(30, 40), M('#1c2a24', { r: 1 }), 0, 0, 0, g, false); ground.rotation.x = -Math.PI / 2;
  const path = mesh(new THREE.PlaneGeometry(2.2, 14), M('#4a4050'), 0, 0.01, 9, g, false); path.rotation.x = -Math.PI / 2;
  // main hall
  const main = new THREE.Group(); g.add(main);
  box(8, 5, 5, wall, 0, 2.5, 0, main);
  const pr = mesh(new THREE.ConeGeometry(5.9, 3, 4, 1), roof, 0, 6.5, 0, main); pr.rotation.y = Math.PI / 4; pr.scale.set(1, 1, 0.62);
  for (const x of [-2.6, 0, 2.6]) win(main, x, 3.6, 2.51);
  for (const x of [-2.6, 2.6]) win(main, x, 1.6, 2.51);
  // door + porch
  box(1.4, 2.2, 0.1, M('#5a2a14'), 0, 1.1, 2.55, main);
  sph(0.08, M('#ffcf4a', { m: 0.8 }), 0.45, 1.1, 2.62, main, 8, 6);
  box(3, 0.15, 1.2, trim, 0, 2.5, 3.0, main);
  for (const x of [-1.3, 1.3]) cyl(0.1, 0.1, 2.5, M('#e8e0d0'), x, 1.25, 3.4, main, 8);
  box(3.4, 0.25, 1.8, M('#5a5060'), 0, 0.12, 3.2, main);
  // wings
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 6, 0, 0.6); g.add(w);
    box(4.2, 3.8, 4, wall, 0, 1.9, 0, w);
    const r = mesh(new THREE.ConeGeometry(3.4, 2.2, 4, 1), roof, 0, 4.9, 0, w); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.85);
    win(w, -0.9, 2.4, 2.01); win(w, 0.9, 2.4, 2.01);
    win(w, -0.9, 0.9, 2.01, 0.7, 0.8); win(w, 0.9, 0.9, 2.01, 0.7, 0.8);
    box(0.5, 1.4, 0.5, M('#2a1e30'), s * 1.2, 5.4, -0.6, w);
  }
  // tower
  const tw = new THREE.Group(); tw.position.set(2.6, 0, -1.2); g.add(tw);
  cyl(1.3, 1.4, 9, wall, 0, 4.5, 0, tw, 12);
  const tr = mesh(new THREE.ConeGeometry(1.8, 3.4, 12), roof, 0, 10.7, 0, tw); void tr;
  const tw1 = win(tw, 0, 7.4, 1.32, 0.6, 0.9);
  void tw1;
  sph(0.15, M('#ffcf4a', { m: 0.8, e: '#a06000', ei: 0.3 }), 0, 12.5, 0, tw, 8, 6);
  cyl(0.02, 0.02, 0.6, trim, 0, 12.2, 0, tw, 4);
  // chimney with smoke anchor
  box(0.7, 2.4, 0.7, M('#4a3a40'), -2.4, 7.2, -0.8, g);
  // fence + trees
  const fenceM = M('#120c18');
  for (let i = -12; i <= 12; i++) {
    if (Math.abs(i) < 2) continue;
    box(0.08, 1.1, 0.08, fenceM, i * 0.7, 0.55, 7.5, g);
    mesh(new THREE.ConeGeometry(0.06, 0.2, 4), fenceM, i * 0.7, 1.2, 7.5, g);
  }
  box(16.8, 0.06, 0.06, fenceM, 0, 0.9, 7.5, g); box(16.8, 0.06, 0.06, fenceM, 0, 0.4, 7.5, g);
  const treeM = M('#0e0a14', { flat: true });
  for (const [x, z, s] of [[-11, -2, 1.3], [11, -3, 1.5], [-9, 5, 1], [10, 5.5, 1.1], [-14, 2, 1.6], [14, 1, 1.2]]) {
    const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t);
    cyl(0.2, 0.3, 3, treeM, 0, 1.5, 0, t, 6);
    for (let k = 0; k < 5; k++) { const b = cyl(0.04, 0.08, 1.6, treeM, 0, 2.4 + k * 0.3, 0, t, 4); b.rotation.z = (k % 2 ? 1 : -1) * (0.6 + k * 0.1); b.position.x = (k % 2 ? -0.5 : 0.5); }
  }
  // moon
  const moon = mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false }), -9, 13, -18, g, false);
  const halo = mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ map: TX.radial('moon', 'rgba(255,240,200,0.45)', 'rgba(255,240,200,0)'), transparent: true, depthWrite: false, fog: false }), -9, 13, -18.1, g, false);
  void moon; void halo;
  // swirling clutter orbiting the house
  const swirl = new THREE.Group(); g.add(swirl);
  const kinds = ['paper', 'sock', 'can', 'book', 'block', 'paper'];
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const j = makeJunk(kinds[i % kinds.length]); j.scale.setScalar(1.6);
    j.userData.a = (i / 26) * Math.PI * 2; j.userData.r = 7 + Math.random() * 3; j.userData.h = 3 + Math.random() * 5; j.userData.s = 0.2 + Math.random() * 0.3;
    swirl.add(j); bits.push(j);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const update = (t) => {
    for (const b of bits) {
      const u = b.userData; const a = u.a + t * u.s;
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 1.3 + u.a * 3) * 0.6, Math.sin(a) * u.r - 0.5);
      b.rotation.x = t * u.s * 3; b.rotation.y = t * u.s * 2;
    }
    winMats.forEach((m, i) => { m.emissiveIntensity = 1.3 + Math.sin(t * 3 + i * 1.7) * 0.15 + (Math.sin(t * 0.7 + i) > 0.97 ? -1 : 0); });
  };
  return { group: g, update };
}
