import * as THREE from 'three';
import { M, mesh, box, cyl, sph } from './props.js';
import * as TX from './textures.js';

const V = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
// deterministic per-position noise so shared (non-indexed) vertices move together
const pnoise = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) - 0.5; };

// ---------- shared bits ----------
const starShape = (() => {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.05 : 0.12; const a = (k / 10) * Math.PI * 2; const x = Math.sin(a) * r, y = Math.cos(a) * r; k ? s.lineTo(x, y) : s.moveTo(x, y); }
  return s;
})();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: false });
const starMat = new THREE.MeshBasicMaterial({ color: '#ffe14a' });
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
const blobGeo = new THREE.CircleGeometry(1, 20);

function makeEyes(parent, r, sep, y, z, glow = false) {
  const g = new THREE.Group(); g.position.set(0, y, z); parent.add(g);
  const white = glow ? M('#fff6a0', { e: '#ffd040', ei: 2 }) : M('#ffffff', { r: 0.25 });
  const pupilM = M('#140a18', { r: 0.2 });
  const pupils = [], whites = [];
  for (const s of [-1, 1]) {
    const w = sph(r, white, s * sep, 0, 0, g, 14, 10); w.scale.z = 0.7; whites.push(w);
    const p = sph(r * 0.48, pupilM, s * sep, 0, r * 0.62, g, 10, 8); pupils.push(p);
    p.userData.base = p.position.clone();
  }
  return { group: g, pupils, whites, r };
}

export class Clutter {
  constructor(game, x, z) {
    this.game = game;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.state = 'idle'; this.stateT = 0; this.t = Math.random() * 10; this.stun = 0;
    this.yaw = Math.random() * 6; this.y = 0; this.flying = false;
    this.fleeDir = new THREE.Vector3(1, 0, 0); this.fleeT = 0; this.yank = 0; this.latchT = 0;
    this.tension = 0; this.alive = true; this.hitCd = 0;
    this.maxLatch = 99; this.mass = 0.3; this.fleeSpeed = 2.5; this.needsStun = true;
    this.stunDur = 3; this.contactDmg = 0; this.hpShown = -1;
  }

  init(blobR) {
    this.hp = this.maxHp;
    this.blob = new THREE.Mesh(blobGeo, blobMat); this.blob.rotation.x = -Math.PI / 2; this.blob.scale.setScalar(blobR || this.radius);
    this.blob.position.y = 0.016; this.root.add(this.blob);
    this.stars = new THREE.Group(); this.stars.visible = false; this.root.add(this.stars);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(starGeo, starMat); this.stars.add(s); }
    this.body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    this.tag = this.game.labels.tag();
    this.game.room.group.add(this.root);
    this.syncVisual(0);
  }

  setState(s) { this.state = s; this.stateT = 0; }
  get player() { return this.game.player; }
  distP() { return Math.hypot(this.player.pos.x - this.pos.x, this.player.pos.z - this.pos.z); }
  dirToPlayer(out = V) { out.set(this.player.pos.x - this.pos.x, 0, this.player.pos.z - this.pos.z); const l = out.length() || 1; return out.multiplyScalar(1 / l); }
  canSeePlayer() { return !this.game.room.blocked(this.pos.x, this.pos.z, this.player.pos.x, this.player.pos.z); }
  get active() { return this.alive && this.state !== 'captured'; }
  get grabbable() {
    if (!this.active || this.state === 'latched') return false;
    return this.needsStun ? this.state === 'stunned' : this.state !== 'hidden';
  }

  // returns 'stun' | 'immune' | null
  flash() {
    if (!this.active || this.state === 'latched' || this.state === 'stunned') return null;
    this.stunFor(this.stunDur);
    return 'stun';
  }
  stunFor(d) {
    this.setState('stunned'); this.stun = d; this.vel.set(0, 0, 0);
    this.game.audio.play('stun', { pitch: this.voice || 1 });
  }
  onLatched() { this.setState('latched'); this.latchT = 0; this.fleeT = 0; this.vel.set(0, 0, 0); this.game.audio.play('squeak', { pitch: this.voice || 1 }); }
  onReleased() { this.setState('recover'); this.tension = 0; }
  afterStun() { this.setState('recover'); }

  capture() {
    this.setState('captured'); this.capFrom = this.pos.clone(); this.capFromY = this.y;
    this.tag.style.display = 'none';
  }

  // movement while latched by the vacuum
  tug(dt) {
    this.latchT += dt;
    this.fleeT -= dt;
    const room = this.game.room;
    if (this.fleeT <= 0) {
      // run roughly away from Pip, veering left/right, steering clear of walls
      const away = this.dirToPlayer(new THREE.Vector3()).multiplyScalar(-1);
      const ang = Math.atan2(away.x, away.z) + rand(-1.3, 1.3);
      this.fleeDir.set(Math.sin(ang), 0, Math.cos(ang));
      const nx = this.pos.x + this.fleeDir.x * 2.5, nz = this.pos.z + this.fleeDir.z * 2.5;
      if (Math.abs(nx) > room.hw - 1 || Math.abs(nz) > room.hd - 1) {
        this.fleeDir.set(-this.pos.x, 0, -this.pos.z).normalize();
        const a2 = Math.atan2(this.fleeDir.x, this.fleeDir.z) + rand(-0.8, 0.8);
        this.fleeDir.set(Math.sin(a2), 0, Math.cos(a2));
      }
      this.fleeT = rand(0.8, 1.6); this.yank = 0.35;
      if (Math.random() < 0.5) this.game.audio.play('squeak', { pitch: this.voice || 1 });
    }
    this.yank = Math.max(0, this.yank - dt);
    const sp = this.fleeSpeed * (this.yank > 0 ? 1.9 : 1);
    this.pos.x += this.fleeDir.x * sp * dt; this.pos.z += this.fleeDir.z * sp * dt;
    if (room.collide(this.pos, this.radius, this.flying ? -1 : 2)) this.fleeT = Math.min(this.fleeT, 0.1);
  }

  update(dt) {
    this.t += dt; this.stateT += dt; this.hitCd = Math.max(0, this.hitCd - dt);
    if (this.state === 'captured') {
      const k = Math.min(1, this.stateT / (this.capDur || 0.5));
      const tip = this.player.tipWorld(V);
      const e = k * k;
      this.pos.x = this.capFrom.x + (tip.x - this.capFrom.x) * e;
      this.pos.z = this.capFrom.z + (tip.z - this.capFrom.z) * e;
      this.y = this.capFromY + (tip.y - 0.3 - this.capFromY) * e;
      this.root.scale.setScalar(Math.max(0.02, 1 - k * 0.98));
      this.body.rotation.y += dt * 25;
      this.syncVisual(dt);
      if (k >= 1) { this.alive = false; this.game.onCaptured(this); }
      return;
    }
    if (this.state === 'latched') { /* game drives tug() */ }
    else if (this.state === 'stunned') {
      this.stun -= dt;
      this.vel.multiplyScalar(Math.exp(-dt * 6));
      if (this.stun <= 0) this.afterStun();
    } else this.ai(dt);

    if (this.state !== 'latched') {
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      this.bumped = this.game.room.collide(this.pos, this.radius, this.flying ? -1 : 2);
    }
    // contact damage
    if (this.contactDmg && this.hitCd <= 0 && this.harmful() && this.distP() < this.radius + 0.45) {
      if (this.player.hurt(this.contactDmg, this.pos.x, this.pos.z)) { this.hitCd = 1; this.onHitPlayer?.(); }
    }
    this.syncVisual(dt);
  }

  harmful() { return false; }
  ai() {}

  faceYaw(target, dt, rate = 8) {
    let d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * rate);
  }

  syncVisual(dt) {
    this.root.position.set(this.pos.x, 0, this.pos.z);
    this.body.position.y = this.y;
    this.root.rotation.y = 0;
    this.body.rotation.y = this.state === 'captured' ? this.body.rotation.y : this.yaw;
    // blob shadow shrinks with height
    const bs = (this.blobR || this.radius) * (1 - Math.min(0.6, this.y * 0.25));
    this.blob.scale.setScalar(bs);
    // stun stars
    const stunned = this.state === 'stunned' || this.state === 'dizzy';
    this.stars.visible = stunned;
    if (stunned) {
      this.stars.position.y = this.y + this.topY + 0.25;
      this.stars.children.forEach((s, i) => { const a = this.t * 5 + (i / 3) * Math.PI * 2; s.position.set(Math.cos(a) * 0.45, Math.sin(this.t * 7 + i) * 0.05, Math.sin(a) * 0.45); s.rotation.y = a; });
    }
    // stretch toward the nozzle while being vacuumed
    const k = this.state === 'latched' ? 0.15 + this.tension * 0.25 + Math.sin(this.t * 40) * 0.03 : 0;
    this.body.scale.set(1 - k * 0.4, 1 - k * 0.3, 1 + k);
    // googly pupils jiggle / track Pip
    if (this.eyes) {
      const dx = this.player.pos.x - this.pos.x, dz = this.player.pos.z - this.pos.z;
      const la = Math.atan2(dx, dz) - this.yaw;
      for (const p of this.eyes.pupils) {
        const b = p.userData.base; const jig = stunned ? 0.4 : 0.06;
        p.position.x = b.x + Math.sin(la) * this.eyes.r * 0.3 + Math.sin(this.t * (stunned ? 14 : 3) + b.x * 9) * this.eyes.r * jig;
        p.position.y = b.y + Math.cos(this.t * (stunned ? 11 : 2) + b.x) * this.eyes.r * jig;
      }
    }
    // HP tag over grabbable / latched clutter
    const show = this.state === 'latched' || this.state === 'stunned';
    if (show && this.active) {
      if (this.tag.style.display !== 'block') this.tag.style.display = 'block';
      const hp = Math.ceil(this.hp);
      if (hp !== this.hpShown) { this.tag.textContent = hp; this.hpShown = hp; }
      V.set(this.pos.x, this.y + this.topY + 0.5, this.pos.z);
      this.game.labels.place(this.tag, V);
    } else if (this.tag.style.display !== 'none') this.tag.style.display = 'none';
  }

  dispose() { this.tag.remove(); this.root.removeFromParent(); }
}

// ===================================================================
// Dust Bunny: skittish, harmless, can be vacuumed without a flash.
// ===================================================================
export class DustBunny extends Clutter {
  constructor(game, x, z) {
    super(game, x, z);
    Object.assign(this, { kind: 'dust', name: 'Dust Bunny', maxHp: 8, needsStun: false, radius: 0.35, fleeSpeed: 2.6, mass: 0.15, topY: 0.8, voice: 1.6, loot: ['c2'] });
    const fur = M('#a8a098', { flat: true, r: 1 });
    const geo = new THREE.IcosahedronGeometry(0.33, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); V.multiplyScalar(1 + pnoise(V.x, V.y, V.z) * 0.22); p.setXYZ(i, V.x, V.y, V.z); }
    geo.computeVertexNormals();
    this.fluff = mesh(geo, fur, 0, 0.33, 0, this.body);
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, e = rand(-0.4, 1); const t = mesh(new THREE.ConeGeometry(0.07, 0.13, 4), fur, Math.cos(a) * Math.cos(e) * 0.32, 0.33 + Math.sin(e) * 0.32, Math.sin(a) * Math.cos(e) * 0.32, this.body); t.lookAt(t.position.x * 3, (t.position.y - 0.33) * 3 + 0.33, t.position.z * 3); t.rotateX(Math.PI / 2); }
    this.ears = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group(); e.position.set(s * 0.13, 0.6, -0.02); this.body.add(e);
      const em = mesh(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), fur, 0, 0.18, 0, e); void em;
      const inner = mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), M('#f0a8b8'), 0, 0.18, 0.04, e); void inner;
      e.rotation.z = -s * 0.25; this.ears.push(e);
    }
    this.eyes = makeEyes(this.body, 0.085, 0.11, 0.42, 0.25);
    sph(0.04, M('#f07a9a'), 0, 0.32, 0.32, this.body, 8, 6);
    for (const s of [-1, 1]) sph(0.08, M('#c8bfb8'), s * 0.14, 0.05, 0.12, this.body, 8, 6).scale.set(1, 0.5, 1.4);
    this.wander = new THREE.Vector3(); this.wT = 0; this.hop = 0;
    this.init(0.35);
  }
  ai(dt) {
    const d = this.distP();
    let want = 0;
    if (d < 4.6 && this.state !== 'recover') {
      const away = this.dirToPlayer(V).multiplyScalar(-1);
      if (this.bumped) { away.set(-away.z, 0, away.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1); }
      this.wander.lerp(away, Math.min(1, dt * 4)); want = 3.3;
      if (this.state !== 'flee') { this.setState('flee'); this.game.audio.play('squeak', { pitch: 1.6 }); }
    } else {
      if (this.state === 'recover' && this.stateT > 0.6) this.setState('idle');
      if (this.state === 'flee') this.setState('idle');
      this.wT -= dt;
      if (this.wT <= 0) { const a = Math.random() * 6.28; this.wander.set(Math.sin(a), 0, Math.cos(a)); this.wT = rand(1, 2.5); if (Math.random() < 0.35) this.wander.set(0, 0, 0); }
      want = this.wander.lengthSq() > 0.01 ? 1.3 : 0;
    }
    const wl = this.wander.length() || 1;
    this.vel.set((this.wander.x / wl) * want, 0, (this.wander.z / wl) * want);
    if (want > 0) this.faceYaw(Math.atan2(this.vel.x, this.vel.z), dt, 10);
  }
  syncVisual(dt) {
    const moving = this.vel.lengthSq() > 0.1 || this.state === 'latched';
    this.hop += (dt || 0) * (moving ? 11 : 3);
    const h = Math.abs(Math.sin(this.hop));
    if (this.state !== 'captured') this.y = moving && this.state !== 'stunned' ? h * 0.28 : 0;
    this.fluff.scale.set(1 + (1 - h) * 0.12 * (moving ? 1 : 0.3), 1 - (1 - h) * 0.15 * (moving ? 1 : 0.3), 1);
    this.ears.forEach((e, i) => { e.rotation.x = Math.sin(this.hop + i) * 0.3 - (this.state === 'latched' ? 0.9 : 0); });
    super.syncVisual(dt);
  }
}

// ===================================================================
// Laundry Lurker: hides as a laundry pile, pops up and lunges.
// ===================================================================
export class SockGremlin extends Clutter {
  constructor(game, x, z) {
    super(game, x, z);
    Object.assign(this, { kind: 'sock', name: 'Laundry Lurker', maxHp: 30, radius: 0.5, fleeSpeed: 3.0, mass: 0.4, topY: 1.0, voice: 1.0, contactDmg: 0, loot: ['c3', 'b1'], maxLatch: 9 });
    const cols = ['#e86a7a', '#5a8ae8', '#f6c445', '#7ac86a', '#ffffff', '#b07ae8'];
    this.pile = new THREE.Group(); this.body.add(this.pile);
    const spots = [[0, 0.3, 0, 0.38], [-0.28, 0.22, 0.1, 0.27], [0.3, 0.22, 0.05, 0.28], [0.05, 0.55, -0.05, 0.27], [-0.1, 0.2, -0.28, 0.26], [0.2, 0.18, -0.25, 0.24]];
    spots.forEach(([x, y, z, r], i) => { const s = sph(r, M(cols[i % cols.length], { map: TX.cloth(cols[i % cols.length]), r: 0.95 }), x, y, z, this.pile, 12, 8); s.scale.set(1.1, 0.85, 1); s.rotation.y = i; });
    this.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.42, 0.35, 0.05); this.pile.add(a);
      const c = M(cols[(s + 3) % cols.length]);
      const leg = mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8), c, s * 0.12, -0.12, 0, a); leg.rotation.z = s * 0.9;
      const foot = mesh(new THREE.CapsuleGeometry(0.08, 0.14, 4, 8), c, s * 0.3, -0.24, 0.06, a); foot.rotation.x = Math.PI / 2;
      mesh(new THREE.TorusGeometry(0.08, 0.025, 4, 10), M('#ffffff'), 0, 0, 0, a).rotation.y = Math.PI / 2;
      this.arms.push(a);
    }
    this.eyes = makeEyes(this.pile, 0.11, 0.14, 0.52, 0.27);
    this.mouth = box(0.22, 0.06, 0.04, M('#3a0a18'), 0, 0.33, 0.37, this.pile);
    this.init(0.55);
    this.setState('hidden');
  }
  harmful() { return this.state === 'lunge'; }
  onHitPlayer() { this.vel.multiplyScalar(-0.3); this.setState('recover'); }
  flash() {
    if (this.state === 'hidden') { this.game.labels.alert(V.set(this.pos.x, 1.3, this.pos.z), '!'); }
    return super.flash();
  }
  ai(dt) {
    const d = this.distP();
    const dir = this.dirToPlayer(new THREE.Vector3());
    switch (this.state) {
      case 'hidden':
        this.vel.set(0, 0, 0);
        // a nervous rustle gives the disguise away
        this.rustle = Math.max(0, (this.rustle || 0) - dt);
        if (d < 6 && Math.random() < dt * 0.45) { this.rustle = 0.35; this.game.audio.play('rustle'); }
        if (d < 3.2 && this.canSeePlayer()) { this.setState('pop'); this.game.audio.play('spotted'); this.game.labels.alert(V.set(this.pos.x, 1.3, this.pos.z), '!'); }
        break;
      case 'pop': if (this.stateT > 0.55) this.setState('chase'); break;
      case 'recover': this.vel.multiplyScalar(Math.exp(-dt * 4)); if (this.stateT > 0.9) this.setState('chase'); break;
      case 'chase':
        this.vel.lerp(dir.clone().multiplyScalar(2.4), Math.min(1, dt * 5));
        this.faceYaw(Math.atan2(dir.x, dir.z), dt);
        if (d < 2.4 && this.stateT > 0.7) { this.setState('windup'); this.game.audio.play('grunt'); }
        break;
      case 'windup':
        this.vel.set(0, 0, 0); this.faceYaw(Math.atan2(dir.x, dir.z), dt, 14);
        if (this.stateT > 0.45) { this.setState('lunge'); this.vel.copy(dir).multiplyScalar(8.5); this.game.audio.play('whoosh'); }
        break;
      case 'lunge': if (this.stateT > 0.32) this.setState('recover'); break;
    }
  }
  syncVisual(dt) {
    const s = this.state;
    let sy = 1, eye = 1;
    if (s === 'hidden') { sy = 0.55 + Math.sin(this.t * 2) * 0.02; eye = 0; this.pile.position.x = this.rustle > 0 ? Math.sin(this.t * 70) * 0.035 : 0; }
    else if (s === 'pop') { const k = Math.min(1, this.stateT / 0.35); sy = 0.55 + k * 0.6 - Math.max(0, k - 0.8) * 0.75; eye = k; }
    else if (s === 'windup') { sy = 0.85; this.pile.position.x = Math.sin(this.t * 60) * 0.04; }
    if (s !== 'hidden' && s !== 'windup') this.pile.position.x = 0;
    const hopping = s === 'chase' || s === 'latched';
    if (s !== 'captured') this.y = hopping ? Math.abs(Math.sin(this.t * 9)) * 0.15 : (s === 'lunge' ? 0.25 : 0);
    this.pile.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    this.eyes.group.scale.set(1, Math.max(0.05, eye), 1);
    this.mouth.visible = eye > 0.5;
    this.mouth.scale.y = s === 'windup' || s === 'latched' ? 3 : 1;
    this.arms.forEach((a, i) => { a.visible = s !== 'hidden'; a.rotation.z = Math.sin(this.t * (s === 'latched' ? 20 : 6) + i * 3) * 0.4; });
    super.syncVisual(dt);
  }
}

// ===================================================================
// Paper Wraith: floats, orbits Pip, throws paper planes.
// ===================================================================
export class PaperWraith extends Clutter {
  constructor(game, x, z) {
    super(game, x, z);
    Object.assign(this, { kind: 'paper', name: 'Paper Wraith', maxHp: 26, radius: 0.45, fleeSpeed: 3.3, mass: 0.3, topY: 0.6, voice: 1.3, flying: true, contactDmg: 6, loot: ['c2', 'b1'], maxLatch: 9 });
    this.stack = new THREE.Group(); this.body.add(this.stack);
    const paper = M('#ffffff', { map: TX.paperTex(), r: 0.9, side: THREE.DoubleSide });
    const cream = M('#efe6cc', { r: 0.9 });
    for (let i = 0; i < 7; i++) { const s = box(0.62, 0.035, 0.8, i % 2 ? cream : paper, rand(-0.04, 0.04), i * 0.05, rand(-0.04, 0.04), this.stack); s.rotation.y = rand(-0.2, 0.2); }
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(s * 0.3, 0.2, 0); this.stack.add(w);
      const p = mesh(new THREE.PlaneGeometry(0.7, 0.55), paper, s * 0.35, 0, 0, w); p.rotation.x = -Math.PI / 2;
      this.wings.push(w);
    }
    for (let i = 0; i < 3; i++) { const tl = mesh(new THREE.PlaneGeometry(0.3, 0.4), paper, rand(-0.2, 0.2), -0.1 - i * 0.12, -0.4 - i * 0.25, this.stack); tl.rotation.set(-1, rand(-0.5, 0.5), rand(-0.5, 0.5)); }
    this.eyes = makeEyes(this.stack, 0.1, 0.15, 0.42, 0.25);
    this.frown = box(0.2, 0.04, 0.04, M('#1a1020'), 0, 0.22, 0.4, this.stack);
    this.orbitA = Math.random() * 6.28; this.throwT = rand(2, 3.2);
    this.init(0.5);
    this.setState('hidden');
  }
  harmful() { return this.state === 'orbit' || this.state === 'windup'; }
  ai(dt) {
    const d = this.distP();
    const dir = this.dirToPlayer(new THREE.Vector3());
    const room = this.game.room;
    const targetY = this.state === 'hidden' ? 0.05 : this.state === 'recover' ? 1.2 : 1.5 + Math.sin(this.t * 2) * 0.2;
    this.y += (targetY - this.y) * Math.min(1, dt * 2.5);
    switch (this.state) {
      case 'hidden':
        this.vel.set(0, 0, 0);
        if (d < 4.6) { this.setState('rise'); this.game.audio.play('paper'); this.game.labels.alert(V.set(this.pos.x, 1.4, this.pos.z), '!'); }
        break;
      case 'rise': if (this.stateT > 0.8) this.setState('orbit'); break;
      case 'recover': if (this.stateT > 0.8) this.setState('orbit'); this.vel.multiplyScalar(0.9); break;
      case 'orbit': {
        this.orbitA += dt * 0.7;
        const R = 4.0;
        let tx = this.player.pos.x + Math.cos(this.orbitA) * R, tz = this.player.pos.z + Math.sin(this.orbitA) * R;
        tx = Math.max(-room.hw + 1, Math.min(room.hw - 1, tx)); tz = Math.max(-room.hd + 1, Math.min(room.hd - 1, tz));
        const vx = tx - this.pos.x, vz = tz - this.pos.z, l = Math.hypot(vx, vz) || 1;
        const sp = Math.min(3.2, l * 2);
        this.vel.lerp(V.set((vx / l) * sp, 0, (vz / l) * sp), Math.min(1, dt * 3));
        this.faceYaw(Math.atan2(dir.x, dir.z), dt);
        this.throwT -= dt;
        if (this.throwT <= 0 && d < 9) { this.setState('windup'); this.game.audio.play('paper'); }
        break;
      }
      case 'windup':
        this.vel.multiplyScalar(Math.exp(-dt * 5)); this.faceYaw(Math.atan2(dir.x, dir.z), dt, 14);
        if (this.stateT > 0.6) {
          this.game.throwPlane(this);
          this.throwT = rand(2.2, 3.4); this.setState('orbit');
        }
        break;
    }
  }
  stunFor(d) { super.stunFor(d); }
  afterStun() { this.setState('recover'); }
  syncVisual(dt) {
    const s = this.state;
    if (s === 'stunned' || s === 'latched') this.y += ((s === 'stunned' ? 0.4 : 0.9) - this.y) * Math.min(1, (dt || 0) * 6);
    const flap = s === 'hidden' ? 0 : Math.sin(this.t * (s === 'latched' ? 22 : 9)) * 0.5;
    this.wings[0].rotation.z = flap; this.wings[1].rotation.z = -flap;
    this.eyes.group.scale.y = s === 'hidden' ? 0.05 : 1;
    this.frown.visible = s !== 'hidden';
    this.stack.rotation.z = s === 'windup' ? Math.sin(this.t * 50) * 0.1 : Math.sin(this.t * 2) * 0.08;
    this.stack.rotation.x = s === 'hidden' ? 0 : -0.25;
    super.syncVisual(dt);
  }
}

// ===================================================================
// Box Brute: armoured cardboard; only vulnerable with flaps open.
// ===================================================================
export class BoxBrute extends Clutter {
  constructor(game, x, z) {
    super(game, x, z);
    Object.assign(this, { kind: 'box', name: 'Box Brute', maxHp: 50, radius: 0.75, fleeSpeed: 2.0, mass: 0.65, topY: 1.6, voice: 0.6, contactDmg: 15, loot: ['b1', 'b1', 'c3'], maxLatch: 10, stunDur: 2.8 });
    const card = M('#ffffff', { map: TX.cardboard(true) }); const plain = M('#b98a55');
    this.crate = new THREE.Group(); this.body.add(this.crate);
    mesh(new THREE.BoxGeometry(1.2, 1.1, 1.1), [plain, plain, plain, plain, card, plain], 0, 0.85, 0, this.crate);
    // grumpy face made from the box's handle cut-outs
    const holeM = M('#120806');
    for (const sx of [-1, 1]) { const h = box(0.32, 0.1, 0.02, holeM, sx * 0.27, 1.05, 0.56, this.crate); h.rotation.z = sx * 0.28; }
    this.boxMouth = box(0.42, 0.08, 0.02, holeM, 0, 0.72, 0.56, this.crate);
    // inner darkness + glowing eyes revealed when flaps open
    box(1.08, 0.02, 0.98, M('#140a08'), 0, 1.39, 0, this.crate);
    this.eyes = makeEyes(this.crate, 0.12, 0.2, 1.42, 0.05, true);
    this.flaps = [];
    const flapDefs = [[0, 0.55, 0, 1.2, 0.5, 'x', 1], [0, -0.55, 0, 1.2, 0.5, 'x', -1], [0.6, 0, Math.PI / 2, 1.1, 0.55, 'z', -1], [-0.6, 0, Math.PI / 2, 1.1, 0.55, 'z', 1]];
    for (const [px, pz, , w, d, axis, s] of flapDefs) {
      const piv = new THREE.Group(); piv.position.set(px, 1.4, pz); this.crate.add(piv);
      const f = axis === 'x' ? box(w, 0.03, d, plain, 0, 0, -s * d / 2, piv) : box(d, 0.03, w, plain, s * d / 2, 0, 0, piv);
      void f; piv.userData = { axis, s }; this.flaps.push(piv);
    }
    this.limbs = [];
    for (const s of [-1, 1]) {
      const arm = box(0.22, 0.6, 0.22, plain, s * 0.72, 0.85, 0.1, this.crate); arm.geometry.translate(0, -0.25, 0); arm.position.y = 1.1;
      const leg = box(0.28, 0.32, 0.32, M('#8a6a42'), s * 0.32, 0.16, 0, this.crate);
      this.limbs.push(arm, leg);
    }
    this.walkT = rand(2, 3.5); this.chargeDir = new THREE.Vector3();
    this.init(0.8);
    this.setState('idle');
  }
  get flapsOpen() { return ['roar', 'dizzy', 'stunned', 'latched'].includes(this.state); }
  harmful() { return this.state === 'charge' || this.state === 'walk'; }
  onHitPlayer() { if (this.state === 'charge') { this.setState('walk'); this.vel.set(0, 0, 0); this.game.shake(0.3); } }
  flash() {
    if (!this.active || this.state === 'latched' || this.state === 'stunned') return null;
    if (this.flapsOpen) { this.stunFor(this.stunDur); return 'stun'; }
    return 'immune';
  }
  ai(dt) {
    const d = this.distP();
    const dir = this.dirToPlayer(new THREE.Vector3());
    switch (this.state) {
      case 'idle': this.vel.set(0, 0, 0); if (d < 7.5) { this.setState('walk'); this.game.audio.play('grunt', { pitch: 0.6 }); } break;
      case 'recover': this.vel.set(0, 0, 0); if (this.stateT > 0.6) this.setState('walk'); break;
      case 'walk':
        this.vel.lerp(dir.clone().multiplyScalar(1.4), Math.min(1, dt * 3));
        this.faceYaw(Math.atan2(dir.x, dir.z), dt, 4);
        this.walkT -= dt;
        if (this.walkT <= 0) { this.setState('roar'); this.game.audio.play('roar'); this.vel.set(0, 0, 0); this.game.shake(0.15); }
        break;
      case 'roar':
        this.faceYaw(Math.atan2(dir.x, dir.z), dt, 10);
        if (this.stateT > 1.1) { this.setState('charge'); this.chargeDir.copy(dir); this.game.audio.play('whoosh'); }
        break;
      case 'charge':
        this.vel.copy(this.chargeDir).multiplyScalar(7.5);
        if (this.stateT > 0.15 && this.bumped) {
          this.setState('dizzy'); this.vel.set(0, 0, 0); this.game.audio.play('thud'); this.game.shake(0.45);
          this.game.fxNorm.burst(14, { x: this.pos.x + this.chargeDir.x * 0.7, y: 0.6, z: this.pos.z + this.chargeDir.z * 0.7, color: '#c8b89a', size: 0.5, size2: 0.9, speed: 3, life: 0.8, alpha: 0.6 });
        }
        if (this.stateT > 1.3) { this.setState('walk'); this.walkT = rand(2.5, 4); }
        break;
      case 'dizzy': this.vel.set(0, 0, 0); if (this.stateT > 1.9) { this.setState('walk'); this.walkT = rand(2.5, 4); } break;
    }
  }
  afterStun() { this.setState('recover'); this.walkT = rand(2, 3); }
  syncVisual(dt) {
    const open = this.flapsOpen ? 1 : 0;
    this.flapOpen = (this.flapOpen || 0) + (open - (this.flapOpen || 0)) * Math.min(1, (dt || 0) * 10);
    const fo = this.flapOpen;
    for (const f of this.flaps) { const a = fo * 2.0 + (this.state === 'latched' ? Math.sin(this.t * 30) * 0.2 : 0); if (f.userData.axis === 'x') f.rotation.x = f.userData.s * a; else f.rotation.z = f.userData.s * a; }
    this.eyes.group.visible = fo > 0.3;
    this.boxMouth.scale.y = this.state === 'roar' ? 3 + Math.sin(this.t * 40) : this.state === 'dizzy' ? 0.5 : 1;
    const walking = this.state === 'walk' || this.state === 'charge' || this.state === 'latched';
    const sp = this.state === 'charge' ? 22 : 8;
    this.crate.rotation.z = walking ? Math.sin(this.t * sp) * 0.06 : 0;
    this.crate.rotation.x = this.state === 'charge' ? 0.2 : this.state === 'roar' ? -0.15 + Math.sin(this.t * 40) * 0.03 : 0;
    this.limbs.forEach((l, i) => { if (i % 2 === 0) l.rotation.x = walking ? Math.sin(this.t * sp + i) * 0.8 : (this.state === 'roar' ? -2.4 : 0); });
    if (this.state !== 'captured') this.y = 0;
    super.syncVisual(dt);
  }
}

// ===================================================================
// The Hoard King: the attic boss.
// ===================================================================
export class HoardKing extends Clutter {
  constructor(game, x, z) {
    super(game, x, z);
    Object.assign(this, { kind: 'boss', name: 'The Hoard King', maxHp: 220, radius: 1.8, fleeSpeed: 1.4, mass: 0.85, topY: 3.6, voice: 0.5, contactDmg: 10, loot: [], maxLatch: 5, stunDur: 3.6, blobR: 2.3 });
    const cols = ['#c8b89a', '#8a6a4a', '#b05a5a', '#5a7ab0', '#e8e0d0', '#7a9a5a', '#a07ac0', '#d8a040'];
    this.heap = new THREE.Group(); this.body.add(this.heap);
    const g = new THREE.SphereGeometry(1.8, 18, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); const n = 1 + pnoise(V.x, V.y, V.z) * 0.12; p.setXYZ(i, V.x * n, Math.max(-0.3, V.y) * n * 0.9, V.z * n); }
    g.computeVertexNormals();
    mesh(g, M('#7a6a5a', { flat: true }), 0, 1.4, 0, this.heap);
    // junk glued all over
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, e = rand(-0.15, 1.3);
      const r = 1.75;
      const pos = new THREE.Vector3(Math.cos(a) * Math.cos(e) * r, 1.4 + Math.sin(e) * r * 0.9, Math.sin(a) * Math.cos(e) * r);
      if (pos.z > 0.6 && Math.abs(pos.x) < 0.9 && pos.y < 2.4) continue; // keep the face/core clear
      const k = Math.random(); const c = M(cols[(Math.random() * cols.length) | 0], { flat: true });
      const geo = k < 0.35 ? new THREE.BoxGeometry(rand(0.3, 0.6), rand(0.3, 0.6), rand(0.3, 0.6))
        : k < 0.55 ? new THREE.CylinderGeometry(0.15, 0.15, rand(0.3, 0.6), 8)
        : k < 0.75 ? new THREE.TorusGeometry(0.22, 0.08, 6, 12) : new THREE.IcosahedronGeometry(rand(0.2, 0.35), 0);
      const m = mesh(geo, c, pos.x, pos.y, pos.z, this.heap); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    }
    // crown (an old lampshade with spikes)
    const crown = new THREE.Group(); crown.position.set(0, 3.15, 0); this.heap.add(crown); this.crown = crown;
    const gold = M('#ffcf4a', { m: 0.7, r: 0.3, e: '#a06000', ei: 0.3 });
    mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.45, 14, 1, true), M('#ffcf4a', { m: 0.7, r: 0.3, side: THREE.DoubleSide }), 0, 0, 0, crown);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; mesh(new THREE.ConeGeometry(0.1, 0.35, 5), gold, Math.cos(a) * 0.58, 0.35, Math.sin(a) * 0.58, crown); sph(0.07, M(['#ff4a5a', '#4aa3ff', '#4ae87a'][i % 3], { e: '#ffffff', ei: 0.2 }), Math.cos(a) * 0.68, 0.05, Math.sin(a) * 0.68, crown, 6, 4); }
    // face
    this.eyes = makeEyes(this.heap, 0.32, 0.45, 2.35, 1.35);
    this.brows = [];
    for (const s of [-1, 1]) { const b = box(0.55, 0.12, 0.1, M('#2a1a10'), s * 0.45, 2.78, 1.45, this.heap); b.rotation.z = s * 0.35; this.brows.push(b); }
    this.mouth = new THREE.Group(); this.mouth.position.set(0, 1.75, 1.5); this.heap.add(this.mouth);
    box(1.0, 0.32, 0.1, M('#1a0a10'), 0, 0, 0, this.mouth);
    for (let i = 0; i < 5; i++) box(0.12, 0.12, 0.05, M('#f2ede0'), -0.4 + i * 0.2, 0.12, 0.04, this.mouth);
    // the core (weak point) behind two cardboard panels
    this.coreMat = M('#ff3a5a', { unique: true, e: '#ff2040', ei: 0.4 });
    this.core = sph(0.32, this.coreMat, 0, 1.05, 1.55, this.heap, 16, 12);
    this.panels = [];
    for (const s of [-1, 1]) { const pn = box(0.5, 0.75, 0.12, M('#b98a55', { map: TX.cardboard(false) }), s * 0.26, 1.05, 1.72, this.heap); pn.userData.s = s; this.panels.push(pn); }
    // fists
    this.fists = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Group(); f.position.set(s * 2.25, 0.7, 0.5); this.body.add(f);
      box(0.8, 0.7, 0.8, M('#b98a55', { map: TX.cardboard(false) }), 0, 0, 0, f);
      for (let k = 0; k < 3; k++) box(0.2, 0.2, 0.2, M('#8a6a42'), -0.25 + k * 0.25, 0.25, 0.42, f);
      this.fists.push(f);
    }
    this.cycle = 0; this.throwsLeft = 0; this.throwT = 0; this.coreOpen = 0;
    this.init(2.3);
    this.setState('dormant');
    this.y = -0.4;
  }
  get phase2() { return this.hp < this.maxHp * 0.5; }
  harmful() { return this.state !== 'dormant' && this.state !== 'intro' && this.state !== 'stunned'; }
  flash() {
    if (!this.active || this.state === 'latched' || this.state === 'stunned') return null;
    if (this.state === 'tired') { this.stunFor(this.stunDur); this.game.audio.play('roar'); return 'stun'; }
    return 'immune';
  }
  onLatched() { super.onLatched(); this.game.audio.play('roar'); }
  onReleased() { this.setState('break'); this.tension = 0; }
  afterStun() { this.setState('throw'); this.startThrows(); }
  startThrows() { this.throwsLeft = this.phase2 ? 6 : 4; this.throwT = 0.6; }
  ai(dt) {
    const dir = this.dirToPlayer(new THREE.Vector3());
    this.faceYaw(Math.atan2(dir.x, dir.z), dt, this.state === 'tired' ? 0.5 : 2);
    switch (this.state) {
      case 'dormant': this.vel.set(0, 0, 0); break;
      case 'intro':
        this.y = Math.min(0, -0.4 + this.stateT * 0.3);
        if (this.stateT > 2.6) { this.setState('throw'); this.startThrows(); }
        break;
      case 'throw': {
        // shuffle slowly toward Pip
        this.vel.lerp(dir.clone().multiplyScalar(this.distP() > 5 ? 0.7 : 0), Math.min(1, dt * 2));
        this.throwT -= dt;
        if (this.throwT <= 0) {
          if (this.throwsLeft > 0) { this.throwsLeft--; this.throwT = this.phase2 ? 0.55 : 0.8; this.game.throwJunk(this); this.throwArm = 0.35; }
          else { this.cycle++; this.setState(this.cycle % 2 === 0 ? 'summon' : 'slam'); this.vel.set(0, 0, 0); this.game.audio.play('grunt', { pitch: 0.5 }); }
        }
        break;
      }
      case 'slam':
        this.vel.set(0, 0, 0);
        if (this.stateT > 1.1 && !this.slammed) {
          this.slammed = true; this.game.shockwave(this.pos.x, this.pos.z, this.radius, this.phase2 ? 7.5 : 6.5, 14);
          this.game.audio.play('slam'); this.game.shake(0.7);
        }
        if (this.stateT > 1.7) { this.slammed = false; this.setState('tired'); }
        break;
      case 'summon':
        this.vel.set(0, 0, 0);
        if (this.stateT > 0.9 && !this.summoned) { this.summoned = true; this.game.summonMinions(this); this.game.audio.play('roar'); }
        if (this.stateT > 1.8) { this.summoned = false; this.setState('tired'); }
        break;
      case 'tired':
        this.vel.set(0, 0, 0);
        if (this.stateT > (this.phase2 ? 2.6 : 3.2)) { this.setState('throw'); this.startThrows(); }
        break;
      case 'break':
        this.vel.set(0, 0, 0);
        if (this.stateT > 0.8) { this.setState('throw'); this.startThrows(); }
        break;
      case 'recover': this.setState('throw'); this.startThrows(); break;
    }
  }
  syncVisual(dt) {
    dt = dt || 0;
    const s = this.state;
    const open = s === 'tired' || s === 'stunned' || s === 'latched' ? 1 : 0;
    this.coreOpen += (open - this.coreOpen) * Math.min(1, dt * 6);
    this.panels.forEach((p) => { p.position.x = p.userData.s * (0.26 + this.coreOpen * 0.45); p.rotation.y = p.userData.s * this.coreOpen * 0.8; });
    this.coreMat.emissiveIntensity = 0.4 + this.coreOpen * (2 + Math.sin(this.t * 10) * 0.8);
    this.core.scale.setScalar(1 + this.coreOpen * Math.sin(this.t * 10) * 0.1);
    const sag = s === 'tired' || s === 'stunned' ? 1 : 0;
    this.heap.rotation.x += ((sag ? 0.18 : 0) - this.heap.rotation.x) * Math.min(1, dt * 4);
    this.heap.scale.y = 1 + Math.sin(this.t * (s === 'latched' ? 25 : 2)) * (s === 'latched' ? 0.03 : 0.02) - sag * 0.06;
    this.brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * (sag ? -0.3 : 0.35); });
    this.mouth.scale.y = s === 'slam' || s === 'summon' || s === 'intro' || s === 'latched' ? 2.2 : s === 'tired' ? 0.5 : 1;
    this.crown.rotation.z = sag ? 0.35 : Math.sin(this.t * 1.5) * 0.05;
    this.throwArm = Math.max(0, (this.throwArm || 0) - dt);
    this.fists.forEach((f, i) => {
      const side = i ? 1 : -1;
      let y = 0.7 + Math.sin(this.t * 2 + i) * 0.1;
      if (s === 'slam') y = this.stateT < 1.1 ? 0.7 + Math.min(1, this.stateT / 0.9) * 2.4 : 0.45;
      if (s === 'throw' && this.throwArm > 0 && i === this.throwsLeft % 2) y = 0.7 + this.throwArm * 5;
      if (s === 'summon') y = 0.7 + Math.sin(this.stateT * 12) * 0.6 + 0.6;
      if (sag) y = 0.4;
      f.position.y += (y - f.position.y) * Math.min(1, dt * 14);
      f.position.x = side * (2.25 + (s === 'latched' ? Math.sin(this.t * 30) * 0.08 : 0));
    });
    if (s === 'intro') { this.heap.position.x = Math.sin(this.t * 40) * 0.05; } else this.heap.position.x = 0;
    super.syncVisual(dt);
    // the boss doesn't stretch as much
    this.body.scale.set(1 - (this.body.scale.z - 1) * 0.1, this.body.scale.y, 1 + (this.body.scale.z - 1) * 0.25);
  }
}

export function spawnClutter(game, type, x, z) {
  switch (type) {
    case 'dust': return new DustBunny(game, x, z);
    case 'sock': return new SockGremlin(game, x, z);
    case 'paper': return new PaperWraith(game, x, z);
    case 'box': return new BoxBrute(game, x, z);
    case 'boss': return new HoardKing(game, x, z);
  }
  throw new Error('unknown clutter ' + type);
}
