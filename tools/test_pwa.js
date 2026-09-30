const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testes de Validação da PWA e Cache Offline ---');

const baseDir = path.resolve(__dirname, '..');

// 1. Testa manifest.webmanifest e manifest.json
const manifestPath = path.join(baseDir, 'manifest.webmanifest');
assert(fs.existsSync(manifestPath), 'manifest.webmanifest deve existir');
const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifestJson.name, 'Cosmic Vanguard — Beat \'em up');
assert.strictEqual(manifestJson.short_name, 'Cosmic Vanguard');
assert.strictEqual(manifestJson.display, 'standalone');
assert.strictEqual(manifestJson.start_url, './index.html');
assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length >= 2, 'Manifest deve conter ícones');

console.log('ok - manifest.webmanifest contém campos essenciais de PWA');

// 2. Testa existência de todos os ícones declarados no manifest
for (const icon of manifestJson.icons) {
  const iconPath = path.join(baseDir, icon.src);
  assert(fs.existsSync(iconPath), `Ícone declarado ${icon.src} deve existir`);
  assert(fs.statSync(iconPath).size > 1000, `Ícone ${icon.src} deve ser válido e ter dados`);
}
console.log('ok - Todos os ícones do manifest (192, 512, maskable) existem');

// 3. Testa sw.js e todos os 77 arquivos pré-cacheados
const swPath = path.join(baseDir, 'sw.js');
assert(fs.existsSync(swPath), 'sw.js deve existir');
const swCode = fs.readFileSync(swPath, 'utf8');

const getPrecacheUrls = new Function(swCode.replace(/self\.addEventListener[\s\S]*/, '') + '; return PRECACHE_URLS;');
const urls = getPrecacheUrls();

assert(urls.length >= 70, `PRECACHE_URLS deve ter lista completa de arquivos (encontrados: ${urls.length})`);

for (const relUrl of urls) {
  if (relUrl === './') continue; // Raiz é servida por index.html
  const filePath = path.join(baseDir, relUrl.replace(/^\.\//, ''));
  assert(fs.existsSync(filePath), `Arquivo em PRECACHE_URLS deve existir: ${relUrl}`);
  assert(fs.statSync(filePath).size > 0, `Arquivo ${relUrl} não deve estar vazio`);
}
console.log(`ok - Todos os ${urls.length} arquivos declarados no Service Worker existem e são válidos`);

// 4. Testa pwa.js
const pwaPath = path.join(baseDir, 'pwa.js');
assert(fs.existsSync(pwaPath), 'pwa.js deve existir');
const pwaCode = fs.readFileSync(pwaPath, 'utf8');
assert(pwaCode.includes('navigator.serviceWorker.register'), 'pwa.js deve registrar o service worker');
assert(pwaCode.includes('beforeinstallprompt'), 'pwa.js deve capturar o evento de instalação');
assert(pwaCode.includes('online') && pwaCode.includes('offline'), 'pwa.js deve escutar eventos de status de rede');
console.log('ok - pwa.js contém registro de service worker, instalação e status offline');

// 5. Testa index.html
const indexPath = path.join(baseDir, 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('manifest.webmanifest'), 'index.html deve referenciar manifest.webmanifest');
assert(indexHtml.includes('apple-touch-icon'), 'index.html deve conter apple-touch-icon');
assert(indexHtml.includes('pwa.js'), 'index.html deve carregar pwa.js');
console.log('ok - index.html configurado com tags e scripts de PWA');

console.log('Todos os testes de PWA e Cache Offline passaram com sucesso!');
