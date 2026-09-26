# Especificação Técnica: Pipeline de Reconstrução de Sprites (Grade 400 × 300)

## 1. Resumo do Entendimento (Understanding Summary)
* **Objetivo:** Reconstruir os sprite sheets dos 11 personagens de Cosmic Vanguard em uma nova grade uniforme de 400 × 300 px por célula.
* **Problema Resolvido:** Eliminar definitivamente o corte de armas/membros durante golpes amplos e saltos, além de remover fragmentos, linhas e corpos duplicados decorrentes da grade anterior (320 × 240 px).
* **Público:** Desenvolvedor e jogadores de Cosmic Vanguard.
* **Restrições:** Transparência total no canal alfa, pés ancorados com precisão matemática na linha de base (`y = 285 px`), preservação das cores e traços arcade originais, e compatibilidade com o motor Canvas do jogo.
* **Não-Escopo:** Não alterar danos, colisões lógicas (*hitboxes*), balanceamento ou controles do jogo.

---

## 2. Premissas e Requisitos Não-Funcionais (Assumptions)
* **Resolução Total do Atlas:** Cada personagem terá uma folha de `2400 × 2100 px` (6 colunas × 7 linhas de 400 × 300 px).
* **Escala Visual Equivalente:** O tamanho aparente dos personagens na tela do jogo será preservado multiplicando as escalas originais por `0.8` ($240 / 300$).
* **Eliminação de Shims:** O arquivo intermediário `sprite-repair.js` será removido; as imagens geradas serão carregadas diretamente pelo navegador sem overhead de processamento no cliente.

---

## 3. Registro de Decisões (Decision Log)

| Decisão | Alternativas Consideradas | Motivo da Escolha |
| :--- | :--- | :--- |
| **Grade de 400 × 300 px** | Manter 320 × 240 ou atlas JSON dinâmico | Fornece margem ampla para armas longas sem a complexidade de manter 319 retângulos manuais. |
| **Pipeline Morfológico em Python** | Nova geração completa via IA ou mapeamento manual | 100% determinístico, reproduzível, preserva a arte original e crava os pés no chão de forma estável. |
| **Ancoragem em y = 280 px** | Alinhamento pelo centro geométrico | Evita flutuação e trepidação vertical do personagem durante trocas de animação no solo. |
| **Ajuste de Escala (0.8x)** | Redesenhar o cenário ou mexer na física do jogo | Garante que o personagem ocupe o mesmo espaço visual no chão da Fase 1, ganhando espaço extra apenas para as extensões de golpes. |

---

## 4. Arquitetura e Fluxo do Pipeline

### 4.1 Script Definitivo (`tools/build_perfect_400x300.py`)
1. **Entrada de Alta Fidelidade:** Lê os frames completos e não-corrompidos das folhas mestre em `assets/sprites/processed/<hero>.png` e `assets/sprites/rebuilt/<enemy>.png`.
2. **Pivô de Registro Fixo (Anti-Jitter):** Aplica um deslocamento uniforme e constante $(dx = 40\text{ px}, dy = 50\text{ px})$ para **todos** os frames de todas as animações:
   - A raiz do personagem ($x = 160$) migra exatamente para $x = 200$ (centro perfeito da célula de 400 px).
   - O plano de contato dos pés com o chão ($y = 235$) migra exatamente para a linha de base $y = 285$ (margem inferior de 15 px).
   - Não há cálculo dinâmico de *bounding box* ou recentralização por frame, garantindo **jitter zero** (estabilidade física absoluta do personagem ao socar, chutar ou andar).
3. **Preservação Integral de Pixels (Anti-Crop):** Não utiliza filtro morfológico ou descarte de componentes conexos (`clean_single_component`), garantindo que 100% dos efeitos flutuantes (auras, construtos da Emerald Nova, pontas de lança da Valoria, faíscas e projéteis) permaneçam visíveis e íntegros.
4. **Resolução de Poses Duplicadas:** Utiliza `HERO_OVERRIDES` nos heróis para substituir frames ruidosos por poses íntegras da mesma fileira.
5. **Saída:** Grava os atlas finais de `2400 × 2100 px` em `assets/sprites/processed/<hero>.png` e `assets/sprites/enemies/<enemy>.png`.

### 4.2 Atualização no Motor (`game.js`)
* Configuração uniforme da grade:
  ```javascript
  const SPRITE_CELL_W = 400;
  const SPRITE_CELL_H = 300;
  ```
* Escala multiplicada por `0.8x` ($240 / 300$) para manter exatamente a mesma proporção no cenário.
* Linha de renderização com pés cravados no solo:
  ```javascript
  ctx.drawImage(img, sx, def.y, sw, sh, -dw / 2, -dh + Math.round(15 * scale), dw, dh);
  ```
* Remoção definitiva do shim `sprite-repair.js`.

### 4.3 Atualização no Visualizador (`sprite-viewer.html`)
* Grade padrão de 400 × 300 px em `GAME_ATLAS` e controles de corte.
* Simulação de combate atualizada com renderização direta dos novos arquivos.

---

## 5. Critérios de Aceite e Validação
1. **Zero Jitter / Deslizamento:** A cabeça e os pés mantêm sua posição natural e ancoragem no solo em todas as trocas de animação (idle, walk, attack, hurt, special).
2. **Armas e Efeitos 100% Íntegros:** Todas as pontas de espadas, lanças, auras de energia e construtos visíveis sem cortes.
3. **Desempenho Nativo:** Carregamento direto de PNGs sem canvas secundários em tempo de execução.
