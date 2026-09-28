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

console.log('Núcleo integrado: agendador pausa, retoma e descarta com a partida OK.');
