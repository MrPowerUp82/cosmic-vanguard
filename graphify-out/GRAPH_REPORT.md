# Graph Report - cosmic-vanguard  (2026-09-28)

## Corpus Check
- 13 files · ~1,857,690 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 251 nodes · 473 edges · 14 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4fe0b766`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- game.js
- COSMIC_VANGUARD_UNIVERSO.md
- updateStage
- spriteAnalyzer.js
- beep
- slice_sprite_sheets.py
- Regiões da campanha
- Cronologia básica
- Path
- Especificação Técnica: Pipeline de Reconstrução de Sprites (Grade 400 × 300)
- build_sprite_sheet.py
- Cosmic Vanguard
- spriteAnalyzer.d.ts

## God Nodes (most connected - your core abstractions)
1. `beep()` - 20 edges
2. `clamp()` - 17 edges
3. `updateStage()` - 12 edges
4. `Cronologia básica` - 12 edges
5. `useSpecial()` - 11 edges
6. `slice_sheet()` - 11 edges
7. `burst()` - 10 edges
8. `analyzeSpriteSheet()` - 10 edges
9. `update()` - 9 edges
10. `startEnemySpecial()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `runTests()` --calls--> `analyzeSpriteSheet()`  [EXTRACTED]
  tools/test_sprite_analyzer.js → src/utils/spriteAnalyzer.js

## Import Cycles
- None detected.

## Communities (14 total, 0 thin omitted)

### Community 0 - "game.js"
Cohesion: 0.11
Nodes (46): bossPreset(), clamp(), completeStage(), drawBar(), drawCitySilhouette(), drawEnemy(), drawEnemySprite(), drawHarbor() (+38 more)

### Community 1 - "COSMIC_VANGUARD_UNIVERSO.md"
Cohesion: 0.06
Nodes (30): A Vanguard, Abyss King, Armored Brute, Cosmic Vanguard — Universo do Jogo, Emerald Nova, Forças do Vazio, Frase do universo, Heróis da Vanguard (+22 more)

### Community 2 - "updateStage"
Cohesion: 0.12
Nodes (31): animDuration(), areaHit(), burst(), damageEnemy(), damagePlayer(), enemyAreaHit(), enemyMeleeHit(), floatingText() (+23 more)

### Community 3 - "spriteAnalyzer.js"
Cohesion: 0.14
Nodes (15): analyzeSpriteSheet(), buildFinalFrames(), createDebugComponentsCanvas(), detectBackground(), detectGrid(), extractImageData(), groupComponents(), canMerge() (+7 more)

### Community 4 - "beep"
Cohesion: 0.18
Nodes (20): beep(), blankSave(), createGame(), cycleMap(), handleCanvasClick(), initAudio(), loadSave(), makePlayer() (+12 more)

### Community 5 - "slice_sprite_sheets.py"
Cohesion: 0.17
Nodes (19): box_gap(), build(), find_labels(), find_parts(), main(), owner_label(), Slice the labelled (ChatGPT-style) sprite sheets into the uniform game atlas.…, Label boxes: dark, solid rectangles ~40 px tall and >= 180 px wide. An opening… (+11 more)

### Community 6 - "Regiões da campanha"
Cohesion: 0.13
Nodes (15): Chefe, Chefe, Chefe, Chefe final, Evento importante, Evento importante, Evento importante, Iron District (+7 more)

### Community 7 - "Cronologia básica"
Cohesion: 0.17
Nodes (12): A mensagem final, Antes da invasão, Ataque a Skyspire, Batalha de Neon Harbor, Batalha do Void Gate, Crise do Iron District, Cronologia básica, Formação da Vanguard (+4 more)

### Community 8 - "Path"
Cohesion: 0.27
Nodes (10): Path, build_enemy(), build_hero(), get_git_image(), main(), Image, Build flawless 400x300 sprite sheets for all 11 characters. Guarantees: 1. Zero…, update_game_js() (+2 more)

### Community 9 - "Especificação Técnica: Pipeline de Reconstrução de Sprites (Grade 400 × 300)"
Cohesion: 0.20
Nodes (9): 1. Resumo do Entendimento (Understanding Summary), 2. Premissas e Requisitos Não-Funcionais (Assumptions), 3. Registro de Decisões (Decision Log), 4.1 Script Definitivo (`tools/build_perfect_400x300.py`), 4.2 Atualização no Motor (`game.js`), 4.3 Atualização no Visualizador (`sprite-viewer.html`), 4. Arquitetura e Fluxo do Pipeline, 5. Critérios de Aceite e Validação (+1 more)

### Community 10 - "build_sprite_sheet.py"
Cohesion: 0.29
Nodes (9): ndarray, build(), generated_grid(), keep_largest_component(), Image, quiet_boundaries(), Build the game's 320 x 240 grid from seven transparent animation strips. An…, Place cuts in the transparent gutters, allowing uneven generated rows. (+1 more)

### Community 11 - "Cosmic Vanguard"
Cohesion: 0.20
Nodes (9): Atualização: sprites de inimigos e boss, Controles, Cosmic Vanguard, Estrutura, Heróis e golpes, Progressão, Rodar, Sprite Sheet Viewer (+1 more)

### Community 12 - "spriteAnalyzer.d.ts"
Cohesion: 0.25
Nodes (7): AnalysisResult, AnalyzerOptions, ContentBounds, DetectedBackground, DetectedGrid, FrameDefinition, NormalizedDimensions

## Knowledge Gaps
- **68 isolated node(s):** `ContentBounds`, `FrameDefinition`, `DetectedGrid`, `DetectedBackground`, `NormalizedDimensions` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 91 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Regiões da campanha` connect `Regiões da campanha` to `COSMIC_VANGUARD_UNIVERSO.md`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Cronologia básica` connect `Cronologia básica` to `COSMIC_VANGUARD_UNIVERSO.md`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `ContentBounds`, `FrameDefinition`, `DetectedGrid` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `game.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10629251700680271 - nodes in this community are weakly interconnected._
- **Should `COSMIC_VANGUARD_UNIVERSO.md` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `updateStage` be split into smaller, more focused modules?**
  _Cohesion score 0.12258064516129032 - nodes in this community are weakly interconnected._
- **Should `spriteAnalyzer.js` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._