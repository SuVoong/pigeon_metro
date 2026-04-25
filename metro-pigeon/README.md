# Metro Pigeon

A pixel art browser game where you fly a pigeon through an endlessly scrolling subway tunnel. Dodge trains, pillars, hanging cables, and grumpy commuters while pecking up breadcrumbs, coins, and pizza slices.

Built with **vanilla JavaScript** and **HTML5 Canvas** — no libraries, no images, no build step. Every sprite is drawn programmatically with `fillRect`.

## Run

Just open `index.html` in any modern browser.

```
# from the metro-pigeon folder
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

No server required. If your browser blocks local files, you can serve the folder with any static server, e.g.:

```
python -m http.server 8000
# then visit http://localhost:8000
```

## Controls

| Action     | Keys                          |
| ---------- | ----------------------------- |
| Fly        | `Arrow keys` or `W A S D`     |
| Start/Retry| `Space` or `Enter`            |

## Gameplay

- The pigeon is always centered on screen — the tunnel scrolls around you.
- The world keeps scrolling left and gets faster the longer you survive.
- **Collect**: 🥖 bread (+5), 🪙 coin (+10), 🍕 pizza (+25).
- **Avoid**: trains (fast, heavy), pillars (tall), hanging cables (sparking), commuters (on the platform).
- You start with 3 lives. Hits give you a brief invulnerability and bounce you back.

## Architecture

A single file (`game.js`) wrapped in an IIFE. Major sections:

- **Canvas setup** — fixed logical resolution (320 × 200) scaled with integer pixel-perfect scaling that fits the window.
- **Input** — keyboard state map, with menu start/restart hooks.
- **Game state** — `START_SCREEN`, `PLAYING`, `GAME_OVER`.
- **Camera** — pigeon stays at the canvas center; the camera tracks the pigeon's world position. Auto-scroll is implemented by drifting the pigeon's world `x` rightward each frame, which makes everything appear to move left.
- **Background** — three parallax layers (far bricks/tunnel, mid pillars/neon signs, near rails/cables).
- **Sprites** — each entity has its own `draw*` function that paints pixels with `fillRect`.
- **Spawning** — obstacles and collectibles spawn just off the right edge and drift with the world.
- **Collisions** — AABB on bounding boxes; brief i-frames after hits.
- **HUD** — pixel-art bitmap font (3×5) for score and lives.

## Extending

Some easy additions:

- **New collectible**: add a `type` to `spawnCollectible`, write a `drawX(x, y)` function, and dispatch it from `drawCollectible`. Set `points` on the spawned object.
- **New obstacle**: same pattern. Add to the spawn picker, give it a width/height/y range, and a `drawX` function. AABB collision picks it up automatically.
- **Power-ups**: extend the collectible code path to set a state flag (e.g. `shieldTimer`) and gate the collision damage behind it. Add a HUD indicator.
- **Difficulty curve**: tune `scrollSpeed` ramp and `spawnTimer` cooldown in `update`.
- **Sound**: wire up `AudioContext` oscillators for chiptune blips on collect/hit — keeps the no-asset constraint.
- **High score**: persist the best score to `localStorage` and render it on the start/game-over screens.
- **New backgrounds**: mod `bgFar/bgMid/bgNear` or add a fourth parallax layer for foreground silhouettes.

## Pixel art notes

- Logical resolution: **320 × 200**. The canvas is drawn at this size and then scaled by an integer factor to fit the window so pixels stay crisp.
- `ctx.imageSmoothingEnabled = false` and integer scaling avoid blurry rescaling.
- All drawing uses `fillRect(x, y, w, h)` — the `px(x, y, w, h, color)` helper wraps it for readability.

Have fun! Coo coo. 🕊️
