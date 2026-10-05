import * as THREE from 'three';
import { M, mesh, box, cyl, sph } from './props.js';

const SKIN = '#f5c9a0', SHIRT = '#ff6b8a', OVERALL = '#2f4f9a', CAP = '#2fc9a6', TANK = '#ffcf4a', SHOE = '#5a3418';

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.aim = new THREE.Vector3(0, 0, -1);
    this.yaw = Math.PI;
    this.radius = 0.4;
    this.maxHp = 100; this.hp = 100;
    this.invuln = 0; this.flashCd = 0; this.walk = 0; this.idle = 0; this.cheerT = 0;
    this.vacuuming = false; this.latched = null; this.power = 0;
    this._build();
  }

  _build() {
    const root = (this.root = new THREE.Group());
    const body = (this.body = new THREE.Group()); root.add(body);
    const ov = M(OVERALL), shirt = M(SHIRT), skin = M(SKIN), cap = M(CAP), shoe = M(SHOE);
    // legs
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.13, 0.55, 0); body.add(hip);
      cyl(0.09, 0.08, 0.42, ov, 0, -0.22, 0, hip, 10);
      const sh = box(0.17, 0.12, 0.28, shoe, 0, -0.47, 0.05, hip); sh.geometry.translate(0, 0, 0);
      this.legs.push(hip);
    }
    // torso
    const torso = (this.torso = new THREE.Group()); torso.position.y = 0.55; body.add(torso);
    cyl(0.27, 0.25, 0.32, ov, 0, 0.14, 0, torso, 16);
    cyl(0.25, 0.27, 0.28, shirt, 0, 0.44, 0, torso, 16);
    box(0.3, 0.2, 0.05, ov, 0, 0.34, 0.24, torso);                         // bib
    for (const s of [-1, 1]) { box(0.06, 0.32, 0.04, ov, s * 0.13, 0.48, 0.22, torso); sph(0.035, M('#ffd84a', { m: 0.6, r: 0.3 }), s * 0.13, 0.4, 0.26, torso, 8, 6); }
    // head
    cyl(0.11, 0.12, 0.12, skin, 0, 0.62, 0, torso, 10);                    // neck
    const head = (this.head = new THREE.Group()); head.position.y = 0.74; torso.add(head);
    sph(0.27, skin, 0, 0.1, 0, head, 20, 16);
    sph(0.06, M('#f0a888'), 0, 0.0, 0.27, head, 10, 8);                    // nose
    for (const s of [-1, 1]) {
      const e = sph(0.075, M('#ffffff', { r: 0.3 }), s * 0.1, 0.09, 0.22, head, 12, 10); e.scale.set(1, 1.25, 0.6);
      sph(0.04, M('#1a1020', { r: 0.2 }), s * 0.1, 0.08, 0.265, head, 10, 8);
      sph(0.012, M('#ffffff', { e: '#ffffff' }), s * 0.1 + 0.015, 0.105, 0.3, head, 6, 4);
      const ch = sph(0.05, M('#ff9aa8'), s * 0.17, -0.03, 0.2, head, 8, 6); ch.scale.set(1, 0.6, 0.4);
      sph(0.05, skin, s * 0.27, 0.1, 0, head, 8, 6);                        // ears
    }
    const mouth = mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10, Math.PI), M('#8a2a3a'), 0, -0.08, 0.25, head); mouth.rotation.z = Math.PI;
    this.mouth = mouth;
    sph(0.27, M('#6a3a1a'), 0, 0.14, -0.04, head, 14, 10).scale.set(1.02, 0.9, 1);  // hair
    const capTop = mesh(new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 0.2, 0, head); void capTop;
    const brim = cyl(0.21, 0.22, 0.035, cap, 0, 0.2, 0.3, head, 16); brim.scale.set(1, 1, 0.75); brim.rotation.x = 0.12;
    sph(0.06, M('#ffffff'), 0, 0.31, 0.22, head, 8, 6).scale.set(1, 0.7, 0.4); // cap badge
    // arms reaching to the nozzle
    const limb = (from, to, r, mat) => {
      const dir = new THREE.Vector3().subVectors(to, from); const L = dir.length();
      const g = new THREE.CylinderGeometry(r, r * 0.85, L, 8); g.translate(0, L / 2, 0);
      const m = mesh(g, mat, from.x, from.y, from.z, torso);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    };
    for (const s of [-1, 1]) {
      const sh = new THREE.Vector3(s * 0.27, 0.52, 0.02), el = new THREE.Vector3(s * 0.3, 0.3, 0.22), hand = new THREE.Vector3(s * 0.11, 0.32, 0.4);
      sph(0.085, shirt, sh.x, sh.y, sh.z, torso, 8, 6);
      limb(sh, el, 0.07, shirt); limb(el, hand, 0.065, skin);
      sph(0.065, skin, el.x, el.y, el.z, torso, 8, 6);
      sph(0.08, M('#ffffff'), hand.x, hand.y, hand.z, torso, 8, 6); // gloves
    }
    // vacuum backpack
    const pack = (this.pack = new THREE.Group()); pack.position.set(0, 0.42, -0.34); torso.add(pack);
    const tankM = M(TANK, { r: 0.35, m: 0.3 });
    const tank = mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), tankM, 0, 0, 0, pack);
    void tank;
    box(0.5, 0.08, 0.1, M('#3a3a4a'), 0, 0.15, 0.18, pack);
    box(0.5, 0.08, 0.1, M('#3a3a4a'), 0, -0.15, 0.18, pack);
    cyl(0.12, 0.12, 0.05, M('#222'), 0, 0.42, 0, pack, 12);
    this.bulbMat = M('#ff4a6a', { unique: true, e: '#ff4a6a', ei: 0.3 });
    sph(0.08, this.bulbMat, 0, 0.48, 0, pack, 10, 8);
    const gauge = cyl(0.07, 0.07, 0.03, M('#f2f2f2'), 0.14, 0.05, -0.17, pack, 12); gauge.rotation.x = Math.PI / 2;
    this.needle = box(0.01, 0.06, 0.01, M('#e22'), 0.14, 0.07, -0.19, pack);
    for (const s of [-1, 1]) { const f = box(0.04, 0.3, 0.2, M('#2fc9a6'), s * 0.21, -0.05, -0.02, pack); void f; }
    // nozzle (held in front)
    const noz = (this.nozzleGroup = new THREE.Group()); noz.position.set(0, 0.3, 0.42); torso.add(noz);
    const metal = M('#c8d0d8', { m: 0.85, r: 0.25 });
    const pipe = cyl(0.07, 0.07, 0.55, metal, 0, 0, 0.12, noz, 12); pipe.rotation.x = Math.PI / 2;
    const mouthN = mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.22, 16, 1, true), M('#2fc9a6', { side: THREE.DoubleSide, r: 0.5 }), 0, 0, 0.48, noz);
    mouthN.rotation.x = Math.PI / 2;
    this.nozzleRing = mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 18), M('#4fe3c1', { unique: true, e: '#4fe3c1', ei: 0.2 }), 0, 0, 0.59, noz);
    box(0.12, 0.1, 0.18, M('#333'), 0, 0.12, 0.05, noz); // flashlight housing
    const lens = cyl(0.06, 0.06, 0.02, M('#fff8d0', { e: '#fff3c0', ei: 2 }), 0, 0.12, 0.15, noz, 12); lens.rotation.x = Math.PI / 2;
    this.tip = new THREE.Object3D(); this.tip.position.set(0, 0, 0.6); noz.add(this.tip);
    this.lamp = new THREE.Object3D(); this.lamp.position.set(0, 0.12, 0.2); noz.add(this.lamp);
    // hose: tank bottom -> nozzle pipe
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 0.2, -0.38), new THREE.Vector3(0.36, 0.05, -0.15), new THREE.Vector3(0.32, 0.12, 0.18), new THREE.Vector3(0.06, 0.28, 0.32),
    ]);
    const hose = mesh(new THREE.TubeGeometry(curve, 20, 0.05, 8), M('#3a3a4a', { r: 0.6 }), 0, 0, 0, torso);
    void hose;

    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    // blob shadow
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; root.add(sh); this.blob = sh;

    // flashlight beam (soft additive cone)
    const beamGeo = new THREE.ConeGeometry(2.2, 7, 28, 1, true);
    beamGeo.translate(0, -3.5, 0); beamGeo.rotateX(-Math.PI / 2);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#fff1c4') }, uAlpha: { value: 0.09 } },
      vertexShader: 'varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = clamp(position.z / 7.0, 0.0, 1.0); vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.5); float a = uAlpha * pow(1.0 - vD, 1.6) * edge; gl_FragColor = vec4(uColor, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat); this.beam.renderOrder = 5;
    this.beam.rotation.x = 0.32; this.lamp.add(this.beam);

    // vacuum suction cone (streaks scroll toward the nozzle)
    const sGeo = new THREE.ConeGeometry(1.25, 3.6, 24, 1, true);
    sGeo.translate(0, -1.8, 0); sGeo.rotateX(-Math.PI / 2);
    this.suckMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vD = clamp(position.z/3.6,0.0,1.0); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uT; uniform float uA; varying vec2 vUv; varying float vD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          float col = floor(vUv.x * 40.0);
          float s = fract(vUv.y * 2.0 - uT * (1.6 + h(vec2(col,1.0))) + h(vec2(col,2.0)));
          float streak = smoothstep(0.0, 0.1, s) * smoothstep(0.35, 0.1, s) * step(0.35, h(vec2(col, 3.0)));
          float a = uA * streak * (1.0 - vD) * smoothstep(0.0, 0.15, vD);
          gl_FragColor = vec4(vec3(0.75, 1.0, 0.95), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.suck = new THREE.Mesh(sGeo, this.suckMat); this.suck.renderOrder = 6;
    this.suck.position.z = 0.55; this.nozzleGroup.add(this.suck);

    // flashlight
    const spot = (this.spot = new THREE.SpotLight('#fff1d0', 70, 17, 0.5, 0.55, 1.4));
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0015; spot.shadow.normalBias = 0.02;
    spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 18;
    this.spotTarget = new THREE.Object3D(); spot.target = this.spotTarget;
    // nozzle glow
    this.vacLight = new THREE.PointLight('#4fe3c1', 0, 4, 2);
  }

  addTo(scene) { scene.add(this.root, this.spot, this.spotTarget, this.vacLight); }

  reset(x, z, yaw = Math.PI) {
    this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.knock.set(0, 0, 0);
    this.yaw = yaw; this.aim.set(Math.sin(yaw), 0, Math.cos(yaw));
    this.latched = null; this.power = 0; this.invuln = 0; this.cheerT = 0;
    this.root.visible = true;
    this.syncTransforms();
  }

  tipWorld(v = new THREE.Vector3()) { return this.tip.getWorldPosition(v); }

  hurt(amount, fx, fz) {
    if (this.invuln > 0 || this.game.state !== 'play') return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 1.3;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, l = Math.hypot(dx, dz) || 1;
    this.knock.set((dx / l) * 7, 0, (dz / l) * 7);
    this.game.onPlayerHurt(amount);
    return true;
  }

  cheer() { this.cheerT = 1.4; }

  update(dt, t) {
    const g = this.game, inp = g.input;
    const moving = g.state === 'play' && !g.cutscene;
    const mv = moving ? inp.move : { x: 0, z: 0 };
    const mlen = Math.hypot(mv.x, mv.z);
    let speed = 5.0;
    if (this.vacuuming) speed = 2.8;
    if (this.latched) speed = 2.3;
    const tx = mv.x * speed, tz = mv.z * speed;
    const acc = 1 - Math.exp(-dt * 14);
    this.vel.x += (tx - this.vel.x) * acc; this.vel.z += (tz - this.vel.z) * acc;
    this.pos.x += (this.vel.x + this.knock.x) * dt; this.pos.z += (this.vel.z + this.knock.z) * dt;
    this.knock.multiplyScalar(Math.exp(-dt * 7));
    if (g.room) g.room.collide(this.pos, this.radius);

    // aim
    if (moving) {
      let ax = null, az = null;
      if (this.latched) { ax = this.latched.pos.x - this.pos.x; az = this.latched.pos.z - this.pos.z; }
      else if (inp.aimStick) { ax = inp.aimStick.x; az = inp.aimStick.z; }
      else if (inp.device === 'kbm' && inp.mouseAim && g.mouseGround) { ax = g.mouseGround.x - this.pos.x; az = g.mouseGround.z - this.pos.z; }
      else if (mlen > 0.2) { ax = mv.x; az = mv.z; }
      if (ax !== null && Math.hypot(ax, az) > 0.05) {
        const want = Math.atan2(ax, az);
        let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-dt * (this.latched ? 8 : 18)));
      }
    }
    this.aim.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

    // timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.flashCd = Math.max(0, this.flashCd - dt);

    // animation
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.3) { this.walk += dt * sp * 2.6; this.idle = 0; } else { this.idle += dt; this.walk *= 0.9; }
    const sw = Math.sin(this.walk) * Math.min(1, sp / 3) * 0.7;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    let bob = Math.abs(Math.sin(this.walk)) * 0.06 * Math.min(1, sp / 3);
    let lean = Math.min(1, sp / 5) * 0.12;
    if (this.vacuuming) lean -= 0.08;
    if (this.latched) lean = -0.25 + Math.sin(t * 30) * 0.03;
    this.body.rotation.x += (lean - this.body.rotation.x) * Math.min(1, dt * 10);
    this.head.rotation.y = this.idle > 3 ? Math.sin(t * 1.3) * 0.6 : this.head.rotation.y * 0.9;
    this.mouth.scale.y = this.latched ? 1.8 : 1;
    if (this.cheerT > 0) {
      this.cheerT -= dt;
      const k = this.cheerT / 1.4;
      bob += Math.abs(Math.sin(k * Math.PI * 3)) * 0.5 * k;
      this.body.rotation.y = (1 - k) * Math.PI * 2;
    } else this.body.rotation.y = 0;
    if (this.vacuuming) { this.torso.position.x = (Math.random() - 0.5) * (this.latched ? 0.04 : 0.015); }
    else this.torso.position.x = 0;
    this.body.position.y = bob;
    this.needle.rotation.z = this.vacuuming ? -1 + Math.sin(t * 40) * 0.2 - (this.latched ? 0.8 : 0) : 0.8;
    this.bulbMat.emissiveIntensity = this.vacuuming ? 1.5 + Math.sin(t * 20) : 0.3;
    this.nozzleRing.material.emissiveIntensity = this.vacuuming ? 2 : 0.2;
    this.root.visible = this.invuln > 0 ? Math.floor(this.invuln * 14) % 2 === 0 : true;
    this.blob.visible = true;

    // vacuum visuals
    this.suckMat.uniforms.uT.value = t;
    const sa = this.vacuuming ? (this.latched ? 0.4 : 0.28) : 0;
    this.suckMat.uniforms.uA.value += (sa - this.suckMat.uniforms.uA.value) * Math.min(1, dt * 12);
    this.suck.visible = this.suckMat.uniforms.uA.value > 0.01;
    this.vacLight.intensity += ((this.vacuuming ? 3 : 0) - this.vacLight.intensity) * Math.min(1, dt * 10);

    this.syncTransforms();
  }

  syncTransforms() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    const lp = this.lamp.getWorldPosition(new THREE.Vector3());
    this.spot.position.copy(lp);
    this.spotTarget.position.set(this.pos.x + this.aim.x * 6, 0, this.pos.z + this.aim.z * 6);
    this.spotTarget.updateMatrixWorld();
    this.tip.getWorldPosition(this.vacLight.position);
  }
}
