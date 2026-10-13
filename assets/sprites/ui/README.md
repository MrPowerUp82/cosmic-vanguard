# Sprites de HUD e menu

Duas folhas PNG RGBA de 1536 × 1024, com 16 peças cada. Os arquivos originais são preservados; o canal alfa foi conferido. Há antialiasing e brilho suave nas bordas.

- `hud.png`: molduras e preenchimentos de vida, energia e chefe, retrato, créditos, especial, defesa, ataque, movimento, salto, troca, pausa e avanço.
- `menu.png`: botões normal/selecionado/pressionado/desativado, slots, modal, molduras de herói, cadeado, iniciar, configurações, voltar e fechar.
- `atlas.json` / `atlas.js`: recortes em pixels, mapeados individualmente. **Não dividir as folhas em uma grade regular.**
- `preview.html`: catálogo com transparência e download de cada recorte como PNG.
- `PROMPTS.md`: especificações completas usadas na ferramenta integrada image_gen.

Abra `assets/sprites/ui/preview.html` pelo mesmo servidor do jogo. As folhas também podem ser importadas em outros motores usando o JSON: `sheet` identifica a imagem e `x,y,w,h` definem o retângulo de origem.

O jogo web usa os slots normal/selecionado no menu inicial, as molduras/preenchimentos de vida e energia no HUD e o ícone de créditos. As outras peças ficam disponíveis no catálogo para telas futuras. Se as imagens ainda não carregaram, o jogo usa a interface desenhada em canvas. Textos e valores continuam dinâmicos. As duas folhas e o atlas JS estão no cache offline.

A versão nativa ainda usa sua interface atual.
