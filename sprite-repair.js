(() => {
  'use strict';

  const ACTIONS = [
    ['idle', 4], ['walk', 6], ['attack', 4], ['jump', 3],
    ['dash', 4], ['hurt', 2], ['special', 6],
  ];

  // Cada escolha aponta para um desenho inteiro da linha original. Quadros com
  // silhuetas truncadas ou uma segunda pose reutilizam desenhos íntegros.
  const HERO_FRAMES = {
    idle: [0, 1, 2, 3],
    walk: [0, 1, 2, 3, 4, 5],
    attack: [0, 1, 2, 3],
    jump: [0, 1, 2],
    dash: [0, 1, 2, 3],
    hurt: [0, 1],
    special: [0, 1, 2, 3, 4, 5],
  };
  const HERO_OVERRIDES = {
    solarion: { walk: [0, 1, 4, 5, 4, 5], special: [0, 1, 3, 4, 5, 0] },
    night_talon: {},
    valoria: { walk: [0, 1, 4, 5, 4, 5], special: [0, 1, 4, 5, 4, 5] },
    red_velocity: {},
    abyss_king: { special: [0, 3, 4, 5, 4, 5] },
    emerald_nova: { walk: [0, 1, 4, 5, 4, 5], special: [0, 1, 3, 4, 5, 0] },
  };

  // Retângulos retirados das poses completas dos atlas originais dos inimigos.
  // Cada sequência alterna os dois recortes indicados. O restante do movimento
  // (deslocamento, salto e efeitos de combate) continua a cargo de game.js.
  const ENEMY_FRAMES = {
    shadow_trooper: {
      idle: [[25, 52, 145, 230], [170, 52, 145, 230]],
      walk: [[610, 52, 155, 228], [770, 52, 155, 228]],
      attack: [[10, 338, 205, 218], [220, 338, 215, 218]],
      jump: [[610, 52, 155, 228], [770, 52, 155, 228]],
      special: [[0, 737, 245, 198], [250, 737, 250, 198]],
    },
    pulse_gunner: {
      idle: [[20, 57, 170, 257], [190, 57, 170, 257]],
      walk: [[665, 57, 165, 257], [830, 57, 165, 257]],
      attack: [[20, 375, 225, 230]],
      jump: [[665, 57, 165, 257], [830, 57, 165, 257]],
      special: [[20, 742, 250, 197]],
    },
    armored_brute: {
      idle: [[25, 55, 160, 225]],
      walk: [[25, 55, 160, 225], [1480, 60, 170, 225]],
      attack: [[1480, 60, 170, 225]],
      jump: [[1480, 60, 170, 225]],
      special: [[15, 685, 230, 255]],
    },
    rift_assassin: {
      idle: [[15, 55, 175, 211]],
      walk: [[600, 55, 180, 211], [780, 55, 180, 211]],
      attack: [[15, 350, 190, 195]],
      jump: [[600, 55, 180, 211], [780, 55, 180, 211]],
      special: [[15, 705, 265, 230]],
    },
    void_tyrant: {
      idle: [[15, 50, 180, 217]],
      walk: [[650, 50, 180, 217], [830, 50, 180, 217]],
      attack: [[15, 322, 205, 263]],
      jump: [[650, 50, 180, 217], [830, 50, 180, 217]],
      special: [[15, 663, 210, 272]],
    },
  };

  function build(source, id) {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1680;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (source.src?.includes('/rebuilt/')) {
      ctx.drawImage(source, 0, 0);
      return canvas;
    }
    const enemy = ENEMY_FRAMES[id];
    for (const [row, [action, count]] of ACTIONS.entries()) {
      for (let frame = 0; frame < count; frame++) {
        const cellX = frame * 320;
        const cellY = row * 240;
        if (!enemy) {
          const picks = HERO_OVERRIDES[id]?.[action] || HERO_FRAMES[action];
          const pick = picks[frame];
          ctx.drawImage(source, pick * 320, cellY, 320, 240, cellX, cellY, 320, 240);
          continue;
        }
        const poses = enemy[action === 'hurt' ? 'idle' : action === 'dash' ? 'jump' : action];
        const [x, y, w, h] = poses[frame % poses.length];
        const size = Math.min(1, 280 / w, 220 / h);
        const dw = Math.round(w * size);
        const dh = Math.round(h * size);
        ctx.drawImage(source, x, y, w, h, cellX + Math.round((320 - dw) / 2), cellY + 234 - dh, dw, dh);
      }
    }
    return canvas;
  }

  window.CosmicSpriteRepair = { build, actions: ACTIONS };
})();
