// Procedural audio: every sound and every note is synthesised with WebAudio.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.55;
    this.sfxVol = 0.8;
    this.tracks = {};
    this.current = null;
    this.vac = null;
    this._last = {};
  }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);

    // white noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // reverb send shared by music + some sfx
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.6, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3.2);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.revMusic = ctx.createGain(); this.revMusic.gain.value = 0.35;
    this.revSfx = ctx.createGain(); this.revSfx.gain.value = 0.25;
    this.revMusic.connect(this.reverb); this.revSfx.connect(this.reverb);
    const revOut = ctx.createGain(); revOut.gain.value = 0.6;
    this.reverb.connect(revOut).connect(this.master);

    this._buildTracks();
    this._timer = setInterval(() => this._schedule(), 25);
    if (this._pendingMusic) this.playMusic(this._pendingMusic);
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  // ---------- primitives ----------
  tone({ f = 440, f2 = null, type = 'sine', t = 0, dur = 0.2, a = 0.005, vol = 0.3, dest = null, filter = null, rev = 0, curve = 'exp', vib = 0, vibRate = 6 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t0 + dur);
      else o.frequency.linearRampToValueAtTime(f2, t0 + dur);
    }
    if (vib) {
      const l = ctx.createOscillator(); const lg = ctx.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg).connect(o.frequency);
      l.start(t0); l.stop(t0 + dur + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) {
      const fl = ctx.createBiquadFilter(); fl.type = filter.type || 'lowpass';
      fl.frequency.value = filter.f || 1000; fl.Q.value = filter.q || 1;
      node.connect(fl); node = fl;
    }
    node.connect(g);
    g.connect(dest || this.sfxBus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(dest === this.musicBus ? this.revMusic : this.revSfx); }
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise({ t = 0, dur = 0.2, a = 0.005, vol = 0.3, type = 'bandpass', f = 1000, f2 = null, q = 1, dest = null, rev = 0 }) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t0);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl).connect(g).connect(dest || this.sfxBus);
    if (rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r).connect(this.revSfx); }
    s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
  }

  // ---------- sound effects ----------
  play(name, opt = {}) {
    if (!this.ctx) return;
    // throttle spammy sounds
    const now = this.ctx.currentTime;
    const gap = { coin: 0.04, step: 0.05, suckSmall: 0.05, squeak: 0.12, hit: 0.06, paper: 0.08, locked: 0.4, dust: 0.08 }[name] || 0;
    if (gap && this._last[name] && now - this._last[name] < gap) return;
    this._last[name] = now;
    const r = (a, b) => a + Math.random() * (b - a);
    const p = opt.pitch || 1;
    switch (name) {
      case 'ui': this.tone({ f: 660, f2: 990, type: 'triangle', dur: 0.09, vol: 0.18 }); break;
      case 'uiBack': this.tone({ f: 700, f2: 420, type: 'triangle', dur: 0.1, vol: 0.18 }); break;
      case 'step': this.noise({ dur: 0.05, vol: 0.05, type: 'lowpass', f: 500 }); break;
      case 'flash':
        this.noise({ dur: 0.35, vol: 0.25, type: 'highpass', f: 1500, f2: 7000, a: 0.01 });
        this.tone({ f: 900, f2: 2600, type: 'sawtooth', dur: 0.18, vol: 0.08, filter: { type: 'lowpass', f: 4000 } });
        this.tone({ f: 2400, f2: 1800, type: 'sine', t: 0.05, dur: 0.4, vol: 0.08, rev: 0.6 });
        break;
      case 'flashFail': this.tone({ f: 1900, type: 'triangle', dur: 0.15, vol: 0.2 }); this.tone({ f: 2850, type: 'sine', t: 0.03, dur: 0.25, vol: 0.12, rev: 0.4 }); break;
      case 'stun': this.tone({ f: 700 * p, f2: 260 * p, type: 'sine', dur: 0.5, vol: 0.22, vib: 40, vibRate: 14 }); break;
      case 'spotted':
        this.tone({ f: 420 * p, f2: 1300 * p, type: 'square', dur: 0.14, vol: 0.1, filter: { type: 'lowpass', f: 2500 } });
        this.tone({ f: 1300 * p, f2: 900 * p, type: 'square', t: 0.13, dur: 0.12, vol: 0.08, filter: { type: 'lowpass', f: 2500 } });
        break;
      case 'squeak': { const b = r(600, 1000) * p; this.tone({ f: b, f2: b * r(1.2, 1.6), type: 'square', dur: 0.09, vol: 0.06, filter: { type: 'lowpass', f: 2200 } }); this.tone({ f: b * 1.3, f2: b * 0.9, type: 'square', t: 0.08, dur: 0.08, vol: 0.05, filter: { type: 'lowpass', f: 2200 } }); break; }
      case 'grunt': this.tone({ f: r(140, 180) * p, f2: 90 * p, type: 'sawtooth', dur: 0.25, vol: 0.12, filter: { type: 'lowpass', f: 700 } }); break;
      case 'latch': this.tone({ f: 200, f2: 520, type: 'sawtooth', dur: 0.2, vol: 0.12, filter: { type: 'lowpass', f: 1500 } }); this.noise({ dur: 0.2, vol: 0.2, type: 'bandpass', f: 800, f2: 3000 }); break;
      case 'capture':
        this.tone({ f: 260, f2: 1800, type: 'sawtooth', dur: 0.45, vol: 0.12, filter: { type: 'lowpass', f: 3000 } });
        this.noise({ dur: 0.45, vol: 0.18, type: 'bandpass', f: 600, f2: 5000, q: 2 });
        this.noise({ t: 0.44, dur: 0.12, vol: 0.4, type: 'lowpass', f: 3000 });
        [0, 4, 7, 12].forEach((s, i) => this.tone({ f: mtof(79 + s), type: 'triangle', t: 0.45 + i * 0.06, dur: 0.35, vol: 0.12, rev: 0.5 }));
        break;
      case 'suckSmall': this.tone({ f: r(500, 700), f2: r(1400, 2000), type: 'sine', dur: 0.09, vol: 0.12 }); break;
      case 'dust': this.noise({ dur: 0.2, vol: 0.12, type: 'lowpass', f: 900 }); break;
      case 'coin': this.tone({ f: 1976 * p, type: 'square', dur: 0.07, vol: 0.06, filter: { type: 'lowpass', f: 5000 } }); this.tone({ f: 2637 * p, type: 'square', t: 0.065, dur: 0.22, vol: 0.06, filter: { type: 'lowpass', f: 5000 }, rev: 0.3 }); break;
      case 'bill': this.noise({ dur: 0.18, vol: 0.15, type: 'bandpass', f: 3000, f2: 6000 }); this.tone({ f: 1568, type: 'triangle', t: 0.05, dur: 0.25, vol: 0.12, rev: 0.4 }); this.tone({ f: 2093, type: 'triangle', t: 0.12, dur: 0.3, vol: 0.12, rev: 0.4 }); break;
      case 'gem': [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ f: mtof(84 + s), type: 'sine', t: i * 0.05, dur: 0.5, vol: 0.1, rev: 0.7 })); break;
      case 'heart': [0, 4, 7, 12].forEach((s, i) => this.tone({ f: mtof(72 + s), type: 'triangle', t: i * 0.07, dur: 0.3, vol: 0.12, rev: 0.4 })); break;
      case 'hurt': this.tone({ f: 330, f2: 110, type: 'square', dur: 0.25, vol: 0.12, filter: { type: 'lowpass', f: 1200 } }); this.noise({ dur: 0.15, vol: 0.3, type: 'lowpass', f: 600 }); break;
      case 'whoosh': this.noise({ dur: 0.25, vol: 0.18, type: 'bandpass', f: 500, f2: 2500, q: 2 }); break;
      case 'slam':
        this.tone({ f: 140, f2: 30, type: 'sine', dur: 0.5, vol: 0.6 });
        this.noise({ dur: 0.5, vol: 0.45, type: 'lowpass', f: 2500, f2: 200 });
        this.tone({ f: 80, f2: 40, type: 'square', dur: 0.2, vol: 0.12, filter: { type: 'lowpass', f: 300 } });
        break;
      case 'thud': this.tone({ f: 120, f2: 40, type: 'sine', dur: 0.3, vol: 0.4 }); this.noise({ dur: 0.2, vol: 0.2, type: 'lowpass', f: 800 }); break;
      case 'door':
        this.tone({ f: 180, f2: 320, type: 'sawtooth', dur: 0.5, vol: 0.06, vib: 30, vibRate: 22, filter: { type: 'bandpass', f: 900, q: 4 } });
        this.noise({ t: 0.42, dur: 0.18, vol: 0.25, type: 'lowpass', f: 400 });
        break;
      case 'locked': for (let i = 0; i < 3; i++) this.noise({ t: i * 0.07, dur: 0.05, vol: 0.2, type: 'bandpass', f: 2500, q: 3 }); this.tone({ f: 200, type: 'square', dur: 0.12, vol: 0.05 }); break;
      case 'unlock': this.noise({ dur: 0.06, vol: 0.3, type: 'bandpass', f: 3000, q: 3 }); [0, 4, 7, 11, 14].forEach((s, i) => this.tone({ f: mtof(76 + s), type: 'triangle', t: 0.1 + i * 0.07, dur: 0.4, vol: 0.12, rev: 0.5 })); break;
      case 'search': for (let i = 0; i < 4; i++) this.noise({ t: i * 0.07, dur: 0.08, vol: 0.12, type: 'bandpass', f: r(1500, 3500), q: 1.5 }); break;
      case 'paper': this.noise({ dur: 0.15, vol: 0.12, type: 'highpass', f: 3000 }); break;
      case 'throw': this.noise({ dur: 0.3, vol: 0.15, type: 'bandpass', f: 400, f2: 1500, q: 2 }); break;
      case 'tear': this.noise({ dur: 0.3, vol: 0.3, type: 'bandpass', f: 2000, f2: 400 }); this.tone({ f: 600, f2: 150, type: 'sawtooth', dur: 0.3, vol: 0.08, filter: { type: 'lowpass', f: 1500 } }); break;
      case 'roar':
        this.tone({ f: 90, f2: 60, type: 'sawtooth', dur: 1.1, vol: 0.25, vib: 12, vibRate: 9, filter: { type: 'lowpass', f: 700 } });
        this.tone({ f: 134, f2: 85, type: 'sawtooth', dur: 1.1, vol: 0.18, vib: 15, vibRate: 7, filter: { type: 'lowpass', f: 900 } });
        this.noise({ dur: 1.1, vol: 0.3, type: 'lowpass', f: 900, f2: 300, a: 0.1 });
        break;
      case 'boing': this.tone({ f: 180, f2: 520, type: 'sine', dur: 0.25, vol: 0.2, vib: 25, vibRate: 18 }); break;
      case 'chest': [0, 5, 9, 12, 17].forEach((s, i) => this.tone({ f: mtof(67 + s), type: 'triangle', t: i * 0.09, dur: 0.6, vol: 0.12, rev: 0.6 })); break;
      case 'clear': {
        const seq = [62, 66, 69, 74, 78, 81, 86];
        seq.forEach((m, i) => this.tone({ f: mtof(m), type: 'triangle', t: i * 0.08, dur: 0.7, vol: 0.13, rev: 0.6 }));
        [74, 78, 81].forEach((m) => this.tone({ f: mtof(m), type: 'sine', t: 0.62, dur: 1.6, vol: 0.1, rev: 0.8 }));
        this.noise({ t: 0.0, dur: 1.2, vol: 0.05, type: 'highpass', f: 6000, rev: 1 });
        break;
      }
      case 'victory': {
        const seq = [[62, 0], [66, 0.12], [69, 0.24], [74, 0.36], [69, 0.6], [74, 0.72], [78, 0.84], [81, 1.1], [86, 1.4]];
        seq.forEach(([m, t]) => { this.tone({ f: mtof(m), type: 'square', t, dur: 0.35, vol: 0.06, filter: { type: 'lowpass', f: 3000 }, rev: 0.4 }); this.tone({ f: mtof(m), type: 'triangle', t, dur: 0.6, vol: 0.12, rev: 0.4 }); });
        [62, 66, 69, 74].forEach((m) => this.tone({ f: mtof(m), type: 'triangle', t: 1.4, dur: 2.2, vol: 0.09, rev: 0.8 }));
        break;
      }
      case 'gameover': [69, 68, 67, 66].forEach((m, i) => this.tone({ f: mtof(m - 12), type: 'square', t: i * 0.3, dur: 0.5, vol: 0.08, filter: { type: 'lowpass', f: 1200 }, rev: 0.5 })); break;
      case 'tip': this.tone({ f: 880, type: 'sine', dur: 0.15, vol: 0.1, rev: 0.4 }); this.tone({ f: 1320, type: 'sine', t: 0.08, dur: 0.25, vol: 0.1, rev: 0.4 }); break;
      case 'type': this.tone({ f: r(500, 650), type: 'square', dur: 0.03, vol: 0.03, filter: { type: 'lowpass', f: 2000 } }); break;
      case 'heartbeat': this.tone({ f: 70, f2: 45, type: 'sine', dur: 0.18, vol: 0.35 }); this.tone({ f: 65, f2: 40, type: 'sine', t: 0.2, dur: 0.2, vol: 0.25 }); break;
      case 'rustle': for (let i = 0; i < 3; i++) this.noise({ t: i * 0.06, dur: 0.07, vol: 0.06, type: 'bandpass', f: r(1200, 2400), q: 1.2 }); break;
      case 'curtain': this.noise({ dur: 0.4, vol: 0.06, type: 'bandpass', f: 1200, q: 0.7 }); break;
    }
  }

  // ---------- vacuum motor loop ----------
  setVacuum(on, load = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.vac) {
      const out = ctx.createGain(); out.gain.value = 0; out.connect(this.sfxBus);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
      const ng = ctx.createGain(); ng.gain.value = 0.5;
      n.connect(bp).connect(ng).connect(out);
      const m = ctx.createOscillator(); m.type = 'sawtooth'; m.frequency.value = 75;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const mg = ctx.createGain(); mg.gain.value = 0.35;
      m.connect(lp).connect(mg).connect(out);
      const w = ctx.createOscillator(); w.type = 'sine'; w.frequency.value = 1400;
      const wg = ctx.createGain(); wg.gain.value = 0.03;
      w.connect(wg).connect(out);
      // rattle tremolo when straining
      const trem = ctx.createOscillator(); trem.frequency.value = 18;
      const tg = ctx.createGain(); tg.gain.value = 0;
      trem.connect(tg).connect(out.gain);
      n.start(); m.start(); w.start(); trem.start();
      this.vac = { out, bp, m, w, tg, wg };
    }
    const v = this.vac;
    v.out.gain.setTargetAtTime(on ? 0.22 + load * 0.08 : 0, t, on ? 0.04 : 0.08);
    v.bp.frequency.setTargetAtTime(on ? 900 + load * 1400 : 500, t, 0.1);
    v.m.frequency.setTargetAtTime(on ? 75 + load * 40 : 40, t, on ? 0.15 : 0.3);
    v.w.frequency.setTargetAtTime(on ? 1400 + load * 900 : 600, t, 0.2);
    v.wg.gain.setTargetAtTime(on ? 0.03 + load * 0.03 : 0, t, 0.1);
    v.tg.gain.setTargetAtTime(on ? load * 0.08 : 0, t, 0.1);
  }

  // ---------- music ----------
  _inst(kind, m, time, len, vel, out) {
    const ctx = this.ctx;
    const f = mtof(m);
    const mk = (type, freq, g0, a, d, filt) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(g0, time + a);
      g.gain.exponentialRampToValueAtTime(0.0001, time + d);
      let n = o;
      if (filt) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filt; o.connect(fl); n = fl; }
      n.connect(g); g.connect(out);
      o.start(time); o.stop(time + d + 0.05);
      return g;
    };
    switch (kind) {
      case 'box': { // music box: bell partials
        const g = mk('sine', f, 0.16 * vel, 0.004, 1.4);
        mk('sine', f * 4.02, 0.035 * vel, 0.002, 0.35);
        mk('sine', f * 2.0, 0.03 * vel, 0.003, 0.6);
        const s = ctx.createGain(); s.gain.value = 0.9; g.connect(s).connect(this.revMusic);
        break;
      }
      case 'pluck': mk('triangle', f, 0.09 * vel, 0.004, 0.28, 2200); break;
      case 'bass': mk('triangle', f, 0.22 * vel, 0.01, Math.max(0.25, len)); mk('sine', f / 2, 0.12 * vel, 0.01, Math.max(0.25, len)); break;
      case 'pad': {
        for (const det of [-7, 7]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
          const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, time);
          g.gain.linearRampToValueAtTime(0.028 * vel, time + len * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, time + len);
          o.connect(fl).connect(g).connect(out);
          const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s).connect(this.revMusic);
          o.start(time); o.stop(time + len + 0.05);
        }
        break;
      }
      case 'lead': mk('square', f, 0.045 * vel, 0.005, Math.max(0.12, len * 0.9), 2400); break;
      case 'kick': {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.15);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.5 * vel, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
        o.connect(g).connect(out); o.start(time); o.stop(time + 0.3);
        break;
      }
      case 'hat': case 'snare': {
        const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
        const fl = ctx.createBiquadFilter(); fl.type = kind === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'hat' ? 7000 : 1800;
        const g = ctx.createGain(); const d = kind === 'hat' ? 0.05 : 0.16;
        g.gain.setValueAtTime((kind === 'hat' ? 0.06 : 0.18) * vel, time); g.gain.exponentialRampToValueAtTime(0.0001, time + d);
        s.connect(fl).connect(g).connect(out); s.start(time, Math.random()); s.stop(time + d + 0.02);
        break;
      }
    }
  }

  _buildTracks() {
    const T = {};
    const chord = (root, q) => ({ m: [0, 3, 7], M: [0, 4, 7], d7: [0, 4, 7, 10], m6: [0, 3, 7, 9], dim: [0, 3, 6] }[q].map((x) => root + x));

    // ---- Dark waltz (messy rooms) ----
    {
      const ev = []; const spb = 6; // eighths per 3/4 bar
      const prog = [[50, 'm'], [50, 'm'], [55, 'm'], [57, 'M'], [50, 'm'], [46, 'M'], [55, 'm6'], [57, 'd7']];
      prog.forEach(([r, q], b) => {
        const s = b * spb; const c = chord(r, q);
        ev.push({ s, i: 'bass', n: r - 12, l: 2 });
        ev.push({ s: s + 2, i: 'pluck', n: c[1] + 12, l: 1, v: 0.8 }, { s: s + 2, i: 'pluck', n: c[2] + 12, l: 1, v: 0.8 });
        ev.push({ s: s + 4, i: 'pluck', n: c[1] + 12, l: 1, v: 0.7 }, { s: s + 4, i: 'pluck', n: c[2] + 12, l: 1, v: 0.7 });
      });
      const mel = [[0, 0, 69, 2], [0, 2, 74, 2], [0, 4, 77, 2], [1, 0, 76, 3], [1, 3, 74, 1], [1, 4, 73, 2],
        [2, 0, 74, 2], [2, 2, 70, 2], [2, 4, 67, 2], [3, 0, 69, 4], [3, 4, 73, 2],
        [4, 0, 77, 2], [4, 2, 76, 1], [4, 3, 77, 1], [4, 4, 81, 2], [5, 0, 74, 3], [5, 3, 70, 3],
        [6, 0, 67, 2], [6, 2, 70, 2], [6, 4, 76, 2], [7, 0, 73, 2], [7, 2, 76, 1], [7, 3, 79, 1], [7, 4, 69, 2]];
      mel.forEach(([b, st, n, l]) => ev.push({ s: b * spb + st, i: 'box', n, l, v: 0.9 }));
      T.dark = { bpm: 150, div: 2, len: 48, ev };
    }
    // ---- Title (slow, mysterious) ----
    {
      const ev = []; const spb = 6;
      const prog = [[50, 'm'], [46, 'M'], [55, 'm'], [57, 'M']];
      prog.forEach(([r, q], b) => {
        const s = b * spb * 2; const c = chord(r, q);
        c.forEach((n) => ev.push({ s, i: 'pad', n: n + 12, l: 12 }));
        ev.push({ s, i: 'bass', n: r - 12, l: 6, v: 0.6 });
        [0, 1, 2, 1, 0, 2].forEach((k, j) => ev.push({ s: s + j * 2, i: 'box', n: c[k] + 24, l: 2, v: 0.5 + (j === 0 ? 0.3 : 0) }));
      });
      T.title = { bpm: 110, div: 2, len: 48, ev };
    }
    // ---- Clean (cozy major waltz) ----
    {
      const ev = []; const spb = 6;
      const prog = [[50, 'M'], [45, 'M'], [47, 'm'], [43, 'M'], [50, 'M'], [52, 'm'], [45, 'M'], [50, 'M']];
      prog.forEach(([r, q], b) => {
        const s = b * spb; const c = chord(r, q);
        ev.push({ s, i: 'bass', n: r - 12, l: 2, v: 0.7 });
        c.forEach((n) => ev.push({ s, i: 'pad', n: n + 12, l: 6, v: 0.8 }));
        ev.push({ s: s + 2, i: 'pluck', n: c[1] + 12, v: 0.5 }, { s: s + 4, i: 'pluck', n: c[2] + 12, v: 0.5 });
      });
      const mel = [[0, 0, 66, 2], [0, 2, 69, 2], [0, 4, 74, 2], [1, 0, 73, 3], [1, 3, 76, 1], [1, 4, 74, 2],
        [2, 0, 71, 2], [2, 2, 74, 2], [2, 4, 78, 2], [3, 0, 79, 4], [3, 4, 78, 1], [3, 5, 76, 1],
        [4, 0, 78, 2], [4, 2, 81, 2], [4, 4, 78, 2], [5, 0, 79, 2], [5, 2, 76, 2], [5, 4, 71, 2],
        [6, 0, 73, 2], [6, 2, 76, 2], [6, 4, 81, 2], [7, 0, 74, 6]];
      mel.forEach(([b, st, n, l]) => ev.push({ s: b * spb + st, i: 'box', n, l, v: 0.8 }));
      T.clean = { bpm: 120, div: 2, len: 48, ev };
    }
    // ---- Boss (driving 4/4) ----
    {
      const ev = []; const bars = 4; const spb = 16;
      const roots = [38, 38, 34, 33];
      const riff = [0, 0, 3, 0, 5, 0, 6, 5];
      for (let b = 0; b < bars; b++) {
        const s0 = b * spb; const r = roots[b];
        for (let k = 0; k < 8; k++) ev.push({ s: s0 + k * 2, i: 'bass', n: r + riff[k], l: 0.2, v: 0.9 });
        for (let k = 0; k < 4; k++) ev.push({ s: s0 + k * 4, i: 'kick', v: 1 });
        ev.push({ s: s0 + 4, i: 'snare', v: 1 }, { s: s0 + 12, i: 'snare', v: 1 });
        for (let k = 0; k < 8; k++) ev.push({ s: s0 + k * 2 + 1, i: 'hat', v: 0.8 });
      }
      const lead = [[0, 74, 3], [3, 77, 3], [6, 80, 2], [8, 79, 4], [12, 77, 2], [14, 74, 2],
        [16, 74, 3], [19, 77, 3], [22, 81, 2], [24, 80, 6], [32, 70, 3], [35, 74, 3], [38, 77, 2], [40, 76, 4], [44, 74, 4],
        [48, 73, 3], [51, 76, 3], [54, 79, 2], [56, 81, 4], [60, 80, 2], [62, 79, 2]];
      lead.forEach(([s, n, l]) => ev.push({ s, i: 'lead', n, l, v: 1 }));
      T.boss = { bpm: 152, div: 4, len: 64, ev };
    }
    for (const k in T) {
      const t = T[k]; t.byStep = Array.from({ length: t.len }, () => []);
      t.ev.forEach((e) => t.byStep[e.s % t.len].push(e));
    }
    this.tracks = T;
  }

  playMusic(name) {
    if (!this.ctx) { this._pendingMusic = name; return; }
    if (this.current && this.current.name === name) return;
    const t = this.ctx.currentTime;
    if (this.current) {
      const old = this.current;
      old.gain.gain.setTargetAtTime(0.0001, t, 0.25);
      old.stopped = true;
      setTimeout(() => old.gain.disconnect(), 2000);
    }
    if (!name || !this.tracks[name]) { this.current = null; return; }
    const g = this.ctx.createGain(); g.gain.value = 0.0001; g.connect(this.musicBus);
    g.gain.setTargetAtTime(1, t + 0.1, 0.3);
    this.current = { name, track: this.tracks[name], gain: g, step: 0, next: t + 0.15 };
  }

  _schedule() {
    const c = this.current; if (!c || c.stopped || !this.ctx) return;
    const tr = c.track; const stepDur = 60 / tr.bpm / tr.div;
    const horizon = this.ctx.currentTime + 0.15;
    if (c.next < this.ctx.currentTime - 0.5) c.next = this.ctx.currentTime + 0.05; // tab was asleep
    while (c.next < horizon) {
      for (const e of tr.byStep[c.step]) this._inst(e.i, e.n, c.next, (e.l || 1) * stepDur, e.v || 1, c.gain);
      c.step = (c.step + 1) % tr.len;
      c.next += stepDur;
    }
  }
}
