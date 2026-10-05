// Dev-only playtest helpers (not included in production builds).
const g = window.__game;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.T = {
  async start(room = null) {
    localStorage.clear(); g.save = null; g.newGame(); await sleep(900);
    while (g.hud.dialogOpen()) { g.hud.advanceDialog(); await sleep(20); }
    if (room) {
      const order = ['foyer', 'parlor', 'kitchen', 'gallery', 'library', 'nursery', 'attic'];
      for (const r of order) { if (r === room) break; g.save.cleared.push(r); g.save.visited.push(r); }
      const keys = { gallery: ['blue'], library: ['blue', 'green'], nursery: ['blue', 'green', 'red'], attic: ['blue', 'green', 'red', 'gold'] }[room] || [];
      g.save.unlocked.push(...keys);
      g.enterRoom(room, null);
    }
    return g.state;
  },
  view(px, py, pz, lx, ly, lz) {
    g.state = 'paused'; document.getElementById('hud').classList.add('hidden');
    g.camera.position.set(px, py, pz); g.camera.lookAt(lx, ly, lz);
  },
  resume() { document.getElementById('hud').classList.remove('hidden'); g.state = 'play'; },
  // simulate holding inputs for a while
  async hold({ move = [0, 0], vac = false, aim = null, ms = 500 }) {
    const inp = g.input;
    const orig = inp.update.bind(inp);
    inp.update = () => { orig(); inp.move.x = move[0]; inp.move.z = move[1]; if (aim) inp.aimStick = { x: aim[0], z: aim[1] }; };
    inp.vacKey = vac;
    await sleep(ms);
    inp.update = orig; inp.vacKey = false;
  },
  // advance the game synchronously with a fixed timestep; ctl(i) may set inputs each frame
  step(seconds, ctl = null) {
    const inp = g.input; const origU = inp.update.bind(inp); const origD = g.clock.getDelta.bind(g.clock);
    g.clock.getDelta = () => 1 / 60;
    let i = 0;
    inp.update = () => { origU(); if (ctl) ctl(i, inp); };
    try { for (; i < seconds * 60; i++) g.loop(); } finally { inp.update = origU; g.clock.getDelta = origD; inp.vacKey = false; }
  },
  enemies() { return g.enemies.map((e) => `${e.kind}:${e.state} hp=${e.hp.toFixed(1)} @${e.pos.x.toFixed(1)},${e.pos.z.toFixed(1)}`); },
  p() { const P = g.player; return `pip @${P.pos.x.toFixed(1)},${P.pos.z.toFixed(1)} hp=${P.hp} latched=${P.latched ? P.latched.kind : '-'} power=${P.power.toFixed(2)}`; },
};
