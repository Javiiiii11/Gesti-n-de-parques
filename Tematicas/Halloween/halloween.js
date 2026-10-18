/* ============================================================================
   Temáticas ParkSales · HALLOWEEN THEME CONTROLLER
   Gestor interactivo y efectos visuales de la temática de terror.
   Diseñado para ser 100% seguro y no intrusivo: cero impacto en eventos
   y formularios de la aplicación principal.
============================================================================ */

(function () {
  'use strict';

  let countdownInterval = null;
  let audioContext = null;
  let soundEnabled = false;

  const SPOOKY_TIPS = [
    '🎃 ¡Que no te tiemble el pulso! Cada cliente es una nueva oportunidad para conquistar la noche. ¡Ve a por todas!',
    '👻 Dicen que los fantasmas aparecen cuando bajas la guardia... ¡Mantén la energía alta y que ningún objetivo se te escape!',
    '🦇 Ni las criaturas de la noche pueden detener a un buen vendedor. ¡Tu actitud es el hechizo más poderoso que tienes!',
    '💀 El verdadero terror no es una noche de miedo... ¡es quedarse a las puertas del objetivo pudiendo conseguirlo!',
    '🕸️ Cada venta rompe una telaraña, cada cliente suma poder y cada esfuerzo te acerca a la victoria. ¡Sigue así!',
    '🔥 Las brujas ya han lanzado su maldición sobre el objetivo mensual... ¡Demuestra que contigo no funciona!',
    '🎃 ¡Alerta de actividad paranormal! Se detecta una subida de motivación en el equipo. ¡Que tiemblen los objetivos!',
    '🧛 Los vampiros descansan durante el día, pero los grandes vendedores nunca dejan escapar una buena oportunidad.',
    '👁️ El objetivo te está observando desde las sombras... ¿Vas a dejar que te atrape o vas a darle caza?',
    '⚰️ Aquí enterramos las excusas, no las oportunidades. ¡Cada conversación puede ser el comienzo de una gran venta!',
    '🌕 Luna llena, energía al máximo y objetivos en peligro. ¡Hoy los monstruos no somos nosotros... somos los que vamos a por todas!',
    '🕯️ Una venta puede encender la noche. Diez pueden cambiar el mes. ¡Nunca subestimes el poder de dar el siguiente paso!',
    '😈 Que los clientes difíciles no te asusten. Los mejores cazadores de monstruos también empezaron enfrentándose a su primer fantasma.',
    '🧟 ¡El objetivo mensual intenta resucitar! No le des tiempo: sigue sumando ventas y acaba con él de una vez.',
    '🏆 La noche es larga, el objetivo es grande y tu potencial da miedo. ¡Es hora de demostrarlo!'
  ];



  /* -------------------------------------------------------------------------- */
  /* 1. SINTETIZADOR DE AUDIO (WEB AUDIO API - 100% AUDIBLE Y COMPATIBLE)      */
  /* -------------------------------------------------------------------------- */

  let spookyInterval = null;

  async function ensureAudioCtx() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    }
    if (audioContext && audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (e) { }
    }
    return audioContext;
  }

  async function playSpookySound(type = 'chime') {
    if (!soundEnabled) return;
    try {
      const ctx = await ensureAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'chime' || type === 'ambient') {
        // Campana gótica de catedral con resonancia y armónicos de terror (volumen audible y envolvente)
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.35, now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        master.connect(ctx.destination);

        const bellHarmonics = [
          { f: 130.81, g: 0.4 },  // C3 (profundo misterioso)
          { f: 155.56, g: 0.35 }, // Eb3 (tercera menor tenebrosa)
          { f: 196.00, g: 0.25 }, // G3
          { f: 261.63, g: 0.2 },  // C4
          { f: 311.13, g: 0.15 }, // Eb4
          { f: 523.25, g: 0.1 }   // C5 (brillo metálico de campana)
        ];

        bellHarmonics.forEach((h, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = i % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(h.f, now);
          osc.frequency.exponentialRampToValueAtTime(h.f * 0.994, now + 3.2);

          g.gain.setValueAtTime(h.g, now);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 3.5);
        });
      } else if (type === 'whoosh') {
        // Ráfaga espectral sutil al cambiar de vista
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.45);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio spooky error:', e);
    }
  }

  function startAmbientSounds() {
    stopAmbientSounds();
    spookyInterval = setInterval(() => {
      if (soundEnabled) {
        playSpookySound('ambient');
      }
    }, 45000);
  }

  function stopAmbientSounds() {
    if (spookyInterval) {
      clearInterval(spookyInterval);
      spookyInterval = null;
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 2. INYECCIÓN DE TELARAÑAS Y MURCIÉLAGOS (POINTER-EVENTS: NONE)             */
  /* -------------------------------------------------------------------------- */

  function injectCornerWebs() {
    if (document.getElementById('hw-corner-web-left')) return;

    const webSvgContent = `
      <svg viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <path d="M0,0 L200,0" stroke-width="1.2" stroke-opacity="0.4" />
        <path d="M0,0 L0,200" stroke-width="1.2" stroke-opacity="0.4" />
        <path d="M0,0 L185,75" stroke-width="1" stroke-opacity="0.4" />
        <path d="M0,0 L145,145" stroke-width="1.2" stroke-opacity="0.45" />
        <path d="M0,0 L75,185" stroke-width="1" stroke-opacity="0.4" />
        <path d="M40,0 Q35,15 28,28 Q15,35 0,40" stroke-width="1" stroke-opacity="0.35" />
        <path d="M80,0 Q70,30 57,57 Q30,70 0,80" stroke-width="1" stroke-opacity="0.35" />
        <path d="M125,0 Q110,48 88,88 Q48,110 0,125" stroke-width="1.1" stroke-opacity="0.35" />
        <path d="M170,0 Q150,65 120,120 Q65,150 0,170" stroke-width="1.1" stroke-opacity="0.35" />
        <g class="hw-spider-swing">
          <path d="M145,145 L145,185" stroke-width="0.8" stroke-opacity="0.55" stroke-dasharray="2 1" />
          <ellipse cx="145" cy="189" rx="3.5" ry="4.5" fill="currentColor" fill-opacity="0.8" />
          <circle cx="145" cy="185.5" r="2.2" fill="currentColor" fill-opacity="0.9" />
          <path d="M143,187 Q137,184 135,188 M147,187 Q153,184 155,188 M142,189 Q136,189 134,193 M148,189 Q154,189 156,193 M143,191 Q138,195 137,199 M147,191 Q152,195 153,199" stroke-width="0.9" stroke-opacity="0.75" />
        </g>
      </svg>
    `;

    const webLeft = document.createElement('div');
    webLeft.id = 'hw-corner-web-left';
    webLeft.className = 'hw-corner-web top-left';
    webLeft.innerHTML = webSvgContent;
    document.body.appendChild(webLeft);

    const webRight = document.createElement('div');
    webRight.id = 'hw-corner-web-right';
    webRight.className = 'hw-corner-web top-right';
    webRight.innerHTML = webSvgContent;
    document.body.appendChild(webRight);
  }

  function injectBats() {
    if (document.getElementById('hw-bats-container')) return;

    const batSvg = `
      <svg viewBox="0 0 100 60" fill="currentColor">
        <path d="M50,22 C46,16 42,12 40,8 C38,13 36,17 33,20 C24,15 12,18 2,27 C10,29 16,35 18,42 C12,41 6,43 0,48 C10,51 18,49 26,45 C28,52 32,56 38,57 C37,50 38,44 42,39 C44,43 47,45 50,45 C53,45 56,43 58,39 C62,44 63,50 62,57 C68,56 72,52 74,45 C82,49 90,51 100,48 C94,43 88,41 82,42 C84,35 90,29 98,27 C88,18 76,15 67,20 C64,17 62,13 60,8 C58,12 54,16 50,22 Z" />
      </svg>
    `;

    const container = document.createElement('div');
    container.id = 'hw-bats-container';
    container.className = 'hw-bats-container';
    container.innerHTML = `
      <div class="hw-bat hw-bat-1">${batSvg}</div>
      <div class="hw-bat hw-bat-2">${batSvg}</div>
      <div class="hw-bat hw-bat-3">${batSvg}</div>
      <div class="hw-bat hw-bat-4">${batSvg}</div>
      <div class="hw-bat hw-bat-5">${batSvg}</div>
      <div class="hw-bat hw-bat-6">${batSvg}</div>
      <div class="hw-bat hw-bat-7">${batSvg}</div>
      <div class="hw-bat hw-bat-8">${batSvg}</div>
      <div class="hw-bat hw-bat-9">${batSvg}</div>
    `;
    document.body.appendChild(container);
  }

  /* -------------------------------------------------------------------------- */
  /* 3. CALABAZAS EN LOGOS Y AUTH CARD (PUMPKIN1 Y PUMPKIN2)                    */
  /* -------------------------------------------------------------------------- */

  function decorateBrandAndAuth() {
    // Calabaza en Sidebar Brand
    const sidebarBrand = document.querySelector('.sidebar-brand');
    if (sidebarBrand && !sidebarBrand.querySelector('.hw-brand-pumpkin')) {
      const pumpkinImg = document.createElement('img');
      pumpkinImg.src = 'Tematicas/Halloween/Pumpkin2.png';
      pumpkinImg.alt = 'Calabaza Halloween';
      pumpkinImg.className = 'hw-brand-pumpkin';
      sidebarBrand.insertBefore(pumpkinImg, sidebarBrand.querySelector('span'));
    }

    // Calabaza en Auth Card
    const authCard = document.querySelector('.auth-card');
    if (authCard && !authCard.querySelector('.hw-auth-pumpkin-badge')) {
      const authPumpkin = document.createElement('img');
      authPumpkin.src = 'Tematicas/Halloween/Pumpkin1.png';
      authPumpkin.alt = 'Calabaza Decoración';
      authPumpkin.className = 'hw-auth-pumpkin-badge';
      authCard.appendChild(authPumpkin);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* COPILOT FLOTANTE - EDICIÓN FANTASMA HALLOWEEN                              */
  /* -------------------------------------------------------------------------- */

  function decorateCopilotFab() {
    const fab = document.getElementById('copilot-fab');
    if (!fab) return;

    if (!fab.querySelector('.hw-copilot-ghost-wrap')) {
      const ghostWrap = document.createElement('div');
      ghostWrap.className = 'hw-copilot-ghost-wrap';
      ghostWrap.setAttribute('aria-label', 'Copilot Fantasma AI');
      ghostWrap.innerHTML = `
        <div class="hw-copilot-pulse"></div>
        <img src="Tematicas/Halloween/copilot_ghost.png" class="hw-copilot-ghost-img" alt="Copilot Fantasma AI">
        <div class="hw-copilot-badge" title="Microsoft Copilot AI">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="url(#hw-cp-grad)" />
            <path d="M8 13.5c0-1.38 1.12-2.5 2.5-2.5h3c1.38 0 2.5 1.12 2.5 2.5S14.88 16 13.5 16h-3C9.12 16 8 14.88 8 13.5z" fill="white" opacity="0.9" />
            <path d="M9.5 8.5c0-.83.67-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5S13.83 10 13 10h-2c-.83 0-1.5-.67-1.5-1.5z" fill="white" opacity="0.75" />
            <defs>
              <linearGradient id="hw-cp-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#0078D4" />
                <stop offset="100%" stop-color="#50E6FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      `;

      ghostWrap.addEventListener('click', (e) => {
        if (typeof window.abrirCopilot === 'function') {
          window.abrirCopilot();
          if (soundEnabled) playSpookySound('whoosh');
        }
      });

      const label = fab.querySelector('.copilot-fab-label');
      if (label) {
        label.textContent = 'Copilot 👻';
        fab.insertBefore(ghostWrap, label);
      } else {
        fab.appendChild(ghostWrap);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 4. CONTROLES Y BADGE EN TOPBAR                                             */
  /* -------------------------------------------------------------------------- */

  function injectTopbarElements() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('hw-topbar-pill')) return;

    // Badge "HALLOWEEN"
    const pill = document.createElement('div');
    pill.id = 'hw-topbar-pill';
    pill.className = 'hw-topbar-pill';
    pill.innerHTML = `<span class="hw-pill-flame">🎃</span> <span>HALLOWEEN</span>`;

    // Botón de efectos de sonido (opcional, apagado por defecto)
    const soundBtn = document.createElement('button');
    soundBtn.id = 'hw-sound-toggle';
    soundBtn.className = 'hw-sound-btn';
    soundBtn.title = 'Efectos de terror: Desactivados (clic para activar)';
    soundBtn.innerHTML = '🔇';
    soundBtn.addEventListener('click', async () => {
      soundEnabled = !soundEnabled;
      soundBtn.classList.toggle('active', soundEnabled);
      soundBtn.innerHTML = soundEnabled ? '🎃' : '🔇';
      soundBtn.title = soundEnabled ? 'Efectos de terror: ACTIVADOS (clic para silenciar)' : 'Efectos de terror: Desactivados';
      if (soundEnabled) {
        await playSpookySound('chime');
        startAmbientSounds();
        if (typeof toast === 'function') toast('🎃 ¡Efectos sonoros de terror ACTIVADOS!', 'info', 2500);
      } else {
        stopAmbientSounds();
        if (typeof toast === 'function') toast('Efectos de terror silenciados', 'info', 2000);
      }
    });

    // Insertar justo a la izquierda del temporizador (#topbar-pomo)
    const pomo = document.getElementById('topbar-pomo');
    if (pomo && pomo.parentNode) {
      pomo.parentNode.insertBefore(pill, pomo);
      pomo.parentNode.insertBefore(soundBtn, pomo);
    } else {
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle && themeToggle.parentNode) {
        themeToggle.parentNode.insertBefore(pill, themeToggle);
        themeToggle.parentNode.insertBefore(soundBtn, themeToggle);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 5. BANNER ILUSTRADO Y CUENTA ATRÁS EN DASHBOARD                            */
  /* -------------------------------------------------------------------------- */

  function updateHalloweenCountdown() {
    const daysEl = document.getElementById('hw-cd-days');
    const hoursEl = document.getElementById('hw-cd-hours');
    const minsEl = document.getElementById('hw-cd-mins');
    if (!daysEl || !hoursEl || !minsEl) return;

    const now = new Date();
    let currentYear = now.getFullYear();
    let target = new Date(currentYear, 9, 31, 23, 59, 59); // 31 Octubre
    if (now > target) {
      target = new Date(currentYear + 1, 9, 31, 23, 59, 59);
    }

    const diff = target.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
  }

  function injectDashboardBanner() {
    const dashboardView = document.getElementById('view-dashboard');
    if (!dashboardView || document.getElementById('hw-dashboard-banner')) return;

    const randomTip = SPOOKY_TIPS[Math.floor(Math.random() * SPOOKY_TIPS.length)];

    const banner = document.createElement('div');
    banner.id = 'hw-dashboard-banner';
    banner.className = 'hw-dashboard-banner';
    banner.innerHTML = `
      <img src="Tematicas/Halloween/halloween_park_banner.jpg" class="hw-banner-bg" alt="Parque Halloween">
      <div class="hw-banner-overlay"></div>
      <div class="hw-banner-content">
        <div>
          <span class="hw-banner-tag">🎃 Edición Especial Parques</span>
          <h2 class="hw-banner-title">Temporada de Halloween y Terror</h2>
          <p class="hw-banner-desc" id="hw-banner-tip">${randomTip}</p>
        </div>
        <div class="hw-banner-actions">
          <div class="hw-banner-countdown" title="Cuenta atrás para la Noche de Halloween">
            <div class="hw-countdown-unit">
              <span class="hw-countdown-val" id="hw-cd-days">--</span>
              <span class="hw-countdown-lbl">Días</span>
            </div>
            <div style="color:#FFA033; font-weight:bold;">:</div>
            <div class="hw-countdown-unit">
              <span class="hw-countdown-val" id="hw-cd-hours">--</span>
              <span class="hw-countdown-lbl">Horas</span>
            </div>
            <div style="color:#FFA033; font-weight:bold;">:</div>
            <div class="hw-countdown-unit">
              <span class="hw-countdown-val" id="hw-cd-mins">--</span>
              <span class="hw-countdown-lbl">Min</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insertar al inicio de la vista del Dashboard (encima de la toolbar)
    dashboardView.insertBefore(banner, dashboardView.firstChild);

    updateHalloweenCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateHalloweenCountdown, 30000);
  }

  /* -------------------------------------------------------------------------- */
  /* 6. DECORAR TARJETAS KPI CON CALABAZAS (PUMPKIN3 A PUMPKIN8)               */
  /* -------------------------------------------------------------------------- */

  function decorateKpiCards() {
    const statsContainer = document.getElementById('dashboard-stats');
    if (!statsContainer) return;

    const cards = statsContainer.querySelectorAll('.card, .stat-card');
    const pumpkins = [
      'Pumpkin3.png',
      'Pumpkin4.png',
      'Pumpkin5.png',
      'Pumpkin6.png',
      'Pumpkin7.png',
      'Pumpkin8.png'
    ];

    cards.forEach((card, index) => {
      if (!card.querySelector('.hw-card-corner-pumpkin')) {
        const pumpkinImg = document.createElement('img');
        const pFile = pumpkins[index % pumpkins.length];
        pumpkinImg.src = `Tematicas/Halloween/${pFile}`;
        pumpkinImg.alt = 'Calabaza';
        pumpkinImg.className = 'hw-card-corner-pumpkin';
        card.appendChild(pumpkinImg);
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 7. INICIALIZACIÓN Y DESTRUCCIÓN SEGURA DE LA TEMÁTICA                       */
  /* -------------------------------------------------------------------------- */

  window.initHalloweenTheme = function () {
    document.documentElement.classList.add('theme-halloween');
    document.body.classList.add('theme-halloween');

    // Asegurar limpieza de cualquier widget o modal previo
    const staleWidget = document.getElementById('hw-float-pumpkin-widget');
    if (staleWidget) staleWidget.remove();
    const staleModal = document.getElementById('hw-modal-backdrop');
    if (staleModal) staleModal.remove();

    injectCornerWebs();
    injectBats();
    decorateBrandAndAuth();
    injectTopbarElements();
    injectDashboardBanner();
    decorateKpiCards();
    decorateCopilotFab();

    // Observar cambios de vista o recarga de estadísticas
    if (!window.__hwViewObserverAttached) {
      window.__hwViewObserverAttached = true;
      const originalSwitchView = window.switchView;
      if (typeof originalSwitchView === 'function') {
        window.switchView = function (...args) {
          const res = originalSwitchView.apply(this, args);
          if (soundEnabled) {
            playSpookySound('whoosh');
          }
          setTimeout(() => {
            if (document.body.classList.contains('theme-halloween')) {
              injectDashboardBanner();
              decorateKpiCards();
            }
          }, 60);
          return res;
        };
      }

      // Hook cuando el Dashboard termine de renderizar estadísticas
      const originalRenderDashboard = window.renderDashboard;
      if (typeof originalRenderDashboard === 'function') {
        window.renderDashboard = function (...args) {
          const res = originalRenderDashboard.apply(this, args);
          setTimeout(() => {
            if (document.body.classList.contains('theme-halloween')) {
              injectDashboardBanner();
              decorateKpiCards();
            }
          }, 80);
          return res;
        };
      }
    }
  };

  window.destroyHalloweenTheme = function () {
    document.documentElement.classList.remove('theme-halloween');
    document.body.classList.remove('theme-halloween');

    stopAmbientSounds();
    soundEnabled = false;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const idsToRemove = [
      'hw-corner-web-left',
      'hw-corner-web-right',
      'hw-bats-container',
      'hw-topbar-pill',
      'hw-sound-toggle',
      'hw-dashboard-banner',
      'hw-float-pumpkin-widget',
      'hw-modal-backdrop'
    ];

    idsToRemove.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    document.querySelectorAll('.hw-brand-pumpkin, .hw-auth-pumpkin-badge, .hw-card-corner-pumpkin, .hw-copilot-ghost-wrap').forEach((el) => {
      el.remove();
    });

    const copilotLabel = document.querySelector('#copilot-fab .copilot-fab-label');
    if (copilotLabel) {
      copilotLabel.textContent = 'Copilot';
    }
  };

})();
