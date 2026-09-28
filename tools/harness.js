const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const DEFAULT_SCRIPTS = ['assets/sprites/processed/atlas.js', 'game.js'];

function createHarness({ scripts = DEFAULT_SCRIPTS } = {}) {
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
    Map,
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
  context.window.SCENARIOS = [];

  vm.createContext(context);
  for (const script of scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
  }

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

  return { step, keyDown, keyUp, press, playerX, labels, draws, classes, window: context.window };
}

module.exports = { createHarness, DEFAULT_SCRIPTS };
