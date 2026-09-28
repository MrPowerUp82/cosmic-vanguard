const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const listeners = {};
const classes = new Set();
const labels = [];
const draws = [];
const timers = [];
let frame;
let now = 0;

const canvasContext = new Proxy({
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  measureText: text => ({ width: text.length * 8 }),
  fillText: (text, x) => labels.push({ text, x }),
  drawImage: (image, sx, sy) => draws.push({ src: image.src, sy }),
}, { get(target, key) { return target[key] ?? (() => {}); } });

const canvas = {
  width: 960, height: 540,
  getContext: () => canvasContext,
  addEventListener() {},
};
const storage = new Map();
const context = {
  console,
  Math,
  Date,
  Set,
  Image: class {
    complete = true;
    naturalWidth = 1672;
    naturalHeight = 941;
  },
  HTMLCanvasElement: class {},
  HTMLImageElement: class {},
  performance: { now: () => now },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  document: {
    getElementById: () => canvas,
    querySelectorAll: () => [],
    body: { classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } } },
  },
  requestAnimationFrame: callback => { frame = callback; },
  setTimeout: (callback, delay) => timers.push({ callback, at: now + delay }),
};
context.window = { ...context, addEventListener: (name, callback) => { listeners[name] = callback; } };

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/sprites/processed/atlas.js'), 'utf8'), context);
context.window.SPRITE_ATLAS = context.window.SPRITE_ATLAS;
context.window.SCENARIOS = [];
vm.runInContext(fs.readFileSync(path.join(root, 'game.js'), 'utf8'), context);

function step(count = 1) {
  for (let i = 0; i < count; i++) {
    now += 16.67;
    labels.length = 0;
    draws.length = 0;
    frame(now);
    for (let j = timers.length - 1; j >= 0; j--) {
      if (timers[j].at <= now) timers.splice(j, 1)[0].callback();
    }
  }
}
function keyDown(code) { listeners.keydown({ code, preventDefault() {} }); }
function keyUp(code) { listeners.keyup({ code }); }
function press(code) { keyDown(code); step(); keyUp(code); step(); }
function playerX(slot) { return labels.find(label => label.text === `P${slot}`)?.x; }

press('Enter');
assert(labels.some(label => label.text === 'MAPA DE OPERAÇÕES'));
press('KeyM');
assert(classes.has('coop-mode'));
press('Enter');
assert(labels.some(label => label.text === 'P1 SOLARION'));
assert(labels.some(label => label.text === 'P2 NIGHT TALON'));

const p1Start = playerX(1);
const p2Start = playerX(2);
keyDown('KeyD'); step(30); keyUp('KeyD'); step();
assert(playerX(1) > p1Start + 50, 'P1 deve mover-se com D');
assert.equal(playerX(2), p2Start, 'P2 deve permanecer parado');
assert(labels.some(label => label.text === 'ONDA 1'), 'a primeira onda deve iniciar');

const p1After = playerX(1);
keyDown('ArrowRight'); step(30); keyUp('ArrowRight'); step();
assert(playerX(2) > p2Start + 50, 'P2 deve mover-se com a seta');
assert.equal(playerX(1), p1After, 'P1 deve permanecer parado');

press('KeyF');
assert(draws.some(draw => draw.src?.includes('solarion.png') && draw.sy === context.window.SPRITE_ATLAS.cellH * 2), 'F deve atacar com P1');
press('KeyJ');
assert(draws.some(draw => draw.src?.includes('night_talon.png') && draw.sy === context.window.SPRITE_ATLAS.cellH * 2), 'J deve atacar com P2');

press('KeyO');
assert(labels.some(label => label.text === 'P2 VALORIA'));
press('KeyE');
assert(labels.some(label => label.text === 'P1 NIGHT TALON'));

console.log('Cooperativo local: seleção, movimento independente, onda, ataques e troca de heróis OK.');
