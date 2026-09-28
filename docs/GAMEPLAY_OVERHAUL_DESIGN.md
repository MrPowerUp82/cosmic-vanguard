# Especificação de Design: Gameplay Overhaul — Fase 1 (só código)

## 1. Resumo do Entendimento
* **O que:** pacote de melhorias de gameplay para o Cosmic Vanguard, entregue em sub-etapas:
  **Núcleo → 1a Combate → 1b Esquiva perfeita + Tag-assist → 1c Progressão → 1d Variedade.**
* **Por que:** hoje um toque em J executa o combo inteiro, não há hitstop, créditos não têm uso, a troca de herói é cosmética (HP por proporção), não há cura e as fases seguem a mesma estrutura.
* **Para quem:** jogador solo e co-op local no teclado.
* **Restrições:** nenhum sprite novo (reuso das 7 linhas: idle, walk, attack, jump, dash, hurt, special); nenhuma tecla nova; co-op deve continuar funcionando; JS puro sem build.
* **Não-escopo:** agarrão/arremesso com arte própria, knockdown/get-up desenhados, props quebráveis, gamepad, online, novos heróis/inimigos/fases, trilha sonora real. Arte nova fica para a Fase 2 (prompts para ChatGPT).

## 2. Premissas (Requisitos Não-Funcionais)
1. **Performance:** 60 fps no navegador desktop; teto de ~400 partículas; hitstop/slow-mo via escala de `dt`, nunca travando o loop.
2. **Arquitetura:** JS puro, múltiplos `<script>` no padrão IIFE, comunicação via `window.CV`.
3. **Persistência:** apenas `localStorage`; save sobe para `version: 2` com migração automática.
4. **Balanceamento:** Normal continua vencível sem upgrades; upgrades servem para estilo e rank.
5. **Testes:** Node + `vm` (harness existente) para regras puras; verificação visual no browser por sub-etapa.
6. **Manutenção:** features novas vivem em módulos; `game.js` recebe apenas hooks/emits.

## 3. Registro de Decisões (Decision Log)

| # | Decisão | Alternativas consideradas | Motivo |
| :-- | :-- | :-- | :-- |
| 1 | Prioridade: combate → progressão → variedade (todas na Fase 1, em sub-etapas) | Começar por progressão ou variedade | Bater é 95% do tempo num beat 'em up; variedade só rende com combate bom |
| 2 | Fase 1 só código, arte nova na Fase 2 | Incluir arte já; nunca gerar arte | ~80% do ganho é alcançável com frames atuais; arte vira polimento |
| 3 | Sem teclas novas (↑+J launcher, J no ar, Q/E = tag-assist, mobilidade = esquiva perfeita) | Tecla dedicada de assist; gamepad | Co-op já divide o teclado; menos teclas = mais acessível |
| 4 | Upgrades por herói: 3 trilhas × 3 níveis + perk | Global da equipe; ambos | Incentiva variar heróis; escopo de UI/balanceamento contido |
| 5 | Variedade: pickups, eventos de onda, modificador por setor, rank + desafios | Subconjunto | Usuário escolheu todos |
| 6 | Abordagem A: núcleo (agendador, timeScale, eventos) + módulos | B: reescrita ES modules; C: remendos no `game.js` | Agendador e timeScale são pré-requisitos do hitstop; baixo risco; `game.js` para de crescer |
| 7 | Substituir `setTimeout` de golpes por agendador no loop | Manter `setTimeout` | Corrige dessincronia com pausa/hitstop (bug atual) |
| 8 | Esquiva perfeita no lugar de bloqueio | Bloqueio/parry com timing | Não há frames de bloqueio; mobilidade já tem i-frames |
| 9 | HP individual por herói + vida cinza + nocaute | Manter HP por proporção | Torna a troca estratégica; compensado por penalidade no rank |
| 10 | Knockdown/juggle via frame `hurt` rotacionado | Gerar sprites de knockdown | Sem custo de arte; substituível na Fase 2 |
| 11 | Combo compartilhado no co-op | Combo por jogador | Incentiva jogar junto |

## 4. Design Final

### 4.1 Núcleo (pré-requisito)
* **Agendador:** `game.schedule(delaySec, fn, owner)` → `game.timers[]`, descontado com `dt` escalado em `updateStage`. `queueHeroAction`/`queueEnemyAction` passam a usá-lo, mantendo as guardas atuais. Pausa congela; sair da fase descarta.
* **Tempo:** `game.hitstop` (s) zera o `dt` do mundo (partículas/shake seguem); `game.slowmo = { scale, timer }`. Hitstop não acumula: `max(atual, novo)`, teto 0,12 s. UI, avisos e pausa usam `dt` real.
* **Eventos:** `on/emit` com `hit`, `kill`, `playerDamaged`, `perfectDodge`, `heroSwitch`, `waveStart`, `waveClear`, `stageStart`, `stageClear`. Apenas emits adicionados às funções existentes.
* **Arquivos:** `atlas.js` → `scenarios.js` → `core.js` → `game.js` → `combat.js` → `progression.js` → `variety.js`. Ponte: `window.CV = { game(), on, emit, schedule, hooks }`.
* **Aceite:** comportamento idêntico ao atual (teste de co-op + partida manual).

### 4.2 Combate (1a)
* **Combo por toques:** frame 0 = antecipação (0,06 s); frames 1–3 = G1 → G2 → Finalizador. Buffer 0,25 s; janela 0,35 s após impacto. Fatores 0,72 / 0,90 / 1,28.
  * J = knockdown; **↑+J** = launcher; **↓+J** = varrida OTG (1× por queda).
* **Aéreo:** J no ar congela frame 2 do `attack` por 0,2 s; até 2 por pulo.
* **Estados do inimigo:** `stun`, `airborne` (gravidade escalonada após 6 hits aéreos), `knockdown` (hurt rotacionado 80°, 0,7 s), `getup` (jump frame 0, 0,4 s invulnerável). **Wall bounce** contra `lockX`/borda da câmera.
* **Postura:** Grunt/Ranger/Elite flinch sempre; Brute a partir do 3º golpe ou finalizador; chefes têm barra — quebrada = 2 s atordoado, +25% dano, launcher permitido.
* **Feel (objeto `FEEL`):** hitstop 0,035 / 0,07 (finalizador) / 0,10 (kill); slow-mo 0,5 s no último kill da onda; faísca radial na cor do herói; número de dano cresce com combo.
* **Combo recompensa:** 10 hits ×1,2 pontos; 25 hits ×1,5 e +5 energia por faixa; 50 hits ×2. Quebra por timer (1,25 s) ou dano recebido. HUD: NICE / GREAT / COSMIC!

### 4.3 Esquiva perfeita + Tag-assist (1b)
* **Esquiva perfeita:** golpe/projétil que acertaria nos primeiros 0,15 s da mobilidade → `perfectDodge`: slow-mo 0,6 s (0,35), +15 energia, "PERFEITO!", afterimages, contra-ataque +30% dano e flinch garantido por 1,5 s. 1× por ativação.
* **Telegrafia:** brilho de 0,25 s antes do golpe inimigo; projéteis desaceleram no trecho final.
* **Tag-assist (Q/E):** quem sai usa `dash` para fora; quem entra usa `dash` para frente com golpe (`mobilityProfile`) e 0,3 s de invulnerabilidade. Recarga do golpe: 6 s (sem ele, troca comum com 0,75 s). HUD com ícone do reserva e anel de recarga.
* **Tag combo:** trocar com alvo em stun/ar mantém o combo e dá +8 energia.
* **HP individual:** cada herói tem vida própria na fase; reserva recupera 50% do dano recente (vida cinza) a 4 HP/s, fora de combate direto. Herói a 0 = nocauteado até o fim da fase, próximo entra automaticamente. Missão falha sem heróis disponíveis (co-op: heróis livres).

### 4.4 Progressão (1c)
* **Loja** (aba na tela de equipe, tecla R): custos 60 / 120 / 200 CR por nível.
  * Vida: +10 / +20 / +30% HP máx.
  * Força: +8 / +16 / +25% dano.
  * Energia: +15 / +30 / +45% regen e −4 / −8 / −12 no custo do especial.
  * **Perk (300 CR, exige as 3 trilhas ≥ Nv 2):**
    * Solarion — Solar Burst deixa chamas (dano contínuo 2 s).
    * Night Talon — Shadow Onslaught +2 golpes; glide causa stun.
    * Valoria — Aerial Lunge reflete projéteis frontais.
    * Red Velocity — janela de esquiva 0,22 s; rastro de dano no speed dash.
    * Abyss King — Tidal Breaker puxa inimigos antes de explodir.
    * Emerald Nova — escudo de construto absorve 1 golpe a cada 12 s.
* **Rank (0–100):** tempo 25, dano recebido 25, maior combo 20 (cheio ≥ 40), esquivas perfeitas + tag combos 15, nocautes 15 (−5 por nocaute). S ≥ 90, A ≥ 75, B ≥ 55, C. Bônus 150 / 100 / 60 / 30 CR. Tela de fim de fase com detalhamento.
* **Desafios:** 3 fixos por fase, `(stats) => bool`, +50 CR na primeira conclusão, 3 estrelas no nó do mapa. Ex.: Neon Harbor — combo 30; Breaker sem nocaute; 5 esquivas perfeitas.
* **Economia estimada por fase:** ~300 (kills) + 30–150 (rank) + até 150 (desafios, 1ª vez) ≈ 2 níveis por fase jogada.

### 4.5 Variedade (1d)
* **Pickups (canvas):** Célula de Vida (+25% HP), Célula de Energia (+40), Núcleo Tag (restaura vida cinza do time e zera recarga de tag; Elite/chefe), Fragmento (+15 CR). Drop: Grunt/Ranger 12%, Brute 25%, Elite 50%. Ímã 60 px, some em 12 s (pisca nos 3 finais). Anti-azar: da onda 3 em diante, HP < 35% garante 1 cura na onda seguinte.
* **Eventos de onda** (`wave.event`): `ambush` (entrada pela esquerda + aviso), `timed` (25 s → +60 CR ou 2 reforços), `surprise` (Rift Assassin cai após área limpa), `bossAdds` (2 Grunts a 66% e 33% HP). 2–3 por setor.
* **Modificadores** (`stage.modifier = { type, params }`, sempre telegrafados, afetam inimigos também):
  * Neon Harbor — Chuva Elétrica: 2 círculos a cada 7 s, explodem após 1 s.
  * Iron District — Esteiras (60 px/s para a esquerda) + vents de vapor.
  * Skyspire — Rajadas de 2,5 s a cada 10 s; gravidade −15%.
  * Void Gate — 2 fendas com dano por área; kills perto delas explodem em cadeia.

### 4.6 Save v2
* `migrateSave(data)` v1 → v2 adiciona `upgrades: { [heroId]: { hp, power, energy, perk } }` e `stageRecords: { [stageId]: { bestRank, bestScore, challenges: [bool, bool, bool] } }`.
* Preserva `unlocked`, `completed`, `credits`, `highScore`, `difficulty` e `LEGACY_HERO_MAP`. Persiste somente após migração; JSON corrompido = slot vazio.

## 5. Estratégia de Testes
* Harness `tools/test_local_coop.js` passa a carregar os novos scripts na ordem do `index.html`.
* Novo `tools/test_gameplay.js`:
  1. Agendador respeita pausa/hitstop e é descartado ao sair da fase.
  2. J, J, J → G1, G2, finalizador; ↑+J lança; gravidade escalonada limita juggle a 6 hits.
  3. Esquiva perfeita dentro/fora da janela de 0,15 s.
  4. HP individual, vida cinza, nocaute + troca automática, falha sem heróis.
  5. Rank e desafios a partir de estatísticas fixas.
  6. Loja: custo, pré-requisito do perk, saldo insuficiente.
  7. Migração v1 → v2 de save real.
  8. Testes de co-op existentes continuam passando.
* Verificação visual no browser pane a cada sub-etapa (Neon Harbor solo e co-op).

## 6. Riscos e Mitigação

| Risco | Mitigação |
| :-- | :-- |
| Refactor do núcleo muda comportamento | Aceite de comportamento idêntico antes das features |
| Hitstop/slow-mo "grudento" | Teto 0,12 s, sem acúmulo, constantes em `FEEL` |
| HP individual deixa o jogo fácil | Penalidade no rank, vida cinza limitada, ajuste por dificuldade após playtest |
| Juggle infinito / chefe travado | Gravidade escalonada; launcher em chefe só com postura quebrada |
| Poluição visual | Teto de partículas; hazards com opacidade reduzida |
| `game.js` monolítico | Features só nos módulos; `game.js` recebe hooks/emits |

## 7. Ordem de Entrega
Núcleo → 1a → 1b → 1c → 1d. Cada etapa jogável, testada e em commit próprio.

## 8. Fase 2 (fora deste escopo)
Arte nova via ChatGPT, no mesmo formato dos sheets atuais (1672 × 941, rótulos por animação, fatiados por `tools/slice_sprite_sheets.py`): agarrão/arremesso (heróis) e `grabbed` (inimigos), knockdown/get-up dos inimigos, sheet de props quebráveis e ícones de itens.
