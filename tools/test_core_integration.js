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
  for (const hero of game.players) hero.hp = 0;
  h.step(60);
  assert.equal(CV.state(), 'stageclear', 'vitória pendente deve ocorrer mesmo com todos os heróis mortos');
  assert.notEqual(game.notice?.text, 'MISSÃO FALHOU', 'fase concluída não deve virar derrota');
}

console.log('Núcleo integrado: agendador pausa, retoma e descarta com a partida OK.');
