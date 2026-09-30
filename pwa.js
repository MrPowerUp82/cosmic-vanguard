/* ==========================================================================
   Cosmic Vanguard — Integração PWA e Gerenciador Offline
   ========================================================================== */

(() => {
  'use strict';

  let deferredPrompt = null;

  function showToast(message, duration = 3000) {
    let toast = document.getElementById('pwa-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-toast';
      toast.className = 'pwa-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, duration);
  }

  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    let pill = document.getElementById('pwa-status-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'pwa-status-pill';
      pill.className = 'pwa-status-pill';
      const topbarRight = document.querySelector('.topbar-right');
      if (topbarRight) {
        topbarRight.prepend(pill);
      } else {
        document.body.appendChild(pill);
      }
    }

    if (!isOnline) {
      pill.innerHTML = '<span class="status-dot offline"></span> Modo Offline';
      pill.title = 'Jogo rodando 100% offline via cache PWA.';
      pill.classList.add('offline');
      pill.classList.remove('online');
      pill.style.display = 'inline-flex';
      showToast('⚡ Modo Offline ativo. Jogo e HQs totalmente disponíveis!');
    } else {
      pill.innerHTML = '<span class="status-dot online"></span> Online';
      pill.title = 'Conectado à rede.';
      pill.classList.add('online');
      pill.classList.remove('offline');
      // Oculta após alguns segundos quando estiver online para não poluir
      setTimeout(() => {
        if (navigator.onLine && pill) pill.style.display = 'none';
      }, 3500);
    }
  }

  function initInstallButton() {
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight || document.getElementById('pwa-install-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'pwa-install-btn';
    btn.className = 'pwa-install-btn';
    btn.innerHTML = '⬇ <span>Instalar</span>';
    btn.title = 'Instalar Cosmic Vanguard como aplicativo no seu dispositivo';
    btn.style.display = 'none';

    btn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('🎮 Instalando Cosmic Vanguard...');
          btn.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });

    topbarRight.prepend(btn);
  }

  // Registra Service Worker
  if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    showToast('Nova versão disponível! Reinicie para atualizar.', 4000);
                  } else {
                    showToast('✔ Cosmic Vanguard pronto para jogar offline!', 3500);
                  }
                }
              });
            }
          });
        })
        .catch(err => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });
    });
  }

  // Captura evento de instalação nativa PWA
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    showToast('🎮 Aplicativo instalado com sucesso!');
    deferredPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
  });

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initInstallButton();
      if (!navigator.onLine) updateOnlineStatus();
      checkActionParams();
    });
  } else {
    initInstallButton();
    if (!navigator.onLine) updateOnlineStatus();
    checkActionParams();
  }

  // Atalho por URL (ex: ?action=hq abre o leitor diretamente)
  function checkActionParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'hq' || window.location.hash === '#hq') {
      setTimeout(() => {
        if (window.CV_HQ && window.CV_HQ.open) {
          window.CV_HQ.open();
        }
      }, 300);
    }
  }
})();
