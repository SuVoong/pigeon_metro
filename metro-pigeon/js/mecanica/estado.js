'use strict';
// Estado global compartido: canvas, constantes, paleta, estado de juego

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const VIEW_W = 320;
const VIEW_H = 200;

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

const STATE = { START: 0, PLAYING: 1, GAME_OVER: 2, PAUSED: 3 };

let state = STATE.START;
let score = 0;
let lives = 3;
let timeAlive = 0;
let invuln = 0;
let hitFlash = 0;
let scrollSpeed = 60;

const camera = { x: 0, y: 0 };

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

let obstacles = [];
let collectibles = [];
let particles = [];
let spawnTimer = 0;
let collectTimer = 0;
let bgFar = 0, bgMid = 0, bgNear = 0;

const keys = {};

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

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
