/**
 * Sprite Sheet Analyzer
 * Sistema inteligente para detecção, recorte, organização e validação de sprites 2D.
 * 
 * Funcionalidades:
 * - Detecção automática de fundo (alfa transparente ou cor sólida com distância perceptual RGB)
 * - Detecção de grid e gutters
 * - Connected Components Labeling (CCL 8-way)
 * - Agrupamento inteligente morfológico (une armas, cabelos, capas e auras desconectadas)
 * - Heurísticas contra artefatos de IA (sprites deslocados, espaçamento irregular)
 * - Alinhamento por pivô/anchor (Bottom-Center, Center, Center of Mass)
 * - Normalização de frames sem distorção
 * - Detecção de anomalias e warnings estatísticos (FRAME_TOO_SMALL, POSSIBLE_MERGED_FRAMES, etc.)
 * - Hook para fallback de segmentação por IA (NEEDS_AI_SEGMENTATION)
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.SpriteAnalyzer = exportsObj;
    root.analyzeSpriteSheet = exportsObj.analyzeSpriteSheet;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Warnings padronizados do sistema
  const WARNINGS = {
    FRAME_TOUCHING_EDGE: 'FRAME_TOUCHING_EDGE',
    FRAME_TOO_SMALL: 'FRAME_TOO_SMALL',
    FRAME_TOO_LARGE: 'FRAME_TOO_LARGE',
    FRAME_OVERLAPPING: 'FRAME_OVERLAPPING',
    MULTIPLE_LARGE_COMPONENTS: 'MULTIPLE_LARGE_COMPONENTS',
    TOO_MANY_COMPONENTS: 'TOO_MANY_COMPONENTS',
    POSSIBLE_MERGED_FRAMES: 'POSSIBLE_MERGED_FRAMES',
    POSSIBLE_SPLIT_FRAME: 'POSSIBLE_SPLIT_FRAME',
    FRAME_COUNT_MISMATCH: 'FRAME_COUNT_MISMATCH',
    UNUSUAL_ASPECT_RATIO: 'UNUSUAL_ASPECT_RATIO',
    NEEDS_AI_SEGMENTATION: 'NEEDS_AI_SEGMENTATION',
  };

  const ANCHOR_MODES = {
    BOTTOM_CENTER: 'bottom_center',
    CENTER: 'center',
    CENTER_OF_MASS: 'center_of_mass',
    CUSTOM: 'custom',
  };

  const DEFAULT_OPTIONS = {
    backgroundType: 'auto',      // 'auto' | 'transparent' | 'solid'
    alphaThreshold: 8,           // 0..255 (valores acima são foreground)
    colorTolerance: 20,          // Tolerância de distância de cor para fundo sólido
    padding: 3,                  // Padding em pixels ao redor do frame detectado
    mergeGapX: 6,                // Distância máxima X para fusão morfológica de partes desconectadas
    mergeGapY: 6,                // Distância máxima Y para fusão morfológica
    minComponentArea: 4,         // Área mínima em pixels para descartar ruído isolado
    expectedFrames: null,        // Quantidade esperada de frames (restrição suave)
    expectedRows: null,          // Quantidade esperada de linhas
    expectedCols: null,          // Quantidade esperada de colunas
    anchorMode: 'bottom_center', // 'bottom_center' | 'center' | 'center_of_mass' | 'custom'
    confidenceThreshold: 0.70,   // Limiar para acionar alerta de revisão / NEEDS_AI_SEGMENTATION
    aiFallback: true,            // Habilita aviso para segmentação externa quando confiança baixa
  };

  /**
   * Distância de cor perceptual ponderada no espaço RGB
   * (Aproximação eficiente de DeltaE sem o custo de conversão LAB completa por pixel)
   */
  function perceptualColorDistance(r1, g1, b1, r2, g2, b2) {
    const rMean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(
      (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
    );
  }

  /**
   * Extrai ImageData a partir de HTMLImageElement, HTMLCanvasElement ou ImageData
   */
  function extractImageData(source) {
    if (!source) throw new Error('Fonte de imagem inválida para análise.');

    if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
      return source;
    }

    if (source.data && source.width && source.height) {
      return source; // Duck-typing para ImageData ou array compatível
    }

    const width = source.naturalWidth || source.videoWidth || source.width;
    const height = source.naturalHeight || source.videoHeight || source.height;

    if (!width || !height) {
      throw new Error('Dimensões da imagem são zero ou inválidas.');
    }

    let canvas;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0);
      return ctx.getImageData(0, 0, width, height);
    }

    throw new Error('Ambiente sem suporte a Canvas para extrair ImageData.');
  }

  /**
   * ETAPA 3 — Detecção de Fundo (Transparente ou Sólido com distância de cor)
   */
  function detectBackground(imageData, options) {
    const { data, width, height } = imageData;
    const alphaThreshold = options.alphaThreshold ?? 8;
    const colorTolerance = options.colorTolerance ?? 20;

    // Amostrar pixels da borda externa e dos quatro cantos
    let transparentBorderPixels = 0;
    let totalSampled = 0;
    const cornerSamples = [];

    // Cantos: 6x6 patches nos 4 cantos
    const patchSize = Math.min(6, Math.floor(width / 2), Math.floor(height / 2));
    const corners = [
      { x0: 0, y0: 0 },
      { x0: width - patchSize, y0: 0 },
      { x0: 0, y0: height - patchSize },
      { x0: width - patchSize, y0: height - patchSize },
    ];

    for (const c of corners) {
      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          const idx = ((c.y0 + dy) * width + (c.x0 + dx)) * 4;
          const a = data[idx + 3];
          if (a <= alphaThreshold) {
            transparentBorderPixels++;
          } else {
            cornerSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
          }
          totalSampled++;
        }
      }
    }

    // Amostra uniforme do perímetro
    for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 50))) {
      const topIdx = x * 4;
      const botIdx = ((height - 1) * width + x) * 4;
      if (data[topIdx + 3] <= alphaThreshold) transparentBorderPixels++;
      else cornerSamples.push({ r: data[topIdx], g: data[topIdx + 1], b: data[topIdx + 2] });
      if (data[botIdx + 3] <= alphaThreshold) transparentBorderPixels++;
      else cornerSamples.push({ r: data[botIdx], g: data[botIdx + 1], b: data[botIdx + 2] });
      totalSampled += 2;
    }

    let determinedType = options.backgroundType;
    if (determinedType === 'auto') {
      determinedType = (transparentBorderPixels / totalSampled) >= 0.5 ? 'transparent' : 'solid';
    }

    let dominantBgColor = null;
    if (determinedType === 'solid' && cornerSamples.length > 0) {
      // Calcular cor média ponderada das amostras de canto
      let sumR = 0, sumG = 0, sumB = 0;
      for (const s of cornerSamples) {
        sumR += s.r;
        sumG += s.g;
        sumB += s.b;
      }
      dominantBgColor = {
        r: Math.round(sumR / cornerSamples.length),
        g: Math.round(sumG / cornerSamples.length),
        b: Math.round(sumB / cornerSamples.length),
      };
    }

    // Criar máscara binária 0 (fundo) e 1 (foreground)
    const mask = new Uint8Array(width * height);
    let foregroundPixelCount = 0;

    if (determinedType === 'transparent') {
      for (let i = 0; i < width * height; i++) {
        const a = data[i * 4 + 3];
        if (a > alphaThreshold) {
          mask[i] = 1;
          foregroundPixelCount++;
        }
      }
    } else {
      const bg = dominantBgColor || { r: 0, g: 0, b: 0 };
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const a = data[idx + 3];
        if (a <= alphaThreshold) {
          mask[i] = 0;
          continue;
        }
        const dist = perceptualColorDistance(data[idx], data[idx + 1], data[idx + 2], bg.r, bg.g, bg.b);
        if (dist > colorTolerance) {
          mask[i] = 1;
          foregroundPixelCount++;
        }
      }
    }

    return {
      type: determinedType,
      dominantColor: dominantBgColor,
      mask,
      foregroundPixelCount,
    };
  }

  /**
   * ETAPA 4 — Detecção Automática de Grid e Gutters
   */
  function detectGrid(mask, width, height, options) {
    // Projeções horizontal e vertical
    const rowOccupancy = new Int32Array(height);
    const colOccupancy = new Int32Array(width);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      let count = 0;
      for (let x = 0; x < width; x++) {
        if (mask[rowOffset + x]) {
          count++;
          colOccupancy[x]++;
        }
      }
      rowOccupancy[y] = count;
    }

    // Identificar gutters (faixas vazias)
    const emptyRows = [];
    for (let y = 0; y < height; y++) {
      if (rowOccupancy[y] === 0) emptyRows.push(y);
    }
    const emptyCols = [];
    for (let x = 0; x < width; x++) {
      if (colOccupancy[x] === 0) emptyCols.push(x);
    }

    // Avaliar possíveis divisões de grid
    const candidateRows = options.expectedRows ? [options.expectedRows] : [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
    const candidateCols = options.expectedCols ? [options.expectedCols] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

    let bestGrid = {
      rows: 1,
      columns: 1,
      cellW: width,
      cellH: height,
      confidence: 0.1,
    };

    let maxScore = -1;

    for (const r of candidateRows) {
      for (const c of candidateCols) {
        if (r === 1 && c === 1) continue;
        const cellW = width / c;
        const cellH = height / r;

        if (cellW < 20 || cellH < 20) continue;

        // Medir se as linhas divisórias caem em gutters vazios
        let cutGutterHits = 0;
        let totalCuts = 0;

        for (let i = 1; i < c; i++) {
          const cutX = Math.round(i * cellW);
          totalCuts++;
          // Tolerância de ±2 pixels
          let hit = false;
          for (let d = -2; d <= 2; d++) {
            const tx = cutX + d;
            if (tx >= 0 && tx < width && colOccupancy[tx] <= Math.max(1, width * 0.005)) {
              hit = true;
              break;
            }
          }
          if (hit) cutGutterHits++;
        }

        for (let j = 1; j < r; j++) {
          const cutY = Math.round(j * cellH);
          totalCuts++;
          let hit = false;
          for (let d = -2; d <= 2; d++) {
            const ty = cutY + d;
            if (ty >= 0 && ty < height && rowOccupancy[ty] <= Math.max(1, height * 0.005)) {
              hit = true;
              break;
            }
          }
          if (hit) cutGutterHits++;
        }

        const gutterAlignmentScore = totalCuts > 0 ? (cutGutterHits / totalCuts) : 0.5;

        // Verificar regularidade do conteúdo interno de cada célula
        let cellsWithContent = 0;
        let cellAreas = [];

        for (let ry = 0; ry < r; ry++) {
          for (let cx = 0; cx < c; cx++) {
            let pxInCell = 0;
            const x0 = Math.floor(cx * cellW);
            const y0 = Math.floor(ry * cellH);
            const x1 = Math.min(width, Math.floor((cx + 1) * cellW));
            const y1 = Math.min(height, Math.floor((ry + 1) * cellH));

            for (let y = y0; y < y1; y += 2) {
              const rowOff = y * width;
              for (let x = x0; x < x1; x += 2) {
                if (mask[rowOff + x]) pxInCell++;
              }
            }
            if (pxInCell > 10) {
              cellsWithContent++;
              cellAreas.push(pxInCell);
            }
          }
        }

        const contentRatio = cellsWithContent / (r * c);
        if (contentRatio < 0.25) continue;

        // Variação do tamanho do conteúdo nas células ocupadas
        let areaConsistency = 0.5;
        if (cellAreas.length > 1) {
          const avgArea = cellAreas.reduce((a, b) => a + b, 0) / cellAreas.length;
          const variance = cellAreas.reduce((acc, v) => acc + Math.pow(v - avgArea, 2), 0) / cellAreas.length;
          const stdDev = Math.sqrt(variance);
          areaConsistency = Math.max(0, 1 - (stdDev / (avgArea + 1e-5)));
        }

        // Pontuação combinada
        const score = gutterAlignmentScore * 0.55 + areaConsistency * 0.30 + contentRatio * 0.15;

        if (score > maxScore) {
          maxScore = score;
          bestGrid = {
            rows: r,
            columns: c,
            cellW: Math.round(cellW),
            cellH: Math.round(cellH),
            confidence: Math.min(0.98, Math.max(0.2, score)),
          };
        }
      }
    }

    return bestGrid;
  }

  /**
   * ETAPA 5 — Connected Components Labeling (CCL 8-way flood fill)
   */
  function labelConnectedComponents(mask, width, height, minArea = 4) {
    const labels = new Int32Array(width * height);
    const components = [];
    let currentLabel = 0;

    // Fila para BFS rápido em buffer pré-alocado
    const queue = new Int32Array(width * height);

    // 8 vizinhos para manter conectadas pontas de lança, espadas e auras diagonais
    const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const startIdx = rowOffset + x;
        if (mask[startIdx] === 0 || labels[startIdx] !== 0) continue;

        currentLabel++;
        let head = 0;
        let tail = 0;

        queue[tail++] = startIdx;
        labels[startIdx] = currentLabel;

        let minX = x, maxX = x;
        let minY = y, maxY = y;
        let pixelCount = 0;
        let sumX = 0, sumY = 0;

        while (head < tail) {
          const curr = queue[head++];
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          pixelCount++;
          sumX += cx;
          sumY += cy;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let d = 0; d < 8; d++) {
            const nx = cx + dx[d];
            const ny = cy + dy[d];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (mask[nIdx] === 1 && labels[nIdx] === 0) {
                labels[nIdx] = currentLabel;
                queue[tail++] = nIdx;
              }
            }
          }
        }

        // Ignora ruído minúsculo isolado
        if (pixelCount >= minArea) {
          const w = maxX - minX + 1;
          const h = maxY - minY + 1;
          components.push({
            id: currentLabel,
            minX,
            minY,
            maxX,
            maxY,
            width: w,
            height: h,
            area: w * h,
            pixelCount,
            centerX: minX + w / 2,
            centerY: minY + h / 2,
            centerOfMassX: sumX / pixelCount,
            centerOfMassY: sumY / pixelCount,
            isSatellite: pixelCount < 40 || (w <= 8 && h <= 8),
          });
        }
      }
    }

    return { labels, components };
  }

  /**
   * ETAPA 6 e ETAPA 7 — Agrupamento Inteligente de Componentes Próximos
   * Une o corpo principal com armas, faíscas, pontas de espadas e auras desconectadas
   */
  function groupComponents(components, width, height, detectedGrid, options) {
    if (components.length === 0) return [];

    const mergeGapX = options.mergeGapX ?? 6;
    const mergeGapY = options.mergeGapY ?? 6;
    const expectedFrames = options.expectedFrames;

    // Ordenar componentes por área decrescente (maiores corpos primeiro)
    const sorted = [...components].sort((a, b) => b.pixelCount - a.pixelCount);

    // Calcular tamanho típico de um corpo principal
    const primaryBodies = sorted.filter(c => c.pixelCount > 100);
    const medianBodyW = primaryBodies.length > 0
      ? primaryBodies[Math.floor(primaryBodies.length / 2)].width
      : (detectedGrid?.cellW ? detectedGrid.cellW * 0.6 : 80);
    const medianBodyH = primaryBodies.length > 0
      ? primaryBodies[Math.floor(primaryBodies.length / 2)].height
      : (detectedGrid?.cellH ? detectedGrid.cellH * 0.7 : 100);

    // Disjoint-set (Union-Find) para agrupamento
    const parent = new Array(components.length);
    for (let i = 0; i < components.length; i++) parent[i] = i;

    function find(i) {
      if (parent[i] === i) return i;
      parent[i] = find(parent[i]);
      return parent[i];
    }

    function union(i, j) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootJ] = rootI;
      }
    }

    // Cluster boundaries temporários
    const clusterBounds = components.map(c => ({
      minX: c.minX, minY: c.minY, maxX: c.maxX, maxY: c.maxY,
      pixelCount: c.pixelCount
    }));

    function canMerge(idxA, idxB) {
      const bA = clusterBounds[find(idxA)];
      const bB = clusterBounds[find(idxB)];

      // Proximidade com gap morfológico
      const gapX = Math.max(0, Math.max(bA.minX, bB.minX) - Math.min(bA.maxX, bB.maxX));
      const gapY = Math.max(0, Math.max(bA.minY, bB.minY) - Math.min(bA.maxY, bB.maxY));

      // Se ambos forem corpos grandes, a distância permitida é estrita (evita fundir 2 personagens)
      const bothAreBig = bA.pixelCount > 250 && bB.pixelCount > 250;
      const maxAllowedGapX = bothAreBig ? Math.min(mergeGapX, 4) : mergeGapX * 2.5;
      const maxAllowedGapY = bothAreBig ? Math.min(mergeGapY, 4) : mergeGapY * 2.5;

      if (gapX > maxAllowedGapX || gapY > maxAllowedGapY) return false;

      // Trava de tamanho máximo do frame combinado
      const unionMinX = Math.min(bA.minX, bB.minX);
      const unionMaxX = Math.max(bA.maxX, bB.maxX);
      const unionMinY = Math.min(bA.minY, bB.minY);
      const unionMaxY = Math.max(bA.maxY, bB.maxY);
      const unionW = unionMaxX - unionMinX + 1;
      const unionH = unionMaxY - unionMinY + 1;

      // Se a união ultrapassar a largura máxima esperada de um único personagem, bloqueia fusão
      const maxFrameW = detectedGrid?.confidence > 0.65 ? detectedGrid.cellW * 1.15 : medianBodyW * 2.2;
      const maxFrameH = detectedGrid?.confidence > 0.65 ? detectedGrid.cellH * 1.25 : medianBodyH * 2.2;

      if (unionW > maxFrameW || unionH > maxFrameH) {
        return false;
      }

      // Se há um grid confiável, favorece a fusão dentro da mesma célula de grid
      if (detectedGrid?.confidence > 0.70) {
        const cellWA = Math.floor((bA.minX + bA.maxX) / 2 / detectedGrid.cellW);
        const cellWB = Math.floor((bB.minX + bB.maxX) / 2 / detectedGrid.cellW);
        const cellHA = Math.floor((bA.minY + bA.maxY) / 2 / detectedGrid.cellH);
        const cellHB = Math.floor((bB.minY + bB.maxY) / 2 / detectedGrid.cellH);
        if (cellWA !== cellWB || cellHA !== cellHB) {
          // Só permite cruzar célula se for satélite minúsculo (ex.: espada longa esticada)
          const isSmallSatellite = (bA.pixelCount < 80 || bB.pixelCount < 80);
          if (!isSmallSatellite) return false;
        }
      }

      return true;
    }

    // Iteração de união de componentes
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        if (find(i) === find(j)) continue;
        if (canMerge(i, j)) {
          const rootI = find(i);
          const rootJ = find(j);
          // Atualiza os bounds agregados do cluster
          const bI = clusterBounds[rootI];
          const bJ = clusterBounds[rootJ];
          bI.minX = Math.min(bI.minX, bJ.minX);
          bI.minY = Math.min(bI.minY, bJ.minY);
          bI.maxX = Math.max(bI.maxX, bJ.maxX);
          bI.maxY = Math.max(bI.maxY, bJ.maxY);
          bI.pixelCount += bJ.pixelCount;
          union(i, j);
        }
      }
    }

    // Agregar componentes em grupos
    const clustersMap = new Map();
    for (let i = 0; i < components.length; i++) {
      const root = find(i);
      if (!clustersMap.has(root)) {
        clustersMap.set(root, []);
      }
      clustersMap.get(root).push(components[i]);
    }

    let clusters = Array.from(clustersMap.values()).map(members => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let totalPixels = 0;
      let sumOfMassX = 0, sumOfMassY = 0;

      for (const m of members) {
        if (m.minX < minX) minX = m.minX;
        if (m.minY < minY) minY = m.minY;
        if (m.maxX > maxX) maxX = m.maxX;
        if (m.maxY > maxY) maxY = m.maxY;
        totalPixels += m.pixelCount;
        sumOfMassX += m.centerOfMassX * m.pixelCount;
        sumOfMassY += m.centerOfMassY * m.pixelCount;
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;

      return {
        components: members,
        minX,
        minY,
        maxX,
        maxY,
        width: w,
        height: h,
        pixelCount: totalPixels,
        centerX: minX + w / 2,
        centerY: minY + h / 2,
        centerOfMassX: sumOfMassX / (totalPixels || 1),
        centerOfMassY: sumOfMassY / (totalPixels || 1),
      };
    });

    // ETAPA 7 — Restrição e ajuste se expectedFrames foi fornecido
    if (expectedFrames && clusters.length > expectedFrames) {
      // Se há mais clusters que o esperado, tentar unir satélites menores aos corpos mais próximos
      clusters.sort((a, b) => b.pixelCount - a.pixelCount);
      while (clusters.length > expectedFrames) {
        // Encontrar o menor cluster e unir ao seu vizinho mais próximo
        let bestDistance = Infinity;
        let mergeA = -1;
        let mergeB = -1;

        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const cA = clusters[i];
            const cB = clusters[j];
            const dx = Math.max(0, Math.max(cA.minX, cB.minX) - Math.min(cA.maxX, cB.maxX));
            const dy = Math.max(0, Math.max(cA.minY, cB.minY) - Math.min(cA.maxY, cB.maxY));
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Não fundir se a largura final exceder o bom senso
            const unionW = Math.max(cA.maxX, cB.maxX) - Math.min(cA.minX, cB.minX) + 1;
            if (unionW > medianBodyW * 2.4) continue;

            if (dist < bestDistance) {
              bestDistance = dist;
              mergeA = i;
              mergeB = j;
            }
          }
        }

        if (mergeA >= 0 && mergeB >= 0 && bestDistance < Math.max(mergeGapX, mergeGapY) * 6) {
          const cA = clusters[mergeA];
          const cB = clusters[mergeB];
          const unionMinX = Math.min(cA.minX, cB.minX);
          const unionMinY = Math.min(cA.minY, cB.minY);
          const unionMaxX = Math.max(cA.maxX, cB.maxX);
          const unionMaxY = Math.max(cA.maxY, cB.maxY);
          const totalPx = cA.pixelCount + cB.pixelCount;

          cA.components.push(...cB.components);
          cA.minX = unionMinX;
          cA.minY = unionMinY;
          cA.maxX = unionMaxX;
          cA.maxY = unionMaxY;
          cA.width = unionMaxX - unionMinX + 1;
          cA.height = unionMaxY - unionMinY + 1;
          cA.centerOfMassX = (cA.centerOfMassX * cA.pixelCount + cB.centerOfMassX * cB.pixelCount) / totalPx;
          cA.centerOfMassY = (cA.centerOfMassY * cA.pixelCount + cB.centerOfMassY * cB.pixelCount) / totalPx;
          cA.pixelCount = totalPx;
          cA.centerX = unionMinX + cA.width / 2;
          cA.centerY = unionMinY + cA.height / 2;

          clusters.splice(mergeB, 1);
        } else {
          // Não foi possível reduzir com segurança sem distorcer
          break;
        }
      }
    }

    return clusters;
  }

  /**
   * ETAPA 18 — Ordenação Natural dos Frames (Linha por linha, esquerda para direita)
   */
  function sortFramesNaturally(clusters, detectedGrid) {
    if (clusters.length <= 1) return clusters;

    // Calcular altura mediana para agrupar em faixas de linhas (linhas horizontais)
    const heights = clusters.map(c => c.height).sort((a, b) => a - b);
    const medianH = heights[Math.floor(heights.length / 2)] || 100;
    const rowTolerance = medianH * 0.45;

    // Agrupar em faixas de linhas usando Y médio
    const rows = [];
    // Primeiro ordenar superficialmente por Y
    const ySorted = [...clusters].sort((a, b) => a.centerY - b.centerY);

    for (const c of ySorted) {
      let placed = false;
      for (const r of rows) {
        if (Math.abs(c.centerY - r.avgY) <= rowTolerance) {
          r.items.push(c);
          r.avgY = (r.avgY * (r.items.length - 1) + c.centerY) / r.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push({ avgY: c.centerY, items: [c] });
      }
    }

    // Ordenar as linhas do topo para a base
    rows.sort((a, b) => a.avgY - b.avgY);

    // Ordenar itens dentro de cada linha da esquerda para a direita (X crescente)
    const sortedResult = [];
    for (const r of rows) {
      r.items.sort((a, b) => a.centerX - b.centerX);
      sortedResult.push(...r.items);
    }

    return sortedResult;
  }

  /**
   * ETAPA 8, 10, 11 e 9 — Normalização, Padding Seguro, Pivô e Validação
   */
  function buildFinalFrames(sortedClusters, imageWidth, imageHeight, options, detectedGrid) {
    const padding = Math.max(0, options.padding ?? 3);
    const anchorMode = options.anchorMode || ANCHOR_MODES.BOTTOM_CENTER;
    const confidenceThreshold = options.confidenceThreshold ?? 0.70;

    // Estatísticas de dimensões para cálculo de anomalias
    const widths = sortedClusters.map(c => c.width).sort((a, b) => a - b);
    const heights = sortedClusters.map(c => c.height).sort((a, b) => a - b);
    const areas = sortedClusters.map(c => c.width * c.height).sort((a, b) => a - b);

    const medianW = widths[Math.floor(widths.length / 2)] || 1;
    const medianH = heights[Math.floor(heights.length / 2)] || 1;
    const medianArea = areas[Math.floor(areas.length / 2)] || 1;
    const medianAspect = medianW / medianH;

    const frames = sortedClusters.map((c, index) => {
      // ETAPA 8 — Padding seguro com clamp aos limites da imagem
      const x = Math.max(0, c.minX - padding);
      const y = Math.max(0, c.minY - padding);
      const maxX = Math.min(imageWidth - 1, c.maxX + padding);
      const maxY = Math.min(imageHeight - 1, c.maxY + padding);
      const width = maxX - x + 1;
      const height = maxY - y + 1;

      const contentBounds = {
        x: c.minX,
        y: c.minY,
        width: c.width,
        height: c.height,
      };

      // ETAPA 11 — Sistema de Anchor / Pivô
      let anchorX, anchorY;
      switch (anchorMode) {
        case ANCHOR_MODES.CENTER:
          anchorX = Math.round(contentBounds.x + contentBounds.width / 2);
          anchorY = Math.round(contentBounds.y + contentBounds.height / 2);
          break;
        case ANCHOR_MODES.CENTER_OF_MASS:
          anchorX = Math.round(c.centerOfMassX);
          anchorY = Math.round(c.centerOfMassY);
          break;
        case ANCHOR_MODES.BOTTOM_CENTER:
        default:
          // Pés cravados no chão: centro horizontal e base inferior do conteúdo
          anchorX = Math.round(contentBounds.x + contentBounds.width / 2);
          anchorY = Math.round(contentBounds.y + contentBounds.height);
          break;
      }

      // ETAPA 9 — Validação estatística e warnings de recorte
      const warnings = [];
      let confidence = 1.0;

      // FRAME_TOUCHING_EDGE
      if (x === 0 || y === 0 || maxX === imageWidth - 1 || maxY === imageHeight - 1) {
        warnings.push(WARNINGS.FRAME_TOUCHING_EDGE);
        confidence -= 0.15;
      }

      // FRAME_TOO_SMALL
      if (c.width < medianW * 0.25 || c.height < medianH * 0.25 || (c.width * c.height) < medianArea * 0.2) {
        warnings.push(WARNINGS.FRAME_TOO_SMALL);
        confidence -= 0.25;
      }

      // FRAME_TOO_LARGE / POSSIBLE_MERGED_FRAMES
      if (c.width > medianW * 1.95) {
        warnings.push(WARNINGS.POSSIBLE_MERGED_FRAMES);
        warnings.push(WARNINGS.FRAME_TOO_LARGE);
        confidence -= 0.35;
      }

      // UNUSUAL_ASPECT_RATIO
      const frameAspect = c.width / c.height;
      if (frameAspect > medianAspect * 2.4 || frameAspect < medianAspect * 0.4) {
        warnings.push(WARNINGS.UNUSUAL_ASPECT_RATIO);
        confidence -= 0.20;
      }

      // Múltiplos componentes grandes
      const largeSubcomponents = c.components.filter(m => m.pixelCount > 150);
      if (largeSubcomponents.length > 1) {
        warnings.push(WARNINGS.MULTIPLE_LARGE_COMPONENTS);
        confidence -= 0.15;
      }

      confidence = Math.max(0.1, Math.min(1.0, confidence));

      // ETAPA 21 — AI como Fallback
      if (confidence < confidenceThreshold && options.aiFallback) {
        warnings.push(WARNINGS.NEEDS_AI_SEGMENTATION);
      }

      return {
        id: index,
        x,
        y,
        width,
        height,
        contentBounds,
        centerX: Math.round(x + width / 2),
        centerY: Math.round(y + height / 2),
        anchorX,
        anchorY,
        relativeAnchorX: anchorX - x,
        relativeAnchorY: anchorY - y,
        pixelCount: c.pixelCount,
        componentsCount: c.components.length,
        confidence: Number(confidence.toFixed(2)),
        warnings,
      };
    });

    // Detecção de sobreposições entre frames (FRAME_OVERLAPPING)
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const fA = frames[i];
        const fB = frames[j];
        const overlapX = Math.max(0, Math.min(fA.x + fA.width, fB.x + fB.width) - Math.max(fA.x, fB.x));
        const overlapY = Math.max(0, Math.min(fA.y + fA.height, fB.y + fB.height) - Math.max(fA.y, fB.y));
        const overlapArea = overlapX * overlapY;

        if (overlapArea > Math.min(fA.width * fA.height, fB.width * fB.height) * 0.08) {
          if (!fA.warnings.includes(WARNINGS.FRAME_OVERLAPPING)) fA.warnings.push(WARNINGS.FRAME_OVERLAPPING);
          if (!fB.warnings.includes(WARNINGS.FRAME_OVERLAPPING)) fB.warnings.push(WARNINGS.FRAME_OVERLAPPING);
          fA.confidence = Math.max(0.1, fA.confidence - 0.2);
          fB.confidence = Math.max(0.1, fB.confidence - 0.2);
        }
      }
    }

    return frames;
  }

  /**
   * ETAPA 2 — Função Mestre Principal: analyzeSpriteSheet
   * Executa todo o pipeline híbrido de ponta a ponta
   */
  function analyzeSpriteSheet(imageSource, userOptions = {}) {
    const options = { ...DEFAULT_OPTIONS, ...userOptions };
    const imageData = extractImageData(imageSource);
    const { width, height } = imageData;

    const globalWarnings = [];

    // 1. Detecção de fundo e máscara
    const bgInfo = detectBackground(imageData, options);

    if (bgInfo.foregroundPixelCount === 0) {
      globalWarnings.push('Nenhum pixel de foreground detectado.');
      return {
        frames: [],
        detectedGrid: { rows: 0, columns: 0, cellW: 0, cellH: 0, confidence: 0 },
        background: bgInfo,
        warnings: globalWarnings,
      };
    }

    // 2. Detecção automática de grid
    const detectedGrid = detectGrid(bgInfo.mask, width, height, options);

    // 3. Connected Components Labeling
    const ccl = labelConnectedComponents(bgInfo.mask, width, height, options.minComponentArea);

    // 4. Agrupamento inteligente morfológico
    const clusters = groupComponents(ccl.components, width, height, detectedGrid, options);

    // 5. Ordenação natural (linha por linha)
    const sortedClusters = sortFramesNaturally(clusters, detectedGrid);

    // 6. Construção dos frames finais, padding, pivô e validação
    const frames = buildFinalFrames(sortedClusters, width, height, options, detectedGrid);

    // Verificação de quantidade esperada de frames
    if (options.expectedFrames && frames.length !== options.expectedFrames) {
      globalWarnings.push(WARNINGS.FRAME_COUNT_MISMATCH);
    }

    // Dimensões normalizadas recomendadas (ETAPA 10)
    const maxWidth = frames.length > 0 ? Math.max(...frames.map(f => f.width)) : 0;
    const maxHeight = frames.length > 0 ? Math.max(...frames.map(f => f.height)) : 0;

    return {
      frames,
      detectedGrid,
      background: {
        type: bgInfo.type,
        dominantColor: bgInfo.dominantColor,
      },
      normalizedDimensions: {
        maxWidth,
        maxHeight,
      },
      rawComponentsCount: ccl.components.length,
      warnings: globalWarnings,
      _mask: bgInfo.mask,
      _labels: ccl.labels,
      imageWidth: width,
      imageHeight: height,
    };
  }

  /**
   * ETAPA 10 — Renderização Normalizada de Frame preservando escala original
   * Mantém a escala 1:1 e alinha perfeitamente pelo anchor
   */
  function renderNormalizedFrame(sourceImage, frame, targetCanvas, options = {}) {
    if (!targetCanvas || !frame) return;
    const ctx = targetCanvas.getContext('2d');
    const targetW = targetCanvas.width;
    const targetH = targetCanvas.height;

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = false;

    // Ponto de destino do pivô no canvas normalizado (geralmente centro-horizontal e margem inferior)
    const targetAnchorX = options.targetAnchorX ?? Math.round(targetW / 2);
    const targetAnchorY = options.targetAnchorY ?? Math.round(targetH - 10);

    const drawX = targetAnchorX - frame.relativeAnchorX;
    const drawY = targetAnchorY - frame.relativeAnchorY;

    ctx.drawImage(
      sourceImage,
      frame.x, frame.y, frame.width, frame.height,
      drawX, drawY, frame.width, frame.height
    );

    // Desenha cruz do anchor se requisitado
    if (options.showAnchor) {
      ctx.strokeStyle = '#ff3366';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(targetAnchorX - 6, targetAnchorY);
      ctx.lineTo(targetAnchorX + 6, targetAnchorY);
      ctx.moveTo(targetAnchorX, targetAnchorY - 6);
      ctx.lineTo(targetAnchorX, targetAnchorY + 6);
      ctx.stroke();
    }
  }

  /**
   * ETAPA 17 — Geradores de Canvas de Debug
   */
  function createDebugMaskCanvas(analysisResult) {
    const { _mask, imageWidth, imageHeight } = analysisResult;
    if (!_mask) return null;

    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(imageWidth, imageHeight);
    const d = imgData.data;

    for (let i = 0; i < imageWidth * imageHeight; i++) {
      const v = _mask[i] ? 255 : 0;
      const idx = i * 4;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function createDebugComponentsCanvas(analysisResult) {
    const { _labels, imageWidth, imageHeight } = analysisResult;
    if (!_labels) return null;

    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(imageWidth, imageHeight);
    const d = imgData.data;

    // Paleta de cores de alto contraste para identificar componentes
    function colorForLabel(label) {
      if (label === 0) return [0, 0, 0, 0];
      const hue = (label * 137.508) % 360;
      // Conversão HSL para RGB rápida
      const s = 0.85, l = 0.55;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
      const m = l - c / 2;
      let r = 0, g = 0, b = 0;
      if (hue < 60) { r = c; g = x; }
      else if (hue < 120) { r = x; g = c; }
      else if (hue < 180) { g = c; b = x; }
      else if (hue < 240) { g = x; b = c; }
      else if (hue < 300) { r = x; b = c; }
      else { r = c; b = x; }
      return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
    }

    for (let i = 0; i < imageWidth * imageHeight; i++) {
      const label = _labels[i];
      if (label > 0) {
        const [r, g, b, a] = colorForLabel(label);
        const idx = i * 4;
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = a;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * ETAPA 20 — Exportadores de Metadados e Atlas
   */
  function exportMetadataJSON(analysisResult, sourceFilename = 'spritesheet.png', animationsMap = {}) {
    return JSON.stringify({
      source: sourceFilename,
      frameSize: analysisResult.normalizedDimensions,
      detectedGrid: analysisResult.detectedGrid,
      background: analysisResult.background,
      frames: analysisResult.frames.map(f => ({
        id: f.id,
        source: {
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
        },
        contentBounds: f.contentBounds,
        anchor: {
          x: f.anchorX,
          y: f.anchorY,
        },
        relativeAnchor: {
          x: f.relativeAnchorX,
          y: f.relativeAnchorY,
        },
        confidence: f.confidence,
        warnings: f.warnings,
      })),
      animations: animationsMap,
    }, null, 2);
  }

  return {
    analyzeSpriteSheet,
    detectBackground,
    detectGrid,
    labelConnectedComponents,
    groupComponents,
    renderNormalizedFrame,
    createDebugMaskCanvas,
    createDebugComponentsCanvas,
    exportMetadataJSON,
    WARNINGS,
    ANCHOR_MODES,
    DEFAULT_OPTIONS,
  };
});
