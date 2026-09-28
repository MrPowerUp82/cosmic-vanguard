# Núcleo de Gameplay (Agendador, Tempo, Eventos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir em Cosmic Vanguard um agendador de ações dentro do loop, controle de tempo (hitstop/slow-mo) e um barramento de eventos, expostos em `window.CV`, sem alterar o comportamento atual do jogo.

**Architecture:** Um novo `core.js` (IIFE, sem dependências de DOM) exporta fábricas puras em `window.CV_CORE`. O `game.js` cria um agendador e um relógio por partida (`game.scheduler`, `game.clock`) e um barramento global (`events`), troca os `setTimeout` de golpes pelo agendador, passa um `dt` de mundo escalado aos sistemas de simulação e emite eventos nos pontos-chave. Módulos futuros (`combat.js`, `progression.js`, `variety.js`) falarão com o jogo só por `window.CV`.

**Tech Stack:** JavaScript puro (ES2020, sem build), Canvas 2D, testes em Node (`node:assert`, `node:vm`) com DOM simulado.

**Spec:** `docs/GAMEPLAY_OVERHAUL_DESIGN.md`, seção 4.1. O campo `hooks` de `window.CV` citado no spec fica para a etapa 1a, quando o primeiro módulo precisar dele (YAGNI). O mesmo vale para `attacker` no evento `hit`.

## Global Constraints

- Sem bundler, sem `import`/`export`: cada arquivo é uma IIFE carregada por `<script>` em `index.html`.
- Ordem de carga: `atlas.js` → `scenarios.js` → `core.js` → `game.js`.
- Hitstop não acumula: `max(atual, novo)`, teto **0,12 s**.
- UI, avisos (`game.notice`), pausa, partículas, câmera e shake usam `dt` real; simulação (jogadores, inimigos, projéteis, combo, agendador) usa `dt` de mundo.
- **Comportamento idêntico:** enquanto ninguém chamar `hitstop`/`slowmo`, o jogo deve se comportar exatamente como hoje. `tools/test_local_coop.js` deve continuar passando.
- `setTimeout` que só tocam áudio (`beep`) permanecem como estão.
- Comentários e textos de teste em português, identificadores em inglês (padrão do `game.js`).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| Arquivo | Ação | Responsabilidade |
| :-- | :-- | :-- |
| `tools/harness.js` | Criar | Carrega os scripts do jogo em `vm` com DOM simulado; expõe `step`, `press`, `keyDown`, `keyUp`, `labels`, `draws`, `window` |
| `tools/test_local_coop.js` | Modificar | Passa a usar `tools/harness.js` (mesmas asserções) |
| `core.js` | Criar | `createScheduler`, `createTimeControl`, `createEventBus` em `window.CV_CORE` |
| `tools/test_core.js` | Criar | Testes unitários de `core.js` |
| `game.js` | Modificar | Usa scheduler/clock/events; publica `window.CV` |
| `tools/test_core_integration.js` | Criar | Testes de integração do núcleo dentro do jogo |
| `index.html` | Modificar | Carrega `core.js` antes de `game.js` |

Comando para rodar todos os testes (usado em várias etapas):

```bash
node tools/test_core.js && node tools/test_local_coop.js && node tools/test_core_integration.js
```

---

### Task 1: Extrair o harness de testes

**Files:**
- Create: `tools/harness.js`
- Modify: `tools/test_local_coop.js` (arquivo inteiro)

**Interfaces:**
- Consumes: nada.
- Produces: `createHarness({ scripts?: string[] }) → { step(count=1), keyDown(code), keyUp(code), press(code), playerX(slot), labels: {text,x}[], draws: {src,sy}[], classes: Set<string>, window: object }`. `scripts` são caminhos relativos à raiz; padrão `DEFAULT_SCRIPTS`. Também exporta `DEFAULT_SCRIPTS`.

- [ ] **Step 1: Criar `tools/harness.js`**

```js
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
```

- [ ] **Step 2: Reescrever `tools/test_local_coop.js` usando o harness**

```js
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

const { step, keyDown, keyUp, press, playerX, labels, draws, classes, window } = createHarness();

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
assert(draws.some(draw => draw.src?.includes('solarion.png') && draw.sy === window.SPRITE_ATLAS.cellH * 2), 'F deve atacar com P1');
press('KeyJ');
assert(draws.some(draw => draw.src?.includes('night_talon.png') && draw.sy === window.SPRITE_ATLAS.cellH * 2), 'J deve atacar com P2');

press('KeyO');
assert(labels.some(label => label.text === 'P2 VALORIA'));
press('KeyE');
assert(labels.some(label => label.text === 'P1 NIGHT TALON'));

console.log('Cooperativo local: seleção, movimento independente, onda, ataques e troca de heróis OK.');
```

- [ ] **Step 3: Rodar o teste**

Run: `node tools/test_local_coop.js`
Expected: `Cooperativo local: seleção, movimento independente, onda, ataques e troca de heróis OK.`

- [ ] **Step 4: Commit**

```bash
git add tools/harness.js tools/test_local_coop.js
git commit -m "test: extract shared game harness from co-op test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `core.js` — agendador, relógio e barramento de eventos

**Files:**
- Create: `core.js`
- Create: `tools/test_core.js`
- Modify: `tools/harness.js` (`DEFAULT_SCRIPTS`)
- Modify: `index.html` (tags `<script>` no fim do `<body>`)

**Interfaces:**
- Consumes: nada.
- Produces (em `window.CV_CORE`):
  - `createScheduler() → { schedule(delaySec: number, fn: () => void, owner?: any): void, update(dt: number): void, cancelOwner(owner): void, clear(): void, size: number (getter) }`. Timers vencidos no mesmo `update` disparam em ordem de vencimento; timers criados dentro de um callback só disparam num `update` posterior.
  - `createTimeControl({ maxHitstop = .12 } = {}) → { hitstop(sec): void, slowmo(scale, sec): void, step(realDt): number /* dt de mundo */, reset(): void, frozen: boolean (getter) }`. Hitstop tem prioridade sobre slow-mo; o slow-mo não é consumido durante hitstop.
  - `createEventBus() → { on(name, fn): () => void /* unsubscribe */, emit(name, data?): void, clear(): void }`. Um handler que lança erro é logado com `console.error` e não impede os demais.

- [ ] **Step 1: Escrever os testes que falham — `tools/test_core.js`**

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const errors = [];
const context = { window: {}, console: { ...console, error: (...args) => errors.push(args) } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8'), context, { filename: 'core.js' });
const { createScheduler, createTimeControl, createEventBus } = context.window.CV_CORE;

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { failures++; console.error(`FALHOU - ${name}\n`, err); }
}
const close = (actual, expected, msg) => assert(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} != ${expected}`);

test('agendador dispara somente após o atraso', () => {
  const s = createScheduler();
  let fired = 0;
  s.schedule(.1, () => fired++);
  s.update(.05);
  assert.equal(fired, 0);
  s.update(.05);
  assert.equal(fired, 1);
  assert.equal(s.size, 0);
});

test('agendador dispara vencidos em ordem de vencimento', () => {
  const s = createScheduler();
  const order = [];
  s.schedule(.08, () => order.push('b'));
  s.schedule(.02, () => order.push('a'));
  s.update(.1);
  assert.deepEqual(order, ['a', 'b']);
});

test('timer criado dentro de callback espera o próximo update', () => {
  const s = createScheduler();
  let inner = 0;
  s.schedule(0, () => s.schedule(0, () => inner++));
  s.update(.016);
  assert.equal(inner, 0);
  s.update(.016);
  assert.equal(inner, 1);
});

test('agendador parado não avança (dt 0)', () => {
  const s = createScheduler();
  let fired = 0;
  s.schedule(.01, () => fired++);
  for (let i = 0; i < 100; i++) s.update(0);
  assert.equal(fired, 0);
});

test('cancelOwner e clear removem timers', () => {
  const s = createScheduler();
  const owner = {};
  let fired = 0;
  s.schedule(.01, () => fired++, owner);
  s.schedule(.01, () => fired++, 'outro');
  s.cancelOwner(owner);
  assert.equal(s.size, 1);
  s.clear();
  s.update(1);
  assert.equal(fired, 0);
});

test('relógio sem efeitos devolve o dt real', () => {
  const c = createTimeControl();
  close(c.step(.016), .016, 'dt');
  assert.equal(c.frozen, false);
});

test('hitstop zera o dt de mundo até ser consumido', () => {
  const c = createTimeControl();
  c.hitstop(.05);
  assert.equal(c.frozen, true);
  assert.equal(c.step(.03), 0);
  assert.equal(c.step(.03), 0);
  close(c.step(.03), .03, 'após hitstop');
});

test('hitstop não acumula e respeita o teto', () => {
  const c = createTimeControl();
  c.hitstop(.05);
  c.hitstop(.03);
  assert.equal(c.step(.049), 0);
  close(c.step(.01), 0, 'resto do hitstop de .05');
  close(c.step(.01), .01, 'livre');
  c.hitstop(5);
  let frozenTime = 0;
  while (c.step(.01) === 0) frozenTime += .01;
  // Tolerância de um passo por arredondamento de ponto flutuante.
  assert(frozenTime <= .12 + .01 + 1e-9, `teto excedido: ${frozenTime}`);
});

test('slow-mo escala o dt e expira', () => {
  const c = createTimeControl();
  c.slowmo(.5, .1);
  close(c.step(.05), .025, 'meio tempo');
  close(c.step(.05), .025, 'meio tempo');
  close(c.step(.05), .05, 'expirado');
});

test('hitstop tem prioridade e não consome o slow-mo', () => {
  const c = createTimeControl();
  c.slowmo(.5, .1);
  c.hitstop(.05);
  assert.equal(c.step(.05), 0);
  close(c.step(.05), .025, 'slow-mo intacto');
  close(c.step(.05), .025, 'slow-mo intacto');
  close(c.step(.05), .05, 'expirado');
});

test('reset limpa hitstop e slow-mo', () => {
  const c = createTimeControl();
  c.hitstop(.1);
  c.slowmo(.3, 1);
  c.reset();
  close(c.step(.02), .02, 'normal');
});

test('eventos: on, emit e unsubscribe', () => {
  const bus = createEventBus();
  const got = [];
  const off = bus.on('kill', data => got.push(data.id));
  bus.emit('kill', { id: 1 });
  off();
  bus.emit('kill', { id: 2 });
  bus.emit('sem-ouvinte');
  assert.deepEqual(got, [1]);
});

test('eventos: erro em um handler não impede os outros', () => {
  const bus = createEventBus();
  let second = 0;
  errors.length = 0;
  bus.on('hit', () => { throw new Error('boom'); });
  bus.on('hit', () => second++);
  bus.emit('hit', {});
  assert.equal(second, 1);
  assert.equal(errors.length, 1);
});

test('eventos: handler pode se desinscrever durante o emit', () => {
  const bus = createEventBus();
  let a = 0, b = 0;
  const offA = bus.on('x', () => { a++; offA(); });
  bus.on('x', () => b++);
  bus.emit('x');
  bus.emit('x');
  assert.equal(a, 1);
  assert.equal(b, 2);
});

if (failures) { console.error(`${failures} teste(s) falharam`); process.exit(1); }
console.log('Núcleo: agendador, relógio e eventos OK.');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tools/test_core.js`
Expected: FAIL com `ENOENT: no such file or directory ... core.js`

- [ ] **Step 3: Implementar `core.js`**

```js
(() => {
  'use strict';

  // Ações atrasadas que avançam com o dt do mundo: pausa e hitstop as congelam.
  function createScheduler() {
    let timers = [];
    return {
      schedule(delaySec, fn, owner = null) {
        timers.push({ t: Math.max(0, delaySec), fn, owner });
      },
      update(dt) {
        if (!timers.length) return;
        const due = [];
        for (const timer of timers) {
          timer.t -= dt;
          if (timer.t <= 0) due.push(timer);
        }
        if (!due.length) return;
        timers = timers.filter(timer => timer.t > 0);
        due.sort((a, b) => a.t - b.t);
        for (const timer of due) timer.fn();
      },
      cancelOwner(owner) {
        timers = timers.filter(timer => timer.owner !== owner);
      },
      clear() {
        timers = [];
      },
      get size() {
        return timers.length;
      },
    };
  }

  // Converte o dt real em dt de mundo. Hitstop congela; slow-mo escala.
  function createTimeControl({ maxHitstop = .12 } = {}) {
    let hitstop = 0;
    let slowScale = 1;
    let slowTimer = 0;
    return {
      hitstop(sec) {
        hitstop = Math.min(maxHitstop, Math.max(hitstop, sec));
      },
      slowmo(scale, sec) {
        slowScale = slowTimer > 0 ? Math.min(slowScale, scale) : scale;
        slowTimer = Math.max(slowTimer, sec);
      },
      step(realDt) {
        if (hitstop > 0) {
          hitstop = Math.max(0, hitstop - realDt);
          return 0;
        }
        if (slowTimer > 0) {
          slowTimer = Math.max(0, slowTimer - realDt);
          return realDt * slowScale;
        }
        return realDt;
      },
      reset() {
        hitstop = 0;
        slowScale = 1;
        slowTimer = 0;
      },
      get frozen() {
        return hitstop > 0;
      },
    };
  }

  function createEventBus() {
    const handlers = new Map();
    return {
      on(name, fn) {
        if (!handlers.has(name)) handlers.set(name, []);
        handlers.get(name).push(fn);
        return () => {
          const list = handlers.get(name);
          const i = list ? list.indexOf(fn) : -1;
          if (i >= 0) list.splice(i, 1);
        };
      },
      emit(name, data) {
        const list = handlers.get(name);
        if (!list) return;
        for (const fn of [...list]) {
          try {
            fn(data);
          } catch (err) {
            console.error(`[CV] handler de "${name}" falhou`, err);
          }
        }
      },
      clear() {
        handlers.clear();
      },
    };
  }

  window.CV_CORE = { createScheduler, createTimeControl, createEventBus };
})();
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node tools/test_core.js`
Expected: todas as linhas `ok - ...` e `Núcleo: agendador, relógio e eventos OK.`

- [ ] **Step 5: Carregar `core.js` no jogo e no harness**

Em `tools/harness.js`, trocar:

```js
const DEFAULT_SCRIPTS = ['assets/sprites/processed/atlas.js', 'game.js'];
```

por:

```js
const DEFAULT_SCRIPTS = ['assets/sprites/processed/atlas.js', 'core.js', 'game.js'];
```

Em `index.html`, trocar:

```html
  <script src="assets/sprites/scenarios/scenarios.js"></script>
  <script src="game.js"></script>
```

por:

```html
  <script src="assets/sprites/scenarios/scenarios.js"></script>
  <script src="core.js"></script>
  <script src="game.js"></script>
```

- [ ] **Step 6: Rodar os dois testes**

Run: `node tools/test_core.js && node tools/test_local_coop.js`
Expected: ambos terminam com suas mensagens de OK.

- [ ] **Step 7: Commit**

```bash
git add core.js tools/test_core.js tools/harness.js index.html
git commit -m "feat: add core scheduler, time control and event bus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Agendador por partida + ponte `window.CV`

**Files:**
- Modify: `game.js` — topo da IIFE, `createGame`, `queueHeroAction`, `queueEnemyAction`, `completeStage`, `updateStage`, fim do arquivo (antes de `requestAnimationFrame(frame)`)
- Create: `tools/test_core_integration.js`

**Interfaces:**
- Consumes: `window.CV_CORE.createScheduler` (Task 2).
- Produces:
  - `game.scheduler` (instância de `createScheduler`) criado em `createGame`.
  - `window.CV = { game: () => game, state: () => state, save: () => save, schedule(sec, fn, owner) }`. `schedule` não faz nada fora de uma partida.

- [ ] **Step 1: Escrever o teste de integração que falha — `tools/test_core_integration.js`**

```js
const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

function startSoloStage() {
  const h = createHarness();
  h.press('Enter'); // título → cria save no slot 1 → mapa
  h.press('Enter'); // mapa → Neon Harbor
  assert.equal(h.window.CV.state(), 'stage', 'a fase deve iniciar');
  return h;
}

{
  const { step, press, window } = startSoloStage();
  const CV = window.CV;
  let fired = 0;
  CV.schedule(.1, () => fired++);
  step(3);
  assert.equal(fired, 0, 'ainda não venceu');
  press('Escape');
  assert.equal(CV.state(), 'pause');
  step(60);
  assert.equal(fired, 0, 'timer não dispara durante a pausa');
  press('Escape');
  assert.equal(CV.state(), 'stage');
  step(10);
  assert.equal(fired, 1, 'timer dispara após retomar');
}

{
  const { step, press, window } = startSoloStage();
  const CV = window.CV;
  press('KeyK'); // Solar Burst agenda o golpe
  assert(CV.game().scheduler.size > 0, 'especial deve agendar o golpe');
  press('Escape');
  step(60);
  assert(CV.game().scheduler.size > 0, 'golpe pendente sobrevive à pausa');
  press('Escape');
  step(60);
  assert.equal(CV.game().scheduler.size, 0, 'golpe pendente executa após retomar');
}

{
  const { step, press, window } = startSoloStage();
  const CV = window.CV;
  let fired = 0;
  CV.schedule(.2, () => fired++);
  const oldGame = CV.game();
  press('Escape');
  press('KeyM'); // pausa → mapa
  assert.equal(CV.state(), 'map');
  press('Enter'); // nova partida
  assert.notEqual(CV.game(), oldGame);
  assert.equal(CV.game().scheduler.size, 0, 'partida nova começa sem timers');
  step(60);
  assert.equal(fired, 0, 'timer da partida anterior é descartado');
}

console.log('Núcleo integrado: agendador pausa, retoma e descarta com a partida OK.');
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tools/test_core_integration.js`
Expected: FAIL com `TypeError: Cannot read properties of undefined (reading 'state')` (ainda não há `window.CV`).

- [ ] **Step 3: Importar as fábricas no topo do `game.js`**

Adicionar logo após a linha `const SAVE_PREFIX = 'cosmic_vanguard_save_';`:

```js
  const { createScheduler } = window.CV_CORE;
```

- [ ] **Step 4: Criar o agendador em `createGame`**

No objeto retornado por `createGame(stage)`, trocar:

```js
      stageEndTimer: 0,
      lockX: null,
    };
```

por:

```js
      stageEndTimer: 0,
      lockX: null,
      scheduler: createScheduler(),
    };
```

- [ ] **Step 5: Trocar `setTimeout` por agendador em `queueHeroAction`**

Substituir a função inteira:

```js
  function queueHeroAction(p, heroId, delayMs, fn) {
    const stageGame = game;
    setTimeout(() => {
      if (state !== 'stage' || game !== stageGame || p.heroId !== heroId || p.hp <= 0) return;
      fn(p, HEROES[heroId]);
    }, delayMs);
  }
```

por:

```js
  // O agendador pertence à partida e só avança dentro de updateStage:
  // pausa congela o golpe e sair da fase o descarta.
  function queueHeroAction(p, heroId, delayMs, fn) {
    game.scheduler.schedule(delayMs / 1000, () => {
      if (p.heroId !== heroId || p.hp <= 0) return;
      fn(p, HEROES[heroId]);
    }, p);
  }
```

- [ ] **Step 6: Trocar `setTimeout` por agendador em `queueEnemyAction`**

Substituir a função inteira:

```js
  function queueEnemyAction(enemy, delayMs, fn) {
    const stageGame = game;
    setTimeout(() => {
      if (state !== 'stage' || game !== stageGame || !game.enemies.includes(enemy) || enemy.dead || game.players.every(p => p.hp <= 0)) return;
      fn(enemy);
    }, delayMs);
  }
```

por:

```js
  function queueEnemyAction(enemy, delayMs, fn) {
    game.scheduler.schedule(delayMs / 1000, () => {
      if (!game.enemies.includes(enemy) || enemy.dead || game.players.every(p => p.hp <= 0)) return;
      fn(enemy);
    }, enemy);
  }
```

- [ ] **Step 7: Trocar `setTimeout` por agendador em `completeStage`**

Em `completeStage()`, substituir:

```js
    setTimeout(() => {
      if (state === 'stage') {
        state = 'stageclear';
        game.stageEndTimer = 0;
      }
    }, 900);
```

por:

```js
    game.scheduler.schedule(.9, () => {
      state = 'stageclear';
      game.stageEndTimer = 0;
    });
```

- [ ] **Step 8: Avançar o agendador em `updateStage`**

Em `updateStage(dt)`, substituir:

```js
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateStageFlow();
```

por:

```js
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateStageFlow();
    game.scheduler.update(dt);
```

- [ ] **Step 9: Publicar `window.CV`**

No fim do `game.js`, substituir:

```js
  requestAnimationFrame(frame);
})();
```

por:

```js
  // Ponte para os módulos de gameplay (combat.js, progression.js, variety.js).
  window.CV = {
    game: () => game,
    state: () => state,
    save: () => save,
    schedule(sec, fn, owner) {
      if (game) game.scheduler.schedule(sec, fn, owner);
    },
  };

  requestAnimationFrame(frame);
})();
```

- [ ] **Step 10: Rodar todos os testes**

Run: `node tools/test_core.js && node tools/test_local_coop.js && node tools/test_core_integration.js`
Expected: as três mensagens de OK, incluindo `Núcleo integrado: agendador pausa, retoma e descarta com a partida OK.`

- [ ] **Step 11: Commit**

```bash
git add game.js tools/test_core_integration.js
git commit -m "refactor: run delayed hero and enemy actions on the stage scheduler

Pausing mid-special no longer drops the pending hit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Relógio de mundo (hitstop / slow-mo)

**Files:**
- Modify: `game.js` — import no topo, `createGame`, `updateStage`, `window.CV`
- Modify: `tools/test_core_integration.js` (acrescentar blocos antes do `console.log` final)

**Interfaces:**
- Consumes: `window.CV_CORE.createTimeControl` (Task 2), `window.CV` (Task 3).
- Produces:
  - `game.clock` (instância de `createTimeControl`) criado em `createGame`.
  - `window.CV.hitstop(sec)` e `window.CV.slowmo(scale, sec)`; sem efeito fora de partida.
  - Em `updateStage`, `wdt` = dt de mundo. `game.time` passa a medir tempo de mundo.

- [ ] **Step 1: Acrescentar testes que falham em `tools/test_core_integration.js`**

Inserir antes da linha `console.log('Núcleo integrado: ...`:

```js
{
  const { step, keyDown, keyUp, window } = startSoloStage();
  const CV = window.CV;
  const p = CV.game().players[0];
  keyDown('KeyD');
  step(5);
  const x0 = p.x;
  const t0 = CV.game().time;
  CV.hitstop(.1);
  step(3);
  assert.equal(p.x, x0, 'herói congelado durante hitstop');
  assert.equal(CV.game().time, t0, 'tempo de mundo parado durante hitstop');
  step(10);
  assert(p.x > x0, 'herói volta a andar após hitstop');
  keyUp('KeyD');

  CV.hitstop(5);
  const t1 = CV.game().time;
  step(10);
  assert(CV.game().time > t1, 'hitstop limitado a 0,12 s');
}

{
  const { step, window } = startSoloStage();
  const CV = window.CV;
  step(5);
  const t0 = CV.game().time;
  step(30);
  const normal = CV.game().time - t0;
  CV.slowmo(.5, 10);
  const t1 = CV.game().time;
  step(30);
  const slow = CV.game().time - t1;
  const ratio = slow / normal;
  assert(ratio > .45 && ratio < .55, `slow-mo deve reduzir o tempo pela metade (razão ${ratio})`);
}

{
  const { step, press, window } = startSoloStage();
  const CV = window.CV;
  CV.hitstop(.1);
  press('Escape');
  press('KeyM');
  press('Enter');
  const t0 = CV.game().time;
  step(2);
  assert(CV.game().time > t0, 'partida nova começa sem hitstop herdado');
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tools/test_core_integration.js`
Expected: FAIL com `TypeError: CV.hitstop is not a function`

- [ ] **Step 3: Importar `createTimeControl`**

Trocar:

```js
  const { createScheduler } = window.CV_CORE;
```

por:

```js
  const { createScheduler, createTimeControl } = window.CV_CORE;
```

- [ ] **Step 4: Criar o relógio em `createGame`**

Trocar:

```js
      scheduler: createScheduler(),
    };
```

por:

```js
      scheduler: createScheduler(),
      clock: createTimeControl(),
    };
```

- [ ] **Step 5: Usar o dt de mundo em `updateStage`**

Substituir o trecho de `updateStage(dt)` que vai de `game.time += dt;` até `game.scheduler.update(dt);` (inclusive) por:

```js
    // wdt = tempo de mundo (hitstop/slow-mo); dt = tempo real (UI, partículas, câmera).
    const wdt = game.clock.step(dt);
    game.time += wdt;
    for (const p of game.players) {
      p.animTime += wdt;
      p.invuln = Math.max(0, p.invuln - wdt);
      p.hurtTimer = Math.max(0, p.hurtTimer - wdt);
      p.attackTimer = Math.max(0, p.attackTimer - wdt);
      p.specialTimer = Math.max(0, p.specialTimer - wdt);
      p.dashTimer = Math.max(0, p.dashTimer - wdt);
      p.dashCooldown = Math.max(0, p.dashCooldown - wdt);
      p.switchCooldown = Math.max(0, p.switchCooldown - wdt);
      p.comboWindow = Math.max(0, p.comboWindow - wdt);
      p.flash = Math.max(0, p.flash - wdt);
      if (p.hp > 0) p.energy = Math.min(p.maxEnergy, p.energy + wdt * 8.5);
    }
    game.comboTimer = Math.max(0, game.comboTimer - wdt);
    if (game.comboTimer <= 0) game.combo = 0;
    if (game.notice?.timer > 0) game.notice.timer -= dt;

    if (game.players.every(p => p.hp <= 0)) {
      for (const p of game.players) p.hp = 0;
      game.notice = { text: 'MISSÃO FALHOU', sub: 'Pressione Enter para voltar ao mapa', timer: 999 };
      if (pressed.has('Enter') || pressed.has('Space')) state = 'map';
      updateParticles(dt);
      return;
    }

    for (const p of game.players) {
      if (p.hp <= 0) continue;
      const h = HEROES[p.heroId];
      handlePlayerMovement(p, wdt, h, controlsFor(p));
      handlePlayerActions(p, controlsFor(p));
      updatePlayerAttack(p, wdt, h);
    }
    updateEnemies(wdt);
    updateProjectiles(wdt);
    updateParticles(dt);
    updateStageFlow();
    game.scheduler.update(wdt);
```

Observação: `handlePlayerActions` continua sendo chamada durante hitstop. Um ataque iniciado no congelamento só progride quando o tempo volta, o que funciona como buffer natural de entrada. O resto de `updateStage` (câmera com `dt`) não muda.

- [ ] **Step 6: Expor `hitstop` e `slowmo` em `window.CV`**

Trocar:

```js
    schedule(sec, fn, owner) {
      if (game) game.scheduler.schedule(sec, fn, owner);
    },
  };
```

por:

```js
    schedule(sec, fn, owner) {
      if (game) game.scheduler.schedule(sec, fn, owner);
    },
    hitstop(sec) {
      if (game) game.clock.hitstop(sec);
    },
    slowmo(scale, sec) {
      if (game) game.clock.slowmo(scale, sec);
    },
  };
```

- [ ] **Step 7: Rodar todos os testes**

Run: `node tools/test_core.js && node tools/test_local_coop.js && node tools/test_core_integration.js`
Expected: as três mensagens de OK.

- [ ] **Step 8: Commit**

```bash
git add game.js tools/test_core_integration.js
git commit -m "feat: scale stage simulation by a world clock with hitstop and slow-mo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Barramento de eventos no jogo

**Files:**
- Modify: `game.js` — import no topo, `startStage`, `switchHero`, `spawnWave`, `damageEnemy`, `killEnemy`, `damagePlayer`, `updateStageFlow`, `completeStage`, `window.CV`
- Modify: `tools/test_core_integration.js` (acrescentar bloco antes do `console.log` final)

**Interfaces:**
- Consumes: `window.CV_CORE.createEventBus` (Task 2), `window.CV` (Tasks 3–4).
- Produces: `window.CV.on(name, fn) → unsubscribe` e `window.CV.emit(name, data)`. Barramento global (sobrevive entre partidas; módulos se inscrevem uma vez). Eventos e payloads:

| Evento | Payload | Onde |
| :-- | :-- | :-- |
| `stageStart` | `{ stage }` | `startStage`, após criar a partida |
| `waveStart` | `{ index, wave }` | `spawnWave`, após criar os inimigos |
| `hit` | `{ target, dmg, knock }` | `damageEnemy`, após aplicar o dano (o campo `attacker` entra na etapa 1a) |
| `kill` | `{ enemy, points }` | `killEnemy` |
| `playerDamaged` | `{ player, dmg }` | `damagePlayer` |
| `heroSwitch` | `{ player, from, to }` | `switchHero` |
| `waveClear` | `{ index }` | `updateStageFlow`, quando a onda é limpa |
| `stageClear` | `{ stage, score }` | `completeStage` |

- [ ] **Step 1: Acrescentar teste que falha em `tools/test_core_integration.js`**

Inserir antes da linha `console.log('Núcleo integrado: ...`:

```js
{
  const h = createHarness();
  const CV = h.window.CV;
  const seen = [];
  const names = ['stageStart', 'waveStart', 'hit', 'kill', 'playerDamaged', 'heroSwitch', 'waveClear', 'stageClear'];
  for (const name of names) CV.on(name, data => seen.push({ name, data }));
  const count = name => seen.filter(ev => ev.name === name).length;

  h.press('Enter');
  h.press('Enter');
  assert.equal(count('stageStart'), 1, 'stageStart');
  assert.equal(seen[0].data.stage.id, 'harbor');

  const game = CV.game();
  const p = game.players[0];

  p.x = game.stage.waves[0].x - 400;
  h.step(2);
  assert.equal(count('waveStart'), 1, 'waveStart');
  assert(game.enemies.length > 0);

  const target = game.enemies[0];
  target.x = p.x + 40;
  target.y = p.y;
  target.hp = 1;
  p.facing = 1;
  h.press('KeyJ');
  h.step(30);
  assert(count('hit') >= 1, 'hit');
  assert(count('kill') >= 1, 'kill');
  assert.equal(seen.find(ev => ev.name === 'kill').data.enemy, target);

  p.invuln = 0;
  game.projectiles.push({ x: p.x, y: p.y, vx: 0, vy: 0, damage: 5, color: '#fff', width: 10, height: 10, life: 1, owner: 'enemy', pierce: false, explosive: false, hit: new Set() });
  h.step(1);
  assert.equal(count('playerDamaged'), 1, 'playerDamaged');
  assert.equal(seen.find(ev => ev.name === 'playerDamaged').data.dmg, 5);

  h.step(40); // sai do hurtTimer
  h.press('KeyE');
  assert.equal(count('heroSwitch'), 1, 'heroSwitch');
  assert.equal(seen.find(ev => ev.name === 'heroSwitch').data.from, 'solarion');

  // Limpa todas as ondas marcando inimigos como mortos e avançando o herói.
  for (let guard = 0; guard < 20 && !game.cleared; guard++) {
    for (const e of game.enemies) e.dead = true;
    h.step(1);
    const next = game.stage.waves[game.currentWave + 1];
    if (next) p.x = Math.min(next.x - 400, game.stage.width - 120);
    h.step(2);
  }
  assert.equal(count('waveClear'), game.stage.waves.length, 'waveClear em toda onda');
  assert.equal(count('stageClear'), 1, 'stageClear');
  assert.equal(seen.find(ev => ev.name === 'stageClear').data.stage.id, 'harbor');
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node tools/test_core_integration.js`
Expected: FAIL com `TypeError: CV.on is not a function`

- [ ] **Step 3: Criar o barramento global**

Trocar:

```js
  const { createScheduler, createTimeControl } = window.CV_CORE;
```

por:

```js
  const { createScheduler, createTimeControl, createEventBus } = window.CV_CORE;
  const events = createEventBus();
```

- [ ] **Step 4: Emitir `stageStart`**

Em `startStage(stage)`, trocar:

```js
    game = createGame(stage);
    state = 'stage';
```

por:

```js
    game = createGame(stage);
    state = 'stage';
    events.emit('stageStart', { stage });
```

- [ ] **Step 5: Emitir `heroSwitch`**

Em `switchHero(p, dir)`, trocar:

```js
    const next = HEROES[list[idx]];
```

por:

```js
    const next = HEROES[list[idx]];
    const fromId = p.heroId;
```

e, no fim da função, trocar:

```js
    beep(600, .06, 'square', .03);
    beep(880, .08, 'triangle', .02);
  }
```

por:

```js
    beep(600, .06, 'square', .03);
    beep(880, .08, 'triangle', .02);
    events.emit('heroSwitch', { player: p, from: fromId, to: next.id });
  }
```

- [ ] **Step 6: Emitir `waveStart`**

Em `spawnWave(index)`, no ramo do chefe, trocar:

```js
      beep(92, .3, 'sawtooth', .035);
      setTimeout(() => beep(72, .3, 'sawtooth', .025), 100);
      return;
    }
```

por:

```js
      beep(92, .3, 'sawtooth', .035);
      setTimeout(() => beep(72, .3, 'sawtooth', .025), 100);
      events.emit('waveStart', { index, wave });
      return;
    }
```

e no fim da função, trocar:

```js
      game.enemies.push(makeEnemy(type, px, py));
    });
  }
```

por:

```js
      game.enemies.push(makeEnemy(type, px, py));
    });
    events.emit('waveStart', { index, wave });
  }
```

- [ ] **Step 7: Emitir `hit`**

Em `damageEnemy`, trocar:

```js
    game.combo++;
    game.comboTimer = 1.25;
    if (e.hp <= 0) killEnemy(e);
  }
```

por:

```js
    game.combo++;
    game.comboTimer = 1.25;
    events.emit('hit', { target: e, dmg, knock });
    if (e.hp <= 0) killEnemy(e);
  }
```

- [ ] **Step 8: Emitir `kill`**

Em `killEnemy`, trocar:

```js
    beep(e.boss ? 58 : 74, e.boss ? .22 : .07, 'sawtooth', e.boss ? .04 : .025);
  }
```

por:

```js
    beep(e.boss ? 58 : 74, e.boss ? .22 : .07, 'sawtooth', e.boss ? .04 : .025);
    events.emit('kill', { enemy: e, points });
  }
```

- [ ] **Step 9: Emitir `playerDamaged`**

Em `damagePlayer`, trocar:

```js
    screenShake = 7;
    beep(66, .08, 'square', .035);
  }
```

por:

```js
    screenShake = 7;
    beep(66, .08, 'square', .035);
    events.emit('playerDamaged', { player: p, dmg });
  }
```

- [ ] **Step 10: Emitir `waveClear`**

Em `updateStageFlow`, trocar:

```js
        game.activeWave = false;
        game.lockX = null;
```

por:

```js
        game.activeWave = false;
        game.lockX = null;
        events.emit('waveClear', { index: game.currentWave });
```

- [ ] **Step 11: Emitir `stageClear`**

Em `completeStage`, trocar:

```js
    save.highScore = Math.max(save.highScore || 0, game.score);
    persistSave();
```

por:

```js
    save.highScore = Math.max(save.highScore || 0, game.score);
    persistSave();
    events.emit('stageClear', { stage: st, score: game.score });
```

- [ ] **Step 12: Expor `on` e `emit` em `window.CV`**

Trocar:

```js
  window.CV = {
    game: () => game,
```

por:

```js
  window.CV = {
    on: events.on,
    emit: events.emit,
    game: () => game,
```

- [ ] **Step 13: Rodar todos os testes**

Run: `node tools/test_core.js && node tools/test_local_coop.js && node tools/test_core_integration.js`
Expected: as três mensagens de OK.

- [ ] **Step 14: Commit**

```bash
git add game.js tools/test_core_integration.js
git commit -m "feat: emit gameplay events through window.CV

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificação no navegador e grafo

**Files:**
- Nenhum arquivo de código. Atualiza `graphify-out/` (não versionado).

- [ ] **Step 1: Subir o servidor estático**

Usar `preview_start` com `{ name: "static" }` (definido em `.claude/launch.json`, porta 8765).

- [ ] **Step 2: Conferir console sem erros**

`read_console_messages` com `onlyErrors: true`. Expected: nenhum erro; em especial nenhum `Cannot destructure property 'createScheduler' of 'window.CV_CORE'` (indicaria `core.js` fora de ordem no `index.html`).

- [ ] **Step 3: Partida solo na Neon Harbor**

Enter (slot) → Enter (fase). Andar até a onda 1, usar J, K (Solar Burst), L, Q/E. Pausar com Esc no meio de um Solar Burst e retomar: o golpe deve acontecer após retomar. Confirmar pelo `javascript_tool`:

```js
window.CV.state() + ' timers=' + window.CV.game().scheduler.size
```

- [ ] **Step 4: Conferir hitstop visualmente**

No `javascript_tool`, com inimigos na tela: `window.CV.hitstop(.12)` — a cena deve congelar por um instante enquanto partículas continuam. `window.CV.slowmo(.35, 2)` — dois segundos em câmera lenta.

- [ ] **Step 5: Partida co-op**

Voltar ao mapa, M para co-op, Enter. Ambos os heróis se movem e atacam normalmente.

- [ ] **Step 6: Screenshot como prova**

`computer` com `action: "screenshot"` durante a partida.

- [ ] **Step 7: Atualizar o grafo**

Run: `graphify update .`
Expected: termina sem erro.
