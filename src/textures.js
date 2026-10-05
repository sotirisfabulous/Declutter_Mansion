import * as THREE from 'three';

// All textures are painted on canvases at startup: no image assets needed.

const cache = new Map();
let anisotropy = 4;
export function setAnisotropy(a) { anisotropy = a; }

function make(key, w, h, draw, { repeat = true, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = anisotropy;
  cache.set(key, t);
  return t;
}

// deterministic pseudo-random for repeatable art
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function shade(hex, amt) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

function speckle(g, w, h, n, alpha, r) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.7})`;
    g.fillRect(Math.random() * w, Math.random() * h, r, r);
  }
}

export function woodFloor(base = '#8a5a3a') {
  return make('wood' + base, 512, 512, (g, w, h) => {
    const rows = 8; const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 200;
      while (x < w) {
        const len = 140 + Math.random() * 160;
        g.fillStyle = shade(base, (Math.random() - 0.5) * 0.08);
        g.fillRect(x, r * rh, len, rh);
        // grain
        g.strokeStyle = shade(base, -0.08); g.globalAlpha = 0.35; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const y = r * rh + Math.random() * rh; g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (Math.random() - 0.5) * 6, x + len * 0.6, y + (Math.random() - 0.5) * 6, x + len, y);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, r * rh, w, 2);
    }
    speckle(g, w, h, 600, 0.06, 2);
  });
}

export function checkerFloor(a = '#e9dcc6', b = '#3a2b4a') {
  return make('check' + a + b, 256, 256, (g, w, h) => {
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? b : a; g.fillRect(i * s, j * s, s, s);
      const grd = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
      grd.addColorStop(0, 'rgba(255,255,255,0.10)'); grd.addColorStop(1, 'rgba(0,0,0,0.10)');
      g.fillStyle = grd; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(i * s, j * s, s, s);
    }
    speckle(g, w, h, 300, 0.05, 2);
  });
}

export function tileFloor(a = '#cfe3e0', grout = '#7a8f8c') {
  return make('tile' + a, 256, 256, (g, w, h) => {
    g.fillStyle = grout; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = shade(a, (Math.random() - 0.5) * 0.06); g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(i * s + 6, j * s + 6, s - 20, 4);
    }
  });
}

export function carpet(base = '#7a2a3a', accent = '#d9a441') {
  return make('carpet' + base + accent, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 4000, 0.07, 2);
    g.strokeStyle = accent; g.globalAlpha = 0.55; g.lineWidth = 4;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    g.beginPath(); g.moveTo(w / 2, 50); g.lineTo(w - 50, h / 2); g.lineTo(w / 2, h - 50); g.lineTo(50, h / 2); g.closePath(); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 24, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  });
}

export function rugTex(base = '#2e5a8a', accent = '#f0c060', key = '') {
  return make('rug' + base + accent + key, 512, 512, (g, w, h) => {
    g.fillStyle = shade(base, -0.1); g.fillRect(0, 0, w, h);
    g.fillStyle = base; g.fillRect(24, 24, w - 48, h - 48);
    speckle(g, w, h, 5000, 0.06, 2);
    g.strokeStyle = accent; g.lineWidth = 8; g.strokeRect(40, 40, w - 80, h - 80);
    g.lineWidth = 3; g.strokeRect(58, 58, w - 116, h - 116);
    g.save(); g.translate(w / 2, h / 2);
    for (let i = 0; i < 8; i++) {
      g.rotate(Math.PI / 4); g.fillStyle = i % 2 ? accent : shade(accent, -0.25);
      g.beginPath(); g.ellipse(0, 70, 22, 60, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = shade(base, 0.15); g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
    g.restore();
  }, { repeat: false });
}

export function wallpaper(base = '#5b3a6e', accent = '#7d5a92', style = 'damask') {
  return make('wp' + base + accent + style, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    if (style === 'stripes') {
      for (let x = 0; x < w; x += 64) { g.fillRect(x, 0, 22, h); g.globalAlpha = 0.5; g.fillRect(x + 30, 0, 4, h); g.globalAlpha = 1; }
    } else if (style === 'dots') {
      for (let y = 0; y < h; y += 42) for (let x = (y / 42) % 2 ? 21 : 0; x < w + 21; x += 42) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    } else if (style === 'stars') {
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * 86 + 40 + ((i / 3 | 0) % 2) * 20, y = (i / 3 | 0) * 86 + 40;
        g.save(); g.translate(x, y); g.beginPath();
        for (let k = 0; k < 10; k++) { const r = k % 2 ? 7 : 16; const a = (k / 10) * Math.PI * 2; g.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
        g.closePath(); g.fill(); g.restore();
      }
    } else if (style === 'planks') {
      for (let x = 0; x < w; x += 42) { g.fillStyle = shade(base, (Math.random() - 0.5) * 0.08); g.fillRect(x, 0, 40, h); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 40, 0, 2, h); }
      speckle(g, w, h, 800, 0.08, 2);
    } else {
      // damask-ish motif
      const motif = (cx, cy, s) => {
        g.save(); g.translate(cx, cy); g.scale(s, s);
        g.beginPath(); g.moveTo(0, -40);
        g.bezierCurveTo(22, -26, 26, -6, 0, 10); g.bezierCurveTo(-26, -6, -22, -26, 0, -40); g.fill();
        g.beginPath(); g.moveTo(0, 6); g.bezierCurveTo(18, 14, 20, 32, 0, 42); g.bezierCurveTo(-20, 32, -18, 14, 0, 6); g.fill();
        g.beginPath(); g.ellipse(-24, 2, 8, 14, -0.6, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(24, 2, 8, 14, 0.6, 0, Math.PI * 2); g.fill();
        g.restore();
      };
      motif(64, 64, 1); motif(192, 192, 1); motif(192, -64, 1); motif(-64, 192, 1); motif(64, 320, 1); motif(320, 64, 1);
    }
    speckle(g, w, h, 500, 0.04, 2);
  });
}

export function portrait(seed, bg = '#2a3d5a') {
  return make('portrait' + seed, 128, 160, (g, w, h) => {
    const R = rng(seed * 7919);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, shade(bg, 0.12)); grd.addColorStop(1, shade(bg, -0.12));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const skin = ['#f1c9a5', '#d9a07a', '#a8714f', '#e8bfa0'][Math.floor(R() * 4)];
    const cloth = ['#6b1f2e', '#1f3d6b', '#2f5a2f', '#4a2a6b', '#333'][Math.floor(R() * 5)];
    // shoulders
    g.fillStyle = cloth; g.beginPath(); g.ellipse(w / 2, h + 10, 58, 50, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#eee'; g.beginPath(); g.moveTo(w / 2 - 12, h - 38); g.lineTo(w / 2, h - 18); g.lineTo(w / 2 + 12, h - 38); g.fill();
    // head
    g.fillStyle = skin; g.beginPath(); g.ellipse(w / 2, 70, 28, 34, 0, 0, Math.PI * 2); g.fill();
    // hair / hat
    const hair = ['#3a2412', '#c9c9c9', '#7a4a1a', '#111', '#d8b25a'][Math.floor(R() * 5)];
    g.fillStyle = hair;
    const hs = Math.floor(R() * 3);
    if (hs === 0) { g.beginPath(); g.ellipse(w / 2, 46, 32, 18, 0, Math.PI, 0); g.fill(); }
    else if (hs === 1) { g.beginPath(); g.ellipse(w / 2, 40, 30, 26, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = skin; g.beginPath(); g.ellipse(w / 2, 74, 26, 30, 0, 0, Math.PI * 2); g.fill(); }
    else { g.fillRect(w / 2 - 22, 10, 44, 30); g.fillRect(w / 2 - 34, 36, 68, 6); }
    // eyes (they follow you...)
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(w / 2 - 10, 68, 6, 4, 0, 0, Math.PI * 2); g.ellipse(w / 2 + 10, 68, 6, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(w / 2 - 9, 68, 2.5, 0, Math.PI * 2); g.arc(w / 2 + 11, 68, 2.5, 0, Math.PI * 2); g.fill();
    // mouth / mustache
    g.strokeStyle = '#6a2a2a'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, 84, 8, 0.2, Math.PI - 0.2); g.stroke();
    if (R() < 0.4) { g.fillStyle = hair; g.beginPath(); g.ellipse(w / 2 - 8, 82, 9, 3, 0.2, 0, Math.PI * 2); g.ellipse(w / 2 + 8, 82, 9, 3, -0.2, 0, Math.PI * 2); g.fill(); }
    // varnish
    const v = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 100); v.addColorStop(0, 'rgba(255,220,150,0.1)'); v.addColorStop(1, 'rgba(40,20,0,0.5)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

export function landscape(seed) {
  return make('land' + seed, 160, 110, (g, w, h) => {
    const R = rng(seed * 31);
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#3b5f8a'); sky.addColorStop(1, '#e8b27a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(30 + R() * 100, 30, 10, 0, Math.PI * 2); g.fill();
    for (let l = 0; l < 3; l++) {
      g.fillStyle = ['#4a6a4a', '#36513a', '#22382a'][l]; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) g.lineTo(x, h * (0.5 + l * 0.12) + Math.sin(x * 0.05 + R() * 6) * 8);
      g.lineTo(w, h); g.fill();
    }
  }, { repeat: false });
}

export function books() {
  return make('books', 256, 128, (g, w, h) => {
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h);
    const cols = ['#7a2a2a', '#2a4a7a', '#2a6a3a', '#8a6a2a', '#5a2a6a', '#a04a20', '#20606a', '#6a6a6a'];
    for (let row = 0; row < 2; row++) {
      let x = 2;
      while (x < w - 4) {
        const bw = 8 + Math.random() * 12, bh = 40 + Math.random() * 20;
        g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        g.fillRect(x, row * 64 + 62 - bh, bw, bh);
        g.fillStyle = 'rgba(255,215,120,0.6)'; g.fillRect(x + 2, row * 64 + 62 - bh + 8, bw - 4, 2); g.fillRect(x + 2, row * 64 + 58, bw - 4, 2);
        x += bw + 1;
      }
    }
  });
}

export function cardboard(label = true) {
  return make('cardboard' + label, 256, 256, (g, w, h) => {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1500, 0.06, 2);
    g.strokeStyle = 'rgba(90,60,30,0.25)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = 'rgba(210, 190, 140, 0.85)'; g.fillRect(w / 2 - 22, 0, 44, h);
    if (label) {
      g.save(); g.translate(w / 2, h * 0.66); g.rotate(-0.08);
      g.fillStyle = '#b0242a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('FRAGILE', 0, 0);
      g.restore();
      g.fillStyle = '#3a2a1a'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('↑↑ JUNK ↑↑', w / 2, 46);
    }
  }, { repeat: false });
}

export function radial(key, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return make('radial' + key, 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, inner); grd.addColorStop(1, outer);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

export function dustTex() {
  return make('dustpile', 128, 128, (g, w, h) => {
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * 56;
      g.fillStyle = `rgba(${150 + Math.random() * 40},${140 + Math.random() * 40},${130 + Math.random() * 40},${0.25 + Math.random() * 0.3})`;
      g.beginPath(); g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2 + Math.random() * 5, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });
}

export function webTex() {
  return make('web', 256, 256, (g, w, h) => {
    g.strokeStyle = 'rgba(235,235,255,0.75)'; g.lineWidth = 1.5;
    const n = 7;
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250); g.stroke(); }
    for (let r = 30; r < 250; r += 28) {
      g.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; const rr = r + (i % 2 ? -6 : 0); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
  }, { repeat: false });
}

export function softDot() {
  return make('softdot', 64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { repeat: false, srgb: false });
}

export function beamTex() {
  // streaky texture scrolled along the vacuum suction cone
  return make('beam', 64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 20 + Math.random() * 60;
      const grd = g.createLinearGradient(x, y, x, y + l);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(x, y, 2 + Math.random() * 2, l);
    }
  }, { srgb: false });
}

export function cloth(base = '#8a3a4a') {
  return make('cloth' + base, 128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h);
    speckle(g, w, h, 300, 0.05, 2);
  });
}

export function paperTex() {
  return make('paper', 128, 128, (g, w, h) => {
    g.fillStyle = '#f4efe0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,40,80,0.35)';
    for (let y = 18; y < h - 10; y += 10) g.fillRect(12, y, w - 24 - Math.random() * 40, 2);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.font = 'bold 14px serif'; g.fillText('URGENT', 14, 14);
  }, { repeat: false });
}
