const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testes do Leitor de HQs e Atalhos ---');

const baseDir = path.resolve(__dirname, '..');
const hqsDir = path.join(baseDir, 'hqs');

// 1. Testa existência das páginas e miniaturas em WebP (independente de PDF)
const issue1Dir = path.join(hqsDir, 'issue-1');
const thumbsDir = path.join(issue1Dir, 'thumbs');
assert(fs.existsSync(issue1Dir), 'Diretório issue-1 deve existir');
assert(fs.existsSync(thumbsDir), 'Diretório de miniaturas deve existir');

for (let i = 1; i <= 16; i++) {
  const num = String(i).padStart(2, '0');
  const pageFile = path.join(issue1Dir, `page_${num}.webp`);
  const thumbFile = path.join(thumbsDir, `thumb_${num}.webp`);

  assert(fs.existsSync(pageFile), `Página ${num} deve existir`);
  assert(fs.statSync(pageFile).size > 10000, `Página ${num} deve ter conteúdo válido`);

  assert(fs.existsSync(thumbFile), `Miniatura ${num} deve existir`);
  assert(fs.statSync(thumbFile).size > 1000, `Miniatura ${num} deve ter conteúdo válido`);
}
console.log('ok - Todas as 16 páginas e 16 miniaturas WebP existem e funcionam de forma independente');

// 2. Testa manifesto JS
const manifestPath = path.join(hqsDir, 'manifest.js');
assert(fs.existsSync(manifestPath), 'manifest.js deve existir');
const manifestCode = fs.readFileSync(manifestPath, 'utf8');
const fakeWindow = {};
new Function('window', manifestCode)(fakeWindow);
assert(fakeWindow.HQ_DATA, 'HQ_DATA deve ser definido no window');
assert(Array.isArray(fakeWindow.HQ_DATA.issues), 'issues deve ser um array');
assert.strictEqual(fakeWindow.HQ_DATA.issues[0].pageCount, 16, 'Deve conter 16 páginas');
console.log('ok - manifest.js define HQ_DATA com metadados corretos');

// 3. Testa index.html
const indexPath = path.join(baseDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('id="hq-shortcut-btn"'), 'index.html deve conter #hq-shortcut-btn no topbar');
assert(indexHtml.includes('id="hq-canvas-btn"'), 'index.html deve conter #hq-canvas-btn no canvas-wrap');
assert(indexHtml.includes('hqs/reader.css'), 'index.html deve carregar hqs/reader.css');
assert(indexHtml.includes('hqs/reader.js'), 'index.html deve carregar hqs/reader.js');
assert(indexHtml.includes('hqs/manifest.js'), 'index.html deve carregar hqs/manifest.js');
assert(indexHtml.includes('H: ler HQs'), 'index.html deve indicar atalho H no footer');
console.log('ok - index.html contém os botões de atalho, estilos e scripts');

// 4. Testa game.js
const gamePath = path.join(baseDir, 'game.js');
const gameCode = fs.readFileSync(gamePath, 'utf8');
assert(gameCode.includes('pauseGame()'), 'game.js deve expor pauseGame no window.CV');
assert(gameCode.includes('in-stage'), 'game.js deve alternar classe in-stage no body');
assert(gameCode.includes('H = ler HQ oficial'), 'game.js deve exibir dica de H na tela de título');
console.log('ok - game.js integrado com controle de pausa e dicas de HQ');

console.log('Todos os testes do Leitor de HQs passaram com sucesso!');
