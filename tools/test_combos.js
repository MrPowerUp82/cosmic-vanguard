const assert = require('node:assert/strict');
const { createHarness } = require('./harness');

for (const id of ['solarion', 'night_talon', 'valoria', 'red_velocity', 'abyss_king', 'emerald_nova']) {
  const h = createHarness();
  h.press('Enter');
  h.press('Enter');
  h.step(30);
  const game = h.window.CV.game();
  const player = game.players[0];
  player.x = game.stage.waves[0].x + 10;
  h.step(30);
  player.heroId = id;
  player.hurtTimer = player.specialTimer = player.dashTimer = 0;
  player.invuln = 100;
  const enemy = game.enemies[0];
  assert(enemy, 'A onda inicial deve ter um alvo');
  game.enemies = [enemy];
  enemy.hp = enemy.maxHp = 10000;
  enemy.cooldown = 100;
  enemy.attackTimer = enemy.specialTimer = enemy.dashTimer = 0;
  const initialHp = enemy.hp;
  h.keyDown('KeyJ');
  h.step();
  h.keyUp('KeyJ');
  assert.equal(player.attackDefinition.combo, true);
  const duration = player.attackDuration;
  assert(Math.abs(duration - (id === 'red_velocity' ? 4 / 13 : 4 / 9)) < 1e-9, 'Preserva a duração do ataque anterior');
  let damageEvents = 0;
  const sourceFrames = new Set();
  for (let i = 0; i < 45; i++) {
    enemy.x = player.x + player.facing * 40;
    enemy.y = player.y;
    enemy.z = player.z;
    enemy.invuln = 0;
    enemy.cooldown = 100;
    const before = enemy.hp;
    h.step();
    if (enemy.hp < before) damageEvents++;
    for (const draw of h.draws) {
      if (draw.src?.endsWith(`/combos/${id}-combo-v1.png`)) sourceFrames.add(`${draw.sx},${draw.sy}`);
    }
  }
  assert.equal(player.attackTimer, 0, 'O ataque deve encerrar');
  assert.equal(player.attackHitFrames.size, 3, 'Exatamente três impactos por combo');
  assert.equal(damageEvents, 3, 'Preparação e recuperação não causam dano');
  assert(enemy.hp < initialHp);
  assert(sourceFrames.size >= 6, `${id}: a missão deve desenhar a sequência nova (${sourceFrames.size} poses)`);
  assert(h.draws.some(draw => draw.src?.endsWith(`/processed/${id}.png`)), 'Volta ao atlas normal após atacar');
}

// A ausência do atlas novo mantém o ataque anterior jogável.
const fallback = createHarness({ scripts: ['assets/sprites/processed/atlas.js', 'core.js', 'game.js'] });
fallback.press('Enter');
fallback.press('Enter');
fallback.press('KeyJ');
assert(fallback.draws.some(draw => draw.src?.endsWith('/processed/solarion.png') && draw.sy === fallback.window.SPRITE_ATLAS.cellH * 2));
console.log('Combos: seis heróis usam sheets novos, três impactos, duração preservada e fallback OK.');
