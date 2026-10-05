// Unified input: keyboard + mouse, gamepad, and touch (dual virtual sticks).

const DEAD = 0.22;

export class Input {
  constructor(app) {
    this.app = app;
    this.keys = new Set();
    this.move = { x: 0, z: 0 };
    this.aimStick = null;          // {x,z} when a stick is aiming
    this.mouseNDC = { x: 0, y: 0 };
    this.mouseAim = false;          // true once the mouse has been used to aim
    this.vacMouse = false; this.vacKey = false; this.vacPad = false; this.vacTouch = false;
    this.edges = {};
    this.device = 'kbm';
    this.touchEnabled = false;
    this.pad = null; this.padPrev = [];
    this.lStick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.rStick = { id: null, x: 0, y: 0 };
    this.listeners = [];
    this._bind();
  }

  get vacuum() { return this.vacMouse || this.vacKey || this.vacPad || this.vacTouch; }
  fire(a) { this.edges[a] = true; }
  take(a) { const v = !!this.edges[a]; this.edges[a] = false; return v; }
  clearEdges() { this.edges = {}; }
  onAny(fn) { this.listeners.push(fn); }
  _any(src) { for (const f of this.listeners) f(src); }

  setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    document.body.classList.toggle('touch', d === 'touch');
    if (d === 'touch' && !this.touchEnabled) this.setTouch(true);
  }
  setTouch(on) {
    this.touchEnabled = on;
    document.getElementById('touch').classList.toggle('hidden', !on || !this.showTouch);
  }
  showTouchUI(show) { this.showTouch = show; this.setTouch(this.touchEnabled); }

  _bind() {
    const kmap = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    };
    addEventListener('keydown', (e) => {
      if (e.repeat) { if (kmap[e.code] || e.code === 'Space') e.preventDefault(); return; }
      this.setDevice('kbm');
      const k = kmap[e.code];
      if (k) { this.keys.add(k); e.preventDefault(); }
      switch (e.code) {
        case 'Space': this.vacKey = true; this.fire('confirm'); e.preventDefault(); break;
        case 'KeyF': case 'ShiftLeft': case 'ShiftRight': case 'KeyQ': this.fire('flash'); break;
        case 'KeyE': case 'Enter': this.fire('use'); this.fire('confirm'); break;
        case 'Escape': case 'KeyP': this.fire('pause'); break;
        case 'KeyM': this.fire('map'); break;
      }
      this._any('key');
    });
    addEventListener('keyup', (e) => {
      const k = kmap[e.code]; if (k) this.keys.delete(k);
      if (e.code === 'Space') this.vacKey = false;
    });
    addEventListener('blur', () => { this.keys.clear(); this.vacKey = this.vacMouse = this.vacTouch = false; });

    const canvas = document.getElementById('gl');
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) { this.mouseAim = true; this.setDevice('kbm'); }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        this.setDevice('kbm'); this.mouseAim = true;
        this.mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
        this.mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
        if (e.button === 0) { this.vacMouse = true; this.fire('confirm'); }
        if (e.button === 2) this.fire('flash');
        this._any('mouse');
      }
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.vacMouse = false; });

    // ---- touch ----
    const lEl = document.getElementById('stick-l');
    const rEl = document.getElementById('stick-r');
    const tl = document.getElementById('touch');
    const rect = (el) => el.getBoundingClientRect();
    const start = (e) => {
      if (e.pointerType === 'mouse') return;
      this.setDevice('touch');
      this._any('touch');
      const x = e.clientX, y = e.clientY;
      const rr = rect(rEl);
      const rcx = rr.left + rr.width / 2, rcy = rr.top + rr.height / 2;
      if (this.rStick.id === null && Math.hypot(x - rcx, y - rcy) < rr.width * 0.8) {
        this.rStick.id = e.pointerId; this.vacTouch = true; rEl.classList.add('active');
        this._rMove(x, y); e.preventDefault(); return;
      }
      if (this.lStick.id === null && x < innerWidth * 0.5) {
        this.lStick.id = e.pointerId; this.lStick.ox = x; this.lStick.oy = y;
        lEl.style.left = `${x - lEl.offsetWidth / 2}px`; lEl.style.top = `${y - lEl.offsetHeight / 2}px`; lEl.style.bottom = 'auto';
        this._lMove(x, y); e.preventDefault(); return;
      }
      this.fire('confirm');
    };
    tl.addEventListener('pointerdown', start);
    canvas.addEventListener('pointerdown', start);
    addEventListener('pointermove', (e) => {
      if (e.pointerId === this.lStick.id) this._lMove(e.clientX, e.clientY);
      if (e.pointerId === this.rStick.id) this._rMove(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (e.pointerId === this.lStick.id) {
        this.lStick.id = null; this.lStick.x = this.lStick.y = 0;
        lEl.querySelector('.knob').style.transform = ''; lEl.style.left = ''; lEl.style.top = ''; lEl.style.bottom = '';
      }
      if (e.pointerId === this.rStick.id) {
        this.rStick.id = null; this.rStick.x = this.rStick.y = 0; this.vacTouch = false;
        rEl.querySelector('.knob').style.transform = ''; rEl.classList.remove('active');
      }
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    const tap = (id, act) => document.getElementById(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.setDevice('touch'); this.fire(act); });
    tap('t-flash', 'flash'); tap('t-use', 'use');
    addEventListener('gamepadconnected', () => this.setDevice('pad'));
  }

  _lMove(x, y) {
    const R = 55; let dx = x - this.lStick.ox, dy = y - this.lStick.oy;
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    this.lStick.x = dx / R; this.lStick.y = dy / R;
    document.querySelector('#stick-l .knob').style.transform = `translate(${dx}px, ${dy}px)`;
  }
  _rMove(x, y) {
    const el = document.getElementById('stick-r'); const r = el.getBoundingClientRect();
    const R = r.width / 2 - 10; let dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    this.rStick.x = dx / R; this.rStick.y = dy / R;
    el.querySelector('.knob').style.transform = `translate(${dx}px, ${dy}px)`;
  }

  rumble(strong, weak, ms) {
    const p = this.pad;
    if (p && p.vibrationActuator) {
      try { p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (_) {}
    } else if (this.device === 'touch' && navigator.vibrate && ms >= 150) {
      try { navigator.vibrate(Math.min(ms, 120)); } catch (_) {}
    }
  }

  update() {
    // keyboard
    let mx = 0, mz = 0;
    if (this.keys.has('left')) mx -= 1; if (this.keys.has('right')) mx += 1;
    if (this.keys.has('up')) mz -= 1; if (this.keys.has('down')) mz += 1;
    this.aimStick = null;

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    this.vacPad = false;
    if (this.pad) {
      const p = this.pad; const ax = p.axes;
      const lx = Math.abs(ax[0]) > DEAD ? ax[0] : 0, ly = Math.abs(ax[1]) > DEAD ? ax[1] : 0;
      const rx = ax[2] || 0, ry = ax[3] || 0;
      const b = (i) => (p.buttons[i] ? p.buttons[i].value > 0.4 || p.buttons[i].pressed : false);
      const now = p.buttons.map((_, i) => b(i));
      const edge = (i) => now[i] && !this.padPrev[i];
      if (lx || ly || Math.hypot(rx, ry) > 0.35 || now.some((v) => v)) this.setDevice('pad');
      if (this.device === 'pad') {
        mx += lx; mz += ly;
        if (Math.hypot(rx, ry) > 0.35) this.aimStick = { x: rx, z: ry };
        this.vacPad = now[7];
      }
      if (edge(0)) { this.fire('use'); this.fire('confirm'); this.fire('menuA'); }
      if (edge(12)) this.fire('menuUp');
      if (edge(13)) this.fire('menuDown');
      const sy = ax[1] || 0;
      if (sy < -0.6 && !(this.stickPrev < -0.6)) this.fire('menuUp');
      if (sy > 0.6 && !(this.stickPrev > 0.6)) this.fire('menuDown');
      this.stickPrev = sy;
      if (edge(2) || edge(4) || edge(5) || edge(6)) this.fire('flash');
      if (edge(9)) this.fire('pause');
      if (edge(8)) this.fire('map');
      if (edge(1)) this.fire('back');
      if (edge(7)) this.fire('confirm');
      if (now.some((v, i) => v && !this.padPrev[i])) this._any('pad');
      this.padPrev = now;
    }

    // touch
    if (this.lStick.id !== null) { mx += this.lStick.x; mz += this.lStick.y; }
    if (this.rStick.id !== null && Math.hypot(this.rStick.x, this.rStick.y) > 0.2) this.aimStick = { x: this.rStick.x, z: this.rStick.y };

    const l = Math.hypot(mx, mz);
    if (l > 1) { mx /= l; mz /= l; }
    this.move.x = mx; this.move.z = mz;
  }

  // Human-readable control names for tips
  name(action) {
    const d = this.device;
    const t = {
      kbm: { vac: '<kbd>Left Click</kbd>', flash: '<kbd>Right Click</kbd>', use: '<kbd>E</kbd>', move: '<kbd>WASD</kbd>', aim: 'the <kbd>Mouse</kbd>' },
      pad: { vac: '<kbd>RT</kbd>', flash: '<kbd>LT</kbd>', use: '<kbd>A</kbd>', move: 'the <kbd>Left Stick</kbd>', aim: 'the <kbd>Right Stick</kbd>' },
      touch: { vac: 'the <kbd>VAC stick</kbd>', flash: '<kbd>FLASH</kbd>', use: '<kbd>USE</kbd>', move: 'the <kbd>left thumb</kbd>', aim: 'the <kbd>VAC stick</kbd>' },
    };
    return t[d][action];
  }
}
