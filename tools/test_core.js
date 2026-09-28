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
