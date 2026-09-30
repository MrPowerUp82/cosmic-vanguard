/* ==========================================================================
   Cosmic Vanguard — Service Worker (PWA Offline Cache)
   Garante funcionamento 100% offline do jogo e leitor de HQs.
   ========================================================================== */

const CACHE_NAME = 'cv-cache-v2';

const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './core.js',
  './game.js',
  './pwa.js',
  './manifest.webmanifest',
  './manifest.json',

  // Ícones
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32x32.png',

  // Sprites e Atlases Principais
  './assets/banner.png',
  './assets/sprites/processed/atlas.js',
  './assets/sprites/scenarios/scenarios.js',

  // Heróis
  './assets/sprites/processed/solarion.png',
  './assets/sprites/processed/night_talon.png',
  './assets/sprites/processed/valoria.png',
  './assets/sprites/processed/red_velocity.png',
  './assets/sprites/processed/abyss_king.png',
  './assets/sprites/processed/emerald_nova.png',

  // Inimigos
  './assets/sprites/processed/enemies/shadow_trooper.png',
  './assets/sprites/processed/enemies/pulse_gunner.png',
  './assets/sprites/processed/enemies/armored_brute.png',
  './assets/sprites/processed/enemies/rift_assassin.png',
  './assets/sprites/processed/enemies/void_tyrant.png',

  // Projéteis
  './assets/sprites/projectiles/solarion.png',
  './assets/sprites/projectiles/valoria.png',
  './assets/sprites/projectiles/abyss_king.png',
  './assets/sprites/projectiles/emerald_nova.png',
  './assets/sprites/projectiles/pulse_gunner.png',
  './assets/sprites/projectiles/void_tyrant.png',

  // Cenários (WebP)
  './assets/sprites/scenarios/neon-harbor-quay.webp',
  './assets/sprites/scenarios/neon-harbor-drydock.webp',
  './assets/sprites/scenarios/iron-district-yard.webp',
  './assets/sprites/scenarios/iron-district-foundry.webp',
  './assets/sprites/scenarios/skyspire-lower.webp',
  './assets/sprites/scenarios/skyspire-summit.webp',
  './assets/sprites/scenarios/void-gate-approach.webp',
  './assets/sprites/scenarios/void-gate-core.webp',

  // Quadrinhos / HQs
  './hqs/manifest.js',
  './hqs/reader.css',
  './hqs/reader.js',

  // Páginas e Miniaturas da HQ #1
  ...Array.from({ length: 16 }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return [
      `./hqs/issue-1/page_${num}.webp`,
      `./hqs/issue-1/thumbs/thumb_${num}.webp`
    ];
  }).flat()
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Usa allSettled para cachear tudo sem interromper caso algum recurso falhe
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(err => {
            console.warn('[SW] Falha ao pré-cachear:', url, err);
          })
        )
      );
      return results;
    })
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.map(key => {
            if (key.startsWith('cv-cache-') && key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
    ])
  );
});

// Estratégia de requisições:
// 1. Navegação (HTML): Network-First com fallback para cache
// 2. Mídias e Scripts (Imagens, WebP, JS, CSS): Cache-First com Network Fallback e Cache Dinâmico
self.addEventListener('fetch', event => {
  const request = event.request;

  // Ignora requisições não-GET ou esquemas não-HTTP(S)
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Requisições de navegação (páginas HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
          return caches.match('./');
        })
    );
    return;
  }

  // Recursos estáticos (Cache-First)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => {
          // Se for uma requisição de imagem que falhou offline, retorna vazio ou erro controlado
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});
