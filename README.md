# Declutter Mansion 🏚️🧹

A spooky-cozy 3D action game in the spirit of *Luigi's Mansion*, but the ghosts are **living clutter** and your
ghost-catcher is the **Clutter-Vac 3000**. Built with three.js as an installable, offline-capable PWA.
All art, textures, music and sound effects are generated in code, so the game ships no image or audio files
apart from the app icons.

## Play

**Live:** https://sotirisfr.github.io/declutter-mansion/ (open it on your phone and use *Add to Home Screen* / *Install app*).

Run locally:

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
```

Production build (outputs `dist/`, including the service worker and web manifest):

```bash
npm run build
npm run preview    # serve dist/ locally
```

Deploy to GitHub Pages with `npm run deploy`: it builds and force-pushes `dist/` to the `gh-pages` branch,
using your GitHub CLI login. `dist/` also works on any other static host (it uses relative paths, so a
sub-folder is fine). PWAs need HTTPS (or localhost) to install and work offline.

## How to play

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | WASD / arrows | Left stick | Left thumb (anywhere on the left half) |
| Aim | Mouse | Right stick | VAC stick |
| Vacuum | Hold left click / Space | RT | Hold the VAC stick |
| Flash / SLAM | Right click / F / Shift | LT, RB or X | FLASH |
| Search / use | E | A | USE |
| Map / pause | M / Esc | Back / Start | 🗺️ / ⏸ |

1. **Flash** living clutter with the Tidy Torch to stun it. Dust bunnies are small enough to vacuum straight away.
2. **Vacuum** stunned clutter to latch on, then **pull away from the direction it runs** to drain its Mess Meter.
3. Fill the power meter and press **Flash** to **SLAM** it for big damage.
4. Clearing a room turns the lights back on, unseals its doors and drops a chest. Some chests hold keys.
5. Search furniture, vacuum curtains, dust piles and junk for treasure. Clean every dust pile in a room for a *Spotless* bonus.
6. Find your way to the attic and defeat **the Hoard King**. Your treasure total decides your rank.

### The clutter
- **Dust Bunny**: skittish and harmless. Vacuum it right up.
- **Laundry Lurker**: hides as an innocent laundry pile (listen for the rustle!), then lunges at you.
- **Paper Wraith**: floats around you throwing paper planes. You can vacuum the planes out of the air.
- **Box Brute**: armoured cardboard. It only flinches from a flash while its flaps are open: right after it roars, or when it bonks into a wall.
- **The Hoard King**: dodge his junk and shockwaves; when he tires out, his heart opens. Flash it!

## Project layout

```
src/
  main.js      entry: fonts, styles, game boot, service-worker registration
  game.js      game state, rooms, vacuum + tug-of-war, loot, doors, boss, saving
  player.js    Pip: model, movement, flashlight, suction visuals
  clutter.js   enemy types and the boss
  rooms.js     mansion layout data, room builder, static-mesh merging, collisions
  props.js     procedural furniture, keys, chest, material helpers
  textures.js  canvas-painted textures (floors, wallpaper, portraits, ...)
  audio.js     WebAudio synth: sound effects, vacuum motor, music sequencer
  input.js     keyboard/mouse, gamepad (with rumble), touch sticks
  hud.js       DOM HUD, dialog, map
  fx.js        GPU point particles and floating world labels
  title.js     moonlit mansion diorama behind the title menu
  debug.js     dev-only playtest helpers (window.T), excluded from production builds
scripts/make-icons.mjs   regenerates the PNG app icons (npm run icons)
```

Progress is saved automatically to `localStorage` (Continue on the title screen).

## Publishing as a claude.ai Artifact

`npm run build:artifact` builds a service-worker-free bundle into `dist-artifact/` and writes `artifact.html`
(page body only, since the Artifact host supplies the document shell). Publish `artifact.html` with the files in
`dist-artifact/assets/` alongside it.
