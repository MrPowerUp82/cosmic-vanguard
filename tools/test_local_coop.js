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
