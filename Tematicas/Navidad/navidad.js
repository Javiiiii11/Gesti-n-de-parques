/* ============================================================================
   Temáticas ParkSales · NAVIDAD THEME CONTROLLER
   Gestor visual y efectos ambientales de la temporada navideña.
   Diseñado para ser 100% seguro, modular y no intrusivo: cero impacto en
   eventos, formularios, cálculos ni datos de la aplicación principal.
   ============================================================================ */

(function () {
  'use strict';

  let countdownInterval = null;
  let audioContext = null;
  let soundEnabled = false;

  const XMAS_TIPS = [
    '✨ ¡La magia de la Navidad se contagia en cada llamada! Cierra el año con energía y orgullo.',
    '🎁 El mejor regalo para el equipo es superar juntos los objetivos. ¡Cada venta es una estrella más en el árbol!',
    '🌟 Como las luces de Navidad, tu esfuerzo hace brillar los resultados del parque. ¡Sigue iluminando el camino!',
    '🎄 Diciembre es la temporada de los grandes cierres. Las oportunidades están listas: ¡ve a por todas!',
    '❄️ Que ningún obstáculo enfríe tu motivación. Los grandes vendedores convierten cada reto en un triunfo.',
    '🦌 A paso firme y con la energía al 100%: ¡estamos en la recta final para superar todos los récords del año!',
    '🔔 Cada venta que sumas celebra el esfuerzo de todo el año. ¡Haz que este mes sea memorable!',
    '⭐ La constancia y la ilusión mueven montañas. ¡Termina este año demostrando de qué eres capaz!',
    '🕯️ Una cálida bienvenida y una sonrisa siempre abren puertas. ¡Que el espíritu navideño guíe tus cierres!',
    '🏆 En Navidad los sueños se hacen realidad con trabajo, dedicación y pasión. ¡Vamos a por el objetivo!'
  ];

  const CARD_ORNAMENTS = [
    'ornament_bauble.svg',
    'ornament_candycane.svg',
    'ornament_gingerbread.svg',
    'ornament_tree.svg',
    'ornament_gift.svg',
    'ornament_bell.svg'
  ];

  /* -------------------------------------------------------------------------- */
  /* 1. SINTETIZADOR DE AUDIO NAVIDEÑO (WEB AUDIO API - PURO Y ELEGANTE)        */
  /* -------------------------------------------------------------------------- */

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

  async function playXmasSound(type = 'chime') {
    if (!soundEnabled) return;
    try {
      const ctx = await ensureAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'chime' || type === 'ambient') {
        // Campanas celestiales navideñas en arpegio cálido (C5, E5, G5, C6)
        const notes = [
          { f: 523.25, t: 0.00, d: 2.2 }, // C5
          { f: 659.25, t: 0.18, d: 2.4 }, // E5
          { f: 783.99, t: 0.36, d: 2.6 }, // G5
          { f: 1046.50, t: 0.54, d: 3.2 } // C6 (brillo cristalino)
        ];

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.28, now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);
        master.connect(ctx.destination);

        notes.forEach((note) => {
          const startTime = now + note.t;

          // Oscilador principal senoidal (cálido)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(note.f, startTime);

          gain1.gain.setValueAtTime(0.35, startTime);
          gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d);

          osc1.connect(gain1);
          gain1.connect(master);
          osc1.start(startTime);
          osc1.stop(startTime + note.d);

          // Armónico agudo brillante de campana
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(note.f * 2.76, startTime);

          gain2.gain.setValueAtTime(0.08, startTime);
          gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d * 0.5);

          osc2.connect(gain2);
          gain2.connect(master);
          osc2.start(startTime);
          osc2.stop(startTime + note.d * 0.5);
        });
      } else if (type === 'whoosh') {
        // Ráfaga suave de nieve al navegar
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.35);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {
      console.warn('Audio Xmas error:', e);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 2. EFECTO DE NIEVE EN CAÍDA (PERFORMANTE, SUTIL Y ELEGANTE)                */
  /* -------------------------------------------------------------------------- */

  function injectSnowflakes() {
    if (document.getElementById('xmas-snow-container')) return;

    const container = document.createElement('div');
    container.id = 'xmas-snow-container';
    container.className = 'xmas-snow-container';
    container.setAttribute('aria-hidden', 'true');

    const totalFlakes = 34;
    let html = '';

    for (let i = 0; i < totalFlakes; i++) {
      const left = Math.round(Math.random() * 100);
      const duration = (6 + Math.random() * 9).toFixed(1); // 6s a 15s
      const delay = (-Math.random() * 12).toFixed(1);      // ya cayendo
      const swayDuration = (3 + Math.random() * 4).toFixed(1);
      const size = i % 4 === 0 ? 12 : (i % 2 === 0 ? 7 : 4);
      const opacity = (0.35 + Math.random() * 0.55).toFixed(2);

      // Cada 4 copos usamos el SVG cristalino para variedad visual
      if (i % 4 === 0) {
        html += `
          <div class="xmas-snowflake xmas-snowflake-crystal" style="left: ${left}%; width: ${size}px; height: ${size}px; animation-duration: ${duration}s, ${swayDuration}s; animation-delay: ${delay}s, ${delay}s; opacity: ${opacity};">
            <svg viewBox="0 0 100 100" fill="currentColor">
              <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
              <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
              <line x1="22" y1="22" x2="78" y2="78" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              <line x1="22" y1="78" x2="78" y2="22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              <circle cx="50" cy="50" r="6" fill="currentColor"/>
            </svg>
          </div>
        `;
      } else {
        html += `
          <div class="xmas-snowflake xmas-snowflake-dot" style="left: ${left}%; width: ${size}px; height: ${size}px; animation-duration: ${duration}s, ${swayDuration}s; animation-delay: ${delay}s, ${delay}s; opacity: ${opacity};"></div>
        `;
      }
    }

    container.innerHTML = html;
    document.body.appendChild(container);
  }

  /* -------------------------------------------------------------------------- */
  /* 3. GUIRNALDAS DE PINO Y LUCES EN ESQUINAS SUPERIORES                       */
  /* -------------------------------------------------------------------------- */

  function injectCornerGarlands() {
    if (document.getElementById('xmas-garland-left')) return;

    const garlandLeft = document.createElement('div');
    garlandLeft.id = 'xmas-garland-left';
    garlandLeft.className = 'xmas-corner-garland top-left';
    garlandLeft.innerHTML = `<img src="Tematicas/Navidad/assets/garland.svg" alt="Guirnalda Navideña" class="xmas-garland-img">`;
    document.body.appendChild(garlandLeft);

    const garlandRight = document.createElement('div');
    garlandRight.id = 'xmas-garland-right';
    garlandRight.className = 'xmas-corner-garland top-right';
    garlandRight.innerHTML = `<img src="Tematicas/Navidad/assets/garland.svg" alt="Guirnalda Navideña" class="xmas-garland-img">`;
    document.body.appendChild(garlandRight);
  }

  /* -------------------------------------------------------------------------- */
  /* 4. NIEVE EN LA PARTE SUPERIOR DE LAS TARJETAS Y ADORNOS DE ESQUINA          */
  /* -------------------------------------------------------------------------- */

  function decorateCardsSnowAndOrnaments() {
    // 1. Tarjetas del Dashboard y estadísticas
    const statsContainer = document.getElementById('dashboard-stats');
    const allCards = document.querySelectorAll('.card, .stat-card, .widget, .filter-card');

    allCards.forEach((card, index) => {
      // 1. Capa de nieve sobre el borde superior de la tarjeta
      if (!card.querySelector('.xmas-snow-cap')) {
        const snowCap = document.createElement('div');
        snowCap.className = 'xmas-snow-cap';
        snowCap.setAttribute('aria-hidden', 'true');
        snowCap.innerHTML = `<img src="Tematicas/Navidad/assets/snow_cap.svg" alt="Nieve" class="xmas-snow-cap-img">`;
        card.appendChild(snowCap);
      }

      // 2. Adorno navideño en esquina superior derecha
      if (!card.querySelector('.xmas-card-ornament')) {
        const ornamentImg = document.createElement('img');
        const file = CARD_ORNAMENTS[index % CARD_ORNAMENTS.length];
        ornamentImg.src = `Tematicas/Navidad/assets/${file}`;
        ornamentImg.alt = 'Adorno Navideño';
        ornamentImg.className = 'xmas-card-ornament';
        card.appendChild(ornamentImg);
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 5. GORRO DE PAPÁ NOEL EN LOGO Y BOLA DE NIEVE EN ACCESO                   */
  /* -------------------------------------------------------------------------- */

  function decorateBrandAndAuth() {
    // Gorrito navideño en el logotipo del sidebar
    const sidebarBrand = document.querySelector('.sidebar-brand');
    if (sidebarBrand && !sidebarBrand.querySelector('.xmas-brand-hat')) {
      const hatImg = document.createElement('img');
      hatImg.src = 'Tematicas/Navidad/assets/santa_hat.svg';
      hatImg.alt = 'Gorro Navidad';
      hatImg.className = 'xmas-brand-hat';
      sidebarBrand.insertBefore(hatImg, sidebarBrand.querySelector('span'));
    }

    // Globo de nieve en tarjeta de login
    const authCard = document.querySelector('.auth-card');
    if (authCard && !authCard.querySelector('.xmas-auth-badge')) {
      const snowglobe = document.createElement('img');
      snowglobe.src = 'Tematicas/Navidad/assets/snowglobe.svg';
      snowglobe.alt = 'Globo de Nieve';
      snowglobe.className = 'xmas-auth-badge';
      authCard.appendChild(snowglobe);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 6. COPILOT FLOTANTE - EDICIÓN NAVIDEÑA (GALLETA DE JENGIBRE COPILOT)       */
  /* -------------------------------------------------------------------------- */

  function decorateCopilotFab() {
    const fab = document.getElementById('copilot-fab');
    if (!fab) return;

    if (!fab.querySelector('.xmas-copilot-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'xmas-copilot-wrap';
      wrap.setAttribute('aria-label', 'Copilot Galleta de Jengibre AI');
      wrap.innerHTML = `
        <div class="xmas-copilot-pulse"></div>
        <img src="Tematicas/Navidad/copilot_gingerbread.png" class="xmas-copilot-ginger-img" alt="Copilot Galleta de Jengibre AI">
        <div class="xmas-copilot-badge" title="Microsoft Copilot AI">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="url(#xmas-cp-grad)" />
            <path d="M8 13.5c0-1.38 1.12-2.5 2.5-2.5h3c1.38 0 2.5 1.12 2.5 2.5S14.88 16 13.5 16h-3C9.12 16 8 14.88 8 13.5z" fill="white" opacity="0.9" />
            <path d="M9.5 8.5c0-.83.67-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5S13.83 10 13 10h-2c-.83 0-1.5-.67-1.5-1.5z" fill="white" opacity="0.75" />
            <defs>
              <linearGradient id="xmas-cp-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#0078D4" />
                <stop offset="100%" stop-color="#50E6FF" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      `;

      wrap.addEventListener('click', (e) => {
        if (typeof window.abrirCopilot === 'function') {
          window.abrirCopilot();
          if (soundEnabled) playXmasSound('whoosh');
        }
      });

      const label = fab.querySelector('.copilot-fab-label');
      if (label) {
        label.textContent = 'Copilot 🍪';
        fab.insertBefore(wrap, label);
      } else {
        fab.appendChild(wrap);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 7. BADGE "NAVIDAD" Y BOTÓN DE SONIDO EN TOPBAR                             */
  /* -------------------------------------------------------------------------- */

  function injectTopbarElements() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('xmas-topbar-pill')) return;

    // Badge "NAVIDAD"
    const pill = document.createElement('div');
    pill.id = 'xmas-topbar-pill';
    pill.className = 'xmas-topbar-pill';
    pill.innerHTML = `<span class="xmas-pill-tree">🎄</span> <span>NAVIDAD</span>`;

    // Botón de sonido (campanas navideñas)
    const soundBtn = document.createElement('button');
    soundBtn.id = 'xmas-sound-toggle';
    soundBtn.className = 'xmas-sound-btn';
    soundBtn.title = 'Sonidos navideños: Desactivados (clic para activar)';
    soundBtn.innerHTML = '🔇';
    soundBtn.addEventListener('click', async () => {
      soundEnabled = !soundEnabled;
      soundBtn.classList.toggle('active', soundEnabled);
      soundBtn.innerHTML = soundEnabled ? '🔔' : '🔇';
      soundBtn.title = soundEnabled ? 'Sonidos navideños: ACTIVADOS (clic para silenciar)' : 'Sonidos navideños: Desactivados';
      if (soundEnabled) {
        await playXmasSound('chime');
        if (typeof toast === 'function') toast('🎄 ¡Campanas navideñas ACTIVADAS!', 'info', 2500);
      } else {
        if (typeof toast === 'function') toast('Sonidos navideños silenciados', 'info', 2000);
      }
    });

    // Insertar junto al temporizador pomodoro o alternador de temas
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
  /* 8. BANNER ILUSTRADO Y CUENTA ATRÁS A NOCHEBUENA / NAVIDAD                   */
  /* -------------------------------------------------------------------------- */

  function updateXmasCountdown() {
    const daysEl = document.getElementById('xmas-cd-days');
    const hoursEl = document.getElementById('xmas-cd-hours');
    const minsEl = document.getElementById('xmas-cd-mins');
    if (!daysEl || !hoursEl || !minsEl) return;

    const now = new Date();
    let currentYear = now.getFullYear();
    let target = new Date(currentYear, 11, 24, 23, 59, 59); // 24 de Diciembre
    if (now > target) {
      target = new Date(currentYear + 1, 11, 24, 23, 59, 59);
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
    if (!dashboardView || document.getElementById('xmas-dashboard-banner')) return;

    const randomTip = XMAS_TIPS[Math.floor(Math.random() * XMAS_TIPS.length)];

    const banner = document.createElement('div');
    banner.id = 'xmas-dashboard-banner';
    banner.className = 'xmas-dashboard-banner';
    banner.innerHTML = `
      <img src="Tematicas/Navidad/navidad_park_banner.jpg" class="xmas-banner-bg" alt="Parque en Navidad">
      <div class="xmas-banner-overlay"></div>
      <div class="xmas-banner-content">
        <div>
          <span class="xmas-banner-tag">🎄 Edición Especial de Navidad</span>
          <h2 class="xmas-banner-title">Temporada de Navidad y Magia</h2>
          <p class="xmas-banner-desc" id="xmas-banner-tip">${randomTip}</p>
        </div>
        <div class="xmas-banner-actions">
          <div class="xmas-banner-countdown" title="Cuenta atrás para Nochebuena">
            <div class="xmas-countdown-unit">
              <span class="xmas-countdown-val" id="xmas-cd-days">--</span>
              <span class="xmas-countdown-lbl">Días</span>
            </div>
            <div style="color:#FFD166; font-weight:bold;">:</div>
            <div class="xmas-countdown-unit">
              <span class="xmas-countdown-val" id="xmas-cd-hours">--</span>
              <span class="xmas-countdown-lbl">Horas</span>
            </div>
            <div style="color:#FFD166; font-weight:bold;">:</div>
            <div class="xmas-countdown-unit">
              <span class="xmas-countdown-val" id="xmas-cd-mins">--</span>
              <span class="xmas-countdown-lbl">Min</span>
            </div>
          </div>
        </div>
      </div>
    `;

    dashboardView.insertBefore(banner, dashboardView.firstChild);

    updateXmasCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateXmasCountdown, 30000);
  }

  /* -------------------------------------------------------------------------- */
  /* 9. INICIALIZACIÓN Y DESTRUCCIÓN SEGURA DE LA TEMÁTICA                       */
  /* -------------------------------------------------------------------------- */

  window.initNavidadTheme = function () {
    document.documentElement.classList.add('theme-navidad');
    document.body.classList.add('theme-navidad');

    injectSnowflakes();
    injectCornerGarlands();
    decorateBrandAndAuth();
    injectTopbarElements();
    injectDashboardBanner();
    decorateCardsSnowAndOrnaments();
    decorateCopilotFab();

    // Observar cambios de vista o recarga de estadísticas
    if (!window.__xmasViewObserverAttached) {
      window.__xmasViewObserverAttached = true;

      const originalSwitchView = window.switchView;
      if (typeof originalSwitchView === 'function') {
        window.switchView = function (...args) {
          const res = originalSwitchView.apply(this, args);
          if (soundEnabled) {
            playXmasSound('whoosh');
          }
          setTimeout(() => {
            if (document.body.classList.contains('theme-navidad')) {
              injectDashboardBanner();
              decorateCardsSnowAndOrnaments();
            }
          }, 60);
          return res;
        };
      }

      const originalRenderDashboard = window.renderDashboard;
      if (typeof originalRenderDashboard === 'function') {
        window.renderDashboard = function (...args) {
          const res = originalRenderDashboard.apply(this, args);
          setTimeout(() => {
            if (document.body.classList.contains('theme-navidad')) {
              injectDashboardBanner();
              decorateCardsSnowAndOrnaments();
            }
          }, 80);
          return res;
        };
      }
    }
  };

  window.destroyNavidadTheme = function () {
    document.documentElement.classList.remove('theme-navidad');
    document.body.classList.remove('theme-navidad');

    soundEnabled = false;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    const idsToRemove = [
      'xmas-snow-container',
      'xmas-garland-left',
      'xmas-garland-right',
      'xmas-topbar-pill',
      'xmas-sound-toggle',
      'xmas-dashboard-banner'
    ];

    idsToRemove.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    document.querySelectorAll('.xmas-brand-hat, .xmas-auth-badge, .xmas-snow-cap, .xmas-card-ornament, .xmas-copilot-wrap').forEach((el) => {
      el.remove();
    });

    const copilotLabel = document.querySelector('#copilot-fab .copilot-fab-label');
    if (copilotLabel) {
      copilotLabel.textContent = 'Copilot';
    }
  };

})();
