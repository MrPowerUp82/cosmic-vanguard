import re
from pathlib import Path

def update_game_js():
    path = Path('game.js')
    content = path.read_text(encoding='utf-8')

    old_block_pattern = re.compile(
        r'  const SPRITE_CELL_W = 320;.*?  const spriteImages = \{\};.*?img\.src = sheet\.src;\s*\}',
        re.DOTALL
    )

    new_block = """  const SPRITE_CELL_W = 400;
  const SPRITE_CELL_H = 300;
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
      src: 'assets/sprites/enemies/shadow_trooper.png', scale: .336,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    pulse_gunner: {
      src: 'assets/sprites/enemies/pulse_gunner.png', scale: .352,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    armored_brute: {
      src: 'assets/sprites/enemies/armored_brute.png', scale: .368,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,8),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,10)
      }
    },
    rift_assassin: {
      src: 'assets/sprites/enemies/rift_assassin.png', scale: .336,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,9),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,11)
      }
    },
    void_tyrant: {
      src: 'assets/sprites/enemies/void_tyrant.png', scale: .384,
      animations: {
        idle: animRow(0,4,5,true), walk: animRow(1,6,8,true), attack: animRow(2,4,8),
        jump: animRow(3,3,7), dash: animRow(4,4,7,true), hurt: animRow(5,2,6), special: animRow(6,6,10)
      }
    },
  };

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
  }"""

    match = old_block_pattern.search(content)
    if not match:
        raise ValueError("Could not match sprite config block in game.js")

    content = content[:match.start()] + new_block + content[match.end():]

    # Update drawSheetFrame
    old_draw = "ctx.drawImage(img, sx, def.y, sw, sh, -dw / 2, -dh + 5, dw, dh);"
    new_draw = "ctx.drawImage(img, sx, def.y, sw, sh, -dw / 2, -dh + Math.round(15 * scale), dw, dh);"
    if old_draw not in content:
        raise ValueError("Could not find drawImage line in drawSheetFrame")
    content = content.replace(old_draw, new_draw, 1)

    old_check = "if (!sheet || !def || !img || !(img instanceof HTMLCanvasElement) && (!img.complete || !img.naturalWidth)) return false;"
    new_check = "if (!sheet || !def || !img || (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth))) return false;"
    if old_check in content:
        content = content.replace(old_check, new_check, 1)

    path.write_text(content, encoding='utf-8')
    print("game.js updated successfully.")

def update_index_html():
    path = Path('index.html')
    content = path.read_text(encoding='utf-8')
    script_line = '  <script src="sprite-repair.js"></script>\n'
    if script_line in content:
        content = content.replace(script_line, '')
        path.write_text(content, encoding='utf-8')
        print("index.html updated successfully.")
    else:
        print("script tag not found or already removed in index.html")

def update_sprite_viewer_html():
    path = Path('sprite-viewer.html')
    content = path.read_text(encoding='utf-8')

    # Remove script tag
    script_line = '  <script src="sprite-repair.js"></script>\n'
    content = content.replace(script_line, '')

    # Update armored_brute path in SHEETS
    content = content.replace(
        "{ id: 'armored_brute', name: 'Armored Brute', src: 'assets/sprites/rebuilt/armored_brute.png' }",
        "{ id: 'armored_brute', name: 'Armored Brute', src: 'assets/sprites/enemies/armored_brute.png' }"
    )

    # Replace heroAnimation and GAME_ATLAS block
    old_atlas_pattern = re.compile(
        r'    const heroAnimation = \(row, count, fps, loop = false\) => \(\{.*?for \(const sheet of SHEETS\.filter\(item => !item\.src\.includes\(\'/processed/\'\)\)\) \{.*?\}\s*\}',
        re.DOTALL
    )

    new_atlas = """    const heroAnimation = (row, count, fps, loop = false) => ({
      x: 0, y: row * 300, w: count * 400, h: 300, count, fps, loop
    });
    const heroAtlas = (scale, fps) => ({
      scale,
      animations: Object.fromEntries(GAME_ANIMATIONS.map((anim, i) => [
        anim.id, heroAnimation(anim.row, anim.count, fps[i], i === 0 || i === 1 || i === 4)
      ]))
    });
    const GAME_ATLAS = {
      solarion: heroAtlas(.392, [5, 9, 9, 7, 11, 7, 9]),
      night_talon: heroAtlas(.392, [5, 9, 9, 7, 11, 7, 10]),
      valoria: heroAtlas(.384, [5, 9, 9, 7, 10, 7, 9]),
      red_velocity: heroAtlas(.392, [6, 12, 13, 9, 16, 8, 13]),
      abyss_king: heroAtlas(.376, [5, 8, 9, 7, 10, 7, 9]),
      emerald_nova: heroAtlas(.392, [5, 9, 9, 7, 11, 7, 9]),
      shadow_trooper: heroAtlas(.336, [5, 8, 9, 7, 7, 6, 11]),
      pulse_gunner: heroAtlas(.352, [5, 8, 9, 7, 7, 6, 11]),
      armored_brute: heroAtlas(.368, [5, 8, 8, 7, 7, 6, 10]),
      rift_assassin: heroAtlas(.336, [5, 8, 9, 7, 7, 6, 11]),
      void_tyrant: heroAtlas(.384, [5, 8, 8, 7, 7, 6, 10]),
    };"""

    match = old_atlas_pattern.search(content)
    if not match:
        raise ValueError("Could not match heroAnimation / GAME_ATLAS in sprite-viewer.html")

    content = content[:match.start()] + new_atlas + content[match.end():]

    # Replace getRepairedAtlas / getGameplayImage with clean image cache
    old_repair_pattern = re.compile(
        r'    const repairedAtlases = \{\};.*?function getGameplayImage\(id\) \{.*?return repairedAtlases\[id\];\s*\}',
        re.DOTALL
    )

    new_image_loader = """    const cachedImages = {};
    function getGameplayImage(id) {
      if (!cachedImages[id]) {
        const sheet = SHEETS.find(item => item.id === id);
        if (sheet) {
          const img = new Image();
          img.onload = () => renderGameplay();
          img.src = sheet.src;
          cachedImages[id] = img;
        }
      }
      return cachedImages[id];
    }"""

    match2 = old_repair_pattern.search(content)
    if not match2:
        raise ValueError("Could not match getRepairedAtlas block in sprite-viewer.html")

    content = content[:match2.start()] + new_image_loader + content[match2.end():]

    # Replace loadSelectedSheet logic
    old_load = """      getRepairedAtlas(selected.id).then(atlas => {
        if (state.imageName === selected.id) el.sheetImage.src = atlas.toDataURL('image/png');
      });"""
    new_load = """      el.sheetImage.src = selected.src;"""
    if old_load in content:
        content = content.replace(old_load, new_load, 1)

    # Replace drawGameplaySprite baseline offset: -dh + 5 -> -dh + Math.round(15 * scale)
    old_gameplay_draw = "ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh + 5, dw, dh);"
    new_gameplay_draw = "ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, -dw / 2, -dh + Math.round(15 * scale), dw, dh);"
    if old_gameplay_draw in content:
        content = content.replace(old_gameplay_draw, new_gameplay_draw, 1)

    path.write_text(content, encoding='utf-8')
    print("sprite-viewer.html updated successfully.")

if __name__ == '__main__':
    update_game_js()
    update_index_html()
    update_sprite_viewer_html()
