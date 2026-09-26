/**
 * Testes automatizados para o SpriteAnalyzer
 */
const { analyzeSpriteSheet, WARNINGS, ANCHOR_MODES } = require('../src/utils/spriteAnalyzer.js');

function runTests() {
  console.log('--- TEST 1: Synthetic 4-frame sheet with detached weapons ---');
  // Criar uma imagem sintética 400x100 com 4 personagens (em x = 50, 150, 250, 350)
  // Cada personagem tem um corpo 20x40 e uma arma desconectada a 6px de distância
  const W = 400, H = 100;
  const data = new Uint8ClampedArray(W * H * 4); // Fundo transparente (alfa = 0)

  // Função auxiliar para desenhar bloco retangular
  function drawRect(rx, ry, rw, rh, r=255, g=255, b=255, a=255) {
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) {
          const idx = (y * W + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }

  // 4 personagens
  for (let i = 0; i < 4; i++) {
    const baseX = 30 + i * 100;
    const baseY = 30;
    // Corpo
    drawRect(baseX, baseY, 24, 50, 200, 100, 50, 255);
    // Espada/arma desconectada (gap de 6px)
    drawRect(baseX + 24 + 6, baseY + 10, 8, 30, 255, 200, 50, 255);
    // Pequena faísca/projétil desconectada acima
    drawRect(baseX + 10, baseY - 8, 4, 4, 100, 255, 255, 255);
  }

  const result1 = analyzeSpriteSheet({ data, width: W, height: H }, {
    expectedFrames: 4,
    mergeGapX: 8,
    mergeGapY: 8,
    padding: 2,
    anchorMode: 'bottom_center'
  });

  console.log(`Detectados ${result1.frames.length} frames (esperados: 4)`);
  if (result1.frames.length !== 4) {
    console.error('FAIL: Deveriam ser exatamente 4 frames!');
    process.exit(1);
  }

  // Verificar se cada frame inclui a arma desconectada (largura deve ser >= 38px)
  result1.frames.forEach((f, idx) => {
    console.log(`Frame ${idx}: x=${f.x}, y=${f.y}, w=${f.width}, h=${f.height}, components=${f.componentsCount}, anchor=(${f.anchorX},${f.anchorY})`);
    if (f.width < 38) {
      console.error(`FAIL: Frame ${idx} não agrupou a arma desconectada! Largura: ${f.width}`);
      process.exit(1);
    }
    // Verificar se o anchor Y está na base inferior
    if (f.anchorY < 80) {
      console.error(`FAIL: Anchor Y deveria estar no solo (~80), mas está em ${f.anchorY}`);
      process.exit(1);
    }
  });
  console.log('SUCCESS: Test 1 passou com louvor!');

  console.log('\n--- TEST 2: Solid background detection & color distance ---');
  // Imagem 200x100 com fundo azul escuro (#101428 = 16, 20, 40)
  const data2 = new Uint8ClampedArray(200 * 100 * 4);
  for (let i = 0; i < 200 * 100; i++) {
    data2[i * 4] = 16;
    data2[i * 4 + 1] = 20;
    data2[i * 4 + 2] = 40;
    data2[i * 4 + 3] = 255;
  }
  // Desenhar 2 sprites brancos (#ffffff)
  for (let y = 20; y < 80; y++) {
    for (let x = 30; x < 70; x++) {
      const idx = (y * 200 + x) * 4;
      data2[idx] = 255; data2[idx+1] = 255; data2[idx+2] = 255;
    }
    for (let x = 130; x < 170; x++) {
      const idx = (y * 200 + x) * 4;
      data2[idx] = 255; data2[idx+1] = 255; data2[idx+2] = 255;
    }
  }

  const result2 = analyzeSpriteSheet({ data: data2, width: 200, height: 100 }, {
    backgroundType: 'auto',
    colorTolerance: 15,
  });

  console.log(`Tipo de fundo detectado: ${result2.background.type}, cor:`, result2.background.dominantColor);
  console.log(`Frames detectados: ${result2.frames.length}`);
  if (result2.background.type !== 'solid' || result2.frames.length !== 2) {
    console.error('FAIL: Deveria detectar fundo sólido e 2 frames!');
    process.exit(1);
  }
  console.log('SUCCESS: Test 2 passou com louvor!');

  console.log('\n--- TEST 3: Warning on abnormal aspect ratio and edge touching ---');
  // Desenhar um sprite encostando na borda
  const data3 = new Uint8ClampedArray(100 * 100 * 4);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) { // Encosta no (0, 0)
      const idx = (y * 100 + x) * 4;
      data3[idx] = 255; data3[idx+1] = 255; data3[idx+2] = 255; data3[idx+3] = 255;
    }
  }
  const result3 = analyzeSpriteSheet({ data: data3, width: 100, height: 100 }, { padding: 0 });
  console.log(`Warnings do frame 0:`, result3.frames[0].warnings);
  if (!result3.frames[0].warnings.includes(WARNINGS.FRAME_TOUCHING_EDGE)) {
    console.error('FAIL: Deveria emitir aviso FRAME_TOUCHING_EDGE!');
    process.exit(1);
  }
  console.log('SUCCESS: Test 3 passou com louvor!');

  console.log('\nTODOS OS TESTES DE UNIDADE PASSARAM COM SUCESSO!');
}

runTests();
