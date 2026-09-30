(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width;
  const H = canvas.height;
  const SAVE_PREFIX = 'cosmic_vanguard_save_';
  const { createScheduler, createTimeControl, createEventBus } = window.CV_CORE;
  const events = createEventBus();
  const keys = Object.create(null);
  const pressed = new Set();
  const SOLO_CONTROLS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    attack: ['KeyJ', 'KeyZ'], special: ['KeyK', 'KeyX'], mobility: ['KeyL', 'KeyC'], jump: ['Space'],
    previous: ['KeyQ'], next: ['KeyE'],
  };
  const COOP_CONTROLS = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], attack: ['KeyF'], special: ['KeyG'], mobility: ['KeyH'], jump: ['Space'], previous: ['KeyQ'], next: ['KeyE'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], attack: ['KeyJ'], special: ['KeyK'], mobility: ['KeyL'], jump: ['ShiftRight'], previous: ['KeyU'], next: ['KeyO'] },
  ];
  const down = codes => codes.some(code => keys[code]);
  const justPressed = codes => codes.some(code => pressed.has(code));
  const controlsFor = p => coopMode ? COOP_CONTROLS[p.slot - 1] : SOLO_CONTROLS;
  let mouse = { x: 0, y: 0, down: false };
  let last = performance.now();
  let state = 'title';
  let previousState = 'title';
  let titleMode = 'slots';
  let selectedSlot = 1;
  let selectedNode = 0;
  let selectedRoster = 0;
  let difficultyPreview = 'normal';
  let coopMode = false;
  let save = null;
  let game = null;
  let audioCtx = null;
  let screenShake = 0;
  let flash = 0;
  let titleStars = makeStars(95, 1337);

  const DIFFICULTY = {
    easy:   { label: 'FÁCIL', enemyHp: 0.78, enemyDamage: 0.72, reward: 0.8 },
    normal: { label: 'NORMAL', enemyHp: 1.0, enemyDamage: 1.0, reward: 1.0 },
    hard:   { label: 'DIFÍCIL', enemyHp: 1.25, enemyDamage: 1.25, reward: 1.35 },
  };

  const LEGACY_HERO_MAP = {
    arc: 'solarion',
    bastion: 'night_talon',
    shade: 'valoria',
    pyre: 'red_velocity',
    cipher: 'abyss_king',
    sol: 'emerald_nova',
  };

  // Cell size and frame counts come from the atlas built by tools/slice_sprite_sheets.py.
  const SPRITE_ATLAS = window.SPRITE_ATLAS;
  const SPRITE_CELL_W = SPRITE_ATLAS.cellW;
  const SPRITE_CELL_H = SPRITE_ATLAS.cellH;
  const animRow = (row, count, fps, loop = false) => ({
    x: 0, y: row * SPRITE_CELL_H, w: count * SPRITE_CELL_W, h: SPRITE_CELL_H, count, fps, loop
  });

  const SPRITE_SHEETS = {
    solarion: {
      src: 'assets/sprites/processed/solarion.png', scale: .392,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,9,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,11,true), hurt: animRow(5,2,7), special: animRow(6,6,9)
      }
    },
    night_talon: {
      src: 'assets/sprites/processed/night_talon.png', scale: .392,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,9,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,11,true), hurt: animRow(5,2,7), special: animRow(6,6,10)
      }
    },
    valoria: {
      src: 'assets/sprites/processed/valoria.png', scale: .384,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,9,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,10,true), hurt: animRow(5,2,7), special: animRow(6,6,9)
      }
    },
    red_velocity: {
      src: 'assets/sprites/processed/red_velocity.png', scale: .392,
      animations: {
        idle: animRow(0,4,6,true), walk: animRow(1,6,12,true), attack: animRow(2,4,13),
        jump: animRow(3,3,9), dash: animRow(4,4,16,true), hurt: animRow(5,2,8), special: animRow(6,6,13)
      }
    },
    abyss_king: {
      src: 'assets/sprites/processed/abyss_king.png', scale: .376,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,10,true), hurt: animRow(5,2,7), special: animRow(6,6,9)
      }
    },
    emerald_nova: {
      src: 'assets/sprites/processed/emerald_nova.png', scale: .392,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,9,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,11,true), hurt: animRow(5,2,7), special: animRow(6,6,9)
      }
    },
  };

  const ENEMY_SHEETS = {
    shadow_trooper: {
      src: 'assets/sprites/processed/enemies/shadow_trooper.png', scale: .336,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    pulse_gunner: {
      src: 'assets/sprites/processed/enemies/pulse_gunner.png', scale: .352,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    armored_brute: {
      src: 'assets/sprites/processed/enemies/armored_brute.png', scale: .368,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,8),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,10)
      }
    },
    rift_assassin: {
      src: 'assets/sprites/processed/enemies/rift_assassin.png', scale: .336,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    void_tyrant: {
      src: 'assets/sprites/processed/enemies/void_tyrant.png', scale: .384,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,8),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,10)
      }
    },
  };

  // Frame counts differ per sheet (e.g. 7-frame walks); the rows above only set row, fps and loop.
  for (const [id, sheet] of Object.entries({ ...SPRITE_SHEETS, ...ENEMY_SHEETS })) {
    for (const [action, def] of Object.entries(sheet.animations)) {
      def.count = SPRITE_ATLAS.counts[id][action];
      def.w = def.count * SPRITE_CELL_W;
    }
  }

  const ENEMY_VISUALS = {
    grunt:         { sheet: 'shadow_trooper', scaleMul: 1.00, name: 'SHADOW TROOPER', ranged: false, leap: true, special: 'shockRush' },
    ranger:        { sheet: 'pulse_gunner',   scaleMul: 1.00, name: 'PULSE GUNNER',   ranged: true,  evade: true, special: 'volleyBlast' },
    brute:         { sheet: 'armored_brute',  scaleMul: 1.08, name: 'ARMORED BRUTE',  ranged: false, slam: true, special: 'furyBreaker' },
    elite:         { sheet: 'rift_assassin',  scaleMul: 1.02, name: 'RIFT ASSASSIN',  ranged: false, phaseLeap: true, special: 'riftOnslaught' },
    breaker_boss:  { sheet: 'armored_brute',  scaleMul: 1.18, name: 'BREAKER',        ranged: false, slam: true, special: 'furyBreaker' },
    overseer_boss: { sheet: 'pulse_gunner',   scaleMul: 1.12, name: 'OVERSEER',       ranged: true,  evade: true, special: 'volleyBlast' },
    aerial_boss:   { sheet: 'rift_assassin',  scaleMul: 1.12, name: 'AERIAL WARDEN',  ranged: false, phaseLeap: true, special: 'riftOnslaught' },
    null_boss:     { sheet: 'void_tyrant',    scaleMul: 1.24, name: 'NULL SOVEREIGN', ranged: false, phaseLeap: true, special: 'apocalypseWave' },
  };

  function getSheetDefinition(id) {
    return SPRITE_SHEETS[id] || ENEMY_SHEETS[id] || null;
  }

  function enemyVisual(enemy) {
    return ENEMY_VISUALS[enemy?.renderId] || ENEMY_VISUALS[enemy?.type] || ENEMY_VISUALS.grunt;
  }

  const spriteImages = {};
  for (const [id, sheet] of Object.entries({ ...SPRITE_SHEETS, ...ENEMY_SHEETS })) {
    const img = new Image();
    img.src = sheet.src;
    spriteImages[id] = img;
  }

  // Each image continues the attack already drawn in its character sheet.
  const PROJECTILE_VISUALS = {
    solarion:     { width: 118, height: 32, lift: 43 },
    valoria:      { width: 110, height: 25, lift: 43 },
    abyss_king:   { width: 112, height: 53, lift: 42 },
    emerald_nova: { width: 78,  height: 24, lift: 42 },
    pulse_gunner: { width: 54,  height: 21, lift: 47 },
    void_tyrant:  { width: 76,  height: 33, lift: 49 },
  };
  const projectileImages = {};
  for (const id of Object.keys(PROJECTILE_VISUALS)) {
    const img = new Image();
    img.src = `assets/sprites/projectiles/${id}.png`;
    projectileImages[id] = img;
  }

  const scenarioImages = {};
  for (const scenario of window.SCENARIOS) {
    scenarioImages[scenario.id] = scenario.scenes.map(scene => {
      const img = new Image();
      img.src = scene.src;
      return img;
    });
  }

  const titleBanner = new Image();
  titleBanner.src = 'assets/banner.png';

  const HEROES = {
    solarion: {
      id: 'solarion', name: 'SOLARION', role: 'Poder / voo', sprite: 'solarion',
      primary: '#ffb12c', secondary: '#fff4d6', accent: '#fff8ad', skin: '#e0b08d',
      hp: 124, energy: 112, speed: 178, damage: 18, specialCost: 42, attackRange: 78,
      description: 'Força solar, voo de impacto e Solar Burst.',
      mobility: 'flight', mobilityName: 'VOO SOLAR', special: 'solarBurst', specialName: 'SOLAR BURST'
    },
    night_talon: {
      id: 'night_talon', name: 'NIGHT TALON', role: 'Tático / ágil', sprite: 'night_talon',
      primary: '#47c9ff', secondary: '#101a31', accent: '#c5f3ff', skin: '#b9876a',
      hp: 106, energy: 122, speed: 210, damage: 15, specialCost: 36, attackRange: 86,
      description: 'Bastões elétricos, grapple dash e Shadow Onslaught.',
      mobility: 'glide', mobilityName: 'GRAPPLE / GLIDE', special: 'shadowOnslaught', specialName: 'SHADOW ONSLAUGHT'
    },
    valoria: {
      id: 'valoria', name: 'VALORIA', role: 'Guerreira', sprite: 'valoria',
      primary: '#ffd257', secondary: '#6e291c', accent: '#fff5c1', skin: '#c58b68',
      hp: 138, energy: 100, speed: 168, damage: 21, specialCost: 40, attackRange: 116,
      description: 'Lança, escudo, investida aérea e Aegis Storm.',
      mobility: 'lunge', mobilityName: 'AERIAL LUNGE', special: 'aegisStorm', specialName: 'AEGIS STORM'
    },
    red_velocity: {
      id: 'red_velocity', name: 'RED VELOCITY', role: 'Velocista', sprite: 'red_velocity',
      primary: '#ff5b55', secondary: '#531228', accent: '#fff0c2', skin: '#b98270',
      hp: 96, energy: 120, speed: 246, damage: 13, specialCost: 34, attackRange: 82,
      description: 'Combos cinéticos, speed dash e Kinetic Surge.',
      mobility: 'speed', mobilityName: 'SPEED DASH', special: 'kineticSurge', specialName: 'KINETIC SURGE'
    },
    abyss_king: {
      id: 'abyss_king', name: 'ABYSS KING', role: 'Controle / alcance', sprite: 'abyss_king',
      primary: '#59e7ff', secondary: '#0b5360', accent: '#ffcf5b', skin: '#bd8967',
      hp: 132, energy: 108, speed: 166, damage: 20, specialCost: 41, attackRange: 125,
      description: 'Tridente, avanço em maré e Tidal Breaker.',
      mobility: 'water', mobilityName: 'WATER RUSH', special: 'tidalBreaker', specialName: 'TIDAL BREAKER'
    },
    emerald_nova: {
      id: 'emerald_nova', name: 'EMERALD NOVA', role: 'Construtos / distância', sprite: 'emerald_nova',
      primary: '#40ff74', secondary: '#10281a', accent: '#caffd6', skin: '#b88368',
      hp: 108, energy: 126, speed: 186, damage: 16, specialCost: 38, attackRange: 96,
      description: 'Construtos sólidos, voo e Nova Barrage.',
      mobility: 'constructFlight', mobilityName: 'HARD-LIGHT FLIGHT', special: 'novaBarrage', specialName: 'NOVA BARRAGE'
    },
  };

  const STAGES = [
    {
      id: 'harbor', name: 'NEON HARBOR', subtitle: 'Zona portuária sob cerco', x: 195, y: 280,
      primary: '#20bfe6', secondary: '#09335c', recruit: 'red_velocity', width: 5600,
      unlocked: () => true,
      waves: [
        { x: 680, enemies: ['grunt','grunt','ranger'] },
        { x: 1510, enemies: ['grunt','brute','grunt','ranger'] },
        { x: 2300, enemies: ['brute','grunt','ranger','ranger'] },
        { x: 3250, enemies: ['grunt','ranger','brute'] },
        { x: 4230, enemies: ['brute','ranger','grunt','ranger'] },
        { x: 5180, boss: 'Breaker' },
      ]
    },
    {
      id: 'metro', name: 'IRON DISTRICT', subtitle: 'Fábricas automatizadas', x: 470, y: 170,
      primary: '#e79d43', secondary: '#522c1d', recruit: 'abyss_king', width: 5600,
      unlocked: () => true,
      waves: [
        { x: 700, enemies: ['grunt','ranger','grunt'] },
        { x: 1520, enemies: ['brute','brute','grunt'] },
        { x: 2310, enemies: ['ranger','ranger','brute','grunt'] },
        { x: 3260, enemies: ['grunt','ranger','brute'] },
        { x: 4240, enemies: ['brute','ranger','ranger','grunt'] },
        { x: 5180, boss: 'Overseer' },
      ]
    },
    {
      id: 'sky', name: 'SKYSPIRE', subtitle: 'Fortaleza acima das nuvens', x: 745, y: 280,
      primary: '#9b8bff', secondary: '#332c6f', recruit: 'emerald_nova', width: 5600,
      unlocked: () => true,
      waves: [
        { x: 700, enemies: ['grunt','grunt','ranger'] },
        { x: 1520, enemies: ['ranger','ranger','brute'] },
        { x: 2310, enemies: ['brute','grunt','brute','ranger'] },
        { x: 3260, enemies: ['grunt','ranger','brute'] },
        { x: 4240, enemies: ['ranger','brute','grunt','ranger'] },
        { x: 5180, boss: 'Aerial Warden' },
      ]
    },
    {
      id: 'void', name: 'VOID GATE', subtitle: 'Origem da invasão', x: 470, y: 398,
      primary: '#f35bd2', secondary: '#49104b', recruit: null, width: 6000,
      unlocked: () => ['harbor','metro','sky'].every(id => save?.completed?.includes(id)),
      waves: [
        { x: 760, enemies: ['brute','ranger','grunt','grunt'] },
        { x: 1680, enemies: ['brute','brute','ranger','ranger'] },
        { x: 2580, enemies: ['elite','grunt','ranger'] },
        { x: 3550, enemies: ['brute','ranger','grunt'] },
        { x: 4610, enemies: ['elite','brute','ranger'] },
        { x: 5650, boss: 'Null Sovereign', final: true },
      ]
    },
  ];

  const ENEMY_TYPES = {
    grunt:  { hp: 52, speed: 100, damage: 10, range: 48, cooldown: 1.05, color: '#e65b67', score: 70 },
    ranger: { hp: 44, speed: 82,  damage: 9,  range: 230, cooldown: 1.55, color: '#da79ff', score: 85, ranged: true },
    brute:  { hp: 94, speed: 72,  damage: 16, range: 56, cooldown: 1.4,  color: '#ef9c46', score: 120, scale: 1.18 },
    elite:  { hp: 135,speed: 118, damage: 18, range: 58, cooldown: .9,   color: '#ff4f9c', score: 190, scale: 1.12 },
  };

  function blankSave(slot, difficulty = 'normal') {
    return {
      version: 1,
      slot,
      difficulty,
      unlocked: ['solarion','night_talon','valoria'],
      completed: [],
      credits: 0,
      highScore: 0,
      currentHero: 'solarion',
      campaignWon: false,
      updatedAt: Date.now(),
    };
  }

  function loadSave(slot) {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      if (!raw) return blankSave(slot, difficultyPreview);
      const parsed = JSON.parse(raw);
      const migratedUnlocked = (parsed.unlocked || []).map(id => LEGACY_HERO_MAP[id] || id).filter((id, i, arr) => HEROES[id] && arr.indexOf(id) === i);
      const migratedCurrent = LEGACY_HERO_MAP[parsed.currentHero] || parsed.currentHero;
      const merged = { ...blankSave(slot), ...parsed, slot };
      merged.unlocked = migratedUnlocked.length ? migratedUnlocked : blankSave(slot).unlocked;
      merged.currentHero = HEROES[migratedCurrent] && merged.unlocked.includes(migratedCurrent) ? migratedCurrent : merged.unlocked[0];
      return merged;
    } catch {
      return blankSave(slot, difficultyPreview);
    }
  }

  function persistSave() {
    if (!save) return;
    save.updatedAt = Date.now();
    localStorage.setItem(SAVE_PREFIX + save.slot, JSON.stringify(save));
  }

  function slotInfo(slot) {
    try {
      const raw = localStorage.getItem(SAVE_PREFIX + slot);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function resetSlot(slot) {
    localStorage.removeItem(SAVE_PREFIX + slot);
  }

  function startFromSlot(slot) {
    selectedSlot = slot;
    save = loadSave(slot);
    selectedNode = 0;
    state = 'map';
    beep(420, .05, 'square', .025);
  }

  function startStage(stage) {
    if (!stage.unlocked()) {
      beep(120, .11, 'sawtooth', .03);
      return;
    }
    game = createGame(stage);
    state = 'stage';
    events.emit('stageStart', { stage });
    beep(280, .07, 'square', .025);
    setTimeout(() => beep(440, .07, 'square', .02), 70);
  }

  function createGame(stage) {
    const heroId = save.currentHero && save.unlocked.includes(save.currentHero) ? save.currentHero : save.unlocked[0];
    const available = save.unlocked.filter(id => HEROES[id]);
    const secondHero = available.find(id => id !== heroId) || heroId;
    const player = makePlayer(heroId, 120, 80, 1);
    const players = coopMode ? [player, makePlayer(secondHero, 165, 115, 2)] : [player];
    return {
      stage,
      time: 0,
      cameraX: 0,
      player,
      players,
      enemies: [],
      projectiles: [],
      particles: [],
      texts: [],
      currentWave: -1,
      activeWave: false,
      cleared: false,
      transition: 1,
      score: 0,
      combo: 0,
      comboTimer: 0,
      notice: { text: stage.name, sub: stage.subtitle, timer: 2.7 },
      bossName: null,
      stageEndTimer: 0,
      lockX: null,
      scheduler: createScheduler(),
      clock: createTimeControl(),
    };
  }

  function makePlayer(heroId, x = 120, y = 80, slot = 1) {
    const h = HEROES[heroId];
    return {
      slot,
      heroId,
      x, y, z: 0, vz: 0,
      w: 34, h: 70,
      hp: h.hp, maxHp: h.hp,
      energy: h.energy, maxEnergy: h.energy,
      facing: 1,
      moving: false,
      animTime: 0,
      attackTimer: 0,
      attackDuration: .48,
      attackHit: false,
      attackFrameLast: -1,
      attackHitFrames: new Set(),
      comboStep: 0,
      comboWindow: 0,
      specialTimer: 0,
      specialDuration: .68,
      dashTimer: 0,
      dashDuration: .34,
      dashCooldown: 0,
      mobilityHits: new Set(),
      invuln: 0,
      hurtTimer: 0,
      switchCooldown: 0,
      flash: 0,
    };
  }

  function switchHero(p, dir) {
    if (!game || state !== 'stage') return;
    if (p.switchCooldown > 0 || p.hurtTimer > 0 || save.unlocked.length < 2) return;
    const occupied = game.players.find(other => other !== p && other.hp > 0)?.heroId;
    const list = save.unlocked.filter(id => HEROES[id] && id !== occupied);
    if (list.length < 2) return;
    let idx = list.indexOf(p.heroId);
    idx = (idx + dir + list.length) % list.length;
    const next = HEROES[list[idx]];
    const fromId = p.heroId;
    const hpRatio = Math.max(0.05, p.hp / p.maxHp);
    const enRatio = p.energy / p.maxEnergy;
    p.heroId = next.id;
    p.animTime = 0;
    p.attackTimer = 0;
    p.specialTimer = 0;
    p.dashTimer = 0;
    p.attackHitFrames = new Set();
    p.mobilityHits = new Set();
    p.maxHp = next.hp;
    p.hp = Math.min(next.hp, Math.max(1, next.hp * hpRatio));
    p.maxEnergy = next.energy;
    p.energy = Math.min(next.energy, next.energy * enRatio + 14);
    p.switchCooldown = .75;
    p.invuln = .42;
    if (p.slot === 1) {
      save.currentHero = next.id;
      persistSave();
    }
    burst(p.x, p.y, '#ffffff', 22, 160);
    floatingText(p.x, p.y - 25, next.name, next.primary);
    beep(600, .06, 'square', .03);
    beep(880, .08, 'triangle', .02);
    events.emit('heroSwitch', { player: p, from: fromId, to: next.id });
  }

  function makeEnemy(type, x, y, options = {}) {
    const base = ENEMY_TYPES[type] || ENEMY_TYPES.grunt;
    const d = DIFFICULTY[save.difficulty] || DIFFICULTY.normal;
    const renderId = options.renderId || type;
    const visual = ENEMY_VISUALS[renderId] || ENEMY_VISUALS[type] || ENEMY_VISUALS.grunt;
    return {
      type,
      renderId,
      name: options.name || visual.name || type.toUpperCase(),
      boss: !!options.boss,
      x, y, z: 0,
      w: options.boss ? 52 : 34,
      h: options.boss ? 92 : 64,
      hp: (options.hp || base.hp) * d.enemyHp,
      maxHp: (options.hp || base.hp) * d.enemyHp,
      speed: (options.speed || base.speed),
      damage: (options.damage || base.damage) * d.enemyDamage,
      range: options.range || base.range,
      cooldownBase: options.cooldown || base.cooldown,
      cooldown: .25 + Math.random() * .5,
      color: options.color || base.color,
      score: options.score || base.score,
      ranged: options.ranged ?? !!base.ranged ?? !!visual.ranged,
      scale: options.scale || base.scale || 1,
      facing: -1,
      moving: false,
      animTime: 0,
      hurtTimer: 0,
      attackTimer: 0,
      attackDuration: visual.ranged ? .42 : .46,
      jumpTimer: 0,
      jumpDuration: 0,
      jumpMove: 0,
      specialTimer: 0,
      specialDuration: 0,
      specialMove: 0,
      invuln: 0,
      dead: false,
      deathTimer: 0,
      aiOffset: (Math.random() - .5) * 42,
      phase: 0,
    };
  }

  function spawnWave(index) {
    const wave = game.stage.waves[index];
    game.currentWave = index;
    game.activeWave = true;
    game.lockX = Math.min(game.stage.width - 300, wave.x + 260);
    game.notice = { text: wave.boss ? 'ALVO PRIORITÁRIO' : `ONDA ${index + 1}`, sub: wave.boss || 'Hostis detectados', timer: wave.boss ? 2.1 : 1.2 };

    if (wave.boss) {
      const bossOpts = bossPreset(wave.boss, wave.final);
      const boss = makeEnemy('elite', wave.x + 170, 92, { ...bossOpts, name: wave.boss, boss: true });
      game.enemies.push(boss);
      game.bossName = wave.boss;
      beep(92, .3, 'sawtooth', .035);
      setTimeout(() => beep(72, .3, 'sawtooth', .025), 100);
      events.emit('waveStart', { index, wave });
      return;
    }

    wave.enemies.forEach((type, i) => {
      const px = wave.x + 80 + (i % 2) * 130 + Math.random() * 35;
      const py = 28 + (i * 47) % 135;
      game.enemies.push(makeEnemy(type, px, py));
    });
    events.emit('waveStart', { index, wave });
  }

  function bossPreset(name, final = false) {
    if (final) return { hp: 520, speed: 105, damage: 23, range: 82, cooldown: .72, color: '#ff57d7', score: 1600, scale: 1.45, renderId: 'null_boss' };
    if (name === 'Breaker') return { hp: 290, speed: 92, damage: 20, range: 66, cooldown: .82, color: '#ff6b4a', score: 780, scale: 1.32, renderId: 'breaker_boss' };
    if (name === 'Overseer') return { hp: 275, speed: 104, damage: 18, range: 225, cooldown: .76, color: '#f0bd50', score: 780, scale: 1.28, renderId: 'overseer_boss', ranged: true };
    return { hp: 265, speed: 118, damage: 17, range: 68, cooldown: .7, color: '#a797ff', score: 780, scale: 1.28, renderId: 'aerial_boss' };
  }

  function update(dt) {
    document.body.classList.toggle('in-stage', state === 'stage');
    if (state === 'stage') updateStage(dt);
    else if (state === 'title') updateTitle(dt);
    else if (state === 'map') updateMap(dt);
    else if (state === 'roster') updateRoster(dt);
    else if (state === 'pause') updatePause(dt);
    else if (state === 'stageclear') updateStageClear(dt);
    else if (state === 'ending') updateEnding(dt);

    screenShake = Math.max(0, screenShake - dt * 12);
    flash = Math.max(0, flash - dt * 3.4);
    pressed.clear();
  }

  function updateTitle() {
    if (pressed.has('ArrowLeft')) selectedSlot = Math.max(1, selectedSlot - 1);
    if (pressed.has('ArrowRight')) selectedSlot = Math.min(3, selectedSlot + 1);

    if (pressed.has('KeyD')) {
      const order = ['easy','normal','hard'];
      difficultyPreview = order[(order.indexOf(difficultyPreview) + 1) % order.length];
      beep(520, .04, 'square', .02);
    }

    if (pressed.has('Delete') || pressed.has('Backspace')) {
      const info = slotInfo(selectedSlot);
      if (info) {
        resetSlot(selectedSlot);
        beep(130, .08, 'square', .025);
      }
    }

    if (pressed.has('Enter') || pressed.has('Space')) {
      const info = slotInfo(selectedSlot);
      if (!info) {
        save = blankSave(selectedSlot, difficultyPreview);
        persistSave();
      }
      startFromSlot(selectedSlot);
    }
  }

  function updateMap() {
    if (pressed.has('Escape')) {
      persistSave();
      state = 'title';
      return;
    }
    if (pressed.has('KeyR')) {
      selectedRoster = Math.max(0, save.unlocked.indexOf(save.currentHero));
      state = 'roster';
      beep(480, .04, 'square', .02);
      return;
    }
    if (pressed.has('KeyM')) toggleCoopMode();

    if (pressed.has('ArrowLeft') || pressed.has('KeyA')) cycleMap(-1);
    if (pressed.has('ArrowRight') || pressed.has('KeyD')) cycleMap(1);
    if (pressed.has('ArrowUp') || pressed.has('KeyW')) cycleMap(-1);
    if (pressed.has('ArrowDown') || pressed.has('KeyS')) cycleMap(1);

    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyJ')) {
      startStage(STAGES[selectedNode]);
    }
  }

  function toggleCoopMode() {
    coopMode = !coopMode;
    document.body.classList.toggle('coop-mode', coopMode);
    document.querySelectorAll('.solo-controls').forEach(el => { el.style.display = coopMode ? 'none' : 'inline'; });
    document.querySelectorAll('.coop-controls').forEach(el => { el.style.display = coopMode ? 'inline' : 'none'; });
    beep(coopMode ? 620 : 410, .06, 'triangle', .025);
  }

  function cycleMap(dir) {
    selectedNode = (selectedNode + dir + STAGES.length) % STAGES.length;
    beep(380 + selectedNode * 40, .03, 'square', .015);
  }

  function updateRoster() {
    const unlocked = save.unlocked.filter(id => HEROES[id]);
    if (pressed.has('Escape') || pressed.has('KeyR')) {
      state = 'map';
      return;
    }
    if (pressed.has('ArrowLeft') || pressed.has('KeyA')) {
      selectedRoster = (selectedRoster - 1 + unlocked.length) % unlocked.length;
      beep(440, .03, 'square', .015);
    }
    if (pressed.has('ArrowRight') || pressed.has('KeyD')) {
      selectedRoster = (selectedRoster + 1) % unlocked.length;
      beep(500, .03, 'square', .015);
    }
    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyJ')) {
      save.currentHero = unlocked[selectedRoster];
      persistSave();
      beep(720, .06, 'triangle', .025);
    }
  }

  function updatePause() {
    if (pressed.has('Escape') || pressed.has('KeyP')) {
      state = previousState === 'stage' ? 'stage' : 'map';
      beep(460, .04, 'square', .02);
    }
    if (pressed.has('KeyM')) {
      persistSave();
      state = 'map';
    }
  }

  function updateStageClear() {
    game.stageEndTimer += 1 / 60;
    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('KeyJ')) {
      if (game.stage.id === 'void') state = 'ending';
      else state = 'map';
    }
  }

  function updateEnding() {
    if (pressed.has('Enter') || pressed.has('Space')) state = 'map';
  }

  function updateStage(dt) {
    if (pressed.has('Escape') || pressed.has('KeyP')) {
      previousState = 'stage';
      state = 'pause';
      beep(220, .04, 'square', .02);
      return;
    }

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

    if (game.cleared && game.players.every(p => p.hp <= 0)) {
      updateParticles(dt);
      game.scheduler.update(wdt);
      return;
    }

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

    const living = game.players.filter(p => p.hp > 0);
    if (!living.length) return;
    const centerX = living.reduce((sum, p) => sum + p.x, 0) / living.length;
    const targetCam = clamp(centerX - W / 2, 0, game.stage.width - W + 120);
    game.cameraX = lerp(game.cameraX, targetCam, 1 - Math.pow(.0001, dt));
    if (coopMode) {
      for (const p of living) p.x = clamp(p.x, game.cameraX + 30, game.cameraX + W - 30);
    }
  }

  function animDuration(heroId, action) {
    const def = SPRITE_SHEETS[heroId]?.animations?.[action];
    if (!def) return .4;
    return Math.max(.18, def.count / def.fps);
  }

  function mobilityProfile(type) {
    const profiles = {
      flight:          { duration: .42, speedMul: 2.35, cooldown: .62, invuln: .30, damage: 24, range: 78, color: '#ffd45a' },
      glide:           { duration: .38, speedMul: 2.55, cooldown: .58, invuln: .28, damage: 21, range: 82, color: '#49cfff' },
      lunge:           { duration: .42, speedMul: 2.20, cooldown: .66, invuln: .26, damage: 30, range: 112, color: '#ffd96c' },
      speed:           { duration: .31, speedMul: 3.35, cooldown: .46, invuln: .24, damage: 18, range: 85, color: '#ff664f' },
      water:           { duration: .40, speedMul: 2.42, cooldown: .62, invuln: .28, damage: 27, range: 100, color: '#55e6ff' },
      constructFlight: { duration: .42, speedMul: 2.35, cooldown: .60, invuln: .28, damage: 22, range: 88, color: '#48ff78' },
    };
    return profiles[type] || profiles.flight;
  }

  function handlePlayerMovement(p, dt, h, controls) {
    let dx = 0, dy = 0;
    const movementLocked = p.hurtTimer > 0 || p.attackTimer > .09 || p.specialTimer > 0;

    if (!movementLocked || p.dashTimer > 0) {
      if (down(controls.left)) dx -= 1;
      if (down(controls.right)) dx += 1;
      if (down(controls.up)) dy -= 1;
      if (down(controls.down)) dy += 1;
      if (dx && dy) { dx *= .7071; dy *= .7071; }
    }

    let speedMul = 1;
    if (p.dashTimer > 0) {
      const profile = mobilityProfile(h.mobility);
      dx = p.facing * profile.speedMul;
      dy *= .28;
      speedMul = 1.25;
      updateMobilityHits(p, h, profile);
    }

    if (dx !== 0) p.facing = Math.sign(dx);
    p.moving = Math.abs(dx) > .01 || Math.abs(dy) > .01;

    const speed = h.speed * speedMul;
    p.x += dx * speed * dt;
    p.y += dy * speed * .72 * dt;

    let maxX = game.stage.width - 120;
    if (game.activeWave && game.lockX != null) maxX = Math.min(maxX, game.lockX);
    p.x = clamp(p.x, 40, maxX);
    p.y = clamp(p.y, 15, 180);

    if (p.z > 0 || p.vz !== 0) {
      p.z += p.vz * dt;
      p.vz -= 760 * dt;
      if (p.z <= 0) { p.z = 0; p.vz = 0; }
    }
  }

  function startMobility(p) {
    const h = HEROES[p.heroId];
    const profile = mobilityProfile(h.mobility);
    p.dashDuration = profile.duration;
    p.dashTimer = profile.duration;
    p.dashCooldown = profile.cooldown;
    p.invuln = Math.max(p.invuln, profile.invuln);
    p.mobilityHits = new Set();
    p.animTime = 0;
    burst(p.x - p.facing * 12, p.y, profile.color || h.primary, h.mobility === 'speed' ? 18 : 11, h.mobility === 'speed' ? 220 : 150);
    if (h.mobility === 'water') burst(p.x, p.y + 8, '#b8f8ff', 12, 170);
    if (h.mobility === 'lunge') p.vz = Math.max(p.vz, 80);
    beep(h.mobility === 'speed' ? 235 : 170, .05, 'sawtooth', .02);
  }

  function updateMobilityHits(p, h, profile) {
    for (const e of game.enemies) {
      if (e.dead || e.invuln > 0 || p.mobilityHits.has(e)) continue;
      const dx = e.x - p.x;
      const dy = Math.abs(e.y - p.y);
      const ahead = p.facing > 0 ? dx > -45 && dx < profile.range : dx < 45 && dx > -profile.range;
      if (ahead && dy < 58) {
        p.mobilityHits.add(e);
        damageEnemy(e, profile.damage, p.facing * (h.mobility === 'speed' ? 160 : 120));
        p.energy = Math.min(p.maxEnergy, p.energy + 2);
        screenShake = Math.max(screenShake, h.mobility === 'lunge' || h.mobility === 'water' ? 6 : 4);
      }
    }
  }

  function handlePlayerActions(p, controls) {
    if (justPressed(controls.jump) && p.z === 0 && p.hurtTimer <= 0 && p.specialTimer <= 0 && p.attackTimer <= 0 && p.dashTimer <= 0) {
      p.vz = 340;
      p.z = 1;
      p.animTime = 0;
      beep(250, .03, 'square', .014);
    }
    if (justPressed(controls.previous)) switchHero(p, -1);
    if (justPressed(controls.next)) switchHero(p, 1);

    if (justPressed(controls.mobility) && p.dashCooldown <= 0 && p.hurtTimer <= 0 && p.attackTimer <= 0 && p.specialTimer <= 0) {
      startMobility(p);
    }

    if (justPressed(controls.attack) && p.hurtTimer <= 0 && p.specialTimer <= 0 && p.dashTimer <= 0 && p.attackTimer <= 0) {
      p.attackDuration = animDuration(p.heroId, 'attack');
      p.attackTimer = p.attackDuration;
      p.attackHit = false;
      p.attackFrameLast = -1;
      p.attackHitFrames = new Set();
      p.comboStep = 0;
      p.comboWindow = .55;
      p.animTime = 0;
      beep(150, .03, 'square', .014);
    }

    if (justPressed(controls.special) && p.hurtTimer <= 0 && p.specialTimer <= 0 && p.attackTimer <= 0 && p.dashTimer <= 0) {
      useSpecial(p);
    }
  }

  function updatePlayerAttack(p, dt, h) {
    if (p.attackTimer <= 0) return;
    const def = SPRITE_SHEETS[p.heroId]?.animations?.attack;
    const count = def?.count || 4;
    const elapsed = p.attackDuration - p.attackTimer;
    const progress = clamp(elapsed / Math.max(.001, p.attackDuration), 0, .9999);
    const frameIndex = Math.min(count - 1, Math.floor(progress * count));
    p.comboStep = frameIndex;
    if (frameIndex <= 0 || p.attackHitFrames.has(frameIndex)) return;
    p.attackHitFrames.add(frameIndex);

    const factors = [0, .72, .90, 1.28];
    const dmg = h.damage * (factors[frameIndex] || 1);
    const range = h.attackRange + (frameIndex === count - 1 ? 18 : 0);
    let hits = 0;
    game.enemies.forEach(e => {
      if (e.dead || e.invuln > 0) return;
      const dx = e.x - p.x;
      const dy = Math.abs(e.y - p.y);
      const inFront = p.facing > 0 ? dx > -26 && dx < range : dx < 26 && dx > -range;
      if (inFront && dy < 54 && Math.abs(e.z - p.z) < 70) {
        damageEnemy(e, dmg, p.facing * (frameIndex === count - 1 ? 120 : 62));
        hits++;
      }
    });
    if (hits) {
      p.energy = Math.min(p.maxEnergy, p.energy + 2 + hits * 1.5);
      screenShake = Math.max(screenShake, frameIndex === count - 1 ? 7 : 3);
      beep(84 + frameIndex * 12, .035, 'square', .025);
    }
  }

  function forwardHit(p, range, lane, dmg, knock, originX = null) {
    const ox = originX ?? p.x;
    let hits = 0;
    for (const e of game.enemies) {
      if (e.dead || e.invuln > 0) continue;
      const dx = e.x - ox;
      const inFront = p.facing > 0 ? dx > -25 && dx < range : dx < 25 && dx > -range;
      if (inFront && Math.abs(e.y - p.y) < lane) {
        damageEnemy(e, dmg, p.facing * knock);
        hits++;
      }
    }
    return hits;
  }

  // O agendador pertence à partida e só avança dentro de updateStage:
  // pausa congela o golpe e sair da fase o descarta.
  function queueHeroAction(p, heroId, delayMs, fn) {
    game.scheduler.schedule(delayMs / 1000, () => {
      if (p.heroId !== heroId || p.hp <= 0) return;
      fn(p, HEROES[heroId]);
    }, p);
  }

  function useSpecial(p) {
    const h = HEROES[p.heroId];
    if (p.energy < h.specialCost) {
      floatingText(p.x, p.y - 35, 'SEM ENERGIA', '#9eb0c9');
      beep(115, .05, 'square', .018);
      return;
    }
    p.energy -= h.specialCost;
    p.specialDuration = animDuration(p.heroId, 'special');
    p.specialTimer = p.specialDuration;
    p.invuln = Math.max(p.invuln, p.specialDuration * .72);
    p.animTime = 0;
    flash = Math.max(flash, .14);
    const heroId = p.heroId;
    const hitAt = Math.round(p.specialDuration * 1000 * .42);

    switch (h.special) {
      case 'solarBurst':
        queueHeroAction(p, heroId, hitAt, (pp, hh) => {
          spawnPlayerProjectile(pp.x + pp.facing * 55, pp.y, pp.facing * 720, 0, 48, '#ffd75f', 42, 18, .72, true, false, 'solarion');
          for (let i = 0; i < 34; i++) game.particles.push({
            x: pp.x + pp.facing * (35 + Math.random() * 370), y: pp.y + (Math.random() - .5) * 28,
            vx: pp.facing * (50 + Math.random() * 100), vy: (Math.random() - .5) * 40,
            life: .22 + Math.random() * .25, maxLife: .48, size: 3 + Math.random() * 8, color: i % 3 ? '#ffd75f' : '#fff7cd'
          });
          screenShake = 10;
        });
        break;
      case 'shadowOnslaught':
        [0.28, 0.43, 0.58, 0.70].forEach((ratio, i) => queueHeroAction(p, heroId, Math.round(p.specialDuration * 1000 * ratio), (pp, hh) => {
          pp.x = clamp(pp.x + pp.facing * 34, 40, game.stage.width - 120);
          forwardHit(pp, 220, 72, 15 + i * 3, 70 + i * 20);
          burst(pp.x + pp.facing * 50, pp.y, i % 2 ? '#43d5ff' : '#0d69b7', 10, 170);
          screenShake = Math.max(screenShake, 4 + i);
        }));
        break;
      case 'aegisStorm':
        queueHeroAction(p, heroId, hitAt - 40, (pp, hh) => {
          areaHit(pp.x, pp.y, 145, 30, 130);
          burst(pp.x, pp.y, '#ffe174', 26, 210);
        });
        queueHeroAction(p, heroId, hitAt + 120, (pp, hh) => {
          spawnPlayerProjectile(pp.x + pp.facing * 55, pp.y, pp.facing * 390, 0, 36, '#ffd85b', 28, 18, .9, true, false, 'valoria');
          screenShake = 8;
        });
        break;
      case 'kineticSurge':
        [0.30, 0.42, 0.54, 0.66].forEach((ratio, i) => queueHeroAction(p, heroId, Math.round(p.specialDuration * 1000 * ratio), (pp, hh) => {
          pp.x = clamp(pp.x + pp.facing * 62, 40, game.stage.width - 120);
          forwardHit(pp, 185, 74, 13 + i * 4, 85 + i * 22);
          burst(pp.x, pp.y, '#ff6b4f', 14, 230);
        }));
        break;
      case 'tidalBreaker':
        queueHeroAction(p, heroId, hitAt, (pp, hh) => {
          areaHit(pp.x, pp.y, 95, 22, 90);
          spawnPlayerProjectile(pp.x + pp.facing * 52, pp.y, pp.facing * 315, 0, 48, '#61e8ff', 50, 28, 1.12, true, true, 'abyss_king');
          burst(pp.x + pp.facing * 35, pp.y, '#c6fbff', 26, 190);
          screenShake = 11;
        });
        break;
      case 'novaBarrage':
        for (let i = 0; i < 4; i++) {
          queueHeroAction(p, heroId, Math.round(p.specialDuration * 1000 * (.28 + i * .09)), (pp, hh) => {
            spawnPlayerProjectile(pp.x + pp.facing * 38, pp.y + (Math.random() - .5) * 18, pp.facing * (470 + i * 35), (Math.random() - .5) * 20, 15, '#48ff78', 18, 10, .85, true, false, 'emerald_nova');
            beep(320 + i * 45, .025, 'square', .014);
          });
        }
        queueHeroAction(p, heroId, Math.round(p.specialDuration * 1000 * .68), (pp, hh) => {
          spawnPlayerProjectile(pp.x + pp.facing * 52, pp.y, pp.facing * 550, 0, 34, '#48ff78', 30, 14, .82, true, false, 'emerald_nova');
          burst(pp.x + pp.facing * 75, pp.y, '#baffc7', 24, 220);
          screenShake = 8;
        });
        break;
    }

    beep(92, .08, 'sawtooth', .03);
    setTimeout(() => beep(620, .08, 'triangle', .02), 35);
  }

  function areaHit(x, y, radius, dmg, knock) {
    game.enemies.forEach(e => {
      if (e.dead || e.invuln > 0) return;
      const dx = e.x - x, dy = (e.y - y) * 1.2;
      if (Math.hypot(dx, dy) <= radius) damageEnemy(e, dmg, Math.sign(dx || 1) * knock);
    });
  }

  function spawnPlayerProjectile(x, y, vx, vy, damage, color, width = 14, height = 8, life = .9, pierce = false, explosive = false, spriteId = null) {
    game.projectiles.push({ x, y, vx, vy, damage, color, width, height, life, owner: 'player', pierce, explosive, spriteId, hit: new Set() });
  }

  function spawnEnemyProjectile(e, p) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = e.boss ? 300 : 235;
    game.projectiles.push({
      x: e.x, y: e.y - 3,
      vx: dx / len * speed, vy: dy / len * speed,
      damage: e.damage * (e.boss ? 1.05 : .82), color: e.boss ? '#ff60de' : '#dc8cff',
      width: e.boss ? 16 : 10, height: e.boss ? 16 : 10, life: 1.7,
      owner: 'enemy', pierce: false, explosive: false, spriteId: 'pulse_gunner', hit: new Set()
    });
    beep(190, .035, 'sawtooth', .012);
  }

  function queueEnemyAction(enemy, delayMs, fn) {
    game.scheduler.schedule(delayMs / 1000, () => {
      if (!game.enemies.includes(enemy) || enemy.dead || game.players.every(p => p.hp <= 0)) return;
      fn(enemy);
    }, enemy);
  }

  function targetForEnemy(e) {
    const living = game.players.filter(p => p.hp > 0);
    return living.reduce((nearest, p) =>
      !nearest || Math.hypot(p.x - e.x, p.y - e.y) < Math.hypot(nearest.x - e.x, nearest.y - e.y) ? p : nearest, null);
  }

  function enemyMeleeHit(e, dmgMul = 1, extraRange = 0, knock = 70, lane = 50) {
    let hit = false;
    for (const p of game.players) {
      if (p.invuln > 0 || p.hp <= 0) continue;
      if (Math.abs(p.x - e.x) < e.range + extraRange && Math.abs(p.y - e.y) < lane && Math.abs((p.z || 0) - (e.z || 0)) < 90) {
        damagePlayer(p, e.damage * dmgMul, Math.sign(p.x - e.x || 1) * knock);
        hit = true;
      }
    }
    return hit;
  }

  function enemyAreaHit(e, radius, dmgMul = 1, knock = 85) {
    let hit = false;
    for (const p of game.players) {
      if (p.invuln > 0 || p.hp <= 0) continue;
      const dx = p.x - e.x;
      const dy = (p.y - e.y) * 1.15;
      if (Math.hypot(dx, dy) <= radius) {
        damagePlayer(p, e.damage * dmgMul, Math.sign(dx || 1) * knock);
        hit = true;
      }
    }
    return hit;
  }

  function spawnEnemyProjectilePattern(e, count = 3, speed = 255, spread = 0.24, color = null, width = 12, height = 12) {
    const p = targetForEnemy(e);
    if (!p) return;
    const baseAngle = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * spread;
      game.projectiles.push({
        x: e.x, y: e.y - 4,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage: e.damage * (e.boss ? 0.92 : 0.72), color: color || e.color,
        width, height, life: 1.7, owner: 'enemy', pierce: false, explosive: false, spriteId: 'pulse_gunner', hit: new Set()
      });
    }
  }

  function startEnemyAttack(e) {
    const visual = enemyVisual(e);
    e.attackDuration = visual.ranged ? .42 : .46;
    e.attackTimer = e.attackDuration;
    e.animTime = 0;
    if (visual.ranged) {
      queueEnemyAction(e, 145, () => {
        const target = targetForEnemy(e);
        if (target) spawnEnemyProjectile(e, target);
      });
    } else {
      queueEnemyAction(e, 145, () => enemyMeleeHit(e, e.boss && e.phase ? 1.1 : 1, 16, e.boss ? 110 : 70));
    }
  }

  function startEnemyJump(e) {
    const visual = enemyVisual(e);
    e.jumpDuration = visual.evade ? .34 : (visual.slam ? .52 : .42);
    e.jumpTimer = e.jumpDuration;
    e.animTime = 0;
    e.jumpMove = visual.evade ? -e.facing * 220 : e.facing * (visual.phaseLeap ? 260 : visual.slam ? 115 : 180);
    if (visual.evade) {
      burst(e.x, e.y, e.color, 7, 120);
      return;
    }
    if (visual.slam) {
      queueEnemyAction(e, 290, () => {
        enemyAreaHit(e, e.boss ? 118 : 96, e.boss ? 1.25 : 1.05, e.boss ? 110 : 90);
        burst(e.x, e.y + 12, '#ffd19a', e.boss ? 16 : 12, e.boss ? 210 : 170);
        screenShake = Math.max(screenShake, e.boss ? 10 : 7);
      });
    } else if (visual.phaseLeap) {
      queueEnemyAction(e, 220, () => {
        const target = targetForEnemy(e);
        if (!target) return;
        e.x = clamp(target.x - e.facing * 40, game.cameraX - 60, game.stage.width - 70);
        enemyMeleeHit(e, 1.05, 28, 95);
        burst(e.x, e.y, '#7ef3ff', 10, 140);
      });
    } else {
      queueEnemyAction(e, 220, () => {
        enemyMeleeHit(e, 1.08, 28, 90);
        burst(e.x, e.y, '#ffd5d5', 8, 110);
      });
    }
  }

  function startEnemySpecial(e) {
    const visual = enemyVisual(e);
    const kind = visual.special;
    e.specialDuration = kind === 'apocalypseWave' ? .94 : kind === 'furyBreaker' ? .82 : .72;
    e.specialTimer = e.specialDuration;
    e.animTime = 0;
    e.specialMove = kind === 'shockRush' ? e.facing * 170 : 0;
    if (kind === 'shockRush') {
      [180, 310, 460].forEach((ms, i) => queueEnemyAction(e, ms, () => {
        e.x = clamp(e.x + e.facing * 42, game.cameraX - 60, game.stage.width - 70);
        enemyMeleeHit(e, .82 + i * .12, 40, 78 + i * 12);
        burst(e.x, e.y, '#ff6b6b', 8, 150);
      }));
    } else if (kind === 'volleyBlast') {
      [210, 320, 430].forEach((ms, i) => queueEnemyAction(e, ms, () => {
        spawnEnemyProjectilePattern(e, e.boss ? 3 : 2, 255 + i * 18, e.boss ? .20 : .12, '#f27dff', e.boss ? 12 : 10, e.boss ? 12 : 10);
        burst(e.x + e.facing * 18, e.y - 4, '#ffb8ff', 5, 80);
      }));
    } else if (kind === 'furyBreaker') {
      queueEnemyAction(e, 380, () => {
        enemyAreaHit(e, e.boss ? 132 : 110, e.boss ? 1.42 : 1.22, e.boss ? 120 : 95);
        burst(e.x, e.y + 8, '#ffc367', 20, 220);
        screenShake = Math.max(screenShake, e.boss ? 12 : 9);
      });
    } else if (kind === 'riftOnslaught') {
      [180, 330, 500].forEach((ms, i) => queueEnemyAction(e, ms, () => {
        e.x = clamp(e.x + e.facing * 56, game.cameraX - 60, game.stage.width - 70);
        enemyMeleeHit(e, .86 + i * .16, 48, 84 + i * 10);
        burst(e.x, e.y, i % 2 ? '#8af8ff' : '#49d4ff', 10, 170);
      }));
    } else if (kind === 'apocalypseWave') {
      queueEnemyAction(e, 360, () => {
        for (let i = 0; i < 3; i++) {
          game.projectiles.push({
            x: e.x + e.facing * 18, y: e.y - 12 + i * 8,
            vx: e.facing * (300 + i * 40), vy: -10 + i * 10,
            damage: e.damage * 0.9, color: '#ff66ff', width: 20, height: 14,
            life: 1.35, owner: 'enemy', pierce: false, explosive: true, spriteId: 'void_tyrant', hit: new Set()
          });
        }
        enemyMeleeHit(e, 1.2, 250, 115);
        burst(e.x + e.facing * 30, e.y - 10, '#ff77ff', 20, 210);
        flash = Math.max(flash, .2);
        screenShake = Math.max(screenShake, 12);
      });
    }
  }

  function enemyAnimation(e) {
    const visual = enemyVisual(e);
    const sheetId = visual.sheet;
    if (e.hurtTimer > 0) return { sheetId, action: 'hurt', index: 0 };
    if (e.specialTimer > 0) return getAnimationFrame(sheetId, 'special', e.specialDuration - e.specialTimer, e.specialDuration);
    if (e.jumpTimer > 0) return getAnimationFrame(sheetId, 'jump', e.jumpDuration - e.jumpTimer, e.jumpDuration);
    if (e.attackTimer > 0) return getAnimationFrame(sheetId, 'attack', e.attackDuration - e.attackTimer, e.attackDuration);
    if (e.moving) return getAnimationFrame(sheetId, 'walk', e.animTime);
    return getAnimationFrame(sheetId, 'idle', e.animTime);
  }

  function updateProjectiles(dt) {
    for (const pr of game.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.owner === 'player') {
        for (const e of game.enemies) {
          if (e.dead || e.invuln > 0 || pr.hit.has(e)) continue;
          if (Math.abs(e.x - pr.x) < pr.width + e.w * .45 && Math.abs(e.y - pr.y) < 34) {
            pr.hit.add(e);
            damageEnemy(e, pr.damage, Math.sign(pr.vx) * 80);
            burst(pr.x, pr.y, pr.color, 8, 120);
            if (pr.explosive) areaHit(pr.x, pr.y, 85, pr.damage * .55, 75);
            if (!pr.pierce) pr.life = 0;
          }
        }
      } else {
        for (const p of game.players) {
          if (p.hp > 0 && p.invuln <= 0 && Math.abs(p.x - pr.x) < pr.width + 18 && Math.abs(p.y - pr.y) < 32) {
            damagePlayer(p, pr.damage, Math.sign(pr.vx) * 65);
            burst(pr.x, pr.y, pr.color, 7, 100);
            pr.life = 0;
            break;
          }
        }
      }
    }
    game.projectiles = game.projectiles.filter(pr => pr.life > 0 && pr.x > game.cameraX - 200 && pr.x < game.cameraX + W + 500);
  }

  function updateEnemies(dt) {
    for (const e of game.enemies) {
      const visual = enemyVisual(e);
      e.animTime += dt;
      e.invuln = Math.max(0, e.invuln - dt);
      e.hurtTimer = Math.max(0, e.hurtTimer - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      e.jumpTimer = Math.max(0, e.jumpTimer - dt);
      e.specialTimer = Math.max(0, e.specialTimer - dt);
      e.moving = false;

      if (e.dead) {
        e.deathTimer += dt;
        continue;
      }
      if (e.hp <= 0) {
        killEnemy(e);
        continue;
      }
      if (e.boss && e.hp < e.maxHp * .5) e.phase = 1;

      if (e.jumpTimer > 0) {
        const progress = 1 - e.jumpTimer / Math.max(0.001, e.jumpDuration || 1);
        e.z = Math.sin(progress * Math.PI) * (visual.evade ? 22 : visual.slam ? 48 : 38);
        e.x += e.jumpMove * dt;
        e.moving = true;
      } else {
        e.z = 0;
        e.jumpMove = 0;
      }

      if (e.specialTimer > 0 && visual.special === 'shockRush') {
        e.x += e.specialMove * dt;
        e.moving = true;
      }

      if (e.hurtTimer > 0 || e.jumpTimer > 0 || e.specialTimer > 0) {
        e.y = clamp(e.y, 12, 182);
        e.x = clamp(e.x, game.cameraX - 80, game.stage.width - 70);
        continue;
      }

      const p = targetForEnemy(e);
      if (!p) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      e.facing = dx >= 0 ? 1 : -1;

      const desiredRange = e.ranged ? e.range * .78 : e.range * .74;
      let moveX = 0, moveY = 0;
      if (e.ranged && absX < 120) {
        moveX -= Math.sign(dx) * e.speed * .7 * dt;
      } else if (absX > desiredRange || absY > 36) {
        const sx = absX > desiredRange ? Math.sign(dx) : 0;
        const sy = absY > 18 ? Math.sign(dy) : 0;
        moveX += sx * e.speed * dt;
        moveY += sy * e.speed * .55 * dt;
      }
      if (moveX || moveY) e.moving = true;
      e.x += moveX;
      e.y += moveY;
      e.y = clamp(e.y, 12, 182);
      e.x = clamp(e.x, game.cameraX - 80, game.stage.width - 70);

      if (e.cooldown <= 0 && absY < 54) {
        const canJump = !e.ranged && absX > e.range * 1.1 && absX < e.range * 2.2 && (visual.leap || visual.slam || visual.phaseLeap);
        const canSpecial = absX <= (e.ranged ? e.range * .95 : e.range * 1.35);
        const specialChance = e.boss ? (e.phase ? 0.55 : 0.28) : visual.special && (e.type === 'elite' ? 0.26 : e.type === 'brute' ? 0.14 : e.type === 'grunt' ? 0.10 : e.type === 'ranger' ? 0.12 : 0.08);
        const jumpChance = visual.evade ? (absX < 118 ? 0.75 : 0) : (e.boss ? 0.28 : 0.18);

        if (visual.evade && absX < 118) {
          e.cooldown = e.cooldownBase * 0.85;
          startEnemyJump(e);
        } else if (visual.special && canSpecial && Math.random() < specialChance) {
          e.cooldown = e.cooldownBase * (e.boss ? 1.35 : 1.55);
          startEnemySpecial(e);
        } else if (canJump && Math.random() < jumpChance) {
          e.cooldown = e.cooldownBase * 1.1;
          startEnemyJump(e);
        } else if (absX <= e.range) {
          e.cooldown = e.cooldownBase * (e.boss && e.phase ? .75 : 1) * (.88 + Math.random() * .24);
          startEnemyAttack(e);
        }
      }

      if (e.boss && e.phase && !e.ranged && e.cooldown > .2 && Math.random() < dt * .22) {
        e.x += Math.sign(dx) * e.speed * 1.8 * dt;
      }
    }

    game.enemies = game.enemies.filter(e => !(e.dead && e.deathTimer > .8));
  }

  function damageEnemy(e, dmg, knock = 0) {
    if (e.dead || e.invuln > 0) return;
    e.hp -= dmg;
    e.invuln = .07;
    e.hurtTimer = e.boss ? .10 : .18;
    e.x += knock * .08;
    burst(e.x, e.y - 5, '#fff3c7', e.boss ? 10 : 6, e.boss ? 145 : 100);
    floatingText(e.x, e.y - 42, Math.round(dmg).toString(), '#fff1b2', .52);
    game.combo++;
    game.comboTimer = 1.25;
    events.emit('hit', { target: e, dmg, knock });
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.deathTimer = 0;
    e.hp = 0;
    const mult = DIFFICULTY[save.difficulty]?.reward || 1;
    const points = Math.round((e.score || 100) * mult);
    game.score += points;
    save.credits += e.boss ? 90 : Math.round(points / 20);
    burst(e.x, e.y, e.color, e.boss ? 34 : 16, e.boss ? 230 : 160);
    floatingText(e.x, e.y - 60, `+${points}`, '#ffe86d');
    screenShake = Math.max(screenShake, e.boss ? 14 : 5);
    flash = Math.max(flash, e.boss ? .38 : .08);
    beep(e.boss ? 58 : 74, e.boss ? .22 : .07, 'sawtooth', e.boss ? .04 : .025);
    events.emit('kill', { enemy: e, points });
  }

  function damagePlayer(p, dmg, knock) {
    if (p.invuln > 0 || p.hp <= 0) return;
    p.hp -= dmg;
    p.invuln = .55;
    p.hurtTimer = .28;
    p.flash = .18;
    p.x += knock * .07;
    burst(p.x, p.y, '#ff8a94', 10, 135);
    floatingText(p.x, p.y - 46, `-${Math.round(dmg)}`, '#ff8d9b');
    screenShake = 7;
    beep(66, .08, 'square', .035);
    events.emit('playerDamaged', { player: p, dmg });
  }

  function updateStageFlow() {
    if (!game.activeWave && game.currentWave + 1 < game.stage.waves.length) {
      const next = game.stage.waves[game.currentWave + 1];
      if (game.players.some(p => p.hp > 0 && p.x >= next.x - 480)) spawnWave(game.currentWave + 1);
    }

    if (game.activeWave) {
      const alive = game.enemies.some(e => !e.dead);
      if (!alive) {
        game.activeWave = false;
        game.lockX = null;
        events.emit('waveClear', { index: game.currentWave });
        if (game.currentWave === game.stage.waves.length - 1) completeStage();
        else game.notice = { text: 'ÁREA LIMPA', sub: 'Avance para o próximo setor', timer: 1.25 };
      }
    }
  }

  function completeStage() {
    if (game.cleared) return;
    game.cleared = true;
    const st = game.stage;
    if (!save.completed.includes(st.id)) save.completed.push(st.id);
    if (st.recruit && !save.unlocked.includes(st.recruit)) {
      save.unlocked.push(st.recruit);
      save.currentHero = st.recruit;
    }
    if (st.id === 'void') save.campaignWon = true;
    save.highScore = Math.max(save.highScore || 0, game.score);
    persistSave();
    events.emit('stageClear', { stage: st, score: game.score });
    game.scheduler.schedule(.9, () => {
      state = 'stageclear';
      game.stageEndTimer = 0;
    });
  }

  function updateParticles(dt) {
    for (const p of game.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(.06, dt);
      p.vy *= Math.pow(.12, dt);
    }
    game.particles = game.particles.filter(p => p.life > 0);
    for (const t of game.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    game.texts = game.texts.filter(t => t.life > 0);
  }

  function burst(x, y, color, count = 10, speed = 130) {
    if (!game) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (.35 + Math.random() * .7);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * .62,
        life: .18 + Math.random() * .36,
        maxLife: .54,
        size: 2 + Math.random() * 5,
        color
      });
    }
  }

  function floatingText(x, y, text, color = '#fff', life = .72) {
    if (!game) return;
    game.texts.push({ x, y, text, color, life, maxLife: life });
  }

  function render() {
    ctx.save();
    if (screenShake > 0) {
      ctx.translate((Math.random() - .5) * screenShake, (Math.random() - .5) * screenShake);
    }
    if (state === 'title') renderTitle();
    else if (state === 'map') renderMap();
    else if (state === 'roster') renderRoster();
    else if (state === 'stage' || state === 'pause' || state === 'stageclear') renderStage();
    else if (state === 'ending') renderEnding();
    ctx.restore();

    if (state === 'pause') renderPauseOverlay();
    if (state === 'stageclear') renderStageClearOverlay();

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(.5, flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function renderTitle() {
    ctx.fillStyle = '#030713';
    ctx.fillRect(0, 0, W, H);
    if (titleBanner.complete && titleBanner.naturalWidth) {
      ctx.drawImage(titleBanner, 0, 0, W, W * titleBanner.naturalHeight / titleBanner.naturalWidth);
    }
    const shade = ctx.createLinearGradient(0, 345, 0, 385);
    shade.addColorStop(0, 'rgba(3,7,19,0)');
    shade.addColorStop(1, '#030713');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 345, W, 42);
    ctx.fillStyle = '#8fa8c6';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText('SELECIONE UM SLOT', 50, 390);
    for (let i = 1; i <= 3; i++) {
      const x = 50 + (i - 1) * 305;
      const info = slotInfo(i);
      const sel = selectedSlot === i;
      ctx.fillStyle = sel ? 'rgba(67,165,205,.18)' : 'rgba(255,255,255,.025)';
      roundRect(x, 402, 270, 76, 8, true);
      ctx.strokeStyle = sel ? '#72e8ff' : '#263a54';
      ctx.lineWidth = sel ? 2 : 1;
      roundRect(x, 402, 270, 76, 8, false, true);
      ctx.fillStyle = sel ? '#dcf9ff' : '#b9c7d8';
      ctx.font = '900 17px ui-monospace, monospace';
      ctx.fillText(`SLOT ${i}`, x + 14, 427);
      ctx.font = '12px ui-monospace, monospace';
      if (info) {
        const progress = Math.min(4, info.completed?.length || 0);
        ctx.fillStyle = '#8fa5bd';
        ctx.fillText(`${progress}/4 setores • ${DIFFICULTY[info.difficulty]?.label || 'NORMAL'}`, x + 14, 449);
        ctx.fillStyle = '#ffe77c';
        ctx.fillText(`${info.credits || 0} créditos`, x + 14, 468);
      } else {
        ctx.fillStyle = '#637790';
        ctx.fillText('NOVO JOGO', x + 14, 455);
      }
    }

    const currentInfo = slotInfo(selectedSlot);
    ctx.fillStyle = '#859db7';
    ctx.font = '12px ui-monospace, monospace';
    if (!currentInfo) {
      ctx.fillText(`D = dificuldade inicial: ${DIFFICULTY[difficultyPreview].label}`, 50, 505);
    } else {
      ctx.fillText('Backspace/Delete = apagar slot', 50, 505);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dfefff';
    ctx.font = '700 13px ui-monospace, monospace';
    ctx.fillText('← → selecionar  •  ENTER iniciar', 910, 505);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#52677f';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('Cooperativo local: pressione M no mapa para alternar entre 1P e 2P.', 50, 530);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#79e6ff';
    ctx.fillText('H = ler HQ oficial', 910, 530);
    ctx.textAlign = 'left';
  }

  function renderMap() {
    drawMapBackground();
    const st = STAGES[selectedNode];

    ctx.fillStyle = 'rgba(4,10,21,.88)';
    ctx.fillRect(0, 0, W, 72);
    ctx.strokeStyle = '#1d3a60';
    ctx.beginPath(); ctx.moveTo(0, 72); ctx.lineTo(W, 72); ctx.stroke();
    ctx.fillStyle = '#eaf3ff';
    ctx.font = '900 20px ui-monospace, monospace';
    ctx.fillText('MAPA DE OPERAÇÕES', 24, 30);
    ctx.fillStyle = '#7f99b7';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(coopMode ? '2P: P1 WASD + F/G/H  •  P2 SETAS + J/K/L' : 'Escolha a próxima zona de missão', 24, 50);

    const current = HEROES[save.currentHero] || HEROES.solarion;
    drawMiniHero(755, 17, current, 1);
    ctx.fillStyle = current.primary;
    ctx.font = '900 13px ui-monospace, monospace';
    ctx.fillText(current.name, 805, 31);
    ctx.fillStyle = '#8ea4bb';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(`${save.unlocked.length}/6 heróis`, 805, 49);

    ctx.strokeStyle = '#294162';
    ctx.lineWidth = 2;
    const route = [[195,280],[470,170],[745,280],[470,398],[195,280]];
    ctx.beginPath();
    route.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.stroke();

    STAGES.forEach((stage, i) => {
      const unlocked = stage.unlocked();
      const complete = save.completed.includes(stage.id);
      const selected = i === selectedNode;
      drawMapNode(stage.x, stage.y, stage, { unlocked, complete, selected });
    });

    ctx.fillStyle = 'rgba(3,9,18,.9)';
    roundRect(50, 454, 860, 64, 10, true);
    ctx.strokeStyle = st.unlocked() ? st.primary : '#3b4657';
    roundRect(50, 454, 860, 64, 10, false, true);
    ctx.fillStyle = st.unlocked() ? '#eef7ff' : '#78879a';
    ctx.font = '900 16px ui-monospace, monospace';
    ctx.fillText(st.name, 72, 480);
    ctx.fillStyle = '#829ab6';
    ctx.font = '12px ui-monospace, monospace';
    const sub = st.unlocked() ? st.subtitle : 'Bloqueado — conclua os três setores externos';
    ctx.fillText(sub, 72, 500);
    ctx.textAlign = 'right';
    ctx.fillStyle = st.unlocked() ? '#d8f8ff' : '#66778b';
    ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText(st.unlocked() ? 'ENTER: INICIAR  •  R: EQUIPE  •  ESC: MENU' : 'SETOR INACESSÍVEL', 890, 490);
    ctx.fillStyle = coopMode ? '#ffe286' : '#9cb3c9';
    ctx.fillText(`M: ${coopMode ? '2 JOGADORES' : '1 JOGADOR'} (TROCAR)`, 890, 508);
    ctx.textAlign = 'left';
  }

  function drawMapBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#061323');
    g.addColorStop(1, '#02050b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawStars(titleStars, 0, 10, .45);
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.strokeStyle = '#1b5283';
    for (let x = -40; x < W + 60; x += 70) {
      ctx.beginPath(); ctx.moveTo(x, 78); ctx.lineTo(x + 145, H); ctx.stroke();
    }
    for (let y = 110; y < H; y += 58) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(29,67,104,.08)';
    ctx.beginPath(); ctx.ellipse(480, 315, 350, 180, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawMapNode(x, y, stage, opts) {
    const r = opts.selected ? 27 : 22;
    ctx.save();
    if (opts.selected) {
      ctx.globalAlpha = .23 + Math.sin(performance.now() / 180) * .07;
      ctx.fillStyle = stage.primary;
      ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = opts.unlocked ? stage.secondary : '#161d28';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = opts.unlocked ? stage.primary : '#394455';
    ctx.lineWidth = opts.selected ? 4 : 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    if (opts.complete) {
      ctx.fillStyle = '#7dff9c';
      ctx.beginPath(); ctx.arc(x + 18, y - 19, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#092b17';
      ctx.font = '900 10px monospace';
      ctx.textAlign = 'center'; ctx.fillText('✓', x + 18, y - 15); ctx.textAlign = 'left';
    }
    if (!opts.unlocked) {
      ctx.fillStyle = '#6f7c8f';
      ctx.font = '900 18px monospace';
      ctx.textAlign = 'center'; ctx.fillText('×', x, y + 6); ctx.textAlign = 'left';
    }
    ctx.fillStyle = opts.selected ? '#f3f9ff' : '#8297af';
    ctx.font = opts.selected ? '900 13px ui-monospace, monospace' : '700 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stage.name, x, y + 49);
    if (stage.recruit && opts.unlocked && !save.unlocked.includes(stage.recruit)) {
      ctx.fillStyle = HEROES[stage.recruit].primary;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`RECRUTA ${HEROES[stage.recruit].name}`, x, y + 64);
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function renderRoster() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1a30'); bg.addColorStop(1, '#03060d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    drawStars(titleStars, 0, 0, .3);

    ctx.fillStyle = '#f0f7ff';
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.fillText('EQUIPE VANGUARD', 38, 48);
    ctx.fillStyle = '#8298b2';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('Escolha o herói que inicia a próxima missão. Q/E troca durante o combate.', 38, 69);

    const unlocked = save.unlocked.filter(id => HEROES[id]);
    const cards = Object.values(HEROES);
    cards.forEach((hero, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 38 + col * 300, y = 108 + row * 176;
      const available = unlocked.includes(hero.id);
      const sel = available && unlocked[selectedRoster] === hero.id;
      const active = save.currentHero === hero.id;
      ctx.fillStyle = sel ? 'rgba(73,181,220,.14)' : 'rgba(255,255,255,.025)';
      roundRect(x, y, 275, 150, 9, true);
      ctx.strokeStyle = sel ? hero.primary : '#24364e';
      ctx.lineWidth = sel ? 2 : 1;
      roundRect(x, y, 275, 150, 9, false, true);
      if (!available) {
        ctx.save(); ctx.globalAlpha = .35; drawMiniHero(x + 25, y + 25, hero, 2.2); ctx.restore();
      } else drawMiniHero(x + 25, y + 25, hero, 2.2);
      ctx.fillStyle = available ? hero.primary : '#647187';
      ctx.font = '900 19px ui-monospace, monospace';
      ctx.fillText(available ? hero.name : '???', x + 106, y + 30);
      ctx.fillStyle = '#8ba0b8';
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(available ? hero.role : 'Bloqueado', x + 106, y + 48);
      if (available) {
        ctx.fillStyle = '#a9b9ca';
        wrapText(hero.description, x + 106, y + 69, 152, 14);
        drawStatBar(x + 106, y + 112, 120, hero.hp / 150, 'HP');
        drawStatBar(x + 106, y + 132, 120, hero.speed / 230, 'VEL');
      }
      if (active) {
        ctx.fillStyle = '#7dff9c';
        ctx.font = '900 10px ui-monospace, monospace';
        ctx.fillText('ATIVO', x + 18, y + 137);
      }
    });

    ctx.fillStyle = '#7289a2';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText('← → selecionar  •  ENTER definir como inicial  •  R/ESC voltar', 38, 507);
  }

  function drawStatBar(x, y, width, ratio, label) {
    ctx.fillStyle = '#26364b'; ctx.fillRect(x, y, width, 5);
    ctx.fillStyle = '#7cdfff'; ctx.fillRect(x, y, width * clamp(ratio, 0, 1), 5);
    ctx.fillStyle = '#6f849d'; ctx.font = '8px monospace'; ctx.fillText(label, x + width + 7, y + 5);
  }

  function renderStage() {
    if (!game) return;
    drawStageBackground(game.stage, game.cameraX);

    // ground lane guides
    ctx.save();
    ctx.globalAlpha = .08;
    ctx.strokeStyle = '#d9f4ff';
    for (let y = 350; y <= 500; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    const entities = [];
    for (const e of game.enemies) entities.push({ y: e.y, type: 'enemy', data: e });
    for (const p of game.players) entities.push({ y: p.y, type: 'player', data: p });
    entities.sort((a,b) => a.y - b.y);

    for (const ent of entities) {
      if (ent.type === 'player') drawPlayer(ent.data);
      else drawEnemy(ent.data);
    }

    for (const pr of game.projectiles) drawProjectile(pr);
    drawParticles();
    drawStageHud();
    drawNotices();
  }

  function drawStageBackground(stage, camX) {
    const id = stage.id;
    const scenes = scenarioImages[id] || [];
    const firstReady = scenes[0]?.complete && scenes[0].naturalWidth;
    const secondReady = scenes[1]?.complete && scenes[1].naturalWidth;
    if (firstReady || secondReady) {
      const midpoint = stage.width / 2;
      const transition = 520;
      const worldCenter = camX + W / 2;
      const t = clamp((worldCenter - midpoint + transition / 2) / transition, 0, 1);
      const blend = t * t * (3 - 2 * t);
      const firstPan = clamp(camX / Math.max(1, midpoint - W / 2), 0, 1);
      const secondPan = clamp((camX - midpoint + W / 2) /
        Math.max(1, stage.width - midpoint - W / 2), 0, 1);
      if (firstReady && (blend < 1 || !secondReady)) drawScenarioImage(scenes[0], firstPan);
      if (secondReady && (blend > 0 || !firstReady)) {
        ctx.save();
        ctx.globalAlpha = firstReady ? blend : 1;
        drawScenarioImage(scenes[1], secondPan);
        ctx.restore();
      }
    } else if (id === 'harbor') drawHarbor(camX);
    else if (id === 'metro') drawMetro(camX);
    else if (id === 'sky') drawSky(camX);
    else drawVoid(camX);

    // progress line
    ctx.fillStyle = 'rgba(3,8,16,.65)';
    ctx.fillRect(0, H - 8, W, 8);
    ctx.fillStyle = stage.primary;
    ctx.fillRect(0, H - 8, W * clamp(Math.max(...game.players.map(p => p.x)) / stage.width, 0, 1), 8);
  }

  function drawScenarioImage(image, progress) {
    // Pan within each scene while keeping the floor and horizon level.
    const cropH = image.naturalHeight * .72;
    const cropW = Math.min(image.naturalWidth, cropH * W / H);
    ctx.drawImage(image, (image.naturalWidth - cropW) * progress,
      (image.naturalHeight - cropH) / 2, cropW, cropH, 0, 0, W, H);
  }

  function drawHarbor(cam) {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#071b35'); g.addColorStop(.55,'#0c3150'); g.addColorStop(.56,'#09263d'); g.addColorStop(1,'#07111e');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    drawStars(titleStars, -cam*.02, 0, .25);
    ctx.fillStyle = '#123b58'; ctx.fillRect(0, 245, W, 80);
    for (let i=-1;i<8;i++) {
      const x = i*170 - (cam*.12)%170;
      ctx.fillStyle = '#0b1c2c'; ctx.fillRect(x, 150, 100, 115);
      ctx.fillStyle = '#1a7391';
      for (let wy=168;wy<245;wy+=22) for(let wx=x+14;wx<x+90;wx+=23) if ((wx+wy+i*13)%3<2) ctx.fillRect(wx,wy,8,5);
    }
    // cranes
    ctx.strokeStyle = '#213e50'; ctx.lineWidth = 8;
    for (let i=0;i<4;i++) {
      const x = i*360 + 60 - (cam*.28)%360;
      ctx.beginPath(); ctx.moveTo(x,245); ctx.lineTo(x,110); ctx.lineTo(x+120,110); ctx.stroke();
      ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x+95,110); ctx.lineTo(x+95,200); ctx.stroke(); ctx.lineWidth=8;
    }
    drawRoad(cam, '#142436', '#1f3850', '#4c6d86');
  }

  function drawMetro(cam) {
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#241711'); g.addColorStop(.55,'#4b2b1c'); g.addColorStop(1,'#0c0b0c');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    for(let i=-1;i<7;i++){
      const x=i*190-(cam*.16)%190;
      ctx.fillStyle='#211815';ctx.fillRect(x,100,130,195);
      ctx.fillStyle='#6c4328';ctx.fillRect(x+15,123,100,14);
      ctx.fillStyle='#e79d43';ctx.globalAlpha=.2;ctx.fillRect(x+25,160,18,70);ctx.globalAlpha=1;
      ctx.strokeStyle='#5e4434';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(x+20,100);ctx.lineTo(x+70,45);ctx.lineTo(x+90,100);ctx.stroke();
    }
    for(let i=0;i<5;i++){
      const x=i*230-(cam*.35)%230;
      ctx.fillStyle='#372319';ctx.fillRect(x,250,90,68);ctx.fillStyle='#a56d3a';ctx.fillRect(x+8,266,74,8);
    }
    drawRoad(cam,'#211915','#35261d','#74513a');
  }

  function drawSky(cam) {
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#476eb8'); g.addColorStop(.58,'#8fb9df'); g.addColorStop(.59,'#c8dcec'); g.addColorStop(1,'#1d2942');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<7;i++){
      const x=i*190-(cam*.08)%190, y=75+(i%3)*45;
      ctx.fillStyle='rgba(255,255,255,.3)';
      ctx.beginPath();ctx.ellipse(x,y,80,22,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+50,y+10,58,18,0,0,Math.PI*2);ctx.fill();
    }
    for(let i=-1;i<6;i++){
      const x=i*230-(cam*.25)%230;
      ctx.fillStyle='#343967';ctx.fillRect(x,165,150,145);
      ctx.fillStyle='#716ec2';ctx.fillRect(x+18,190,114,10);
      ctx.strokeStyle='#958be2';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+75,165);ctx.lineTo(x+75,105);ctx.stroke();
    }
    drawRoad(cam,'#262945','#393d66','#7779ad');
  }

  function drawVoid(cam) {
    const g=ctx.createRadialGradient(W*.55,H*.25,20,W*.55,H*.25,500); g.addColorStop(0,'#56205f');g.addColorStop(.45,'#1d1338');g.addColorStop(1,'#050610');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    drawStars(titleStars, -cam*.035, 0, .65);
    ctx.save();ctx.globalAlpha=.25;ctx.strokeStyle='#d84cdf';ctx.lineWidth=2;
    for(let i=0;i<7;i++){
      const x=i*180-(cam*.18)%180;
      ctx.beginPath();ctx.moveTo(x,70);ctx.lineTo(x+90,270);ctx.lineTo(x-20,270);ctx.closePath();ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle='rgba(242,82,218,.13)';ctx.beginPath();ctx.ellipse(480,150,130,85,0,0,Math.PI*2);ctx.fill();
    drawRoad(cam,'#151226','#241a39','#6d3c82');
  }

  function drawRoad(cam, base, stripe, line) {
    ctx.fillStyle=base;ctx.fillRect(0,310,W,230);
    ctx.fillStyle=stripe;
    for(let i=-2;i<14;i++){
      const x=i*110-(cam*.7)%110;
      ctx.beginPath();ctx.moveTo(x,310);ctx.lineTo(x+72,310);ctx.lineTo(x+132,540);ctx.lineTo(x+25,540);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle=line;ctx.lineWidth=3;ctx.globalAlpha=.45;
    ctx.beginPath();ctx.moveTo(0,358);ctx.lineTo(W,358);ctx.stroke();
    ctx.globalAlpha=1;
  }

  function getAnimationFrame(heroId, action, time, duration = null) {
    const def = getSheetDefinition(heroId)?.animations?.[action];
    if (!def) return { action: 'idle', index: 0 };
    let index = 0;
    if (duration != null && duration > 0 && !def.loop) {
      const progress = clamp(time / duration, 0, .9999);
      index = Math.min(def.count - 1, Math.floor(progress * def.count));
    } else {
      index = Math.floor(time * def.fps) % def.count;
    }
    return { action, index };
  }

  function playerAnimation(p) {
    if (p.hurtTimer > 0) return getAnimationFrame(p.heroId, 'hurt', .28 - p.hurtTimer, .28);
    if (p.specialTimer > 0) return getAnimationFrame(p.heroId, 'special', p.specialDuration - p.specialTimer, p.specialDuration);
    if (p.dashTimer > 0) return getAnimationFrame(p.heroId, 'dash', p.dashDuration - p.dashTimer, p.dashDuration);
    if (p.z > 0 || p.vz !== 0) {
      const def = SPRITE_SHEETS[p.heroId]?.animations?.jump;
      let idx = p.vz > 170 ? 0 : (p.vz > -120 ? 1 : 2);
      idx = Math.min((def?.count || 3) - 1, idx);
      return { action: 'jump', index: idx };
    }
    if (p.attackTimer > 0) return getAnimationFrame(p.heroId, 'attack', p.attackDuration - p.attackTimer, p.attackDuration);
    if (p.moving) return getAnimationFrame(p.heroId, 'walk', p.animTime);
    return getAnimationFrame(p.heroId, 'idle', p.animTime);
  }

  function drawSheetFrame(x, groundY, heroId, action, frameIndex, facing = 1, scaleMul = 1) {
    const sheet = getSheetDefinition(heroId);
    const img = spriteImages[heroId];
    const def = sheet?.animations?.[action];
    if (!sheet || !def || !img || (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth))) return false;

    const sw = def.w / def.count;
    const sx = def.x + sw * clamp(frameIndex, 0, def.count - 1);
    const sh = def.h;
    const scale = sheet.scale * scaleMul;
    const dw = sw * scale;
    const dh = sh * scale;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(groundY));
    ctx.scale(facing, 1);
    ctx.drawImage(img, sx, def.y, sw, sh, -dw / 2, -dh + Math.round(SPRITE_ATLAS.footMargin * scale), dw, dh);
    ctx.restore();
    return true;
  }

  function drawPlayer(p) {
    const hero = HEROES[p.heroId];
    const sx = Math.round(p.x - game.cameraX);
    const groundY = Math.round(363 + p.y * .75);
    const sy = Math.round(groundY - p.z);
    if (sx < -180 || sx > W + 180) return;
    drawShadow(sx, groundY, p.dashTimer > 0 ? 32 : 25, p.z);
    ctx.save();
    if (p.hp <= 0) ctx.globalAlpha = .35;
    if (p.flash > 0 || (p.invuln > 0 && Math.floor(performance.now()/55)%2===0)) ctx.globalAlpha=.55;
    const anim = playerAnimation(p);
    const drawn = drawSheetFrame(sx, sy, p.heroId, anim.action, anim.index, p.facing, 1);
    if (!drawn) drawHeroSprite(sx, sy, hero, p.facing, 1.0, p.attackTimer > 0, p.comboStep, p.specialTimer > 0);
    ctx.restore();
    if (coopMode) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '900 12px ui-monospace, monospace';
      ctx.fillStyle = p.slot === 1 ? '#66e7ff' : '#ffd166';
      ctx.fillText(`P${p.slot}${p.hp <= 0 ? ' KO' : ''}`, sx, sy - 125);
      ctx.restore();
    }
  }

  function drawEnemy(e) {
    const sx = Math.round(e.x - game.cameraX);
    const sy = Math.round(354 + e.y * .75 - e.z);
    if (sx < -150 || sx > W + 150) return;
    if (e.dead) ctx.globalAlpha = clamp(1 - e.deathTimer / .8, 0, 1);
    drawShadow(sx, 363 + e.y * .75, e.boss ? 34 : 24, e.z);
    ctx.save();
    if (e.hurtTimer > 0) ctx.translate((Math.random()-.5)*4,0);
    const visual = enemyVisual(e);
    const scale = visual.scaleMul * (e.scale || 1) * (e.boss ? 1.04 : 1);
    const anim = enemyAnimation(e);
    const drawn = drawSheetFrame(sx, sy, visual.sheet, anim.action, anim.index, e.facing, scale);
    if (!drawn) drawEnemySprite(sx, sy, e, scale);
    ctx.restore();
    if (e.dead) ctx.globalAlpha=1;
    if (e.boss && !e.dead) {
      const w=150,h=7,x=sx-w/2,y=sy-e.h*1.05-24;
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(x,y,w,h);
      ctx.fillStyle=e.color;ctx.fillRect(x,y,w*clamp(e.hp/e.maxHp,0,1),h);
      ctx.fillStyle='#fff';ctx.font='900 10px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(e.name.toUpperCase(),sx,y-6);ctx.textAlign='left';
    }
  }

  function drawHeroSprite(x, y, hero, facing=1, scale=1, attacking=false, combo=0, special=false) {
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    // cape/back detail
    ctx.fillStyle=hero.secondary;
    ctx.beginPath();ctx.moveTo(-9,-49);ctx.lineTo(-19,-7);ctx.lineTo(4,-15);ctx.closePath();ctx.fill();
    // legs
    ctx.fillStyle=hero.secondary;ctx.fillRect(-11,-20,9,22);ctx.fillRect(3,-20,9,22);
    ctx.fillStyle='#0b1220';ctx.fillRect(-13,0,12,6);ctx.fillRect(2,0,13,6);
    // torso
    ctx.fillStyle=hero.primary;ctx.fillRect(-15,-50,30,33);
    ctx.fillStyle=hero.secondary;ctx.fillRect(-15,-24,30,8);
    // emblem
    ctx.fillStyle=hero.accent;ctx.fillRect(-5,-42,10,8);ctx.fillRect(-2,-46,4,16);
    // head
    ctx.fillStyle=hero.skin;ctx.fillRect(-10,-66,20,17);
    ctx.fillStyle=hero.secondary;ctx.fillRect(-11,-69,22,6);
    // eyes visor
    ctx.fillStyle=hero.accent;ctx.fillRect(2,-62,7,3);
    // arms
    const ext = attacking ? 14 + combo*5 : 0;
    ctx.fillStyle=hero.primary;
    ctx.fillRect(-21,-47,8,25);
    ctx.fillRect(13,-47,8+ext,-8+16);
    ctx.fillStyle=hero.skin;ctx.fillRect(19+ext,-45,7,8);
    if (special) {
      ctx.globalAlpha=.45;ctx.strokeStyle=hero.primary;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,-34,30+Math.sin(performance.now()/50)*4,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemySprite(x,y,e,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(e.facing*scale,scale);
    const c=e.color;
    ctx.fillStyle='#15151d';ctx.fillRect(-12,-20,10,23);ctx.fillRect(3,-20,10,23);
    ctx.fillStyle=c;ctx.fillRect(-17,-53,34,36);
    ctx.fillStyle='#221b2d';ctx.fillRect(-17,-28,34,8);
    ctx.fillStyle='#b88471';ctx.fillRect(-11,-68,22,16);
    ctx.fillStyle='#201827';ctx.fillRect(-12,-71,24,7);
    ctx.fillStyle='#ffecf8';ctx.fillRect(3,-63,7,3);
    ctx.fillStyle=c;ctx.fillRect(-24,-48,9,27);ctx.fillRect(15,-48,9,27);
    if(e.attackTimer>0){ctx.fillStyle='#fff0d8';ctx.fillRect(22,-45,10,8);}
    if(e.boss){ctx.strokeStyle='#ffffff';ctx.globalAlpha=.45;ctx.strokeRect(-20,-56,40,42);ctx.globalAlpha=1;}
    ctx.restore();
  }

  function drawMiniHero(x,y,hero,scale=1){
    const sheet = SPRITE_SHEETS[hero.id];
    const img = spriteImages[hero.id];
    const def = sheet?.animations?.idle;
    if (sheet && def && img && (img instanceof HTMLCanvasElement || img.complete && img.naturalWidth)) {
      const sw = def.w / def.count;
      const targetH = 50 * scale;
      const targetW = sw / def.h * targetH;
      ctx.save();
      ctx.drawImage(img, def.x, def.y, sw, def.h, x, y, targetW, targetH);
      ctx.restore();
      return;
    }
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.fillStyle=hero.secondary;ctx.fillRect(5,31,8,19);ctx.fillRect(18,31,8,19);
    ctx.fillStyle=hero.primary;ctx.fillRect(4,8,24,26);
    ctx.fillStyle=hero.skin;ctx.fillRect(9,-5,15,14);
    ctx.fillStyle=hero.secondary;ctx.fillRect(8,-8,17,5);
    ctx.fillStyle=hero.accent;ctx.fillRect(13,16,7,7);
    ctx.restore();
  }

  function drawShadow(x,y,r,z=0){
    ctx.save();ctx.globalAlpha=clamp(.32-z/500,.08,.32);ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x,y,r,8,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }

  function drawProjectile(pr){
    const x=pr.x-game.cameraX;
    const visual=PROJECTILE_VISUALS[pr.spriteId];
    const img=projectileImages[pr.spriteId];
    const y=(pr.owner==='player'?363:354)+pr.y*.75-(visual?.lift||0);
    ctx.save();
    if(visual && img?.complete && img.naturalWidth){
      ctx.translate(Math.round(x),Math.round(y));
      if(pr.vx<0)ctx.scale(-1,1);
      ctx.imageSmoothingEnabled=true;
      ctx.shadowColor=pr.color;
      ctx.shadowBlur=8;
      ctx.drawImage(img,-visual.width/2,-visual.height/2,visual.width,visual.height);
    }else{
      ctx.shadowColor=pr.color;ctx.shadowBlur=14;ctx.fillStyle=pr.color;
      if(pr.owner==='player' && Math.abs(pr.vx)>300){ctx.fillRect(x-pr.width*(pr.vx>0?1.4:.2),y-pr.height/2,pr.width*1.8,pr.height);}else{ctx.beginPath();ctx.ellipse(x,y,pr.width,pr.height,0,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }

  function drawParticles(){
    for(const p of game.particles){
      const a=clamp(p.life/(p.maxLife||.5),0,1);ctx.save();ctx.globalAlpha=a;ctx.fillStyle=p.color;const x=p.x-game.cameraX,y=354+p.y*.75;ctx.fillRect(Math.round(x),Math.round(y),p.size,p.size);ctx.restore();
    }
    for(const t of game.texts){
      const a=clamp(t.life/t.maxLife,0,1);ctx.save();ctx.globalAlpha=a;ctx.fillStyle=t.color;ctx.font='900 12px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(t.text,t.x-game.cameraX,340+t.y*.75);ctx.restore();
    }
  }

  function drawStageHud(){
    for (const p of game.players) {
      const h = HEROES[p.heroId], x = p.slot === 1 ? 14 : 357;
      ctx.fillStyle='rgba(2,7,14,.82)';roundRect(x,14,330,88,9,true);ctx.strokeStyle=p.slot===1?'#244060':'#745d30';roundRect(x,14,330,88,9,false,true);
      drawMiniHero(x+14,30,h,1.05);
      ctx.fillStyle=h.primary;ctx.font='900 16px ui-monospace, monospace';ctx.fillText(`${coopMode ? `P${p.slot} ` : ''}${h.name}`,x+72,35);
      ctx.fillStyle='#7890aa';ctx.font='10px ui-monospace, monospace';ctx.fillText(p.hp>0?h.role.toUpperCase():'FORA DE COMBATE',x+72,49);
      drawBar(x+72,59,238,14,p.hp/p.maxHp,'#ff5d6e','#30131a');
      drawBar(x+72,80,238,8,p.energy/p.maxEnergy,h.primary,'#112436');
      ctx.fillStyle='#dcecff';ctx.font='900 10px ui-monospace, monospace';ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`,x+78,70);
    }

    ctx.textAlign='right';ctx.fillStyle='rgba(2,7,14,.76)';roundRect(705,14,241,72,9,true);ctx.strokeStyle='#223a58';roundRect(705,14,241,72,9,false,true);
    ctx.fillStyle='#8ca4bd';ctx.font='10px ui-monospace, monospace';ctx.fillText(game.stage.name,930,34);
    ctx.fillStyle='#f7e672';ctx.font='900 16px ui-monospace, monospace';ctx.fillText(String(game.score).padStart(6,'0'),930,56);
    ctx.fillStyle='#7e93aa';ctx.font='10px ui-monospace, monospace';ctx.fillText(`${save.credits} CR`,930,73);ctx.textAlign='left';

    if(game.combo>1 && game.comboTimer>0){ctx.fillStyle='#fff18b';ctx.font='900 25px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(`${game.combo} HIT`,W/2,72);ctx.textAlign='left';}

    // party strip
    if (!coopMode) {
      const list=save.unlocked.filter(id=>HEROES[id]);
      let x=18;const y=118;
      list.forEach((id,i)=>{const hh=HEROES[id];const active=id===game.player.heroId;ctx.save();ctx.globalAlpha=active?1:.55;ctx.fillStyle=active?'rgba(255,255,255,.11)':'rgba(0,0,0,.24)';roundRect(x,y,48,28,5,true);ctx.strokeStyle=active?hh.primary:'#25364b';roundRect(x,y,48,28,5,false,true);ctx.fillStyle=hh.primary;ctx.fillRect(x+6,y+7,7,14);ctx.fillStyle='#c9d8e7';ctx.font='900 8px monospace';ctx.fillText(hh.name,x+17,y+18);ctx.restore();x+=53;});
    }

    if(game.bossName){
      const boss=game.enemies.find(e=>e.boss&&!e.dead);
      if(boss){const bw=430,bx=(W-bw)/2,by=108;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(bx,by,bw,13);ctx.fillStyle=boss.color;ctx.fillRect(bx,by,bw*clamp(boss.hp/boss.maxHp,0,1),13);ctx.strokeStyle='#ffffff';ctx.globalAlpha=.3;ctx.strokeRect(bx,by,bw,13);ctx.globalAlpha=1;}
    }
  }

  function drawBar(x,y,w,h,ratio,fg,bg){ctx.fillStyle=bg;ctx.fillRect(x,y,w,h);ctx.fillStyle=fg;ctx.fillRect(x,y,w*clamp(ratio,0,1),h);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.strokeRect(x+.5,y+.5,w-1,h-1);}

  function drawNotices(){
    if(game.notice?.timer>0){
      const alpha=Math.min(1,game.notice.timer*2);ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.fillStyle='rgba(1,5,12,.72)';roundRect(250,200,460,92,8,true);ctx.strokeStyle=game.stage.primary;roundRect(250,200,460,92,8,false,true);ctx.fillStyle='#f5fbff';ctx.font='900 28px ui-monospace, monospace';ctx.fillText(game.notice.text,W/2,238);ctx.fillStyle='#8da6c0';ctx.font='12px ui-monospace, monospace';ctx.fillText(game.notice.sub,W/2,266);ctx.restore();ctx.textAlign='left';
    }
    if(game.players.every(p=>p.hp<=0)){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#ff6f7e';ctx.font='900 38px ui-monospace, monospace';ctx.fillText('MISSÃO FALHOU',W/2,H/2-12);ctx.fillStyle='#cad8e8';ctx.font='13px ui-monospace, monospace';ctx.fillText('ENTER para voltar ao mapa',W/2,H/2+24);ctx.textAlign='left';}
  }

  function renderPauseOverlay(){
    ctx.fillStyle='rgba(1,4,10,.72)';ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(8,18,34,.96)';roundRect(310,165,340,210,12,true);ctx.strokeStyle='#517396';roundRect(310,165,340,210,12,false,true);ctx.textAlign='center';ctx.fillStyle='#eaf5ff';ctx.font='900 30px ui-monospace, monospace';ctx.fillText('PAUSA',W/2,212);ctx.fillStyle='#8fa5bd';ctx.font='13px ui-monospace, monospace';ctx.fillText('ESC / P — continuar',W/2,254);ctx.fillText('M — voltar ao mapa',W/2,282);ctx.fillStyle='#79e6ff';ctx.fillText('H — ler HQ do jogo',W/2,310);ctx.fillStyle='#607891';ctx.font='11px ui-monospace, monospace';ctx.fillText('O progresso das áreas concluídas é salvo automaticamente.',W/2,348);ctx.textAlign='left';
  }

  function renderStageClearOverlay(){
    ctx.fillStyle='rgba(1,4,10,.68)';ctx.fillRect(0,0,W,H);
    const st=game.stage;
    ctx.fillStyle='rgba(8,18,34,.96)';roundRect(230,115,500,310,12,true);ctx.strokeStyle=st.primary;ctx.lineWidth=2;roundRect(230,115,500,310,12,false,true);
    ctx.textAlign='center';ctx.fillStyle='#eef8ff';ctx.font='900 30px ui-monospace, monospace';ctx.fillText('SETOR CONCLUÍDO',W/2,165);
    ctx.fillStyle=st.primary;ctx.font='900 19px ui-monospace, monospace';ctx.fillText(st.name,W/2,196);
    ctx.fillStyle='#8098b2';ctx.font='12px ui-monospace, monospace';ctx.fillText(`Pontuação ${game.score}  •  Créditos totais ${save.credits}`,W/2,228);
    if(st.recruit){const h=HEROES[st.recruit];ctx.fillStyle='rgba(255,255,255,.04)';roundRect(310,255,340,92,8,true);drawMiniHero(336,277,h,1.25);ctx.textAlign='left';ctx.fillStyle=h.primary;ctx.font='900 18px ui-monospace, monospace';ctx.fillText(`${h.name} RECRUTADO`,410,282);ctx.fillStyle='#9cb0c5';ctx.font='11px ui-monospace, monospace';ctx.fillText(h.description,410,305);ctx.fillText('Q/E: troque para ele durante qualquer missão.',410,326);ctx.textAlign='center';}
    else {ctx.fillStyle='#ffe57b';ctx.font='900 18px ui-monospace, monospace';ctx.fillText('NÚCLEO DA INVASÃO DESTRUÍDO',W/2,294);ctx.fillStyle='#9bb0c8';ctx.font='12px ui-monospace, monospace';ctx.fillText('A campanha foi concluída. Todos os setores podem ser rejogados.',W/2,322);}
    ctx.fillStyle='#d7e9fa';ctx.font='900 12px ui-monospace, monospace';ctx.fillText('ENTER — continuar',W/2,390);ctx.textAlign='left';
  }

  function renderEnding(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0a2442');g.addColorStop(1,'#02050a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);drawStars(titleStars,0,0,.8);drawPlanet(760,150,125);
    ctx.fillStyle='rgba(3,8,16,.7)';roundRect(70,80,650,350,14,true);ctx.strokeStyle='#6fe8ff';roundRect(70,80,650,350,14,false,true);
    ctx.fillStyle='#eff9ff';ctx.font='900 38px ui-monospace, monospace';ctx.fillText('MISSÃO CUMPRIDA',105,145);
    ctx.fillStyle='#6fe8ff';ctx.font='900 19px ui-monospace, monospace';ctx.fillText('A VANGUARD DETEVE A INVASÃO',105,178);
    ctx.fillStyle='#9bb0c7';ctx.font='14px ui-monospace, monospace';wrapText('Os portais foram selados e os setores voltaram a responder. Sua equipe permanece ativa para novas incursões, desafios e futuras expansões.',105,225,520,22);
    ctx.fillStyle='#f5e57a';ctx.font='900 14px ui-monospace, monospace';ctx.fillText(`HERÓIS: ${save.unlocked.length}/6    CRÉDITOS: ${save.credits}    RECORDE: ${save.highScore}`,105,327);
    ctx.fillStyle='#8097b0';ctx.font='12px ui-monospace, monospace';ctx.fillText('ENTER — voltar ao mapa e continuar jogando',105,387);
  }

  function drawPlanet(x,y,r){
    ctx.save();
    const g=ctx.createRadialGradient(x-r*.3,y-r*.4,10,x,y,r);g.addColorStop(0,'#6feaff');g.addColorStop(.25,'#316fb0');g.addColorStop(.74,'#152b5c');g.addColorStop(1,'#070d20');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.25;ctx.strokeStyle='#a4f6ff';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(x,y+10,r*1.35,r*.3,-.22,0,Math.PI*2);ctx.stroke();ctx.restore();
  }

  function drawCitySilhouette(x,y,c1,c2){
    ctx.fillStyle=c1;ctx.fillRect(x,y,W,H-y);
    for(let i=0;i<22;i++){const bx=i*48+(i%3)*7,bw=34+(i%4)*10,bh=35+(i*23)%110;ctx.fillStyle=i%2?c1:c2;ctx.fillRect(bx,y-bh,bw,bh);}
  }

  function drawStars(stars, ox=0, oy=0, alpha=1){
    ctx.save();ctx.globalAlpha=alpha;for(const s of stars){ctx.fillStyle=s.b>0.7?'#bcecff':'#ffffff';const x=((s.x+ox)%W+W)%W;ctx.fillRect(x,s.y+oy,s.s,s.s);}ctx.restore();
  }

  function makeStars(n,seed){
    const a=[];let s=seed>>>0;for(let i=0;i<n;i++){s=(s*1664525+1013904223)>>>0;const x=(s%10000)/10000*W;s=(s*1664525+1013904223)>>>0;const y=(s%10000)/10000*H;s=(s*1664525+1013904223)>>>0;a.push({x,y,s:1+(s%2),b:(s%100)/100});}return a;
  }

  function wrapText(text,x,y,maxWidth,lineHeight){
    const words=text.split(' ');let line='';for(let n=0;n<words.length;n++){const test=line+words[n]+' ';if(ctx.measureText(test).width>maxWidth&&n>0){ctx.fillText(line,x,y);line=words[n]+' ';y+=lineHeight;}else line=test;}ctx.fillText(line,x,y);
  }

  function roundRect(x,y,w,h,r,fill=false,stroke=false){
    const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();if(fill)ctx.fill();if(stroke)ctx.stroke();
  }

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function lerp(a,b,t){return a+(b-a)*t;}

  function initAudio(){
    if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch{audioCtx=null;}}
    if(audioCtx?.state==='suspended') audioCtx.resume();
  }

  function beep(freq=440,duration=.05,type='square',volume=.02){
    initAudio();if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);
  }

  function handleCanvasClick(x,y){
    if(state==='title'){
      if(y>=322&&y<=406){for(let i=1;i<=3;i++){const sx=66+(i-1)*274;if(x>=sx&&x<=sx+248){selectedSlot=i;const info=slotInfo(i);if(!info){save=blankSave(i,difficultyPreview);persistSave();}startFromSlot(i);return;}}}
      return;
    }
    if(state==='map'){
      if(x>=650&&y>=495&&y<=520){toggleCoopMode();return;}
      for(let i=0;i<STAGES.length;i++){const st=STAGES[i];if(Math.hypot(x-st.x,y-st.y)<42){selectedNode=i;if(st.unlocked())startStage(st);else beep(110,.07,'square',.02);return;}}
      if(x>700&&y<80){state='roster';selectedRoster=Math.max(0,save.unlocked.indexOf(save.currentHero));}
      return;
    }
    if(state==='roster'){
      const unlocked=save.unlocked.filter(id=>HEROES[id]);
      Object.values(HEROES).forEach((hero,i)=>{const col=i%3,row=Math.floor(i/3),cx=38+col*300,cy=108+row*176;if(x>=cx&&x<=cx+275&&y>=cy&&y<=cy+150&&unlocked.includes(hero.id)){selectedRoster=unlocked.indexOf(hero.id);save.currentHero=hero.id;persistSave();beep(720,.05,'triangle',.02);}});
      return;
    }
    if(state==='stageclear'){state=game.stage.id==='void'?'ending':'map';return;}
    if(state==='ending'){state='map';}
  }

  window.addEventListener('keydown', e => {
    const code=e.code;
    if(!keys[code]) pressed.add(code);
    keys[code]=true;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(code)) e.preventDefault();
    initAudio();
  }, {passive:false});
  window.addEventListener('keyup', e => {keys[e.code]=false;});
  window.addEventListener('blur', () => {for(const k in keys)keys[k]=false;if(state==='stage'){previousState='stage';state='pause';}});

  function canvasCoords(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
  canvas.addEventListener('pointerdown',e=>{initAudio();const p=canvasCoords(e);mouse={x:p.x,y:p.y,down:true};handleCanvasClick(p.x,p.y);});
  canvas.addEventListener('pointermove',e=>{const p=canvasCoords(e);mouse.x=p.x;mouse.y=p.y;});
  canvas.addEventListener('pointerup',()=>mouse.down=false);

  document.querySelectorAll('#touch-ui [data-key]').forEach(btn=>{
    const code=btn.dataset.key;
    const down=e=>{e.preventDefault();initAudio();if(!keys[code])pressed.add(code);keys[code]=true;};
    const up=e=>{e.preventDefault();keys[code]=false;};
    btn.addEventListener('pointerdown',down,{passive:false});btn.addEventListener('pointerup',up,{passive:false});btn.addEventListener('pointercancel',up,{passive:false});btn.addEventListener('pointerleave',up,{passive:false});
  });

  function frame(now){
    const dt=Math.min(.033,(now-last)/1000||.016);last=now;update(dt);render();requestAnimationFrame(frame);
  }

  // Ponte para os módulos de gameplay (combat.js, progression.js, variety.js).
  window.CV = {
    on: events.on,
    emit: events.emit,
    game: () => game,
    state: () => state,
    save: () => save,
    schedule(sec, fn, owner) {
      if (game) game.scheduler.schedule(sec, fn, owner);
    },
    hitstop(sec) {
      if (game) game.clock.hitstop(sec);
    },
    slowmo(scale, sec) {
      if (game) game.clock.slowmo(scale, sec);
    },
    pauseGame() {
      if (state === 'stage') {
        previousState = 'stage';
        state = 'pause';
        for (const k in keys) keys[k] = false;
      }
    },
  };

  requestAnimationFrame(frame);
})();
