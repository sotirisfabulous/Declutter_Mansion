import { KEY_COLORS } from './props.js';
import { MANSION, ROOMS } from './rooms.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = $('hud');
    this.tipTimer = 0; this.promptText = ''; this.bannerTimer = 0; this.roomTimer = 0; this.toastTimer = 0;
    this.flashA = 0; this.hurtA = 0;
    this.dialogQueue = []; this.dialogCb = null; this.typing = 0; this.fullText = '';
    this.profPortrait = this._drawProf();
    $('dlg-portrait').style.backgroundImage = `url(${this.profPortrait})`;
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  setHP(hp, max) {
    $('hp-num').textContent = Math.ceil(hp);
    $('hp-fill').style.width = `${(hp / max) * 100}%`;
    const h = document.querySelector('.hp-heart');
    h.classList.add('bump'); setTimeout(() => h.classList.remove('bump'), 150);
  }
  setMoney(v, bump = true) {
    $('money').textContent = v.toLocaleString();
    if (bump) { const m = document.querySelector('.money'); m.classList.add('bump'); clearTimeout(this._mb); this._mb = setTimeout(() => m.classList.remove('bump'), 120); }
  }
  setKeys(keys) {
    const root = $('keys'); root.innerHTML = '';
    for (const k of keys) {
      const d = document.createElement('div'); d.className = 'key-ico'; d.style.color = KEY_COLORS[k]; d.textContent = '🗝'; d.title = `${k} key`;
      root.appendChild(d);
    }
  }
  roomName(name, sub = '') {
    const el = $('room-name'); el.innerHTML = name + (sub ? `<small>${sub}</small>` : '');
    el.classList.add('show'); this.roomTimer = 3.2;
  }
  prompt(html) {
    if (html === this.promptText) return;
    this.promptText = html;
    const el = $('prompt');
    if (!html) el.classList.add('hidden'); else { el.innerHTML = html; el.classList.remove('hidden'); }
  }
  tip(html, dur = 6) {
    const el = $('tip'); el.innerHTML = html; el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    this.tipTimer = dur; this.game.audio.play('tip');
  }
  hideTip() { $('tip').classList.add('hidden'); this.tipTimer = 0; }
  banner(html, dur = 2.6) {
    const el = $('banner'); el.innerHTML = html; el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = `banner ${dur}s ease forwards`;
    this.bannerTimer = dur;
  }
  toast(text, dur = 2.5) { const el = $('toast'); el.textContent = text; el.classList.remove('hidden'); this.toastTimer = dur; }
  flash(a = 0.5) { this.flashA = Math.max(this.flashA, a); }
  hurt() { this.hurtA = 1; }

  showTug(e) {
    $('tug').classList.remove('hidden'); $('tug-name').textContent = e.name;
    this._tugE = e;
  }
  hideTug() { $('tug').classList.add('hidden'); this._tugE = null; }
  updateTug(e, power, align) {
    $('tug-hp').textContent = Math.max(0, Math.ceil(e.hp));
    $('tug-power').style.width = `${power * 100}%`;
    const pw = document.querySelector('.tug-power');
    pw.classList.toggle('full', power >= 1);
    $('tug-slam').textContent = this.game.input.device === 'touch' ? 'TAP FLASH!' : 'SLAM!';
    const hint = $('tug-hint');
    if (power >= 1) { hint.innerHTML = `Press ${this.game.input.name('flash')} to <b>SLAM</b>!`; }
    else hint.textContent = align > 0.5 ? 'Great pull! Keep it up!' : 'Pull AWAY from where it runs!';
    hint.style.color = align > 0.5 ? '#ffe14a' : '';
  }

  bossBar(show, frac = 1) {
    $('boss-bar').classList.toggle('hidden', !show);
    $('boss-fill').style.width = `${Math.max(0, frac) * 100}%`;
  }
  flashCooldown(frac) {
    $('flash-cd').querySelector('i').style.height = `${(1 - frac) * 100}%`;
    $('t-flash').classList.toggle('cool', frac < 1);
  }
  useButton(show) { $('t-use').classList.toggle('hidden', !show); }

  // ---------- dialog ----------
  dialog(lines, cb, name = 'Prof. Tidwell') {
    this.dialogQueue = [...lines]; this.dialogCb = cb; $('dlg-name').textContent = name;
    $('dialog').classList.remove('hidden');
    this._nextLine();
  }
  _nextLine() {
    const line = this.dialogQueue.shift();
    if (line === undefined) { $('dialog').classList.add('hidden'); const cb = this.dialogCb; this.dialogCb = null; cb && cb(); return; }
    this.fullText = line; this.typing = 0;
    $('dlg-text').innerHTML = '';
  }
  dialogOpen() { return !$('dialog').classList.contains('hidden'); }
  advanceDialog() {
    if (this.typing < this.plainLen()) { this.typing = 1e9; $('dlg-text').innerHTML = this.fullText; return; }
    this.game.audio.play('ui');
    this._nextLine();
  }
  plainLen() { return this.fullText.replace(/<[^>]+>/g, '').length; }
  _typeTick(dt) {
    const L = this.plainLen(); if (this.typing >= L) return;
    const before = Math.floor(this.typing);
    this.typing += dt * 55;
    const n = Math.min(L, Math.floor(this.typing));
    if (n !== before) {
      if (n % 3 === 0) this.game.audio.play('type');
      // reveal n visible characters while keeping tags intact
      let out = '', count = 0, i = 0; const s = this.fullText;
      while (i < s.length && count < n) {
        if (s[i] === '<') { const j = s.indexOf('>', i); out += s.slice(i, j + 1); i = j + 1; continue; }
        out += s[i]; i++; count++;
      }
      // close any open tags
      const open = (out.match(/<(b|kbd)>/g) || []).length - (out.match(/<\/(b|kbd)>/g) || []).length;
      for (let k = 0; k < open; k++) out += out.lastIndexOf('<kbd>') > out.lastIndexOf('<b>') ? '</kbd>' : '</b>';
      $('dlg-text').innerHTML = out;
    }
  }

  // ---------- map ----------
  renderMap(save, currentId) {
    const grid = $('map-grid'); grid.innerHTML = '';
    const cw = Math.min(150, (Math.min(innerWidth * 0.9, 520) - 20) / 3), ch = Math.min(84, (innerHeight * 0.55) / 3);
    const gap = 14;
    grid.style.width = `${cw * 3 + gap * 2}px`; grid.style.height = `${ch * 3 + gap * 2}px`;
    const px = (r) => ({ x: r.grid[0] * (cw + gap), y: r.grid[1] * (ch + gap) });
    // connections
    for (const r of MANSION) for (const d of r.doors) {
      if (!d.to || r.id > d.to) continue;
      const o = ROOMS[d.to]; const a = px(r), b = px(o);
      const el = document.createElement('div'); el.className = 'map-door';
      const horiz = a.y === b.y;
      if (horiz) { el.style.left = `${Math.min(a.x, b.x) + cw - 2}px`; el.style.top = `${a.y + ch / 2 - 4}px`; el.style.width = `${gap + 4}px`; el.style.height = '8px'; }
      else { el.style.left = `${a.x + cw / 2 - 4}px`; el.style.top = `${Math.min(a.y, b.y) + ch - 2}px`; el.style.width = '8px'; el.style.height = `${gap + 4}px`; }
      const lock = d.lock || (o.doors.find((x) => x.to === r.id) || {}).lock;
      if (lock && !save.unlocked.includes(lock)) el.style.background = KEY_COLORS[lock];
      grid.appendChild(el);
    }
    for (const r of MANSION) {
      const p = px(r); const el = document.createElement('div');
      const st = save.cleared.includes(r.id) ? 'cleared' : save.visited.includes(r.id) ? 'visited' : 'unknown';
      el.className = `map-room ${st}${r.id === currentId ? ' here' : ''}`;
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; el.style.width = `${cw}px`; el.style.height = `${ch}px`;
      el.innerHTML = st === 'unknown' ? '?' : r.name.replace('The ', '');
      if (r.id === currentId) { const pip = document.createElement('div'); pip.className = 'pip'; el.appendChild(pip); }
      grid.appendChild(el);
    }
  }

  update(dt) {
    if (this.tipTimer > 0) { this.tipTimer -= dt; if (this.tipTimer <= 0) this.hideTip(); }
    if (this.roomTimer > 0) { this.roomTimer -= dt; if (this.roomTimer <= 0) $('room-name').classList.remove('show'); }
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) $('banner').classList.add('hidden'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) $('toast').classList.add('hidden'); }
    this.flashA = Math.max(0, this.flashA - dt * 2.5); $('flash').style.opacity = this.flashA;
    this.hurtA = Math.max(0, this.hurtA - dt * 1.8); $('hurt').style.opacity = this.hurtA;
    if (this.dialogOpen()) this._typeTick(dt);
  }

  _drawProf() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#5a3a8a'); bg.addColorStop(1, '#2a1747'); g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(14, 128); g.quadraticCurveTo(64, 80, 114, 128); g.fill();       // lab coat
    g.fillStyle = '#3fa8e0'; g.fillRect(56, 96, 16, 32);                                                         // tie
    g.fillStyle = '#f2c8a0'; g.beginPath(); g.ellipse(64, 62, 30, 34, 0, 0, Math.PI * 2); g.fill();            // face
    g.fillStyle = '#ffffff';                                                                                       // wild hair
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.ellipse(64 + Math.cos(a) * 34, 50 + Math.sin(a) * 26, 14, 10, a, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.ellipse(32, 66, 10, 16, 0, 0, Math.PI * 2); g.ellipse(96, 66, 10, 16, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 3; g.fillStyle = 'rgba(200,240,255,0.6)';                            // glasses
    for (const x of [50, 78]) { g.beginPath(); g.arc(x, 62, 11, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(61, 62); g.lineTo(67, 62); g.stroke();
    g.fillStyle = '#222'; for (const x of [52, 80]) { g.beginPath(); g.arc(x, 63, 3.5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(64, 84, 18, 7, 0, 0, Math.PI); g.fill();                  // moustache
    g.fillStyle = '#e8a080'; g.beginPath(); g.arc(64, 72, 5, 0, Math.PI * 2); g.fill();                         // nose
    return c.toDataURL();
  }
}
