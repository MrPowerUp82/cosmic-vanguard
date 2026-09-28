# Cosmic Vanguard Native v0.1.1

![Banner de Cosmic Vanguard](../assets/banner.png)

Port C++17/SDL2 do Cosmic Vanguard, estruturado a partir do processo de build de
`wizard_coop_cpp`. O executável não usa JavaScript, HTML ou Canvas: simulação, input,
renderização e saves são nativos. O código de jogo e o renderer são compartilhados
entre Linux, Windows, Nintendo Switch, PS Vita e PSP.

## Arquivos gerados

Rode `./native/tools/build-all.ps1` no PowerShell com Docker Desktop ativo. O script
gera os atlases nativos, compila os cinco alvos e salva os pacotes em
`native/dist/v0.1.1/` com `SHA256SUMS`. Para um alvo:

```powershell
./native/tools/build-all.ps1 -Targets windows
```

| Plataforma | Pacote | Instalação |
|---|---|---|
| Windows x86_64 | `cosmic-vanguard-v0.1.1-windows-x86_64.zip` | Extraia tudo e abra `cosmic_vanguard.exe`. |
| Linux x86_64 | `cosmic-vanguard-v0.1.1-linux-x86_64.tar.gz` | Requer SDL2, SDL2_image e SDL2_ttf instalados; extraia e rode `./linux/cosmic_vanguard`. |
| Switch com CFW | `cosmic-vanguard-v0.1.1-switch.nro` | Copie para `sd:/switch/` e abra no Homebrew Menu. |
| PS Vita com homebrew | `cosmic-vanguard-v0.1.1-vita.vpk` | Instale no VitaShell; Title ID `CVAN00001`. |
| PSP com CFW / Adrenaline | `cosmic-vanguard-v0.1.1-psp.cso` ou `.iso` | Copie para `ms0:/ISO/`. O `.zip` alternativo contém a pasta `CosmicVanguard` para `ms0:/PSP/GAME/`. |

## Controles

| Ação | Teclado P1 | Teclado P2 | Switch/PC | Vita/PSP |
|---|---|---|---|---|
| Mover | WASD (setas no solo) | Setas | Analógico ou direcional | Analógico ou direcional |
| Atacar | J (F no co-op) | J | A | □ |
| Especial | K (G no co-op) | K | X | ✕ |
| Mobilidade | L (H no co-op) | L | B | ○ |
| Pular | Espaço | Shift direito | Y | △ |
| Trocar herói | Q / E | U / O | L / R | L / R |
| Pausa | Esc / P | Esc / P | Start | Start |
| Menu | Enter, Esc, setas | — | A, B, direcional | ✕, ○, direcional |
| Co-op no mapa | M | — | Y | △ |
| Equipe no mapa | R | — | Back | Select |
| Dificuldade no mapa | Tab | — | Ombro direito | R |

Saves: PC na pasta de dados do usuário (`SDL_GetPrefPath`), Switch em
`sdmc:/switch/cosmic-vanguard/`, Vita em `ux0:data/cosmic-vanguard/`, PSP em
`ms0:/data/cosmic-vanguard/`. A versão web usa `localStorage`; os arquivos nativos
começam em slots próprios.

## Estado do port

A campanha com quatro setores, seis heróis, recrutamento, ondas, chefes, co-op
local, troca de herói, dificuldades e três slots está implementada. Os sprites
originais foram redimensionados para atlases de 448×448 px, com variante de
224×224 px para PSP. Os quatro cenários e seus sprites são empacotados nos
executáveis/pacotes. O banner também aparece na tela inicial de todas as plataformas.

Este é o primeiro port jogável. Ainda faltam efeitos visuais e sonoros do navegador,
ataques especiais dos inimigos/chefes e algumas nuances das habilidades de cada
herói. A campanha e os controles foram testados no build Linux; a versão Windows
foi executada e capturada. Switch, Vita e PSP compilaram e foram empacotados, mas
a execução nesses aparelhos ainda precisa de validação em hardware/emulador.

## Desenvolvimento

O núcleo fica em `include/cosmic/game.hpp` e `src/game.cpp`. O frontend SDL2 é
`src/main.cpp`. `tools/bake_assets.py` refaz os atlases a partir dos sprites web.
O build Linux executa `ctest`; o executável aceita `--play`, `--coop`, `--stage N`,
`--frames N` e `--screenshot FILE` para verificações headless.

A fonte DejaVuSans-Bold inclui sua licença em `assets/DejaVu-LICENSE.txt`.
