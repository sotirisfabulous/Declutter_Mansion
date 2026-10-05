import * as THREE from 'three';
import { softDot } from './textures.js';

const VS = `
attribute float psize; attribute float palpha; attribute vec3 pcolor;
uniform float uScale;
varying float vA; varying vec3 vC;
void main(){
  vA = palpha; vC = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform sampler2D uTex;
varying float vA; varying vec3 vC;
void main(){
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vC, t.a * vA);
  if (gl_FragColor.a < 0.01) discard;
}`;

export class Particles {
  constructor(scene, max = 1500, additive = false) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.col2 = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.size0 = new Float32Array(max); this.size1 = new Float32Array(max);
    this.alpha = new Float32Array(max); this.a0 = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.outCol = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.outCol, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('psize', this.aSize); geo.setAttribute('palpha', this.aAlpha);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uTex: { value: softDot() } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
    this._c = new THREE.Color(); this._c2 = new THREE.Color();
  }

  setScale(s) { this.mat.uniforms.uScale.value = s; }
  clear() { this.n = 0; }

  emit(p) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i3] = p.vx || 0; this.vel[i3 + 1] = p.vy || 0; this.vel[i3 + 2] = p.vz || 0;
    this._c.set(p.color ?? 0xffffff); this._c2.set(p.color2 ?? p.color ?? 0xffffff);
    this.col[i3] = this._c.r; this.col[i3 + 1] = this._c.g; this.col[i3 + 2] = this._c.b;
    this.col2[i3] = this._c2.r; this.col2[i3 + 1] = this._c2.g; this.col2[i3 + 2] = this._c2.b;
    this.size0[i] = p.size ?? 0.2; this.size1[i] = p.size2 ?? this.size0[i];
    this.a0[i] = p.alpha ?? 1;
    this.life[i] = this.maxLife[i] = p.life ?? 1;
    this.grav[i] = p.gravity ?? 0; this.drag[i] = p.drag ?? 0;
  }

  // emit n particles around a point with randomized spread
  burst(n, o) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (o.up ?? 0.5) + (Math.random() - 0.5) * (o.cone ?? 1.5);
      const sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      const r = o.radius ?? 0;
      const colors = o.colors;
      this.emit({
        x: o.x + (Math.random() - 0.5) * r, y: o.y + (Math.random() - 0.5) * r * 0.5, z: o.z + (Math.random() - 0.5) * r,
        vx: Math.cos(a) * sp * Math.cos(e), vy: Math.sin(e) * sp, vz: Math.sin(a) * sp * Math.cos(e),
        color: colors ? colors[(Math.random() * colors.length) | 0] : o.color, color2: o.color2,
        size: (o.size ?? 0.2) * (0.6 + Math.random() * 0.8), size2: o.size2, alpha: o.alpha,
        life: (o.life ?? 0.8) * (0.6 + Math.random() * 0.6), gravity: o.gravity ?? 0, drag: o.drag ?? 1.5,
      });
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.grav[i] > 0 && this.pos[i3 + 1] < 0.02) { this.pos[i3 + 1] = 0.02; this.vel[i3 + 1] *= -0.4; this.vel[i3] *= 0.6; this.vel[i3 + 2] *= 0.6; }
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      this.outCol[i3] = this.col[i3] + (this.col2[i3] - this.col[i3]) * t;
      this.outCol[i3 + 1] = this.col[i3 + 1] + (this.col2[i3 + 1] - this.col[i3 + 1]) * t;
      this.outCol[i3 + 2] = this.col[i3 + 2] + (this.col2[i3 + 2] - this.col[i3 + 2]) * t;
      i++;
    }
    const g = this.points.geometry; g.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  _kill(i) {
    const j = --this.n; if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[j3 + k]; this.vel[i3 + k] = this.vel[j3 + k];
      this.col[i3 + k] = this.col[j3 + k]; this.col2[i3 + k] = this.col2[j3 + k]; this.outCol[i3 + k] = this.outCol[j3 + k];
    }
    this.size[i] = this.size[j]; this.size0[i] = this.size0[j]; this.size1[i] = this.size1[j];
    this.alpha[i] = this.alpha[j]; this.a0[i] = this.a0[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
    this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
  }
}

// DOM labels anchored to world positions (damage numbers, HP tags, "!" alerts)
export class Labels {
  constructor(camera) {
    this.camera = camera; this.root = document.getElementById('labels');
    this.items = []; this._v = new THREE.Vector3();
  }
  project(p) {
    this._v.copy(p).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth, y: (-this._v.y * 0.5 + 0.5) * innerHeight, vis: this._v.z < 1 };
  }
  float(text, pos, cls = '', life = 1) {
    if (this.items.length > 40) return;
    const el = document.createElement('div'); el.className = 'float ' + cls; el.innerHTML = text;
    this.root.appendChild(el);
    this.items.push({ el, pos: pos.clone(), life, follow: null });
  }
  alert(pos, text = '!') {
    const el = document.createElement('div'); el.className = 'alert'; el.textContent = text;
    this.root.appendChild(el);
    this.items.push({ el, pos: pos.clone(), life: 0.7, follow: null });
  }
  tag() {
    const el = document.createElement('div'); el.className = 'hp-tag'; el.style.display = 'none';
    this.root.appendChild(el);
    return el;
  }
  place(el, pos) {
    const s = this.project(pos);
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.life -= dt;
      if (it.life <= 0) { it.el.remove(); this.items.splice(i, 1); continue; }
      this.place(it.el, it.pos);
    }
  }
  clear() { for (const it of this.items) it.el.remove(); this.items = []; }
}
