/* ==========================================================================
   Cosmic Vanguard — Integração PWA e Gerenciador Offline
   Suporte a Desktop e Dispositivos Móveis (Android / iOS / Tablets)
   ========================================================================== */

(() => {
  'use strict';

  let deferredPrompt = null;

  function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  function showToast(message, duration = 3500) {
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
      setTimeout(() => {
        if (navigator.onLine && pill) pill.style.display = 'none';
      }, 3500);
    }
  }

  function hideInstallButtons() {
    const btnTopbar = document.getElementById('pwa-install-btn');
    const btnCanvas = document.getElementById('pwa-canvas-btn');
    if (btnTopbar) btnTopbar.style.display = 'none';
    if (btnCanvas) btnCanvas.style.display = 'none';
  }

  function showInstallButtons() {
    if (isRunningStandalone()) return;
    const btnTopbar = document.getElementById('pwa-install-btn');
    const btnCanvas = document.getElementById('pwa-canvas-btn');
    if (btnTopbar) btnTopbar.style.display = 'inline-flex';
    if (btnCanvas) btnCanvas.style.display = 'inline-flex';
  }

  async function handleInstallClick(e) {
    if (e) e.preventDefault();

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showToast('🎮 Instalando Cosmic Vanguard...');
          hideInstallButtons();
        }
      } catch (err) {
        console.warn('[PWA] Erro ao abrir prompt:', err);
      }
      deferredPrompt = null;
    } else {
      // Guia passo a passo quando o navegador não disparou evento programático ou em iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        showToast('📲 No iPhone/iPad: toque em Compartilhar (⎋) e depois em "Adicionar à Tela de Início".', 6000);
      } else {
        showToast('📲 Para instalar: abra o menu (⋮) do navegador e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".', 5500);
      }
    }
  }

  function setupInstallButtons() {
    if (isRunningStandalone()) {
      document.body.classList.add('is-standalone');
      hideInstallButtons();
      return;
    }

    const btnTopbar = document.getElementById('pwa-install-btn');
    const btnCanvas = document.getElementById('pwa-canvas-btn');

    if (btnTopbar) {
      btnTopbar.addEventListener('click', handleInstallClick);
    }
    if (btnCanvas) {
      btnCanvas.addEventListener('click', handleInstallClick);
    }

    showInstallButtons();
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

  // Captura evento nativo de instalação PWA (Chrome/Edge/Android)
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons();
  });

  window.addEventListener('appinstalled', () => {
    showToast('🎮 Cosmic Vanguard instalado com sucesso!');
    deferredPrompt = null;
    document.body.classList.add('is-standalone');
    hideInstallButtons();
  });

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupInstallButtons();
      if (!navigator.onLine) updateOnlineStatus();
      checkActionParams();
    });
  } else {
    setupInstallButtons();
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
