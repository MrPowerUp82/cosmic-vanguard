const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./harness');

const h = createHarness({
  scripts: [
    'assets/sprites/processed/atlas.js',
    'assets/sprites/scenarios/scenarios.js',
    'core.js',
    'game.js',
  ],
});

for (const stage of h.window.SCENARIOS) {
  assert.equal(stage.scenes.length, 2, `${stage.name} precisa de dois trechos`);
  for (const scene of stage.scenes) {
    assert(fs.existsSync(path.join(__dirname, '..', scene.src)), `${scene.src} ausente`);
  }
}

h.press('Enter');
h.press('Enter');
const game = h.window.CV.game();
assert.equal(game.stage.width, 5600);
assert.equal(game.stage.waves.length, 6);
assert(game.stage.waves[2].x < game.stage.width / 2);
assert(game.stage.waves[3].x > game.stage.width / 2);

// Isola a câmera do combate para verificar os três pontos do percurso.
game.stage.waves = [];
const renderedScenes = () => h.draws.filter(draw => draw.src?.endsWith('.webp'));
game.players[0].x = 120;
h.step(30);
assert.deepEqual(renderedScenes().map(draw => path.basename(draw.src)), ['neon-harbor-quay.webp']);

game.players[0].x = game.stage.width / 2;
h.step(80);
assert.deepEqual(renderedScenes().map(draw => path.basename(draw.src)), [
  'neon-harbor-quay.webp', 'neon-harbor-drydock.webp',
]);

game.players[0].x = game.stage.width - 480;
h.step(80);
assert.deepEqual(renderedScenes().map(draw => path.basename(draw.src)), ['neon-harbor-drydock.webp']);
assert(renderedScenes()[0].sx > 0, 'o segundo cenário deve se deslocar lateralmente');

console.log('Cenários web: dois trechos por fase, câmera e transição OK.');
