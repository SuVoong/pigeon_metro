// Metro Pigeon - pixel art canvas game
// All graphics drawn with fillRect. No external assets.

(() => {
  'use strict';

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Logical pixel size — game renders at this size and is scaled up
  const VIEW_W = 320;
  const VIEW_H = 200;

  function resize() {
    // Fit canvas backing store to window with integer scale
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.max(1, Math.floor(Math.min(w / VIEW_W, h / VIEW_H)));
    canvas.width = VIEW_W * scale;
    canvas.height = VIEW_H * scale;
    canvas.style.width = (VIEW_W * scale) + 'px';
    canvas.style.height = (VIEW_H * scale) + 'px';
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Palette ----------
  const PAL = {
    bg0: '#070708',
    bg1: '#101218',
    tunnelDark: '#1a1d24',
    tunnelMid: '#262a33',
    tunnelLight: '#363b47',
    brick: '#2e2620',
    brickGrout: '#1a1612',
    brickHi: '#3d342c',
    rail: '#5a5a64',
    railShine: '#8a8a96',
    pillar: '#3a3a44',
    pillarShade: '#22222a',
    train: '#e8b53b',
    trainShade: '#a8801f',
    trainWindow: '#9be3ff',
    trainBlack: '#161616',
    cable: '#1a1a22',
    cableHi: '#33333d',
    neonPink: '#ff4ea0',
    neonCyan: '#36e7ff',
    neonYellow: '#ffd84a',
    pigeonBody: '#7c8fa8',
    pigeonBelly: '#cfd8e3',
    pigeonHead: '#5d7090',
    pigeonBeak: '#f0a040',
    pigeonFoot: '#e08838',
    pigeonEye: '#101010',
    bread: '#e8c476',
    breadShade: '#a07a3a',
    coin: '#ffd84a',
    coinShade: '#a07a14',
    pizzaCrust: '#c08040',
    pizzaCheese: '#ffe080',
    pizzaPep: '#c8302a',
    passenger1: '#3a4a6a',
    passenger2: '#6a3a4a',
    passengerSkin: '#e8b890',
    hudBg: '#000000',
    hudText: '#f5e0a0',
    danger: '#ff3030',
  };

  // ---------- Input ----------
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
    if (state === STATE.START && (e.key === ' ' || e.key === 'Enter')) startGame();
    if (state === STATE.GAME_OVER && (e.key === ' ' || e.key === 'Enter')) startGame();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // ---------- Game state ----------
  const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2 };
  let state = STATE.START;

  let score = 0;
  let lives = 3;
  let timeAlive = 0;
  let invuln = 0;        // i-frames after hit
  let hitFlash = 0;
  let scrollSpeed = 60;  // base world scroll px/sec (tunnel always moves left)

  // Camera offset (world coords to screen). Pigeon stays centered.
  const camera = { x: 0, y: 0 };

  // Pigeon — world coordinates
  const pigeon = {
    x: 0,
    y: VIEW_H / 2,
    vx: 0,
    vy: 0,
    w: 16,
    h: 12,
    flapFrame: 0,
    flapTimer: 0,
    facing: 1,
  };

  // Entities
  let obstacles = [];
  let collectibles = [];
  let particles = [];

  // Spawn timers
  let spawnTimer = 0;
  let collectTimer = 0;

  // Background brick offset for parallax tiling
  let bgFar = 0, bgMid = 0, bgNear = 0;

  function startGame() {
    state = STATE.PLAYING;
    score = 0;
    lives = 3;
    timeAlive = 0;
    invuln = 0;
    hitFlash = 0;
    scrollSpeed = 60;
    pigeon.x = 0;
    pigeon.y = VIEW_H / 2;
    pigeon.vx = 0;
    pigeon.vy = 0;
    obstacles = [];
    collectibles = [];
    particles = [];
    spawnTimer = 0;
    collectTimer = 0;
    camera.x = 0;
    camera.y = 0;
  }

  // ---------- AABB ----------
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // World->screen helper. Pigeon centered: screen = world - camera.
  function w2sx(wx) { return Math.floor(wx - camera.x + VIEW_W / 2); }
  function w2sy(wy) { return Math.floor(wy - camera.y + VIEW_H / 2); }

  // ---------- Spawning ----------
  function spawnObstacle() {
    const types = ['train', 'pillar', 'cable', 'passenger'];
    const type = types[Math.floor(Math.random() * types.length)];
    // Spawn off-screen to the right of the camera, on player's path
    const wx = camera.x + VIEW_W / 2 + VIEW_W / 2 + 40 + Math.random() * 60;
    let wy, w, h;
    if (type === 'train') {
      w = 90; h = 36;
      wy = (Math.random() < 0.5 ? VIEW_H * 0.18 : VIEW_H * 0.62);
    } else if (type === 'pillar') {
      w = 14; h = 120;
      wy = VIEW_H / 2 - h / 2 + (Math.random() * 40 - 20);
    } else if (type === 'cable') {
      w = 32; h = 22;
      wy = 8 + Math.random() * 20;
    } else { // passenger
      w = 14; h = 22;
      wy = VIEW_H - 28 - Math.random() * 4;
    }
    obstacles.push({ type, x: wx, y: wy, w, h, vx: -scrollSpeed - (type === 'train' ? 80 : 0) });
  }

  function spawnCollectible() {
    const r = Math.random();
    let type;
    if (r < 0.6) type = 'bread';
    else if (r < 0.9) type = 'coin';
    else type = 'pizza';
    const w = type === 'pizza' ? 12 : 8;
    const h = type === 'pizza' ? 12 : 8;
    const wx = camera.x + VIEW_W / 2 + VIEW_W / 2 + 20 + Math.random() * 80;
    const wy = 30 + Math.random() * (VIEW_H - 60);
    collectibles.push({
      type, x: wx, y: wy, w, h, vx: -scrollSpeed,
      bob: Math.random() * Math.PI * 2,
      points: type === 'bread' ? 5 : type === 'coin' ? 10 : 25,
    });
  }

  function emitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80 - 20,
        life: 0.4 + Math.random() * 0.3,
        color,
      });
    }
  }

  // ---------- Update ----------
  function update(dt) {
    if (state !== STATE.PLAYING) return;

    timeAlive += dt;
    score += dt * 5; // passive score
    scrollSpeed = 60 + Math.min(80, timeAlive * 1.5);
    if (invuln > 0) invuln -= dt;
    if (hitFlash > 0) hitFlash -= dt;

    // --- Pigeon controls ---
    const accel = 380;
    const maxSpeed = 130;
    const friction = 6;
    let ax = 0, ay = 0;
    if (keys['arrowleft'] || keys['a']) ax -= 1;
    if (keys['arrowright'] || keys['d']) ax += 1;
    if (keys['arrowup'] || keys['w']) ay -= 1;
    if (keys['arrowdown'] || keys['s']) ay += 1;
    if (ax !== 0 || ay !== 0) {
      const m = Math.hypot(ax, ay);
      ax /= m; ay /= m;
    }
    pigeon.vx += ax * accel * dt;
    pigeon.vy += ay * accel * dt;
    // Apply friction
    pigeon.vx -= pigeon.vx * friction * dt;
    pigeon.vy -= pigeon.vy * friction * dt;
    // Clamp
    const sp = Math.hypot(pigeon.vx, pigeon.vy);
    if (sp > maxSpeed) {
      pigeon.vx = (pigeon.vx / sp) * maxSpeed;
      pigeon.vy = (pigeon.vy / sp) * maxSpeed;
    }
    if (Math.abs(pigeon.vx) > 5) pigeon.facing = pigeon.vx > 0 ? 1 : -1;

    pigeon.x += pigeon.vx * dt;
    pigeon.y += pigeon.vy * dt;

    // Vertical world clamp (keep pigeon within tunnel area on screen)
    const topLimit = camera.y - VIEW_H / 2 + 14;
    const botLimit = camera.y + VIEW_H / 2 - 18;
    if (pigeon.y < topLimit) { pigeon.y = topLimit; pigeon.vy = 0; }
    if (pigeon.y > botLimit) { pigeon.y = botLimit; pigeon.vy = 0; }

    // Wing flap (faster when moving)
    pigeon.flapTimer += dt * (4 + Math.abs(pigeon.vx) * 0.05 + Math.abs(pigeon.vy) * 0.05);
    if (pigeon.flapTimer >= 1) {
      pigeon.flapTimer = 0;
      pigeon.flapFrame = (pigeon.flapFrame + 1) % 3;
    }

    // --- Camera follows pigeon (pigeon centered) ---
    camera.x = pigeon.x;
    camera.y = VIEW_H / 2; // lock vertically to tunnel

    // World scrolls left automatically — implemented by drifting pigeon.x right
    // so the camera (which follows pigeon) makes the world appear to move left.
    pigeon.x += scrollSpeed * dt;

    // Parallax bg offsets
    bgFar  -= scrollSpeed * 0.2 * dt;
    bgMid  -= scrollSpeed * 0.5 * dt;
    bgNear -= scrollSpeed * 1.0 * dt;

    // --- Spawning ---
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 0.9 + Math.random() * 1.1 - Math.min(0.6, timeAlive * 0.01);
    }
    collectTimer -= dt;
    if (collectTimer <= 0) {
      spawnCollectible();
      collectTimer = 0.6 + Math.random() * 0.8;
    }

    // --- Move and cull obstacles ---
    for (const o of obstacles) {
      // Obstacles move in world. Trains move faster left.
      o.x += o.vx * dt;
    }
    obstacles = obstacles.filter(o => o.x + o.w > camera.x - VIEW_W);

    for (const c of collectibles) {
      c.x += c.vx * dt;
      c.bob += dt * 4;
    }
    collectibles = collectibles.filter(c => c.x + c.w > camera.x - VIEW_W);

    // --- Particles ---
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // --- Collisions ---
    const pBox = { x: pigeon.x - pigeon.w / 2, y: pigeon.y - pigeon.h / 2, w: pigeon.w, h: pigeon.h };

    // Collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      const cBox = { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h };
      if (aabb(pBox, cBox)) {
        score += c.points;
        emitParticles(c.x, c.y, c.type === 'coin' ? PAL.coin : c.type === 'pizza' ? PAL.pizzaCheese : PAL.bread, 8);
        collectibles.splice(i, 1);
      }
    }

    // Obstacles
    if (invuln <= 0) {
      for (const o of obstacles) {
        const oBox = { x: o.x, y: o.y, w: o.w, h: o.h };
        // Tighter hitbox for cables/pillars
        if (aabb(pBox, oBox)) {
          lives -= 1;
          invuln = 1.5;
          hitFlash = 0.2;
          emitParticles(pigeon.x, pigeon.y, PAL.danger, 14);
          // Bounce back
          pigeon.vx = -120;
          pigeon.vy = (Math.random() - 0.5) * 100;
          if (lives <= 0) {
            state = STATE.GAME_OVER;
          }
          break;
        }
      }
    }
  }

  // ---------- Drawing helpers ----------
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // ---------- Draw background (parallax) ----------
  function drawBackground() {
    // Far layer: dark tunnel gradient
    px(0, 0, VIEW_W, VIEW_H, PAL.bg0);
    px(0, 20, VIEW_W, VIEW_H - 40, PAL.bg1);

    // Brick walls top and bottom (far)
    drawBricks(0, 0, VIEW_W, 28, bgFar);
    drawBricks(0, VIEW_H - 28, VIEW_W, 28, bgFar);

    // Mid: arched tunnel ribs/pillars
    drawTunnelRibs(bgMid);

    // Neon signs on far wall
    drawNeonSigns(bgMid);

    // Rails on the floor (near)
    drawRails(bgNear);

    // Hanging cables along the ceiling (near)
    drawCeilingCables(bgNear);
  }

  function drawBricks(x, y, w, h, offset) {
    const bw = 16, bh = 8;
    const ox = ((offset % bw) + bw) % bw;
    px(x, y, w, h, PAL.brick);
    for (let row = 0; row * bh < h; row++) {
      const ry = y + row * bh;
      const stagger = (row % 2 === 0) ? 0 : bw / 2;
      for (let col = -1; col * bw < w + bw; col++) {
        const rx = x + col * bw - ox + stagger;
        // grout
        px(rx, ry, bw - 1, 1, PAL.brickGrout);
        px(rx, ry + bh - 1, 1, 1, PAL.brickGrout);
        // highlight
        px(rx + 1, ry + 1, 2, 1, PAL.brickHi);
      }
    }
    // gritty noise
    for (let i = 0; i < 18; i++) {
      const nx = x + ((i * 53 + Math.floor(offset)) % w + w) % w;
      const ny = y + (i * 17) % h;
      px(nx, ny, 1, 1, PAL.brickGrout);
    }
  }

  function drawTunnelRibs(offset) {
    const spacing = 80;
    const ox = ((offset % spacing) + spacing) % spacing;
    for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
      const x = i * spacing - ox;
      // Vertical rib
      px(x, 28, 4, VIEW_H - 56, PAL.tunnelMid);
      px(x + 1, 28, 1, VIEW_H - 56, PAL.tunnelLight);
      // Arch top
      px(x - 6, 28, 16, 2, PAL.tunnelMid);
      px(x - 6, 26, 16, 2, PAL.tunnelDark);
      // Arch bottom plate
      px(x - 6, VIEW_H - 30, 16, 2, PAL.tunnelMid);
    }
  }

  function drawNeonSigns(offset) {
    const spacing = 160;
    const ox = ((offset * 0.7 % spacing) + spacing) % spacing;
    const colors = [PAL.neonPink, PAL.neonCyan, PAL.neonYellow];
    for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
      const x = i * spacing - ox + 40;
      const c = colors[Math.abs(i) % 3];
      // sign frame
      px(x, 50, 28, 14, '#0a0a0a');
      // neon
      const blink = (Math.floor(timeAlive * 6) + i) % 8 === 0 ? '#ffffff' : c;
      px(x + 2, 52, 24, 2, blink);
      px(x + 2, 56, 24, 2, c);
      px(x + 2, 60, 24, 2, c);
      // dim cells
      px(x + 6, 54, 2, 2, '#0a0a0a');
      px(x + 14, 54, 2, 2, '#0a0a0a');
      px(x + 22, 54, 2, 2, '#0a0a0a');
    }
  }

  function drawRails(offset) {
    // Floor band
    px(0, VIEW_H - 18, VIEW_W, 18, PAL.tunnelDark);
    // Sleepers
    const spacing = 16;
    const ox = ((offset % spacing) + spacing) % spacing;
    for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
      const x = i * spacing - ox;
      px(x, VIEW_H - 10, 12, 3, '#3a2a1a');
      px(x, VIEW_H - 11, 12, 1, '#1a1208');
    }
    // Rails
    px(0, VIEW_H - 12, VIEW_W, 1, PAL.rail);
    px(0, VIEW_H - 6, VIEW_W, 1, PAL.rail);
    px(0, VIEW_H - 12, VIEW_W, 1, PAL.railShine);
    // Platform edge (near layer)
    px(0, VIEW_H - 18, VIEW_W, 1, PAL.neonYellow);
  }

  function drawCeilingCables(offset) {
    const spacing = 28;
    const ox = ((offset % spacing) + spacing) % spacing;
    for (let i = -1; i * spacing < VIEW_W + spacing; i++) {
      const x = i * spacing - ox;
      // Conduit along ceiling
      px(x, 6, spacing, 2, PAL.cable);
      px(x, 6, spacing - 1, 1, PAL.cableHi);
      // little drop
      if (i % 3 === 0) {
        px(x + 6, 8, 1, 4, PAL.cable);
        px(x + 6, 12, 3, 2, PAL.cableHi);
      }
    }
  }

  // ---------- Pigeon sprite ----------
  function drawPigeon() {
    const sx = w2sx(pigeon.x) - 8;
    const sy = w2sy(pigeon.y) - 6;
    if (invuln > 0 && Math.floor(timeAlive * 20) % 2 === 0) return; // blink

    const f = pigeon.flapFrame; // 0=up, 1=mid, 2=down
    const flip = pigeon.facing < 0;

    // Use a small drawing buffer of pixels for the sprite, then flip if needed.
    const sprite = [];
    function p(x, y, c) { sprite.push([x, y, c]); }

    // Body
    p(4, 5, PAL.pigeonBody); p(5, 5, PAL.pigeonBody); p(6, 5, PAL.pigeonBody); p(7, 5, PAL.pigeonBody); p(8, 5, PAL.pigeonBody);
    p(3, 6, PAL.pigeonBody); p(4, 6, PAL.pigeonBelly); p(5, 6, PAL.pigeonBelly); p(6, 6, PAL.pigeonBelly); p(7, 6, PAL.pigeonBelly); p(8, 6, PAL.pigeonBody);
    p(3, 7, PAL.pigeonBody); p(4, 7, PAL.pigeonBelly); p(5, 7, PAL.pigeonBelly); p(6, 7, PAL.pigeonBelly); p(7, 7, PAL.pigeonBelly); p(8, 7, PAL.pigeonBody);
    p(4, 8, PAL.pigeonBody); p(5, 8, PAL.pigeonBody); p(6, 8, PAL.pigeonBody); p(7, 8, PAL.pigeonBody);

    // Head
    p(9, 4, PAL.pigeonHead); p(10, 4, PAL.pigeonHead); p(11, 4, PAL.pigeonHead);
    p(9, 5, PAL.pigeonHead); p(10, 5, PAL.pigeonHead); p(11, 5, PAL.pigeonHead);
    p(11, 5, PAL.pigeonEye);
    p(12, 5, PAL.pigeonBeak); p(13, 5, PAL.pigeonBeak);
    p(12, 6, PAL.pigeonBeak);

    // Feet (tucked when flying)
    p(6, 9, PAL.pigeonFoot); p(8, 9, PAL.pigeonFoot);

    // Wing - 3 frames
    if (f === 0) { // up
      p(4, 2, PAL.pigeonHead); p(5, 2, PAL.pigeonHead); p(6, 2, PAL.pigeonHead);
      p(4, 3, PAL.pigeonBody); p(5, 3, PAL.pigeonBody); p(6, 3, PAL.pigeonBody); p(7, 3, PAL.pigeonBody);
      p(5, 4, PAL.pigeonBody); p(6, 4, PAL.pigeonBody);
    } else if (f === 1) { // mid
      p(3, 4, PAL.pigeonHead); p(4, 4, PAL.pigeonHead); p(5, 4, PAL.pigeonHead); p(6, 4, PAL.pigeonHead); p(7, 4, PAL.pigeonHead);
      p(3, 5, PAL.pigeonBody); // overlap ok (will be overwritten by body draw order)
    } else { // down
      p(3, 8, PAL.pigeonHead); p(4, 9, PAL.pigeonHead); p(5, 9, PAL.pigeonHead); p(6, 9, PAL.pigeonHead);
      p(4, 10, PAL.pigeonBody); p(5, 10, PAL.pigeonBody); p(6, 10, PAL.pigeonBody);
    }

    // Render with flip
    for (const [px_, py_, c] of sprite) {
      const dx = flip ? (15 - px_) : px_;
      ctx.fillStyle = c;
      ctx.fillRect(sx + dx, sy + py_, 1, 1);
    }
  }

  // ---------- Obstacles ----------
  function drawObstacle(o) {
    const sx = w2sx(o.x);
    const sy = w2sy(o.y);
    if (sx + o.w < 0 || sx > VIEW_W) return;
    if (o.type === 'train') drawTrain(sx, sy, o.w, o.h);
    else if (o.type === 'pillar') drawPillar(sx, sy, o.w, o.h);
    else if (o.type === 'cable') drawCable(sx, sy, o.w, o.h);
    else if (o.type === 'passenger') drawPassenger(sx, sy, o.w, o.h);
  }

  function drawTrain(x, y, w, h) {
    // Body
    px(x, y, w, h, PAL.train);
    px(x, y, w, 2, PAL.trainShade);
    px(x, y + h - 4, w, 4, PAL.trainShade);
    // Black stripe
    px(x, y + h - 2, w, 2, PAL.trainBlack);
    // Headlight (front)
    px(x, y + 8, 2, 6, PAL.neonYellow);
    px(x - 4, y + 9, 4, 4, 'rgba(255,216,74,0.4)');
    // Windows
    for (let i = 0; i < 4; i++) {
      const wx = x + 10 + i * 18;
      px(wx, y + 6, 12, 10, PAL.trainWindow);
      px(wx, y + 6, 12, 1, '#5fb6d6');
      // window frame divider
      px(wx + 5, y + 6, 1, 10, PAL.trainShade);
    }
    // Wheels
    for (let i = 0; i < 3; i++) {
      const wx = x + 10 + i * 30;
      px(wx, y + h - 1, 8, 1, PAL.trainBlack);
      px(wx + 1, y + h, 6, 1, PAL.trainBlack);
    }
    // Speed lines
    for (let i = 0; i < 5; i++) {
      const sx2 = x + w + 2 + i * 6;
      px(sx2, y + 6 + (i * 5) % 20, 4, 1, PAL.trainWindow);
    }
  }

  function drawPillar(x, y, w, h) {
    px(x, y, w, h, PAL.pillar);
    px(x, y, 2, h, PAL.pillarShade);
    px(x + w - 2, y, 2, h, PAL.pillarShade);
    // Bolts
    for (let i = 0; i < 6; i++) {
      const by = y + 8 + i * (h / 6);
      px(x + 5, by, 2, 2, '#1a1a22');
      px(x + 5, by, 1, 1, '#5a5a64');
    }
    // Caps
    px(x - 2, y, w + 4, 4, PAL.pillarShade);
    px(x - 2, y + h - 4, w + 4, 4, PAL.pillarShade);
  }

  function drawCable(x, y, w, h) {
    // Hanging cable bundle from ceiling
    px(x, 0, 2, y, PAL.cable);
    px(x + w - 2, 0, 2, y, PAL.cable);
    // Box at the bottom
    px(x, y, w, h - 4, PAL.cable);
    px(x, y, w, 1, PAL.cableHi);
    // Sparking light
    if (Math.floor(timeAlive * 8) % 4 === 0) {
      px(x + w / 2 - 1, y + h - 2, 3, 2, PAL.neonCyan);
    } else {
      px(x + w / 2 - 1, y + h - 2, 3, 2, PAL.cableHi);
    }
  }

  function drawPassenger(x, y, w, h) {
    // body
    px(x + 2, y + 8, w - 4, h - 8, PAL.passenger1);
    // legs
    px(x + 3, y + h - 4, 2, 4, PAL.passenger2);
    px(x + w - 5, y + h - 4, 2, 4, PAL.passenger2);
    // head
    px(x + 4, y + 2, w - 8, 6, PAL.passengerSkin);
    // hair/hat
    px(x + 4, y, w - 8, 3, '#1a1a22');
    // briefcase
    px(x + w - 2, y + 12, 3, 4, '#3a2a1a');
    px(x + w - 2, y + 11, 3, 1, '#5a4030');
  }

  // ---------- Collectibles ----------
  function drawCollectible(c) {
    const sx = w2sx(c.x);
    const sy = w2sy(c.y) + Math.floor(Math.sin(c.bob) * 2);
    if (sx + c.w < 0 || sx > VIEW_W) return;
    if (c.type === 'bread') drawBread(sx - c.w / 2, sy - c.h / 2);
    else if (c.type === 'coin') drawCoin(sx - c.w / 2, sy - c.h / 2);
    else if (c.type === 'pizza') drawPizza(sx - c.w / 2, sy - c.h / 2);
  }

  function drawBread(x, y) {
    px(x + 1, y + 2, 6, 4, PAL.bread);
    px(x + 2, y + 1, 4, 1, PAL.bread);
    px(x + 1, y + 6, 6, 1, PAL.breadShade);
    px(x + 2, y + 3, 1, 1, PAL.breadShade);
    px(x + 5, y + 4, 1, 1, PAL.breadShade);
  }

  function drawCoin(x, y) {
    const wob = Math.floor(Math.sin(timeAlive * 6) * 1.5) + 0;
    px(x + 2 - wob, y + 1, 4 + wob * 2, 6, PAL.coin);
    px(x + 2 - wob, y + 1, 4 + wob * 2, 1, '#fff8a0');
    px(x + 2 - wob, y + 6, 4 + wob * 2, 1, PAL.coinShade);
    px(x + 3, y + 3, 2, 2, PAL.coinShade);
  }

  function drawPizza(x, y) {
    // triangle slice
    px(x + 5, y + 1, 2, 1, PAL.pizzaCrust);
    px(x + 4, y + 2, 4, 1, PAL.pizzaCheese);
    px(x + 3, y + 3, 6, 1, PAL.pizzaCheese);
    px(x + 2, y + 4, 8, 1, PAL.pizzaCheese);
    px(x + 1, y + 5, 10, 1, PAL.pizzaCheese);
    px(x + 1, y + 6, 10, 2, PAL.pizzaCrust);
    // pepperoni
    px(x + 4, y + 3, 2, 1, PAL.pizzaPep);
    px(x + 7, y + 4, 2, 1, PAL.pizzaPep);
    px(x + 3, y + 5, 1, 1, PAL.pizzaPep);
  }

  // ---------- Particles ----------
  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life);
      ctx.globalAlpha = Math.min(1, a * 2);
      px(Math.floor(w2sx(p.x)), Math.floor(w2sy(p.y)), 2, 2, p.color);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD (pixel font) ----------
  // Tiny 3x5 pixel font for digits and select letters.
  const FONT = {
    '0': ['111','101','101','101','111'],
    '1': ['010','110','010','010','111'],
    '2': ['111','001','111','100','111'],
    '3': ['111','001','111','001','111'],
    '4': ['101','101','111','001','001'],
    '5': ['111','100','111','001','111'],
    '6': ['111','100','111','101','111'],
    '7': ['111','001','010','100','100'],
    '8': ['111','101','111','101','111'],
    '9': ['111','101','111','001','111'],
    ':': ['000','010','000','010','000'],
    ' ': ['000','000','000','000','000'],
    'A': ['111','101','111','101','101'],
    'B': ['110','101','110','101','110'],
    'C': ['111','100','100','100','111'],
    'D': ['110','101','101','101','110'],
    'E': ['111','100','110','100','111'],
    'F': ['111','100','110','100','100'],
    'G': ['111','100','101','101','111'],
    'H': ['101','101','111','101','101'],
    'I': ['111','010','010','010','111'],
    'J': ['001','001','001','101','111'],
    'K': ['101','110','100','110','101'],
    'L': ['100','100','100','100','111'],
    'M': ['101','111','111','101','101'],
    'N': ['101','111','111','111','101'],
    'O': ['111','101','101','101','111'],
    'P': ['111','101','111','100','100'],
    'Q': ['111','101','101','111','011'],
    'R': ['111','101','110','101','101'],
    'S': ['111','100','111','001','111'],
    'T': ['111','010','010','010','010'],
    'U': ['101','101','101','101','111'],
    'V': ['101','101','101','111','010'],
    'W': ['101','101','111','111','101'],
    'X': ['101','101','010','101','101'],
    'Y': ['101','101','111','010','010'],
    'Z': ['111','001','010','100','111'],
    '!': ['010','010','010','000','010'],
    '-': ['000','000','111','000','000'],
  };

  function drawText(text, x, y, color, scale = 1) {
    text = text.toUpperCase();
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const glyph = FONT[ch];
      if (!glyph) continue;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (glyph[r][c] === '1') {
            px(x + (i * 4 + c) * scale, y + r * scale, scale, scale, color);
          }
        }
      }
    }
  }

  function drawHUD() {
    // Top bar
    px(0, 0, VIEW_W, 11, 'rgba(0,0,0,0.55)');
    drawText('SCORE ' + Math.floor(score), 4, 3, PAL.hudText);
    // Lives as little pigeons
    drawText('LIVES', VIEW_W - 60, 3, PAL.hudText);
    for (let i = 0; i < lives; i++) {
      const lx = VIEW_W - 33 + i * 10;
      px(lx, 3, 7, 5, PAL.pigeonBody);
      px(lx + 1, 4, 5, 3, PAL.pigeonBelly);
      px(lx + 6, 4, 2, 1, PAL.pigeonBeak);
      px(lx + 5, 3, 1, 1, PAL.pigeonEye);
    }

    if (hitFlash > 0) {
      ctx.globalAlpha = hitFlash * 2;
      px(0, 0, VIEW_W, VIEW_H, PAL.danger);
      ctx.globalAlpha = 1;
    }
  }

  function drawStartScreen() {
    px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.55)');
    drawText('METRO PIGEON', VIEW_W / 2 - 47, 50, PAL.neonYellow, 2);
    drawText('A SUBWAY FLAPPER', VIEW_W / 2 - 32, 80, PAL.neonCyan, 1);
    drawText('ARROWS OR WASD TO FLY', VIEW_W / 2 - 42, 110, PAL.hudText, 1);
    drawText('AVOID TRAINS PILLARS CABLES', VIEW_W / 2 - 54, 122, PAL.hudText, 1);
    drawText('GRAB BREAD COINS PIZZA', VIEW_W / 2 - 44, 134, PAL.hudText, 1);
    if (Math.floor(timeAlive * 2) % 2 === 0) {
      drawText('PRESS SPACE TO START', VIEW_W / 2 - 40, 160, PAL.neonPink, 1);
    }
    // Title pigeon flap
    drawTitlePigeon(VIEW_W / 2 - 8, 22);
  }

  function drawTitlePigeon(x, y) {
    const f = Math.floor(timeAlive * 6) % 3;
    const saveX = pigeon.x, saveY = pigeon.y, saveF = pigeon.flapFrame, saveCx = camera.x, saveCy = camera.y;
    pigeon.flapFrame = f;
    pigeon.x = x + 8; pigeon.y = y + 6;
    camera.x = pigeon.x; camera.y = pigeon.y;
    drawPigeon();
    pigeon.x = saveX; pigeon.y = saveY; pigeon.flapFrame = saveF;
    camera.x = saveCx; camera.y = saveCy;
  }

  function drawGameOverScreen() {
    px(0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.6)');
    drawText('GAME OVER', VIEW_W / 2 - 36, 60, PAL.danger, 2);
    drawText('FINAL SCORE ' + Math.floor(score), VIEW_W / 2 - 32, 100, PAL.hudText, 1);
    if (Math.floor(timeAlive * 2) % 2 === 0) {
      drawText('PRESS SPACE TO RETRY', VIEW_W / 2 - 40, 130, PAL.neonCyan, 1);
    }
  }

  // ---------- Render ----------
  function render() {
    // Clear with vignette base
    px(0, 0, VIEW_W, VIEW_H, PAL.bg0);
    drawBackground();

    // World entities - draw collectibles behind, obstacles, then pigeon
    for (const c of collectibles) drawCollectible(c);
    for (const o of obstacles) drawObstacle(o);
    drawPigeon();
    drawParticles();

    drawHUD();

    if (state === STATE.START) drawStartScreen();
    else if (state === STATE.GAME_OVER) drawGameOverScreen();
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Always tick timeAlive a bit so menu animations work
    if (state !== STATE.PLAYING) timeAlive += dt;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
