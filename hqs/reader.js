(() => {
  'use strict';

  // Obtém dados do manifesto (hqs/manifest.js) com fallback
  const HQ_DATA = window.HQ_DATA || {
    issues: [
      {
        id: 'issue-1',
        number: 1,
        title: 'Cosmic Vanguard #1',
        subtitle: 'A Fronteira Foi Encontrada',
        pdf: null,
        pageCount: 16,
        pages: Array.from({ length: 16 }, (_, i) => {
          const num = String(i + 1).padStart(2, '0');
          return {
            page: i + 1,
            src: `hqs/issue-1/page_${num}.webp`,
            thumb: `hqs/issue-1/thumbs/thumb_${num}.webp`
          };
        })
      }
    ]
  };

  const state = {
    issueIndex: 0,
    currentPage: 1,
    zoom: 1.0,
    spreadMode: false,
    thumbsOpen: true,
    isOpen: false,
    audioCtx: null
  };

  function currentIssue() {
    return HQ_DATA.issues[state.issueIndex] || HQ_DATA.issues[0];
  }

  // Efeito sonoro sintetizado sutil de virar página
  function playPageTurnSound() {
    try {
      if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }
      const ctx = state.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.12);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (_) {
      // Áudio desabilitado ou restrito pelo navegador
    }
  }

  function createModalHtml() {
    if (document.getElementById('hq-modal')) return;

    const modalHtml = `
      <div id="hq-modal" class="hq-modal" aria-hidden="true" role="dialog" aria-label="Leitor de Quadrinhos">
        <div class="hq-modal-backdrop" id="hq-backdrop"></div>
        <div class="hq-modal-window">
          <!-- Cabeçalho -->
          <header class="hq-header">
            <div class="hq-header-left">
              <span class="hq-logo-badge">📖 HQ OFICIAL</span>
              <div class="hq-title-group">
                <h2 class="hq-title" id="hq-modal-title">Cosmic Vanguard #1</h2>
                <span class="hq-subtitle" id="hq-modal-subtitle">A Fronteira Foi Encontrada</span>
              </div>
            </div>

            <div class="hq-header-actions">
              <!-- Alternar 1 / 2 páginas -->
              <button id="hq-mode-btn" class="hq-pill-btn" title="Alternar entre 1 e 2 páginas (modo dupla página)">
                <span id="hq-mode-icon">📄</span>
                <span id="hq-mode-text">1 Página</span>
              </button>

              <!-- Zoom -->
              <div class="hq-zoom-group">
                <button id="hq-zoom-out" class="hq-icon-btn" title="Diminuir zoom (−)">−</button>
                <button id="hq-zoom-reset" class="hq-zoom-label" title="Ajustar à tela">100%</button>
                <button id="hq-zoom-in" class="hq-icon-btn" title="Aumentar zoom (+)">+</button>
              </div>

              <!-- Tela cheia -->
              <button id="hq-fullscreen-btn" class="hq-icon-btn" title="Alternar tela cheia (F)">⛶</button>

              <!-- Link direto para o PDF original (exibido apenas se disponível) -->
              <a id="hq-pdf-link" class="hq-pill-btn hq-pdf-btn" href="" target="_blank" download title="Baixar ou abrir o arquivo PDF original" style="display: none;">
                <span>⬇ PDF</span>
              </a>

              <!-- Fechar -->
              <button id="hq-close-btn" class="hq-close-btn" title="Fechar leitor (Esc)" aria-label="Fechar">✕</button>
            </div>
          </header>

          <!-- Palco de Leitura -->
          <div class="hq-stage-wrap" id="hq-stage-wrap">
            <button id="hq-prev-btn" class="hq-nav-arrow hq-nav-prev" title="Página anterior (← / A)" aria-label="Página anterior">◀</button>

            <!-- Zonas de clique para toque ou mouse -->
            <div class="hq-click-zone hq-click-zone-left" id="hq-click-left" title="Página anterior"></div>
            <div class="hq-click-zone hq-click-zone-right" id="hq-click-right" title="Próxima página"></div>

            <div class="hq-page-viewport" id="hq-page-viewport">
              <div class="hq-page-container" id="hq-page-container">
                <img id="hq-page-img" class="hq-page-img" alt="Página da HQ" src="" />
                <img id="hq-page-img-2" class="hq-page-img" alt="Segunda página da HQ" src="" style="display: none;" />
              </div>
            </div>

            <button id="hq-next-btn" class="hq-nav-arrow hq-nav-next" title="Próxima página (→ / D / Espaço)" aria-label="Próxima página">▶</button>
          </div>

          <!-- Rodapé com Navegador e Miniaturas -->
          <footer class="hq-footer">
            <div class="hq-footer-controls">
              <div class="hq-footer-left">
                <button id="hq-first-page" class="hq-icon-btn" title="Primeira página (Home)">⏮</button>
                <span class="hq-page-indicator" id="hq-page-indicator">Página 1 de 16</span>
              </div>

              <div class="hq-page-slider-wrap">
                <input type="range" id="hq-page-slider" class="hq-page-slider" min="1" max="16" value="1" title="Arrastar para mudar de página" />
              </div>

              <div class="hq-footer-right">
                <button id="hq-last-page" class="hq-icon-btn" title="Última página (End)">⏭</button>
                <button id="hq-thumbs-toggle" class="hq-pill-btn" title="Mostrar ou recolher miniaturas">
                  <span id="hq-thumbs-toggle-text">Miniaturas ▴</span>
                </button>
              </div>
            </div>

            <!-- Gaveta de Miniaturas -->
            <div class="hq-thumbs-drawer expanded" id="hq-thumbs-drawer">
              <div class="hq-thumbs-track" id="hq-thumbs-track"></div>
            </div>
          </footer>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function updatePageDisplay() {
    const issue = currentIssue();
    const total = issue.pageCount;
    const pageIndex = state.currentPage - 1;

    const img1 = document.getElementById('hq-page-img');
    const img2 = document.getElementById('hq-page-img-2');
    const indicator = document.getElementById('hq-page-indicator');
    const slider = document.getElementById('hq-page-slider');
    const prevBtn = document.getElementById('hq-prev-btn');
    const nextBtn = document.getElementById('hq-next-btn');
    const container = document.getElementById('hq-page-container');

    if (!img1 || !issue.pages[pageIndex]) return;

    // Atualiza imagem primária
    img1.src = issue.pages[pageIndex].src;

    if (state.spreadMode && state.currentPage < total && state.currentPage > 1) {
      // Página dupla (ex: 2-3, 4-5...)
      const nextIndex = state.currentPage;
      if (issue.pages[nextIndex]) {
        img2.src = issue.pages[nextIndex].src;
        img2.style.display = 'block';
        indicator.textContent = `Páginas ${state.currentPage}-${state.currentPage + 1} de ${total}`;
      } else {
        img2.style.display = 'none';
        indicator.textContent = `Página ${state.currentPage} de ${total}`;
      }
      container.classList.add('hq-spread-mode');
    } else {
      img2.style.display = 'none';
      container.classList.remove('hq-spread-mode');
      indicator.textContent = `Página ${state.currentPage} de ${total}`;
    }

    slider.value = state.currentPage;
    slider.max = total;

    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= total;

    // Aplica zoom
    container.style.transform = `scale(${state.zoom})`;

    // Atualiza destaque na miniatura ativa
    const thumbs = document.querySelectorAll('.hq-thumb-item');
    thumbs.forEach((thumb, idx) => {
      const active = (idx + 1 === state.currentPage) || (state.spreadMode && idx === state.currentPage && state.currentPage > 1);
      thumb.classList.toggle('active', active);
      if (active) {
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });

    playPageTurnSound();
  }

  function populateThumbnails() {
    const issue = currentIssue();
    const track = document.getElementById('hq-thumbs-track');
    if (!track) return;

    track.innerHTML = '';
    issue.pages.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'hq-thumb-item' + (idx === 0 ? ' active' : '');
      item.dataset.page = p.page;
      item.title = `Página ${p.page}`;
      item.innerHTML = `
        <img src="${p.thumb}" alt="Miniatura da página ${p.page}" loading="lazy" />
        <div class="hq-thumb-num">${p.page}</div>
      `;
      item.addEventListener('click', () => {
        goToPage(p.page);
      });
      track.appendChild(item);
    });
  }

  function goToPage(page) {
    const issue = currentIssue();
    const newPage = Math.max(1, Math.min(issue.pageCount, page));
    if (newPage !== state.currentPage) {
      state.currentPage = newPage;
      updatePageDisplay();
    }
  }

  function prevPage() {
    const step = state.spreadMode && state.currentPage > 2 ? 2 : 1;
    goToPage(state.currentPage - step);
  }

  function nextPage() {
    const step = state.spreadMode && state.currentPage > 1 ? 2 : 1;
    goToPage(state.currentPage + step);
  }

  function toggleSpreadMode() {
    state.spreadMode = !state.spreadMode;
    const modeBtnText = document.getElementById('hq-mode-text');
    const modeBtnIcon = document.getElementById('hq-mode-icon');
    if (modeBtnText) {
      modeBtnText.textContent = state.spreadMode ? '2 Páginas' : '1 Página';
      modeBtnIcon.textContent = state.spreadMode ? '📖' : '📄';
    }
    updatePageDisplay();
  }

  function setZoom(val) {
    state.zoom = Math.max(0.75, Math.min(2.5, val));
    const label = document.getElementById('hq-zoom-reset');
    if (label) {
      label.textContent = `${Math.round(state.zoom * 100)}%`;
    }
    const container = document.getElementById('hq-page-container');
    if (container) {
      container.style.transform = `scale(${state.zoom})`;
    }
  }

  function toggleFullscreen() {
    const modalWindow = document.querySelector('.hq-modal-window');
    if (!document.fullscreenElement) {
      if (modalWindow && modalWindow.requestFullscreen) {
        modalWindow.requestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  function toggleThumbs() {
    state.thumbsOpen = !state.thumbsOpen;
    const drawer = document.getElementById('hq-thumbs-drawer');
    const toggleText = document.getElementById('hq-thumbs-toggle-text');
    if (drawer) {
      drawer.classList.toggle('expanded', state.thumbsOpen);
    }
    if (toggleText) {
      toggleText.textContent = state.thumbsOpen ? 'Miniaturas ▴' : 'Miniaturas ▾';
    }
  }

  function openHqReader(issueIdx = 0) {
    createModalHtml();
    state.issueIndex = issueIdx;
    state.isOpen = true;

    const modal = document.getElementById('hq-modal');
    const issue = currentIssue();

    // Atualiza cabeçalho
    const titleEl = document.getElementById('hq-modal-title');
    const subtitleEl = document.getElementById('hq-modal-subtitle');
    const pdfLink = document.getElementById('hq-pdf-link');

    if (titleEl) titleEl.textContent = issue.title;
    if (subtitleEl) subtitleEl.textContent = issue.subtitle;
    if (pdfLink) {
      if (issue.pdf) {
        pdfLink.href = encodeURI(issue.pdf);
        pdfLink.style.display = 'inline-flex';
      } else {
        pdfLink.style.display = 'none';
      }
    }

    populateThumbnails();
    updatePageDisplay();

    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('hq-reader-open');

    // Pausa o jogo se estiver em fase de combate
    if (window.CV && window.CV.state && window.CV.state() === 'stage') {
      if (window.CV.pauseGame) {
        window.CV.pauseGame();
      }
    }
  }

  function closeHqReader() {
    const modal = document.getElementById('hq-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('hq-reader-open');
    state.isOpen = false;

    // Retorna foco para o canvas do jogo
    const canvas = document.getElementById('game');
    if (canvas) canvas.focus();
  }

  function bindEvents() {
    createModalHtml();

    // Botão no Topbar
    const topbarBtn = document.getElementById('hq-shortcut-btn');
    if (topbarBtn) {
      topbarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openHqReader();
      });
    }

    // Botão flutuante no Canvas
    const canvasBtn = document.getElementById('hq-canvas-btn');
    if (canvasBtn) {
      canvasBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openHqReader();
      });
    }

    // Botões do Modal
    const closeBtn = document.getElementById('hq-close-btn');
    const backdrop = document.getElementById('hq-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeHqReader);
    if (backdrop) backdrop.addEventListener('click', closeHqReader);

    const prevBtn = document.getElementById('hq-prev-btn');
    const nextBtn = document.getElementById('hq-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', prevPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);

    const clickLeft = document.getElementById('hq-click-left');
    const clickRight = document.getElementById('hq-click-right');
    if (clickLeft) clickLeft.addEventListener('click', prevPage);
    if (clickRight) clickRight.addEventListener('click', nextPage);

    const firstBtn = document.getElementById('hq-first-page');
    const lastBtn = document.getElementById('hq-last-page');
    if (firstBtn) firstBtn.addEventListener('click', () => goToPage(1));
    if (lastBtn) lastBtn.addEventListener('click', () => goToPage(currentIssue().pageCount));

    const slider = document.getElementById('hq-page-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        goToPage(parseInt(e.target.value, 10));
      });
    }

    const zoomIn = document.getElementById('hq-zoom-in');
    const zoomOut = document.getElementById('hq-zoom-out');
    const zoomReset = document.getElementById('hq-zoom-reset');
    if (zoomIn) zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.25));
    if (zoomOut) zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.25));
    if (zoomReset) zoomReset.addEventListener('click', () => setZoom(1.0));

    const modeBtn = document.getElementById('hq-mode-btn');
    if (modeBtn) modeBtn.addEventListener('click', toggleSpreadMode);

    const fullscreenBtn = document.getElementById('hq-fullscreen-btn');
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

    const thumbsToggle = document.getElementById('hq-thumbs-toggle');
    if (thumbsToggle) thumbsToggle.addEventListener('click', toggleThumbs);

    // Zoom via roda do mouse sobre o palco
    const stageWrap = document.getElementById('hq-stage-wrap');
    if (stageWrap) {
      stageWrap.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          setZoom(state.zoom + delta);
        }
      }, { passive: false });
    }

    // Suporte a gestos touch (swipe para passar página)
    let touchStartX = 0;
    let touchStartY = 0;
    if (stageWrap) {
      stageWrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      stageWrap.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX < 0) nextPage();
            else prevPage();
          }
        }
      }, { passive: true });
    }

    // Teclado global
    window.addEventListener('keydown', (e) => {
      // Se o modal estiver aberto, captura os comandos de leitura
      if (state.isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeHqReader();
        } else if (['ArrowRight', 'KeyD', 'PageDown', ' '].includes(e.key) || e.code === 'Space') {
          e.preventDefault();
          nextPage();
        } else if (['ArrowLeft', 'KeyA', 'PageUp'].includes(e.key)) {
          e.preventDefault();
          prevPage();
        } else if (e.key === 'Home') {
          e.preventDefault();
          goToPage(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          goToPage(currentIssue().pageCount);
        } else if (e.code === 'KeyF') {
          e.preventDefault();
          toggleFullscreen();
        } else if (e.code === 'KeyH') {
          e.preventDefault();
          closeHqReader();
        }
        return;
      }

      // Se o modal estiver fechado, tecla H abre o leitor (exceto coop em combate onde P1 usa H)
      if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const isCoopStage = window.CV && window.CV.state && window.CV.state() === 'stage' && document.body.classList.contains('coop-mode');
        if (!isCoopStage) {
          e.preventDefault();
          openHqReader();
        }
      }
    }, { capture: true });
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

  // Exporta métodos públicos para o namespace global
  window.CV_HQ = {
    open: openHqReader,
    close: closeHqReader,
    isOpen: () => state.isOpen,
    goToPage: goToPage,
    currentIssue: currentIssue
  };
})();
