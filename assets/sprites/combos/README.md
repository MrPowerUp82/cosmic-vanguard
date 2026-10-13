# Combos v1 — Cosmic Vanguard

Seis sprite sheets PNG RGBA de **1536 × 1024**, com **12 poses** cada, criados com image_gen usando os sheets originais como referência de identidade e estilo. Total: 72 poses.

| Sheet | Sequência visual |
| --- | --- |
| solarion-combo-v1.png | Jab, direto, uppercut solar |
| night_talon-combo-v1.png | Golpe horizontal, diagonal, estocada dupla de bastões |
| valoria-combo-v1.png | Estocada, varredura, impacto de escudo |
| red_velocity-combo-v1.png | Jab, direto, chute lateral |
| abyss_king-combo-v1.png | Estocada, corte ascendente, golpe pesado de tridente |
| emerald_nova-combo-v1.png | Soco de construto, lâmina de luz, impacto pesado |

## Prévia e importação

Abra `preview.html`. Escolha o herói, reproduza/ pause, ajuste a velocidade, examine um frame ou espelhe a direção. O link de download entrega o sheet completo.

`atlas.json` contém os retângulos de origem `x/y/w/h`, os pivôs de chão `pivotX/pivotY` e agrupamentos de golpes. As linhas foram mapeadas individualmente, porque a geração não manteve células uniformes. Alguns recortes têm largura maior para preservar armas e efeitos.

O campo opcional `clip` é um polígono em pixels locais ao recorte: aplique-o antes de desenhar. Ele exclui fragmentos de poses vizinhas nos recortes ampliados. O desenho de referência está em `preview.html`. Os pixels das folhas originais não foram alterados.

A prévia usa 12 fps como velocidade de inspeção. Os campos `hit` e `phase` são agrupamentos editoriais da sequência, não eventos de dano implementados no motor.

## Como os combos funcionam no jogo atual

- Solo: **J / Z**, ou botão **ATK**.
- Cooperativo: **F** para jogador 1, **J** para jogador 2.
- Uma pressão inicia toda a animação atual. É necessário terminar o ataque antes de iniciar outro.
- Os controles de especial são **K / X** no solo, **G** no jogador 1 cooperativo e **K** no jogador 2.

**Os novos sheets estão integrados ao combate web.** O jogo usa os 12 frames com três impactos explícitos, mantendo a duração, os multiplicadores de dano e o alcance do combo anterior. Os pivôs e as máscaras também são usados na missão. Ao terminar, o herói volta ao atlas de idle/walk; enquanto a imagem nova não carrega, o ataque anterior continua disponível. Não há sistema de sequência J → J → J implementado. A versão nativa mantém sua interface e ataques anteriores.

## Validação

Dimensões, canal alfa e limites dos 72 retângulos foram verificados. A inspeção da prévia em navegador cobriu os seis personagens e os ataques largos de lança, bastões, chute, tridente e construto. O teste tools/test_combos.js verifica os seis sheets durante uma missão, exatamente três impactos de dano, duração preservada, retorno ao atlas normal e fallback. O teste de cooperativo verifica os novos sheets com F e J.

As folhas usam ilustração arcade com bordas suavizadas, não pixel art de resolução fixa. Há pequenas variações de desenho/volume entre poses próprias da geração. Os pivôs alinham a altura do chão, e cada herói tem escala própria no jogo para manter um tamanho próximo ao atlas anterior.

Prompts completos: `PROMPTS.md`.
