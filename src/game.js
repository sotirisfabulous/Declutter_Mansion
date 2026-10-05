import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Particles, Labels } from './fx.js';
import { Player } from './player.js';
import { MANSION, ROOMS, Room, makeJunk } from './rooms.js';
import { spawnClutter, DustBunny, SockGremlin } from './clutter.js';
import { M, mesh, buildKey, buildChest, KEY_COLORS } from './props.js';
import { HUD } from './hud.js';
import { buildTitleScene } from './title.js';
import * as TX from './textures.js';

const SAVE_KEY = 'declutter-mansion-save-v1';
const SETTINGS_KEY = 'declutter-mansion-settings-v1';
const VALUES = { coin: 10, bill: 50, bar: 150, gem: 300 };
const KEY_NAMES = { blue: 'Blue Key', green: 'Green Key', red: 'Red Key', gold: 'Gold Key' };
const $ = (id) => document.getElementById(id);
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

// ---- shared pickup assets ----
const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16); coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf4a', metalness: 0.8, roughness: 0.25, emissive: '#7a4a00', emissiveIntensity: 0.4 });
const billGeo = new THREE.BoxGeometry(0.42, 0.03, 0.22);
const billMat = new THREE.MeshStandardMaterial({ color: '#5ac86a', roughness: 0.7, emissive: '#1a5a2a', emissiveIntensity: 0.4 });
const barGeo = new THREE.BoxGeometry(0.42, 0.16, 0.2);
const gemGeo = new THREE.OctahedronGeometry(0.2, 0);
const gemMat = new THREE.MeshStandardMaterial({ color: '#7af0ff', metalness: 0.2, roughness: 0.1, emissive: '#30b0e0', emissiveIntensity: 1.2 });
const heartGeo = (() => {
  const s = new THREE.Shape(); s.moveTo(0, -0.18); s.bezierCurveTo(-0.3, 0.02, -0.18, 0.24, 0, 0.1); s.bezierCurveTo(0.18, 0.24, 0.3, 0.02, 0, -0.18);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }); g.center(); return g;
})();
const heartMat = new THREE.MeshStandardMaterial({ color: '#ff5a7a', emissive: '#ff2050', emissiveIntensity: 0.6, roughness: 0.3 });

export class Game {
  constructor() {
    this.canvas = $('gl');
    this.settings = Object.assign({ music: 0.5, sfx: 0.8, quality: !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent), touch: matchMedia('(pointer: coarse)').matches }, this._load(SETTINGS_KEY) || {});
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    TX.setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07020f');
    this.scene.fog = new THREE.Fog('#120a22', 16, 42);
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    this.camPos = new THREE.Vector3(0, 12, 10); this.camLook = new THREE.Vector3();

    // constant light rig (keeps shader programs stable)
    this.hemi = new THREE.HemisphereLight('#6a6ab0', '#1a1020', 0.6);
    this.moon = new THREE.DirectionalLight('#8aa0ff', 0.6); this.moon.position.set(-4, 10, -6);
    this.roomLight = new THREE.PointLight('#ffd9a0', 0, 0, 1.15); this.roomLight.position.set(0, 3.4, 0);
    this.scene.add(this.hemi, this.moon, this.roomLight);

    this.audio = new AudioEngine();
    this.audio.setVolumes(this.settings.music, this.settings.sfx);
    this.input = new Input();
    this.hud = new HUD(this);
    this.labels = new Labels(this.camera);
    this.fxAdd = new Particles(this.scene, 1600, true);
    this.fxNorm = new Particles(this.scene, 1200, false);
    this.player = new Player(this); this.player.addTo(this.scene);
    this.player.root.visible = false;

    this.title = buildTitleScene(); this.scene.add(this.title.group);
    this.rooms = {}; this.room = null;
    this.enemies = []; this.pickups = []; this.projectiles = []; this.waves = []; this.chests = []; this.timers = [];
    this.state = 'title'; this.cutscene = false; this.t = 0; this.hitstop = 0; this.shakeAmt = 0; this.flashBoost = 0;
    this.mouseGround = new THREE.Vector3(); this.raycaster = new THREE.Raycaster(); this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
    this.save = this._load(SAVE_KEY);
    this.tipsSeen = new Set();
    this._buildTether();
    this._bindUI();
    this.applyQuality();
    addEventListener('resize', () => this.resize()); this.resize();
    this.clock = new THREE.Clock();
    this.showTitle();
    this.renderer.setAnimationLoop(() => this.loop());
  }

  // ------------------------------------------------------------------ setup
  _load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
  _store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  applyQuality() {
    const q = this.settings.quality;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q ? 2 : 1.25));
    this.player.spot.castShadow = q;
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const s = (h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.fxAdd.setScale(s); this.fxNorm.setScale(s);
  }

  _buildTether() {
    this.tetherMat = new THREE.MeshBasicMaterial({ color: '#7affe0', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tether = new THREE.Mesh(new THREE.BufferGeometry(), this.tetherMat);
    this.tether.visible = false; this.tether.frustumCulled = false; this.scene.add(this.tether);
    this.tetherCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  }

  _bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); this.audio.init(); this.audio.play('ui'); fn(); });
    click('btn-new', () => {
      // two-tap confirmation built into the button (native confirm() is unavailable in some embeds)
      const btn = $('btn-new');
      if (this.save && !this.save.done && !btn.dataset.armed) {
        btn.dataset.armed = '1'; btn.textContent = 'Tap again to start over';
        clearTimeout(this._armT); this._armT = setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'New Game'; }, 3000);
        return;
      }
      delete btn.dataset.armed; btn.textContent = 'New Game';
      this.newGame();
    });
    click('btn-continue', () => this.continueGame());
    click('btn-howto', () => this.openHowTo('title'));
    click('btn-howto2', () => this.openHowTo('pause'));
    click('howto-close', () => this.closeHowTo());
    click('btn-resume', () => this.resume());
    click('btn-quit', () => { this.persist(); $('pause').classList.add('hidden'); this.showTitle(); });
    click('btn-retry', () => this.retry());
    click('btn-again', () => { this.save = null; this._store(SAVE_KEY, null); this.newGame(); });
    click('btn-pause', () => this.pause());
    click('btn-map', () => this.openMap());
    click('map-close', () => this.closeMap());
    $('dialog').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.hud.advanceDialog(); });
    const vm = $('vol-music'), vs = $('vol-sfx'), oq = $('opt-quality'), ot = $('opt-touch');
    vm.value = this.settings.music; vs.value = this.settings.sfx; oq.checked = this.settings.quality; ot.checked = this.settings.touch;
    vm.oninput = () => { this.settings.music = +vm.value; this.audio.setVolumes(this.settings.music, this.settings.sfx); this._store(SETTINGS_KEY, this.settings); };
    vs.oninput = () => { this.settings.sfx = +vs.value; this.audio.setVolumes(this.settings.music, this.settings.sfx); this._store(SETTINGS_KEY, this.settings); this.audio.play('coin'); };
    oq.onchange = () => { this.settings.quality = oq.checked; this.applyQuality(); this._store(SETTINGS_KEY, this.settings); };
    ot.onchange = () => { this.settings.touch = ot.checked; this.input.setTouch(ot.checked); this._store(SETTINGS_KEY, this.settings); };
    this.input.setTouch(this.settings.touch);
    // first interaction unlocks audio
    const unlock = () => { this.audio.init(); };
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'click']) addEventListener(ev, unlock);
    this.input.onAny(() => this.audio.init());
    this.input.onAny((src) => { if (src === 'touch' && !this.settings.touch) { this.settings.touch = true; ot.checked = true; this.input.setTouch(true); } });
    // PWA install
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.installPrompt = e; $('btn-install').classList.remove('hidden'); });
    click('btn-install', async () => { if (!this.installPrompt) return; this.installPrompt.prompt(); await this.installPrompt.userChoice; this.installPrompt = null; $('btn-install').classList.add('hidden'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
  }

  // ------------------------------------------------------------------ screens
  showTitle() {
    this.state = 'title';
    this.leaveRoom();
    this.title.group.visible = true; this.player.root.visible = false;
    this.hud.show(false); this.input.showTouchUI(false);
    ['pause', 'gameover', 'ending', 'map', 'howto'].forEach((s) => $(s).classList.add('hidden'));
    $('title').classList.remove('hidden');
    $('btn-continue').classList.toggle('hidden', !(this.save && !this.save.done));
    if (this.input.device === 'pad') ($('btn-continue').classList.contains('hidden') ? $('btn-new') : $('btn-continue')).focus();
    this.hemi.color.set('#6a7ac8'); this.hemi.groundColor.set('#241830'); this.hemi.intensity = 1.3;
    this.moon.intensity = 1.6; this.moon.color.set('#9ab0ff'); this.roomLight.intensity = 0;
    this.scene.fog.color.set('#120a22'); this.scene.fog.near = 25; this.scene.fog.far = 70;
    this.player.spot.intensity = 0; this.player.vacLight.intensity = 0;
    this.audio.setVacuum(false);
    this.audio.playMusic('title');
    this.hud.bossBar(false);
  }

  openHowTo(from) { this.howtoFrom = from; $('howto').classList.remove('hidden'); if (from === 'pause') $('pause').classList.add('hidden'); }
  closeHowTo() { $('howto').classList.add('hidden'); if (this.howtoFrom === 'pause') $('pause').classList.remove('hidden'); }

  freshSave() {
    return { v: 1, room: 'foyer', from: null, money: 0, hp: 100, keys: [], unlocked: [], cleared: [], visited: [], captured: {}, searched: {}, curtains: {}, spotless: [], tips: [], time: 0, stats: { captured: 0, slams: 0, flashes: 0, hurt: 0 }, done: false };
  }

  resetRooms() {
    this.leaveRoom();
    for (const r of Object.values(this.rooms)) {
      r.group.removeFromParent();
      r.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    this.rooms = {};
  }

  newGame() {
    this.save = this.freshSave();
    this.resetRooms();
    this.startPlaying();
    this.enterRoom('foyer', null);
    this.state = 'dialog';
    const n = (a) => this.input.name(a);
    setTimeout(() => this.hud.dialog([
      'Pip! Thank goodness you came. Your great-aunt Marge left you this mansion... along with fifty years of junk that has come <b>ALIVE</b>!',
      'I\'m Professor Tidwell, clutter-ologist. Take my greatest invention: the <b>Clutter-Vac 3000</b>!',
      `Dust bunnies are harmless. Hold ${n('vac')} near them to suck them right up. Move with ${n('move')} and aim with ${n('aim')}.`,
      `Bigger clutter must be stunned with the Tidy Torch first: press ${n('flash')} to <b>flash</b> it! Then vacuum while it's dazed.`,
      'Once you latch on, <b>pull AWAY</b> from where it runs to drain its Mess Meter. Fill the power meter and flash again to <b>SLAM</b> it!',
      'Clean each room to turn the lights on and find the keys. The source of all this mess is somewhere upstairs... Good luck, Pip!',
    ], () => { this.state = 'play'; this.tip('dust', `Vacuum up the dust bunnies! Hold ${n('vac')}.`, 7); }), 700);
  }

  continueGame() {
    if (!this.save) return this.newGame();
    this.tipsSeen = new Set(this.save.tips || []);
    this.resetRooms();
    this.startPlaying();
    this.enterRoom(this.save.room, this.save.from);
  }

  startPlaying() {
    ['title', 'ending', 'gameover', 'pause', 'map', 'howto'].forEach((id) => $(id).classList.add('hidden'));
    this.title.group.visible = false;
    this.player.root.visible = true;
    this.player.hp = this.save.hp || 100;
    this.tipsSeen = new Set(this.save.tips || []);
    this.hud.show(true); this.input.showTouchUI(true);
    this.hud.setHP(this.player.hp, this.player.maxHp); this.hud.setMoney(this.save.money, false); this.hud.setKeys(this.save.keys);
    this.state = 'play';
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused'; this.audio.setVacuum(false);
    $('pause').classList.remove('hidden'); this.input.showTouchUI(false);
  }
  resume() {
    if (this.state !== 'paused') return;
    $('pause').classList.add('hidden'); this.state = 'play'; this.input.showTouchUI(true); this.input.clearEdges();
  }
  openMap() {
    if (this.state !== 'play') return;
    this.state = 'map'; this.audio.setVacuum(false);
    this.hud.renderMap(this.save, this.room.def.id); $('map').classList.remove('hidden'); this.input.showTouchUI(false);
  }
  closeMap() { if (this.state !== 'map') return; $('map').classList.add('hidden'); this.state = 'play'; this.input.showTouchUI(true); this.input.clearEdges(); }

  persist() {
    if (!this.save || !this.room) return;
    this.save.hp = Math.max(30, this.player.hp);
    this.save.tips = [...this.tipsSeen];
    this._store(SAVE_KEY, this.save);
  }

  tip(id, html, dur) { if (this.tipsSeen.has(id)) return; this.tipsSeen.add(id); this.hud.tip(html, dur); }

  // controller-friendly menus: D-pad / stick moves focus, A presses
  navMenus() {
    const inp = this.input;
    const vis = ['howto', 'pause', 'gameover', 'ending', 'map', 'title'].map((id) => $(id)).find((el) => !el.classList.contains('hidden'));
    if (!vis) return;
    const btns = [...vis.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
    if (!btns.length) return;
    let i = btns.indexOf(document.activeElement);
    if (inp.take('menuDown')) { i = (i + 1) % btns.length; btns[i].focus(); this.audio.play('ui'); }
    if (inp.take('menuUp')) { i = (i - 1 + btns.length) % btns.length; btns[i].focus(); this.audio.play('ui'); }
    if (inp.take('menuA')) (btns[i] || vis.querySelector('.btn.primary') || btns[0]).click();
  }

  // ------------------------------------------------------------------ rooms
  leaveRoom() {
    this.releaseLatch(false);
    for (const e of this.enemies) e.dispose();
    for (const p of this.pickups) p.mesh.removeFromParent();
    for (const p of this.projectiles) { p.mesh.removeFromParent(); p.ring && p.ring.removeFromParent(); }
    for (const w of this.waves) w.mesh.removeFromParent();
    for (const c of this.chests) c.obj.removeFromParent();
    this.enemies = []; this.pickups = []; this.projectiles = []; this.waves = []; this.chests = []; this.timers = [];
    this.cutscene = false; this.camFocus = null; this.slamAnim = null; this.confettiT = 0;
    this.fxAdd.clear(); this.fxNorm.clear(); this.labels.clear();
    if (this.room) this.room.group.visible = false;
    this.room = null; this.boss = null;
    this.hud.hideTug(); this.hud.prompt('');
  }

  enterRoom(id, from) {
    this.leaveRoom();
    const def = ROOMS[id];
    if (!this.rooms[id]) { this.rooms[id] = new Room(def, this); this.scene.add(this.rooms[id].group); }
    const room = (this.room = this.rooms[id]);
    room.group.visible = true;
    const S = this.save;
    S.room = id; S.from = from; this.entry = { id, from };
    const cleared = S.cleared.includes(id);
    const firstVisit = !S.visited.includes(id);
    if (firstVisit) S.visited.push(id);

    // spawn uncaptured clutter
    if (!cleared) {
      const caught = S.captured[id] || [];
      def.enemies.forEach(([type, x, z], i) => {
        if (caught.includes(i)) return;
        const e = spawnClutter(this, type, x, z); e.idx = i; this.enemies.push(e);
        if (type === 'boss') this.boss = e;
      });
    }
    // restore searched furniture & curtains
    const searched = S.searched[id] || [];
    room.searchables.forEach((s) => { s.searched = searched.includes(s.idx); });
    const curt = S.curtains[id] || [];
    room.flutters.forEach((f, i) => { if (curt.includes(i)) f.loot = null; f.idx = i; f.suckT = 0; });
    // doors
    for (const d of room.doors) {
      if (d.sealObj) d.sealObj.visible = !cleared;
      if (d.lockObj) d.lockObj.visible = !S.unlocked.includes(d.lock);
      if (d.leaf) d.leaf.rotation.y = 0;
    }
    room.heaps.forEach((h) => (h.visible = !cleared));
    room.setCleanVisuals(cleared ? 1 : 0);
    this.cleanTarget = cleared ? 1 : 0; this.cleanAnim = cleared ? 1 : 0;

    // place Pip at the door we came through
    let px = 0, pz = room.hd - 1.5, yaw = Math.PI;
    const door = from ? room.doors.find((d) => d.to === from) : room.doors.find((d) => d.side === 'S');
    if (door) { px = door.x + door.nx * 1.3; pz = door.z + door.nz * 1.3; yaw = Math.atan2(door.nx, door.nz); }
    this.player.reset(px, pz, yaw);
    this.player.root.visible = true;
    this.updateLights(1);
    this.updateCamera(0, true);

    this.hud.roomName(def.name, cleared ? 'Spotless ✨' : `${this.enemies.length} clutter${this.enemies.length === 1 ? '' : 's'} lurking`);
    this.hud.bossBar(false);
    if (def.boss && !cleared) {
      this.audio.playMusic(null);
      this.after(0.9, () => this.bossIntro());
    } else this.audio.playMusic(cleared ? 'clean' : 'dark');
    if (firstVisit && def.hint && !cleared) this.after(1.5, () => this.hud.tip(def.hint, 6));
    this.persist();
  }

  goThrough(door) {
    if (this.state !== 'play') return;
    this.state = 'transition';
    this.audio.play('door'); this.audio.setVacuum(false);
    this.doorAnim = door;
    $('fade').classList.add('on');
    setTimeout(() => {
      const from = this.room.def.id;
      this.enterRoom(door.to, from);
      setTimeout(() => { $('fade').classList.remove('on'); this.state = 'play'; this.input.clearEdges(); }, 80);
    }, 360);
  }

  // ------------------------------------------------------------------ main loop
  loop() {
    let dt = Math.min(0.05, this.clock.getDelta());
    this.input.update();
    const inp = this.input;

    if (inp.take('pause')) {
      if (this.state === 'play') this.pause();
      else if (this.state === 'paused') this.resume();
      else if (this.state === 'map') this.closeMap();
    }
    if (inp.take('map')) { if (this.state === 'play') this.openMap(); else if (this.state === 'map') this.closeMap(); }
    if (inp.take('back')) { if (this.state === 'paused') this.resume(); else if (this.state === 'map') this.closeMap(); }

    if (this.state === 'title') {
      this.t += dt;
      this.title.update(this.t);
      const a = this.t * 0.08;
      this.camera.position.set(Math.sin(a) * 22, 6.5 + Math.sin(this.t * 0.2), Math.cos(a) * 22);
      this.camera.lookAt(0, 4.5, 0);
      if (inp.take('confirm')) { /* menu buttons handle it */ }
    } else {
      if (this.state === 'dialog' && this.hud.dialogOpen() && inp.take('confirm')) this.hud.advanceDialog();
      const live = this.state === 'play' || this.state === 'transition' || this.state === 'dialog' || this.state === 'ending';
      if (live) {
        let wdt = dt;
        if (this.hitstop > 0) { this.hitstop -= dt; wdt = dt * 0.08; }
        if (this.state === 'dialog') wdt = dt;
        this.updateWorld(wdt, dt);
        if (this.save && this.state === 'play') this.save.time += dt;
      }
    }
    this.navMenus();
    this.hud.update(dt);
    this.labels.update(dt);
    this.renderer.render(this.scene, this.camera);
    inp.clearEdges();
  }

  updateWorld(dt, realDt) {
    this.t += dt;
    const P = this.player, room = this.room;
    if (!room) return;
    this.runTimers(dt);
    // mouse aim point
    this.raycaster.setFromCamera(this.input.mouseNDC, this.camera);
    this.raycaster.ray.intersectPlane(this.aimPlane, this.mouseGround);

    P.update(dt, this.t);
    if (this.state === 'play' && !this.cutscene) {
      if (this.input.take('flash')) this.doFlash();
      this.updateVacuum(dt);
      this.updateInteract();
      this.checkDoors();
    } else { P.vacuuming = false; this.audio.setVacuum(false); this.tether.visible = false; }

    if (this.state !== 'dialog') for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.separate();
    this.updateProjectiles(dt);
    this.updateWaves(dt);
    this.updatePickups(dt);
    this.updateChests(dt);
    this.updateJunk(dt);
    room.update(this.t, dt);
    this.updateClean(dt);
    this.updateLights(dt);
    this.updateCamera(realDt, false);
    this.fxAdd.update(dt); this.fxNorm.update(dt);

    // footsteps
    const sp = Math.hypot(P.vel.x, P.vel.z);
    if (sp > 1) { this.stepT = (this.stepT || 0) - dt * sp; if (this.stepT <= 0) { this.stepT = 1.5; this.audio.play('step'); if (!room.cleanLevel || room.cleanLevel < 0.5) this.fxNorm.emit({ x: P.pos.x, y: 0.05, z: P.pos.z, vy: 0.3, color: '#8a8078', size: 0.25, size2: 0.5, life: 0.5, alpha: 0.35 }); } }
    // dust motes drifting in the flashlight beam
    if (Math.random() < dt * 25 && this.state === 'play') {
      const d = rand(1.5, 6), s = rand(-0.4, 0.4);
      const ax = P.aim.x, az = P.aim.z;
      this.fxAdd.emit({ x: P.pos.x + ax * d - az * s * d * 0.5, y: rand(0.3, 1.6), z: P.pos.z + az * d + ax * s * d * 0.5, vx: rand(-0.1, 0.1), vy: rand(-0.05, 0.08), vz: rand(-0.1, 0.1), color: '#fff3c8', size: 0.05, life: rand(1, 2), alpha: room.cleanLevel > 0.5 ? 0.25 : 0.6 });
    }
    // HUD
    this.hud.flashCooldown(1 - P.flashCd / 0.9);
    const low = P.hp > 0 && P.hp <= 30 && this.state === 'play';
    document.querySelector('.hp-heart').classList.toggle('low', low);
    if (low) { this.beatT = (this.beatT || 0) - dt; if (this.beatT <= 0) { this.beatT = 0.9; this.audio.play('heartbeat'); } }
    if (this.boss && this.boss.active) this.hud.bossBar(this.boss.state !== 'dormant', this.boss.hp / this.boss.maxHp);
    // death
    if (P.hp <= 0 && this.state === 'play') this.gameOver();
  }

  // ------------------------------------------------------------------ vacuum + tug-of-war
  inCone(x, z, range, cosHalf) {
    const P = this.player; const tip = P.tipWorld(V1);
    const dx = x - tip.x, dz = z - tip.z, d = Math.hypot(dx, dz);
    if (d > range) return null;
    if (d < 0.5) return d;
    return (dx * P.aim.x + dz * P.aim.z) / d >= cosHalf ? d : null;
  }

  updateVacuum(dt) {
    const P = this.player, inp = this.input, room = this.room;
    const want = inp.vacuum;
    P.vacuuming = want;
    const tension = P.latched ? P.latched.tension : 0;
    this.audio.setVacuum(want, P.latched ? 0.6 + tension * 0.4 : 0);
    if (!want) { if (P.latched) this.releaseLatch(true); this.tether.visible = false; this.hud.prompt(this.promptBase || ''); return; }
    const tip = P.tipWorld(V2).clone();

    // suction streak particles
    for (let i = 0; i < 2; i++) {
      const d = rand(1.5, 3.8), sp = rand(-0.7, 0.7);
      const x = tip.x + P.aim.x * d - P.aim.z * sp * d * 0.5, z = tip.z + P.aim.z * d + P.aim.x * sp * d * 0.5, y = tip.y + rand(-0.6, 0.6) * d * 0.4;
      const life = 0.35;
      this.fxAdd.emit({ x, y, z, vx: (tip.x - x) / life, vy: (tip.y - y) / life, vz: (tip.z - z) / life, color: '#b8fff0', size: 0.07, size2: 0.02, life, alpha: 0.7 });
    }

    if (P.latched) this.updateTug(dt, tip);
    else {
      // look for something to grab
      let best = null, bd = 1e9, ungrabbable = null;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const d = this.inCone(e.pos.x, e.pos.z, 4.4 + e.radius, 0.78);
        if (d === null || room.blocked(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) continue;
        if (e.grabbable && d < bd) { best = e; bd = d; }
        else if (!e.grabbable && e.state !== 'hidden' && e.state !== 'dormant') ungrabbable = e;
      }
      if (best) this.latch(best);
      else if (ungrabbable) {
        this.vacNoGrab = (this.vacNoGrab || 0) + dt;
        if (this.vacNoGrab > 0.8) this.tip('flashfirst', ungrabbable.kind === 'box' ? 'Box Brutes are too tough! Flash them when their <b>flaps open</b> (right after they roar, or when dizzy).' : ungrabbable.kind === 'boss' ? 'Wait until the Hoard King is <b>tired</b>, then flash his glowing heart!' : `It's too lively to vacuum! <b>Flash</b> it first with ${this.input.name('flash')}.`, 6);
      }
    }

    // pull loose things toward the nozzle
    for (const f of room.flutters) {
      const wp = f.mesh.getWorldPosition(V1);
      const d = this.inCone(wp.x, wp.z, 4.2, 0.6);
      if (d !== null) {
        if (f.wind < 0.2 && Math.random() < 0.05) this.audio.play('curtain');
        f.wind = Math.min(1, f.wind + dt * 3);
        if (f.loot) { f.suckT += dt; if (f.suckT > 1.1) { this.spawnLoot(f.loot, wp.x, wp.z, wp.y); f.loot = null; (this.save.curtains[room.def.id] ||= []).push(f.idx); this.audio.play('search'); } }
      }
    }
    for (const dp of room.dustPiles) {
      if (dp.amount <= 0) continue;
      const d = this.inCone(dp.x, dp.z, 4.3, 0.7);
      if (d === null) continue;
      dp.amount -= dt * 0.8;
      if (Math.random() < 0.6) {
        const x = dp.x + rand(-dp.r, dp.r) * 0.6, z = dp.z + rand(-dp.r, dp.r) * 0.6, life = 0.4;
        this.fxNorm.emit({ x, y: 0.1, z, vx: (tip.x - x) / life, vy: (tip.y - 0.1) / life, vz: (tip.z - z) / life, color: '#9a8f88', size: 0.15, size2: 0.05, life, alpha: 0.7 });
      }
      dp.obj.scale.setScalar(Math.max(0.01, dp.amount));
      if (dp.amount <= 0) {
        dp.obj.visible = false; this.audio.play('dust');
        this.fxAdd.burst(8, { x: dp.x, y: 0.3, z: dp.z, color: '#fff3a0', size: 0.15, speed: 2, life: 0.6, up: 1 });
        if (Math.random() < 0.35) this.spawnLoot(['c1'], dp.x, dp.z, 0.4);
        this.checkSpotless();
      }
    }
    // paper planes can be sucked out of the air
    for (const p of this.projectiles) {
      if (!p.vacuumable || p.dead) continue;
      const d = this.inCone(p.pos.x, p.pos.z, 4.2, 0.6);
      if (d === null) continue;
      const k = 16 / (d + 0.5);
      p.vel.x += (tip.x - p.pos.x) * k * dt; p.vel.y += (tip.y - p.pos.y) * k * dt; p.vel.z += (tip.z - p.pos.z) * k * dt;
      p.vel.multiplyScalar(0.92);
      if (d < 0.6) { p.dead = true; this.audio.play('paper'); this.audio.play('suckSmall'); this.labels.float('Snatched!', V1.copy(p.pos).setY(1.5), 'gold', 0.8); this.tip('planes', 'Nice! Paper planes can be vacuumed right out of the air.', 4); }
    }
  }

  latch(e) {
    const P = this.player;
    P.latched = e; P.power = 0; e.onLatched();
    this.vacNoGrab = 0; this.dmgAcc = 0; this.dmgT = 0;
    this.audio.play('latch'); this.input.rumble(0.6, 0.4, 150);
    this.hud.showTug(e);
    this.shake(0.15);
    this.tip('pull', `Latched on! Now move AWAY from where it's running to drain its <b>Mess Meter</b>.`, 6);
  }

  releaseLatch(escaped) {
    const P = this.player, e = P.latched;
    if (!e) return;
    P.latched = null; P.power = 0;
    this.tether.visible = false; this.hud.hideTug();
    if (e.active && e.state === 'latched') e.onReleased();
    if (escaped) { this.audio.play('tear'); }
  }

  updateTug(dt, tip) {
    const P = this.player, e = P.latched, inp = this.input, room = this.room;
    if (!e.active || e.state !== 'latched') { this.releaseLatch(false); return; }
    if (this.slamAnim) { this.updateSlam(dt, tip); return; }
    e.tug(dt);
    // rope constraint
    let dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, dist = Math.hypot(dx, dz);
    const rope = 3.6 + e.radius;
    if (dist > rope) {
      const ex = dist - rope, nx = dx / dist, nz = dz / dist;
      e.pos.x -= nx * ex * (1 - e.mass); e.pos.z -= nz * ex * (1 - e.mass);
      P.pos.x += nx * ex * e.mass; P.pos.z += nz * ex * e.mass;
      room.collide(e.pos, e.radius, e.flying ? -1 : 2); room.collide(P.pos, P.radius);
      dx = e.pos.x - P.pos.x; dz = e.pos.z - P.pos.z; dist = Math.hypot(dx, dz);
    }
    // pulling against its run direction
    const mv = inp.move, ml = Math.hypot(mv.x, mv.z);
    let align = 0;
    if (ml > 0.2) {
      const mx = mv.x / ml, mz = mv.z / ml;
      const vsFlee = -(mx * e.fleeDir.x + mz * e.fleeDir.z);
      const vsAway = -(mx * dx + mz * dz) / (dist || 1);
      align = Math.max(0, Math.max(vsFlee, vsAway * 0.7)) * Math.min(1, ml);
    }
    e.tension += (align - e.tension) * Math.min(1, dt * 6);
    const boss = e.kind === 'boss';
    const dps = (boss ? 2 : 2.5) + (boss ? 10 : 12) * align;
    e.hp -= dps * dt;
    this.dmgAcc += dps * dt; this.dmgT += dt;
    if (this.dmgT > 0.4 && this.dmgAcc >= 1) {
      this.labels.float(`-${Math.floor(this.dmgAcc)}`, V1.set(e.pos.x + rand(-0.3, 0.3), e.y + e.topY + 0.2, e.pos.z), 'dmg', 0.8);
      this.dmgAcc -= Math.floor(this.dmgAcc); this.dmgT = 0;
    }
    P.power = Math.min(1, P.power + align * dt * (boss ? 0.4 : 0.45));
    if (P.power >= 1) this.tip('slam', `Power full! Press ${inp.name('flash')} to <b>SLAM</b> it!`, 5);
    this.hud.updateTug(e, P.power, align);
    if (align > 0.5 && Math.random() < 0.4) this.fxAdd.burst(1, { x: e.pos.x, y: e.y + 0.6, z: e.pos.z, color: '#ffe14a', size: 0.12, speed: 3, life: 0.4 });
    this.rumbleT = (this.rumbleT || 0) - dt;
    if (this.rumbleT <= 0) { this.rumbleT = 0.12; inp.rumble(0.25 + align * 0.5, 0.3, 120); }

    // tether visual: a wobbling curved beam from nozzle to clutter
    const end = V1.set(e.pos.x, e.y + Math.min(1.2, e.topY * 0.5), e.pos.z);
    const mid = new THREE.Vector3().addVectors(tip, end).multiplyScalar(0.5);
    mid.x += Math.sin(this.t * 13) * 0.3; mid.z += Math.cos(this.t * 11) * 0.3; mid.y += 0.4;
    this.tetherCurve.v0.copy(tip); this.tetherCurve.v1.copy(mid); this.tetherCurve.v2.copy(end);
    this.tether.geometry.dispose();
    this.tether.geometry = new THREE.TubeGeometry(this.tetherCurve, 16, 0.07 + align * 0.05, 6, false);
    this.tether.visible = true;
    this.tetherMat.opacity = 0.35 + Math.sin(this.t * 30) * 0.1 + align * 0.3;
    if (Math.random() < 0.7) {
      const k = Math.random(); const p = this.tetherCurve.getPoint(k);
      this.fxAdd.emit({ x: p.x, y: p.y, z: p.z, vx: (tip.x - p.x) * 2.5, vy: (tip.y - p.y) * 2.5, vz: (tip.z - p.z) * 2.5, color: '#b8fff0', size: 0.12, size2: 0.03, life: 0.4, alpha: 0.9 });
    }

    if (e.hp <= 0) { this.captureEnemy(e); return; }
    if (e.latchT > e.maxLatch || dist > rope + 2.2) {
      this.releaseLatch(true);
      this.labels.float('It broke free!', V1.set(e.pos.x, e.y + e.topY + 0.3, e.pos.z), 'warn', 1.2);
      this.shake(0.3);
      if (e.kind === 'boss') { this.shockwave(e.pos.x, e.pos.z, e.radius, 6, 10); this.audio.play('roar'); }
      this.tip('escape', 'It broke free! Pull <b>away</b> harder and use <b>SLAM</b> to finish them faster.', 5);
    }
  }

  doFlash() {
    const P = this.player;
    if (P.flashCd > 0) return;
    if (P.latched && P.power >= 1) { this.startSlam(P.latched); return; }
    P.flashCd = 0.9; this.flashBoost = 1; this.save.stats.flashes++;
    this.audio.play('flash'); this.hud.flash(0.32);
    const tip = P.tipWorld(V2);
    this.fxAdd.burst(14, { x: tip.x, y: tip.y, z: tip.z, color: '#fff6c8', size: 0.25, speed: 4, life: 0.35 });
    let stunned = 0, immune = null;
    for (const e of this.enemies) {
      if (!e.active || e === P.latched) continue;
      const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      const inside = d < 1.8 + e.radius || (d < 8.5 + e.radius && (dx * P.aim.x + dz * P.aim.z) / d > 0.72);
      if (!inside || this.room.blocked(P.pos.x, P.pos.z, e.pos.x, e.pos.z)) continue;
      const r = e.flash();
      if (r === 'stun') {
        stunned++;
        this.fxAdd.burst(12, { x: e.pos.x, y: e.y + e.topY, z: e.pos.z, color: '#ffe14a', size: 0.18, speed: 3, life: 0.6 });
        this.labels.float('Stunned!', V1.set(e.pos.x, e.y + e.topY + 0.4, e.pos.z), 'gold', 0.9);
      } else if (r === 'immune') immune = e;
    }
    if (immune) {
      this.audio.play('flashFail');
      this.labels.float(immune.kind === 'boss' ? 'Not yet!' : 'Tink!', V1.set(immune.pos.x, immune.y + immune.topY + 0.3, immune.pos.z), 'warn', 0.9);
      if (immune.kind === 'box') this.tip('boxflaps', 'Box Brutes only flinch when their <b>flaps are open</b>: after they roar, or when they bonk into a wall!', 6);
    }
    if (stunned) this.tip('nowvac', `Stunned! Quick, <b>vacuum</b> it with ${this.input.name('vac')}!`, 5);
  }

  startSlam(e) {
    const P = this.player;
    P.power = 0; this.save.stats.slams++;
    const from = e.pos.clone();
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
    const to = e.kind === 'boss' ? e.pos.clone() : new THREE.Vector3(P.pos.x - dx * 0.75, 0, P.pos.z - dz * 0.75);
    this.room.collide(to, e.radius);
    this.slamAnim = { e, from, to, t: 0 };
    this.audio.play('whoosh');
  }

  updateSlam(dt, tip) {
    const s = this.slamAnim, e = s.e;
    s.t += dt / 0.42;
    const k = Math.min(1, s.t);
    e.pos.lerpVectors(s.from, s.to, k);
    e.y = Math.sin(k * Math.PI) * (e.kind === 'boss' ? 1.2 : 3.2);
    this.tether.visible = false;
    if (k >= 1) {
      this.slamAnim = null; e.y = 0;
      const dmg = e.kind === 'boss' ? 16 : 20;
      e.hp -= dmg;
      this.audio.play('slam'); this.shake(0.7); this.hitstop = 0.12; this.input.rumble(1, 1, 300);
      this.labels.float(`SLAM! -${dmg}`, V1.set(e.pos.x, e.topY + 0.6, e.pos.z), 'big', 1.2);
      this.fxNorm.burst(20, { x: e.pos.x, y: 0.2, z: e.pos.z, color: '#c8b89a', size: 0.5, size2: 1.1, speed: 4, life: 0.8, up: 0.2, alpha: 0.6 });
      this.fxAdd.burst(16, { x: e.pos.x, y: 0.6, z: e.pos.z, color: '#ffe14a', size: 0.2, speed: 6, life: 0.5, up: 0.6 });
      this.shockRing(e.pos.x, e.pos.z, '#fff0a0');
      if (e.hp <= 0) this.captureEnemy(e);
    }
    void tip;
  }

  captureEnemy(e) {
    const P = this.player;
    P.latched = null; P.power = 0; this.tether.visible = false; this.hud.hideTug();
    e.capDur = e.kind === 'boss' ? 1.6 : 0.5;
    e.capture();
    this.audio.play('capture'); this.hitstop = 0.06; this.input.rumble(0.8, 0.8, 250);
    if (e.kind === 'boss') this.bossDefeated(e);
  }

  onCaptured(e) {
    const tip = this.player.tipWorld(V2);
    this.fxAdd.burst(24, { x: tip.x, y: tip.y, z: tip.z, colors: ['#ffe14a', '#7affe0', '#ff8ad8', '#ffffff'], size: 0.2, speed: 5, life: 0.8, up: 0.8 });
    this.labels.float(['Gotcha!', 'Tidied!', 'Sparkly!', 'Bagged it!', 'So fresh!'][(Math.random() * 5) | 0], V1.set(tip.x, tip.y + 0.8, tip.z), 'gold', 1);
    e.dispose();
    this.save.stats.captured++;
    if (e.idx !== undefined) (this.save.captured[this.room.def.id] ||= []).push(e.idx);
    const loot = [...e.loot];
    if (this.player.hp < 45 && Math.random() < 0.5) loot.push('heart');   // a little mercy
    if (loot.length) this.spawnLoot(loot, tip.x, tip.z, tip.y + 0.3, true);
    if (e.kind === 'dust' && !this.tipsSeen.has('firstcatch')) { this.tipsSeen.add('firstcatch'); }
    if (e.kind === 'boss') return;
    const left = this.enemies.filter((x) => x.active && x !== e && !x.minion).length;
    if (left === 0 && !this.room.def.boss) this.after(0.7, () => this.roomCleared());
    else if (left > 0) this.hud.roomName(this.room.def.name, `${left} clutter${left === 1 ? '' : 's'} left`);
    this.persist();
  }

  // ------------------------------------------------------------------ room cleared!
  roomCleared() {
    const room = this.room; if (!room || this.save.cleared.includes(room.def.id)) return;
    this.save.cleared.push(room.def.id);
    this.audio.play('clear'); this.audio.playMusic(null);
    this.after(2.2, () => this.audio.playMusic('clean'));
    this.hud.banner('Room Clean!<small>The lights are back on</small>', 2.8);
    this.player.cheer();
    this.cleanTarget = 1;
    // poof the mess
    room.heaps.forEach((h, i) => this.after(0.3 + i * 0.25, () => {
      if (!h.visible) return;
      h.visible = false;
      this.fxAdd.burst(14, { x: h.position.x, y: 0.4, z: h.position.z, colors: ['#fff3a0', '#ffffff', '#ffd0f0'], size: 0.2, speed: 3, life: 0.8, up: 1 });
      this.fxNorm.burst(8, { x: h.position.x, y: 0.2, z: h.position.z, color: '#c8b89a', size: 0.5, size2: 1, speed: 1.5, life: 0.7, alpha: 0.5 });
      this.audio.play('suckSmall');
    }));
    // planks fly off the doors
    room.doors.forEach((d) => {
      if (!d.sealObj || !d.sealObj.visible) return;
      d.sealObj.visible = false;
      const wp = d.sealObj.getWorldPosition(V1);
      this.fxNorm.burst(12, { x: wp.x, y: wp.y, z: wp.z, color: '#8a6a42', size: 0.25, speed: 4, life: 0.9, gravity: 9, up: 0.8 });
      this.fxAdd.burst(10, { x: wp.x, y: wp.y, z: wp.z, color: '#c89aff', size: 0.25, speed: 3, life: 0.6 });
    });
    // reward chest
    const rw = room.def.reward || {};
    if (rw.key || rw.loot) this.after(1.2, () => this.spawnChest(rw));
    if (rw.key) this.after(1.6, () => this.tip('keyhint', 'A treasure chest appeared! Walk up to it to open it.', 4));
    this.persist();
  }

  checkSpotless() {
    const room = this.room, id = room.def.id;
    if (this.save.spotless.includes(id)) return;
    if (room.dustPiles.every((d) => d.amount <= 0)) {
      this.save.spotless.push(id);
      this.addMoney(100);
      this.labels.float('Spotless floor! +$100', V1.copy(this.player.pos).setY(2.2), 'big', 1.6);
      this.audio.play('gem');
    }
  }

  updateClean(dt) {
    if (this.cleanAnim === this.cleanTarget) return;
    this.cleanAnim = Math.min(this.cleanTarget, this.cleanAnim + dt / 2.2);
    // flicker on like old bulbs
    const k = this.cleanAnim;
    const flick = k < 0.6 ? (Math.sin(k * 80) > 0.2 ? k : k * 0.3) : k;
    this.room.setCleanVisuals(flick);
  }

  updateLights(dt) {
    const room = this.room; if (!room) return;
    const c = room.cleanLevel;
    const k = Math.min(1, dt * 6);
    const lerp = (a, b) => a + (b - a) * c;
    this.hemi.intensity += (lerp(1.25, 1.4) - this.hemi.intensity) * k;
    this.hemi.color.lerpColors(new THREE.Color('#6a6ac0'), new THREE.Color('#fff0dd'), c);
    this.hemi.groundColor.lerpColors(new THREE.Color('#2a1a38'), new THREE.Color('#6a5040'), c);
    this.moon.intensity += (lerp(0.9, 0.9) - this.moon.intensity) * k;
    this.moon.color.lerpColors(new THREE.Color('#7a90ff'), new THREE.Color('#ffe8c8'), c);
    this.roomLight.color.set(room.def.clean || '#ffd9a0');
    this.roomLight.intensity += (c * 26 - this.roomLight.intensity) * k;
    this.roomLight.position.set(0, room.H - 0.5, 0);
    this.scene.fog.color.lerpColors(new THREE.Color('#120a22'), new THREE.Color('#2a1a14'), c);
    this.scene.fog.near = 16; this.scene.fog.far = 42;
    this.flashBoost = Math.max(0, this.flashBoost - dt * 3);
    const P = this.player;
    P.spot.intensity = lerp(75, 35) + this.flashBoost * 400;
    P.beamMat.uniforms.uAlpha.value = lerp(0.09, 0.04) + this.flashBoost * 0.35;
  }

  // ------------------------------------------------------------------ interactions
  updateInteract() {
    const P = this.player, room = this.room;
    let near = null, nd = 1e9;
    for (const s of room.searchables) {
      if (s.searched) continue;
      const d = Math.hypot(P.pos.x - s.x, P.pos.z - s.z);
      if (d < s.r && d < nd) { near = s; nd = d; }
    }
    this.promptBase = near ? `${this.input.name('use')} Search` : '';
    if (!P.latched) this.hud.prompt(this.doorPrompt || this.promptBase);
    this.hud.useButton(!!near);
    if (near && this.input.take('use')) this.search(near);
    if (near) this.tip('search', `Furniture might hide treasure! Press ${this.input.name('use')} to search.`, 5);
  }

  search(s) {
    s.searched = true;
    (this.save.searched[this.room.def.id] ||= []).push(s.idx);
    this.audio.play('search');
    const o = s.obj; const base = o.position.x; let k = 0;
    const jig = () => { k++; o.position.x = base + (k % 2 ? 0.06 : -0.06) * (1 - k / 10); if (k < 10) setTimeout(jig, 40); else o.position.x = base; };
    jig();
    this.fxNorm.burst(10, { x: s.x, y: 0.8, z: s.z, color: '#9a8f88', size: 0.35, size2: 0.7, speed: 1.5, life: 0.8, alpha: 0.5 });
    const loot = s.loot.filter((l) => l !== 'bunny');
    if (loot.length) this.spawnLoot(loot, s.x, s.z, 1.0);
    else this.labels.float('Just dust...', V1.set(s.x, 1.6, s.z), '', 1);
    this.persist();
  }

  checkDoors() {
    const P = this.player, room = this.room, inp = this.input;
    this.doorPrompt = '';
    this.unlockT = Math.max(0, (this.unlockT || 0) - 1 / 60);
    for (const d of room.doors) {
      const along = d.side === 'N' || d.side === 'S' ? Math.abs(P.pos.x - d.x) : Math.abs(P.pos.z - d.z);
      const perp = d.side === 'N' ? P.pos.z + room.hd : d.side === 'S' ? room.hd - P.pos.z : d.side === 'W' ? P.pos.x + room.hw : room.hw - P.pos.x;
      if (along > 1.0 || perp > 0.85) continue;
      const push = -(inp.move.x * d.nx + inp.move.z * d.nz);
      const cleared = this.save.cleared.includes(room.def.id);
      if (d.to === null) { this.doorPrompt = 'The front door is jammed shut by junk!'; if (push > 0.3) this.audio.play('locked'); continue; }
      if (!cleared) { this.doorPrompt = 'Sealed by clutter! Clean up this room first.'; if (push > 0.3) { this.audio.play('locked'); this.rattle(d); } continue; }
      if (d.lock && !this.save.unlocked.includes(d.lock)) {
        if (this.save.keys.includes(d.lock)) { if (push > 0.3) { this.unlock(d); this.unlockT = 0.7; } else this.doorPrompt = `Push in to use the ${KEY_NAMES[d.lock]}`; }
        else { this.doorPrompt = `Locked! You need the <b style="color:${KEY_COLORS[d.lock]}">${KEY_NAMES[d.lock]}</b>.`; if (push > 0.3) { this.audio.play('locked'); this.rattle(d); } }
        continue;
      }
      if (push > 0.3 && !(this.unlockT > 0)) { if (d.leaf) d.leaf.rotation.y = -1.2; this.goThrough(d); return; }
    }
  }

  rattle(d) {
    if (!d.leaf) return;
    d.leaf.rotation.y = Math.sin(this.t * 60) * 0.03;
  }

  unlock(d) {
    this.save.keys = this.save.keys.filter((k) => k !== d.lock);
    this.save.unlocked.push(d.lock);
    this.hud.setKeys(this.save.keys);
    this.audio.play('unlock');
    const wp = d.lockObj.getWorldPosition(V1);
    this.fxAdd.burst(24, { x: wp.x, y: wp.y, z: wp.z, color: KEY_COLORS[d.lock], size: 0.2, speed: 4, life: 0.8 });
    d.lockObj.visible = false;
    this.labels.float('Unlocked!', V1.set(wp.x, wp.y + 0.6, wp.z), 'gold', 1);
    this.persist();
  }

  // ------------------------------------------------------------------ loot
  spawnLoot(list, x, z, y = 1, burst = false) {
    const items = [];
    for (const l of list) {
      if (/^c\d+$/.test(l)) for (let i = 0; i < +l.slice(1); i++) items.push('coin');
      else if (l === 'b1') items.push('bill');
      else items.push(l);
    }
    items.forEach((kind, i) => {
      let m;
      if (kind === 'coin') m = new THREE.Mesh(coinGeo, coinMat);
      else if (kind === 'bill') m = new THREE.Mesh(billGeo, billMat);
      else if (kind === 'bar') m = new THREE.Mesh(barGeo, coinMat);
      else if (kind === 'gem') m = new THREE.Mesh(gemGeo, gemMat);
      else if (kind === 'heart') m = new THREE.Mesh(heartGeo, heartMat);
      else if (KEY_COLORS[kind]) m = buildKey(kind);
      else return;
      m.castShadow = true;
      this.room.group.add(m);
      const a = rand(0, Math.PI * 2), sp = burst ? rand(2, 4) : rand(1, 2.5);
      this.pickups.push({ kind, mesh: m, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(Math.cos(a) * sp, rand(3.5, 6), Math.sin(a) * sp), delay: 0.35 + i * 0.03, t: 0, spin: rand(4, 7) });
      if (kind === 'gem') this.audio.play('gem');
    });
  }

  updatePickups(dt) {
    const P = this.player, room = this.room;
    const tip = P.tipWorld(V2);
    for (const p of this.pickups) {
      p.t += dt; p.delay -= dt;
      const isKey = !!KEY_COLORS[p.kind];
      let magnet = false;
      if (P.vacuuming && p.delay <= 0 && !isKey) {
        const d = this.inCone(p.pos.x, p.pos.z, 5.5, 0.55);
        if (d !== null) {
          magnet = true;
          const k = 30 / (d + 0.6);
          p.vel.x += (tip.x - p.pos.x) * k * dt; p.vel.y += (tip.y - p.pos.y) * k * dt; p.vel.z += (tip.z - p.pos.z) * k * dt;
          p.vel.multiplyScalar(0.9);
        }
      }
      if (isKey) {
        // keys float up and drift to Pip
        p.pos.y += (2.0 + Math.sin(p.t * 3) * 0.15 - p.pos.y) * Math.min(1, dt * 2);
        if (p.t > 1.2) { p.pos.x += (P.pos.x - p.pos.x) * Math.min(1, dt * 3); p.pos.z += (P.pos.z - p.pos.z) * Math.min(1, dt * 3); }
        p.mesh.rotation.y += dt * 3;
        if (Math.random() < 0.3) this.fxAdd.emit({ x: p.pos.x + rand(-0.2, 0.2), y: p.pos.y, z: p.pos.z + rand(-0.2, 0.2), vy: 0.5, color: KEY_COLORS[p.kind], size: 0.15, life: 0.6 });
      } else {
        if (!magnet) p.vel.y -= 16 * dt;
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.2 && !magnet) { p.pos.y = 0.2; p.vel.y = Math.abs(p.vel.y) * 0.45; p.vel.x *= 0.7; p.vel.z *= 0.7; if (p.vel.y < 0.6) p.vel.y = 0; }
        room.collide(p.pos, 0.15);
        p.mesh.rotation.y += dt * p.spin;
        if (p.kind === 'bill') p.mesh.rotation.z = Math.sin(p.t * 5) * 0.3;
      }
      p.mesh.position.copy(p.pos);
      const dP = Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z);
      const dT = p.pos.distanceTo(tip);
      if (p.delay <= 0 && (dP < 0.65 || dT < 0.45 || (isKey && p.t > 1.6 && dP < 0.9))) this.collect(p);
      // despawn fade: never (treasure should wait for you)
    }
    this.pickups = this.pickups.filter((p) => !p.got);
  }

  collect(p) {
    p.got = true; p.mesh.removeFromParent();
    const pos = V1.set(p.pos.x, 1.8, p.pos.z);
    if (p.kind === 'heart') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.hud.setHP(this.player.hp, this.player.maxHp); this.audio.play('heart');
      this.labels.float('+20 ♥', pos, 'heal', 1);
    } else if (KEY_COLORS[p.kind]) {
      this.save.keys.push(p.kind); this.hud.setKeys(this.save.keys);
      this.audio.play('unlock'); this.audio.play('chest');
      this.hud.banner(`${KEY_NAMES[p.kind]}!<small>It must open a door somewhere...</small>`, 2.6);
      this.fxAdd.burst(30, { x: p.pos.x, y: p.pos.y, z: p.pos.z, color: KEY_COLORS[p.kind], size: 0.22, speed: 4, life: 0.9 });
      this.player.cheer();
      this.persist();
    } else {
      const v = VALUES[p.kind] || 10;
      this.addMoney(v);
      this.audio.play(p.kind === 'coin' ? 'coin' : p.kind === 'gem' ? 'gem' : 'bill', { pitch: 1 + Math.random() * 0.1 });
      this.labels.float(`+$${v}`, pos, 'gold', 0.8);
      this.fxAdd.burst(4, { x: p.pos.x, y: p.pos.y, z: p.pos.z, color: p.kind === 'bill' ? '#9aff9a' : p.kind === 'gem' ? '#9af0ff' : '#ffe14a', size: 0.12, speed: 2, life: 0.4 });
    }
  }

  addMoney(v) { this.save.money += v; this.hud.setMoney(this.save.money); }

  spawnChest(rw) {
    const c = buildChest();
    const P = this.player, room = this.room;
    let x = P.pos.x + P.aim.x * 1.8, z = P.pos.z + P.aim.z * 1.8;
    const p = new THREE.Vector3(x, 0, z); room.collide(p, 0.7);
    if (room.colliders.some((k) => p.x > k.minX - 0.6 && p.x < k.maxX + 0.6 && p.z > k.minZ - 0.6 && p.z < k.maxZ + 0.6)) { const f = room.freeSpot(0.7) || { x: 0, z: 0 }; p.set(f.x, 0, f.z); }
    c.obj.position.set(p.x, 5, p.z); room.group.add(c.obj);
    this.chests.push({ ...c, pos: p, y: 5, vy: 0, open: false, openT: 0, rw });
    this.audio.play('whoosh');
  }

  updateChests(dt) {
    const P = this.player;
    for (const c of this.chests) {
      if (c.y > 0 || c.vy !== 0) {
        c.vy -= 20 * dt; c.y += c.vy * dt;
        if (c.y <= 0) { c.y = 0; if (Math.abs(c.vy) > 3) { c.vy = -c.vy * 0.35; this.audio.play('thud'); this.shake(0.2); this.fxNorm.burst(10, { x: c.pos.x, y: 0.1, z: c.pos.z, color: '#c8b89a', size: 0.4, size2: 0.8, speed: 2, life: 0.6, alpha: 0.5 }); } else c.vy = 0; }
      }
      c.obj.position.set(c.pos.x, c.y, c.pos.z);
      c.obj.rotation.y = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z) * 0.15;
      if (!c.open) {
        c.light.material.opacity = 0.25 + Math.sin(this.t * 4) * 0.1;
        if (c.y === 0 && Math.hypot(P.pos.x - c.pos.x, P.pos.z - c.pos.z) < 1.4) {
          c.open = true; this.audio.play('chest');
          const items = [...(c.rw.loot || [])]; if (c.rw.key) items.push(c.rw.key);
          this.after(0.3, () => this.spawnLoot(items, c.pos.x, c.pos.z, 0.8));
        }
      } else {
        c.openT += dt;
        c.lid.rotation.x = -Math.min(1, c.openT * 3) * 1.9;
        c.light.material.opacity = Math.max(0, 0.6 - c.openT * 0.3);
        if (c.openT < 1 && Math.random() < 0.6) this.fxAdd.emit({ x: c.pos.x + rand(-0.3, 0.3), y: 0.6, z: c.pos.z + rand(-0.2, 0.2), vy: rand(1, 3), color: '#ffe14a', size: 0.12, life: 0.8 });
      }
      // chests are solid-ish
      const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 0.01) { P.pos.x = c.pos.x + (dx / d) * 0.85; P.pos.z = c.pos.z + (dz / d) * 0.85; }
    }
  }

  updateJunk(dt) {
    const P = this.player, room = this.room;
    if (!room) return;
    const tip = P.tipWorld(V2);
    for (const j of room.junk) {
      if (!j.alive) continue;
      let pulled = false;
      if (P.vacuuming) {
        const d = this.inCone(j.x, j.z, 4.6, 0.6);
        if (d !== null) {
          pulled = true;
          const k = 22 / (d + 0.5);
          j.vx += (tip.x - j.x) * k * dt / Math.max(0.5, d); j.vz += (tip.z - j.z) * k * dt / Math.max(0.5, d);
          j.spin += dt * 12;
          if (d < 0.6) {
            j.alive = false; j.mesh.visible = false; this.audio.play('suckSmall');
            this.fxAdd.burst(5, { x: tip.x, y: tip.y, z: tip.z, color: '#b8fff0', size: 0.12, speed: 2, life: 0.4 });
            if (Math.random() < 0.25) this.spawnLoot(['c1'], tip.x, tip.z, tip.y, true);
            continue;
          }
        }
      }
      // Pip kicks junk around when walking into it
      const dx = j.x - P.pos.x, dz = j.z - P.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 0.55 && dd > 0.01) { const sp = Math.hypot(P.vel.x, P.vel.z) + 1; j.vx += (dx / dd) * sp * 0.6; j.vz += (dz / dd) * sp * 0.6; j.spin += 4; }
      j.vx *= Math.exp(-dt * (pulled ? 2 : 5)); j.vz *= Math.exp(-dt * (pulled ? 2 : 5)); j.spin *= Math.exp(-dt * 3);
      j.x += j.vx * dt; j.z += j.vz * dt;
      const p = V1.set(j.x, 0, j.z); room.collide(p, j.r); j.x = p.x; j.z = p.z;
      j.mesh.position.set(j.x, j.mesh.userData.y + (pulled ? Math.min(0.6, 0.3 / (Math.hypot(tip.x - j.x, tip.z - j.z) + 0.2)) : 0), j.z);
      j.mesh.rotation.y += j.spin * dt; if (pulled) j.mesh.rotation.x += j.spin * dt * 0.5;
    }
  }

  // ------------------------------------------------------------------ projectiles & hazards
  throwPlane(w) {
    const P = this.player;
    const g = new THREE.Group();
    const s = new THREE.Shape(); s.moveTo(0, 0.35); s.lineTo(0.22, -0.2); s.lineTo(0, -0.1); s.lineTo(-0.22, -0.2); s.closePath();
    const m = mesh(new THREE.ShapeGeometry(s), M('#ffffff', { side: THREE.DoubleSide, e: '#ffffff', ei: 0.3 }), 0, 0, 0, g);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI;
    this.room.group.add(g);
    const from = new THREE.Vector3(w.pos.x, w.y + 0.3, w.pos.z);
    const target = new THREE.Vector3(P.pos.x + P.vel.x * 0.35, 0.9, P.pos.z + P.vel.z * 0.35);
    const vel = target.sub(from).normalize().multiplyScalar(7);
    this.projectiles.push({ kind: 'plane', mesh: g, pos: from, vel, gravity: 0, dmg: 8, r: 0.35, life: 3, vacuumable: true });
    this.audio.play('throw');
  }

  throwJunk(boss) {
    const P = this.player;
    const kinds = ['box', 'barrel', 'chair'];
    const k = kinds[(Math.random() * kinds.length) | 0];
    const g = new THREE.Group();
    if (k === 'box') mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), M('#b98a55', { map: TX.cardboard(false) }), 0, 0, 0, g);
    else if (k === 'barrel') mesh(new THREE.CylinderGeometry(0.35, 0.32, 0.8, 10), M('#7a4a2a'), 0, 0, 0, g);
    else { const j = makeJunk('book'); j.scale.setScalar(2.5); g.add(j); const j2 = makeJunk('can'); j2.scale.setScalar(2.5); j2.position.y = 0.2; g.add(j2); }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.room.group.add(g);
    const from = new THREE.Vector3(boss.pos.x, 3.4, boss.pos.z);
    const tx = P.pos.x + P.vel.x * 0.6 + rand(-0.8, 0.8), tz = P.pos.z + P.vel.z * 0.6 + rand(-0.8, 0.8);
    const tp = new THREE.Vector3(tx, 0, tz); this.room.collide(tp, 0.5);
    const T = rand(1.0, 1.25), G = 14;
    const vel = new THREE.Vector3((tp.x - from.x) / T, (0.4 - from.y) / T + 0.5 * G * T, (tp.z - from.z) / T);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0.6, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(tp.x, 0.03, tp.z); this.room.group.add(ring);
    this.projectiles.push({ kind: 'junk', mesh: g, pos: from, vel, gravity: G, dmg: 12, r: 1.25, life: T + 0.5, ring, T, t: 0, spinV: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)) });
    this.audio.play('throw');
  }

  updateProjectiles(dt) {
    const P = this.player;
    for (const p of this.projectiles) {
      p.life -= dt; p.t = (p.t || 0) + dt;
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (p.kind === 'plane') {
        p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z); p.mesh.rotation.z = Math.sin(p.t * 10) * 0.3;
        if (Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r + P.radius && !p.dead) { if (P.hurt(p.dmg, p.pos.x - p.vel.x, p.pos.z - p.vel.z)) p.dead = true; }
        const hw = this.room.hw, hd = this.room.hd;
        if (Math.abs(p.pos.x) > hw || Math.abs(p.pos.z) > hd) p.dead = true;
      } else {
        p.mesh.rotation.x += p.spinV.x * dt; p.mesh.rotation.y += p.spinV.y * dt;
        const k = Math.min(1, p.t / p.T);
        p.ring.scale.setScalar(1.3 - k * 0.3); p.ring.material.opacity = 0.3 + k * 0.5 + Math.sin(p.t * 20) * 0.1;
        if (p.pos.y <= 0.4 && p.vel.y < 0) {
          p.dead = true;
          this.audio.play('thud'); this.shake(0.3);
          this.fxNorm.burst(16, { x: p.pos.x, y: 0.2, z: p.pos.z, color: '#c8b89a', size: 0.5, size2: 1, speed: 3.5, life: 0.7, up: 0.3, alpha: 0.6 });
          this.fxNorm.burst(8, { x: p.pos.x, y: 0.4, z: p.pos.z, colors: ['#b98a55', '#7a4a2a', '#e8e0d0'], size: 0.2, speed: 5, life: 0.9, gravity: 12, up: 1 });
          if (Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r + 0.2) P.hurt(p.dmg, p.pos.x, p.pos.z);
          if (Math.random() < 0.3) this.spawnLoot(['c1'], p.pos.x, p.pos.z, 0.5);
        }
      }
      if (p.life <= 0) p.dead = true;
      if (p.dead) { p.mesh.removeFromParent(); p.ring && p.ring.removeFromParent(); }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  shockwave(x, z, r0, rMax, dmg) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); this.room.group.add(m);
    this.waves.push({ mesh: m, x, z, r: r0, rMax, dmg, speed: 6.5, hit: false });
  }
  shockRing(x, z, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); this.room.group.add(m);
    this.waves.push({ mesh: m, x, z, r: 0.3, rMax: 2.5, dmg: 0, speed: 8, hit: true });
  }
  updateWaves(dt) {
    const P = this.player;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      w.mesh.scale.setScalar(w.r);
      w.mesh.material.opacity = 0.85 * (1 - w.r / w.rMax);
      if (!w.hit && w.dmg) {
        const d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
        if (Math.abs(d - w.r) < 0.45) { w.hit = true; P.hurt(w.dmg, w.x, w.z); }
      }
      if (w.r >= w.rMax) { w.done = true; w.mesh.removeFromParent(); }
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  separate() {
    const P = this.player, es = this.enemies, room = this.room;
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (!a.active) continue;
      // Pip can't walk through solid clutter
      if (!a.flying && a.state !== 'hidden' && a !== P.latched) {
        const dx = P.pos.x - a.pos.x, dz = P.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.radius + P.radius * 0.8;
        if (d < m && d > 0.001) { P.pos.x = a.pos.x + (dx / d) * m; P.pos.z = a.pos.z + (dz / d) * m; room.collide(P.pos, P.radius); }
      }
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (!b.active || a.flying !== b.flying) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = a.radius + b.radius;
        if (d < m && d > 0.001) {
          const push = (m - d) / 2, nx = dx / d, nz = dz / d;
          const wa = a.kind === 'boss' || a.state === 'latched' ? 0 : 1, wb = b.kind === 'boss' || b.state === 'latched' ? 0 : 1;
          const tot = wa + wb || 1;
          a.pos.x -= nx * push * 2 * wa / tot; a.pos.z -= nz * push * 2 * wa / tot;
          b.pos.x += nx * push * 2 * wb / tot; b.pos.z += nz * push * 2 * wb / tot;
        }
      }
    }
  }

  // ------------------------------------------------------------------ boss
  bossIntro() {
    const b = this.boss; if (!b || this.room.def.id !== 'attic') return;
    this.cutscene = true; this.audio.setVacuum(false);
    this.camFocus = b.pos;
    b.setState('intro');
    this.audio.play('roar'); this.shake(0.8);
    this.hud.banner('The Hoard King<small>Lord of the Unsorted</small>', 3);
    this.audio.playMusic('boss');
    this.after(0.9, () => this.shake(0.6));
    this.after(2.9, () => {
      this.cutscene = false; this.camFocus = null;
      this.hud.tip(`Dodge the junk! When he gets <b>tired</b>, his heart opens: <b>flash</b> it, then vacuum!`, 7);
    });
  }

  summonMinions(b) {
    const n = b.phase2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const x = b.pos.x + Math.cos(a) * (b.radius + 1.2), z = b.pos.z + Math.sin(a) * (b.radius + 1.2) + 1;
      const e = i === 2 ? new SockGremlin(this, x, z) : new DustBunny(this, x, z);
      if (i === 2) e.setState('chase');
      e.minion = true; e.loot = ['c1'];
      this.room.collide(e.pos, e.radius);
      this.enemies.push(e);
      this.fxNorm.burst(12, { x: e.pos.x, y: 0.3, z: e.pos.z, color: '#9a8f88', size: 0.4, size2: 0.8, speed: 2, life: 0.6, alpha: 0.6 });
    }
  }

  bossDefeated() {
    this.cutscene = true;
    this.state = 'ending';
    this.audio.playMusic(null); this.audio.setVacuum(false);
    this.hud.bossBar(false);
    // remaining minions get swept up too
    for (const e of this.enemies) if (e.active && e.kind !== 'boss') { e.capDur = 0.7; e.capture(); }
    this.after(1.7, () => {
      this.audio.play('victory'); this.hud.flash(0.9); this.shake(0.5);
      this.cleanTarget = 1; this.hud.banner('Spotless!<small>The mansion is clutter-free</small>', 3.5);
      this.player.cheer();
      if (!this.save.cleared.includes('attic')) this.save.cleared.push('attic');
      this.addMoney(1000);
      this.spawnLoot(['gem', 'bar', 'bar', 'c5'], this.player.pos.x, this.player.pos.z - 1.5, 2, true);
      this.confettiT = 4;
    });
    this.after(6.5, () => this.showEnding());
  }

  showEnding() {
    const S = this.save; S.done = true; this.persist();
    const m = Math.floor(S.time / 60), s = Math.floor(S.time % 60);
    const rank = S.money >= 5400 ? 'S' : S.money >= 4500 ? 'A' : S.money >= 3600 ? 'B' : S.money >= 2600 ? 'C' : 'D';
    $('stats').innerHTML = `<div>Treasure <b>$${S.money.toLocaleString()}</b></div><div>Time <b>${m}:${String(s).padStart(2, '0')}</b></div>
      <div>Clutter caught <b>${S.stats.captured}</b></div><div>Slams <b>${S.stats.slams}</b></div>
      <div>Spotless floors <b>${S.spotless.length}/7</b></div><div>Times hurt <b>${S.stats.hurt}</b></div>`;
    $('rank').textContent = rank;
    $('ending').classList.remove('hidden');
    this.hud.show(false); this.input.showTouchUI(false);
    this.audio.playMusic('clean');
  }

  gameOver() {
    this.state = 'dead';
    this.releaseLatch(false); this.audio.setVacuum(false);
    this.audio.playMusic(null); this.audio.play('gameover');
    this.input.showTouchUI(false);
    setTimeout(() => $('gameover').classList.remove('hidden'), 900);
  }

  retry() {
    $('gameover').classList.add('hidden');
    this.player.hp = this.player.maxHp; this.hud.setHP(this.player.hp, this.player.maxHp);
    this.state = 'play'; this.input.showTouchUI(true);
    this.enterRoom(this.entry.id, this.entry.from);
  }

  onPlayerHurt(amount) {
    this.audio.play('hurt'); this.hud.hurt(); this.shake(0.35); this.input.rumble(0.8, 0.5, 200);
    this.hud.setHP(this.player.hp, this.player.maxHp);
    this.labels.float(`-${amount}`, V1.copy(this.player.pos).setY(2), 'warn', 0.9);
    this.save.stats.hurt++;
    if (this.player.latched && this.player.latched.kind !== 'boss') this.releaseLatch(true);
    if (this.player.hp > 0 && this.player.hp <= 30) this.tip('lowhp', 'Low health! Search furniture for <b>hearts</b>.', 5);
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // game-time timers (pause with the game, cleared when leaving a room)
  after(sec, fn) { this.timers.push({ t: sec, fn }); }
  runTimers(dt) {
    if (!this.timers.length) return;
    for (const tm of this.timers) tm.t -= dt;
    const due = this.timers.filter((tm) => tm.t <= 0);
    this.timers = this.timers.filter((tm) => tm.t > 0);
    for (const tm of due) tm.fn();
  }

  updateCamera(dt, snap) {
    const P = this.player, room = this.room; if (!room) return;
    const aspect = innerWidth / innerHeight;
    const f = THREE.MathUtils.clamp(1.45 / aspect, 0.95, 1.9);
    let tx = P.pos.x + P.aim.x * 0.8, tz = P.pos.z + P.aim.z * 0.6;
    // frame both Pip and whatever Pip is fighting
    const focus = this.camFocus || (P.latched ? P.latched.pos : null) || (this.boss && this.boss.active && this.boss.state !== 'dormant' ? this.boss.pos : null);
    if (focus) { const k = this.camFocus ? 0.5 : 0.35; tx = P.pos.x + (focus.x - P.pos.x) * k; tz = P.pos.z + (focus.z - P.pos.z) * k; }
    const mx = Math.max(0, room.hw - 6.5 * Math.min(1.4, aspect / 1.4)), mz = Math.max(0, room.hd - 4);
    tx = THREE.MathUtils.clamp(tx, -mx, mx); tz = THREE.MathUtils.clamp(tz, -mz, mz + 0.6);
    const zoom = P.latched ? 0.9 : 1;
    const desired = V1.set(tx, 9.6 * f * zoom, tz + 7.4 * f * zoom);
    const look = V2.set(tx, 0.4, tz - 0.4);
    const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.camPos.lerp(desired, k); this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    }
    this.camera.lookAt(this.camLook);
    if (this.confettiT > 0) {
      this.confettiT -= dt;
      for (let i = 0; i < 4; i++) this.fxNorm.emit({ x: this.camLook.x + rand(-8, 8), y: 6, z: this.camLook.z + rand(-5, 4), vx: rand(-0.5, 0.5), vy: rand(-2, -1), vz: rand(-0.5, 0.5), color: ['#ffcf4a', '#ff6b8a', '#4fe3c1', '#c79bff', '#ffffff'][(Math.random() * 5) | 0], size: 0.18, life: 3, drag: 0.2 });
    }
  }
}
