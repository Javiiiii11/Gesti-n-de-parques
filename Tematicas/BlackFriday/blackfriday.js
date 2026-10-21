/* ============================================================================
   Temáticas ParkSales · BLACK FRIDAY THEME CONTROLLER (EDICIÓN ALTA ENERGÍA)
   Gestor visual, efectos ambientales de chispas y atmósfera Cyber Luxury Black Friday.
   100% modular y seguro: Cero impacto en lógica de negocio, datos o eventos.
   ============================================================================ */

(function () {
  'use strict';

  let countdownInterval = null;
  let audioContext = null;
  let soundEnabled = false;

  // Sistema de chispas en Canvas
  let sparksCanvas = null;
  let sparksCtx = null;
  let sparksAnimId = null;
  let sparksList = [];
  let sparksArcs = [];

  const BF_TIPS = [
    '🏷️ ¡Black Friday es la mayor oportunidad del año! Cada llamada es un cierre en potencia.',
    '⚡ Los clientes buscan las mejores ofertas: transmite energía, exclusividad y confianza.',
    '🔥 Récord histórico a la vista. El ritmo y la constancia de hoy marcan la diferencia.',
    '💎 Trata cada llamada como un cliente VIP de Black Friday. ¡Pulveriza tus objetivos!',
    '🚀 Mantén el foco en las mejores promociones. ¡Vamos a por el día más potente de ParkSales!',
    '🎯 El entusiasmo vende más que cualquier descuento. ¡Haz que la experiencia sea única!',
    '⭐ Las mejores ventas son las que se cierran con decisión y pasión. ¡A por todas!',
    '🏆 La semana dorada de ventas: ¡hoy se forjan los mejores números del año!'
  ];

  const CARD_BADGES = [
    'tag_sale.svg',
    'tag_percent.svg',
    'tag_flash.svg',
    'tag_vip.svg'
  ];

  /* -------------------------------------------------------------------------- */
  /* 1. SINTETIZADOR DE AUDIO CYBER BLACK FRIDAY (WEB AUDIO API - 0 DEPENDENCIAS)*/
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

  async function playBfSound(type = 'cash') {
    if (!soundEnabled) return;
    try {
      const ctx = await ensureAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'cash' || type === 'arpeggio') {
        // Chime arpegiado futurista de "Venta / Éxito" (E5, G#5, B5, E6)
        const notes = [
          { f: 659.25, t: 0.00, d: 0.35, type: 'triangle' },
          { f: 830.61, t: 0.08, d: 0.35, type: 'sine' },
          { f: 987.77, t: 0.16, d: 0.40, type: 'triangle' },
          { f: 1318.51, t: 0.24, d: 1.2, type: 'sine' }
        ];

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.22, now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        master.connect(ctx.destination);

        notes.forEach((note) => {
          const startTime = now + note.t;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = note.type;
          osc.frequency.setValueAtTime(note.f, startTime);

          gain.gain.setValueAtTime(0.26, startTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.d);

          osc.connect(gain);
          gain.connect(master);
          osc.start(startTime);
          osc.stop(startTime + note.d);
        });
      } else if (type === 'whoosh') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio Black Friday error:', e);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 2. CHISPAS CYBER & ALTA ENERGÍA (CANVAS LIGERO, 60 FPS, SUBIENDO)          */
  /* -------------------------------------------------------------------------- */

  function initCyberSparksCanvas() {
    if (document.getElementById('bf-sparks-canvas')) return;

    sparksCanvas = document.createElement('canvas');
    sparksCanvas.id = 'bf-sparks-canvas';
    sparksCanvas.className = 'bf-sparks-canvas';
    sparksCanvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sparksCanvas);

    sparksCtx = sparksCanvas.getContext('2d', { alpha: true });

    function resizeCanvas() {
      if (!sparksCanvas) return;
      sparksCanvas.width = window.innerWidth;
      sparksCanvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    sparksList = [];
    sparksArcs = [];
    const maxSparks = 42;

    function createSpark(fromBurst = false, originX, originY) {
      const w = sparksCanvas.width || window.innerWidth;
      const h = sparksCanvas.height || window.innerHeight;

      const isGold = Math.random() < 0.65;
      const color = isGold 
        ? (Math.random() < 0.45 ? '#FFF275' : '#FFD700') 
        : (Math.random() < 0.65 ? '#FF1E56' : '#00F0FF');
      
      const glow = isGold ? 'rgba(255, 215, 0, 0.7)' : 'rgba(255, 30, 86, 0.7)';

      const x = originX !== undefined ? originX : Math.random() * w;
      const y = originY !== undefined ? originY : (fromBurst ? Math.random() * h : h - Math.random() * (h * 0.45));

      return {
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * (fromBurst ? 4.5 : 2.0),
        vy: fromBurst ? (Math.random() - 0.5) * 4.5 : -(Math.random() * 2.4 + 0.9),
        size: Math.random() * 2.2 + 1.2,
        life: 1.0,
        decay: Math.random() * 0.014 + 0.009,
        color: color,
        glow: glow,
        flickerSpeed: Math.random() * 0.25 + 0.08,
        flickerOffset: Math.random() * Math.PI * 2
      };
    }

    for (let i = 0; i < maxSparks; i++) {
      const sp = createSpark();
      sp.y = Math.random() * (sparksCanvas.height || window.innerHeight);
      sparksList.push(sp);
    }

    let lastArcTime = Date.now();

    function triggerElectricArc() {
      if (!sparksCanvas) return;
      const w = sparksCanvas.width || window.innerWidth;
      const h = sparksCanvas.height || window.innerHeight;

      const startX = Math.random() < 0.5 ? Math.random() * 120 + 20 : w - (Math.random() * 120 + 20);
      const startY = Math.random() * h * 0.7 + 40;
      
      const points = [{ x: startX, y: startY }];
      let cx = startX;
      let cy = startY;
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segments; s++) {
        cx += (Math.random() - 0.5) * 36;
        cy += (Math.random() - 0.3) * 30;
        points.push({ x: cx, y: cy });
      }

      for (let b = 0; b < 4; b++) {
        sparksList.push(createSpark(true, cx, cy));
      }

      sparksArcs.push({
        points: points,
        life: 1.0,
        decay: 0.16,
        color: Math.random() < 0.6 ? '#FFD700' : '#FF1E56'
      });
    }

    function renderSparks(now) {
      if (!sparksCanvas || !sparksCtx) return;

      sparksCtx.clearRect(0, 0, sparksCanvas.width, sparksCanvas.height);

      if (Date.now() - lastArcTime > 3500 && Math.random() < 0.08) {
        lastArcTime = Date.now();
        triggerElectricArc();
      }

      for (let a = sparksArcs.length - 1; a >= 0; a--) {
        const arc = sparksArcs[a];
        arc.life -= arc.decay;
        if (arc.life <= 0) {
          sparksArcs.splice(a, 1);
          continue;
        }

        sparksCtx.save();
        sparksCtx.beginPath();
        sparksCtx.moveTo(arc.points[0].x, arc.points[0].y);
        for (let p = 1; p < arc.points.length; p++) {
          sparksCtx.lineTo(arc.points[p].x, arc.points[p].y);
        }
        sparksCtx.strokeStyle = arc.color;
        sparksCtx.lineWidth = 1.4;
        sparksCtx.shadowBlur = 10;
        sparksCtx.shadowColor = arc.color;
        sparksCtx.globalAlpha = Math.max(0, arc.life);
        sparksCtx.stroke();
        sparksCtx.restore();
      }

      for (let i = sparksList.length - 1; i >= 0; i--) {
        const p = sparksList[i];

        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        p.vx *= 0.99;
        p.vy *= 0.996;

        if (p.life <= 0 || p.y < -20 || p.x < -20 || p.x > sparksCanvas.width + 20) {
          sparksList[i] = createSpark();
          continue;
        }

        const flicker = 0.65 + 0.35 * Math.sin(now * p.flickerSpeed + p.flickerOffset);
        const alpha = Math.max(0, Math.min(1, p.life * flicker));

        sparksCtx.save();
        sparksCtx.globalAlpha = alpha;
        sparksCtx.shadowBlur = 8;
        sparksCtx.shadowColor = p.glow;
        sparksCtx.fillStyle = p.color;

        sparksCtx.beginPath();
        sparksCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        sparksCtx.fill();

        sparksCtx.fillStyle = '#FFFFFF';
        sparksCtx.beginPath();
        sparksCtx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
        sparksCtx.fill();

        sparksCtx.restore();
      }

      sparksAnimId = requestAnimationFrame(renderSparks);
    }

    sparksAnimId = requestAnimationFrame(renderSparks);
  }

  function destroyCyberSparksCanvas() {
    if (sparksAnimId) {
      cancelAnimationFrame(sparksAnimId);
      sparksAnimId = null;
    }
    if (sparksCanvas) {
      sparksCanvas.remove();
      sparksCanvas = null;
      sparksCtx = null;
    }
    sparksList = [];
    sparksArcs = [];
  }

  /* -------------------------------------------------------------------------- */
  /* 3. BANNERS/RIBETE DECORATIVO EN ESQUINAS SUPERIORES (TOP: 0)               */
  /* -------------------------------------------------------------------------- */

  function injectCornerRibbons() {
    if (document.getElementById('bf-corner-ribbon-left')) return;

    const ribbonLeft = document.createElement('div');
    ribbonLeft.id = 'bf-corner-ribbon-left';
    ribbonLeft.className = 'bf-corner-ribbon top-left';
    ribbonLeft.innerHTML = `<img src="Tematicas/BlackFriday/assets/bf_corner_ribbon.svg" alt="Black Friday Corner" class="bf-ribbon-img">`;
    document.body.appendChild(ribbonLeft);

    const ribbonRight = document.createElement('div');
    ribbonRight.id = 'bf-corner-ribbon-right';
    ribbonRight.className = 'bf-corner-ribbon top-right';
    ribbonRight.innerHTML = `<img src="Tematicas/BlackFriday/assets/bf_corner_ribbon.svg" alt="Black Friday Corner" class="bf-ribbon-img">`;
    document.body.appendChild(ribbonRight);
  }

  /* -------------------------------------------------------------------------- */
  /* 4. LOGOTIPO SIDEBAR & PANTALLA DE ACCESO (DISEÑO LIMPIO EN 1 LÍNEA)        */
  /* -------------------------------------------------------------------------- */

  function decorateBrandAndAuth() {
    const sidebarBrand = document.querySelector('.sidebar-brand');
    if (sidebarBrand && !sidebarBrand.querySelector('.bf-brand-tag')) {
      const tag = document.createElement('span');
      tag.className = 'bf-brand-tag';
      tag.textContent = '⚡ BF SALE';
      sidebarBrand.appendChild(tag);
    }

    const authCard = document.querySelector('.auth-card');
    if (authCard && !authCard.querySelector('.bf-auth-card-badge')) {
      const vipImg = document.createElement('img');
      vipImg.src = 'Tematicas/BlackFriday/assets/vip_pass.svg';
      vipImg.alt = 'Black Friday VIP Access';
      vipImg.className = 'bf-auth-card-badge';
      authCard.appendChild(vipImg);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 5. TOPBAR BADGE "BLACK FRIDAY" Y BOTÓN DE SONIDO                           */
  /* -------------------------------------------------------------------------- */

  function injectTopbarElements() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('bf-topbar-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'bf-topbar-pill';
    pill.className = 'bf-topbar-pill';
    pill.innerHTML = `<span class="bf-pill-icon">🏷️</span> <span>BLACK FRIDAY</span>`;

    const soundBtn = document.createElement('button');
    soundBtn.id = 'bf-sound-toggle';
    soundBtn.className = 'bf-sound-btn';
    soundBtn.title = 'Efectos Black Friday: Desactivados (clic para activar)';
    soundBtn.innerHTML = '🔇';
    soundBtn.addEventListener('click', async () => {
      soundEnabled = !soundEnabled;
      soundBtn.classList.toggle('active', soundEnabled);
      soundBtn.innerHTML = soundEnabled ? '⚡' : '🔇';
      soundBtn.title = soundEnabled ? 'Efectos Black Friday: ACTIVADOS (clic para silenciar)' : 'Efectos Black Friday: Desactivados';
      if (soundEnabled) {
        await playBfSound('cash');
        if (typeof toast === 'function') toast('⚡ ¡Efectos Black Friday ACTIVADOS!', 'info', 2500);
      } else {
        if (typeof toast === 'function') toast('Sonidos Black Friday silenciados', 'info', 2000);
      }
    });

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
  /* 6. ADORNOS EN TODAS LAS CAJAS, TARJETAS Y PANELES (DISCRETOS)              */
  /* -------------------------------------------------------------------------- */

  function decorateCards() {
    // Abarca Dashboard, Historial, Llamadas, Archivos de Parques e Importar/Exportar
    const allCards = document.querySelectorAll(
      '.card, .stat-card, .widget, .filter-card, .dashboard-panel, .ex-card, .parques-panel, .promos-card, .historial-filter-card, #llamada-form, .ll-card'
    );
    allCards.forEach((card, index) => {
      if (!card.querySelector('.bf-card-badge')) {
        const badgeImg = document.createElement('img');
        const file = CARD_BADGES[index % CARD_BADGES.length];
        badgeImg.src = `Tematicas/BlackFriday/assets/${file}`;
        badgeImg.alt = 'Black Friday Deal';
        badgeImg.className = 'bf-card-badge';
        card.appendChild(badgeImg);
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 7. DASHBOARD BANNER CON CUENTA ATRÁS Y TIPS DE VENTAS                       */
  /* -------------------------------------------------------------------------- */

  function getBlackFridayDate(year) {
    const firstNov = new Date(year, 10, 1);
    let dayOfWeek = firstNov.getDay();
    let firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
    let fourthFriday = firstFriday + 21;
    return new Date(year, 10, fourthFriday, 23, 59, 59);
  }

  function updateBlackFridayCountdown() {
    const daysEl = document.getElementById('bf-cd-days');
    const hoursEl = document.getElementById('bf-cd-hours');
    const minsEl = document.getElementById('bf-cd-mins');
    const secsEl = document.getElementById('bf-cd-secs');
    if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

    const now = new Date();
    let currentYear = now.getFullYear();
    let target = getBlackFridayDate(currentYear);

    if (now > target) {
      target = getBlackFridayDate(currentYear + 1);
    }

    const diff = target.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    daysEl.textContent = String(days).padStart(2, '0');
    hoursEl.textContent = String(hours).padStart(2, '0');
    minsEl.textContent = String(mins).padStart(2, '0');
    secsEl.textContent = String(secs).padStart(2, '0');
  }

  function injectDashboardBanner() {
    const dashboardView = document.getElementById('view-dashboard');
    if (!dashboardView || document.getElementById('bf-dashboard-banner')) return;

    const randomTip = BF_TIPS[Math.floor(Math.random() * BF_TIPS.length)];

    const banner = document.createElement('div');
    banner.id = 'bf-dashboard-banner';
    banner.className = 'bf-dashboard-banner';
    banner.innerHTML = `
      <img src="Tematicas/BlackFriday/black_friday_park_banner.jpg" class="bf-banner-bg" alt="Black Friday ParkSales">
      <div class="bf-banner-overlay"></div>
      <div class="bf-banner-content">
        <div>
          <span class="bf-banner-tag">⚡ Edición Especial Black Friday</span>
          <h2 class="bf-banner-title">Black Friday ParkSales · <span>Semana de Récords</span></h2>
          <p class="bf-banner-desc" id="bf-banner-tip">${randomTip}</p>
        </div>
        <div class="bf-banner-actions">
          <div class="bf-banner-countdown" title="Cuenta atrás para el Cierre de Black Friday">
            <div class="bf-countdown-unit">
              <span class="bf-countdown-val" id="bf-cd-days">--</span>
              <span class="bf-countdown-lbl">Días</span>
            </div>
            <div class="bf-countdown-sep">:</div>
            <div class="bf-countdown-unit">
              <span class="bf-countdown-val" id="bf-cd-hours">--</span>
              <span class="bf-countdown-lbl">Horas</span>
            </div>
            <div class="bf-countdown-sep">:</div>
            <div class="bf-countdown-unit">
              <span class="bf-countdown-val" id="bf-cd-mins">--</span>
              <span class="bf-countdown-lbl">Min</span>
            </div>
            <div class="bf-countdown-sep">:</div>
            <div class="bf-countdown-unit">
              <span class="bf-countdown-val" id="bf-cd-secs">--</span>
              <span class="bf-countdown-lbl">Seg</span>
            </div>
          </div>
        </div>
      </div>
    `;

    dashboardView.insertBefore(banner, dashboardView.firstChild);

    updateBlackFridayCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateBlackFridayCountdown, 1000);
  }

  /* -------------------------------------------------------------------------- */
  /* 8. COPILOT FAB BLACK FRIDAY (LOGO OFICIAL COPILOT EN ESTILO BLACK FRIDAY)   */
  /* -------------------------------------------------------------------------- */

  function decorateCopilotFab() {
    const fab = document.getElementById('copilot-fab');
    if (!fab) return;

    if (!fab.querySelector('.bf-copilot-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'bf-copilot-wrap';
      wrap.setAttribute('aria-label', 'Microsoft Copilot Black Friday');
      wrap.innerHTML = `
        <div class="bf-copilot-pulse"></div>
        <svg class="bf-copilot-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bf-cp-disc" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#222538"/>
              <stop offset="60%" stop-color="#0E0F17"/>
              <stop offset="100%" stop-color="#06070B"/>
            </radialGradient>
            <linearGradient id="bf-cp-ribbon" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFF275"/>
              <stop offset="35%" stop-color="#FFD700"/>
              <stop offset="70%" stop-color="#FF1E56"/>
              <stop offset="100%" stop-color="#8B0029"/>
            </linearGradient>
            <filter id="bf-cp-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feComposite in="SourceGraphic" in2="blur" operator="over"/>
            </filter>
          </defs>
          <circle cx="24" cy="24" r="22" fill="url(#bf-cp-disc)" stroke="#FFD700" stroke-width="2" filter="url(#bf-cp-glow)"/>
          <circle cx="24" cy="24" r="19" stroke="#FF1E56" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.6"/>
          
          <g transform="translate(6, 6) scale(1.5)">
            <path d="M8 13.5c0-1.38 1.12-2.5 2.5-2.5h3c1.38 0 2.5 1.12 2.5 2.5S14.88 16 13.5 16h-3C9.12 16 8 14.88 8 13.5z"
              fill="url(#bf-cp-ribbon)" filter="url(#bf-cp-glow)"/>
            <path d="M9.5 8.5c0-.83.67-1.5 1.5-1.5h2c.83 0 1.5.67 1.5 1.5S13.83 10 13 10h-2c-.83 0-1.5-.67-1.5-1.5z"
              fill="#FFF275" opacity="0.95"/>
          </g>
          
          <g transform="translate(32, 4)">
            <rect x="0" y="0" width="12" height="12" rx="3" fill="#FF1E56" stroke="#FFF275" stroke-width="1"/>
            <path d="M6 1 L3 6 L6 6 L5 10 L9 5 L6 5 Z" fill="#FFF275"/>
          </g>
        </svg>
      `;

      wrap.addEventListener('click', (e) => {
        if (typeof window.abrirCopilot === 'function') {
          window.abrirCopilot();
          if (soundEnabled) playBfSound('whoosh');
        }
      });

      const label = fab.querySelector('.copilot-fab-label');
      if (label) {
        label.textContent = 'Copilot ⚡';
        fab.insertBefore(wrap, label);
      } else {
        fab.appendChild(wrap);
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 9. INICIALIZACIÓN Y DESTRUCCIÓN SEGURA DE LA TEMÁTICA                       */
  /* -------------------------------------------------------------------------- */

  window.initBlackFridayTheme = function () {
    document.documentElement.classList.add('theme-blackfriday');
    document.body.classList.add('theme-blackfriday');

    // Chispas Canvas
    initCyberSparksCanvas();
    // Ribete de esquina superior
    injectCornerRibbons();
    // Marca y Login
    decorateBrandAndAuth();
    // Topbar y Sonido
    injectTopbarElements();
    // Banner
    injectDashboardBanner();
    // Decorar todas las cajas (dashboard, historial, llamadas, parques, exportar)
    decorateCards();
    // Botón oficial Copilot Black Friday
    decorateCopilotFab();

    // Observador para cambios de vista o recarga de datos
    if (!window.__bfViewObserverAttached) {
      window.__bfViewObserverAttached = true;

      const originalSwitchView = window.switchView;
      if (typeof originalSwitchView === 'function') {
        window.switchView = function (...args) {
          const res = originalSwitchView.apply(this, args);
          if (soundEnabled) {
            playBfSound('whoosh');
          }
          setTimeout(() => {
            if (document.body.classList.contains('theme-blackfriday')) {
              injectDashboardBanner();
              decorateCards();
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
            if (document.body.classList.contains('theme-blackfriday')) {
              injectDashboardBanner();
              decorateCards();
            }
          }, 80);
          return res;
        };
      }
    }
  };

  window.destroyBlackFridayTheme = function () {
    document.documentElement.classList.remove('theme-blackfriday');
    document.body.classList.remove('theme-blackfriday');

    soundEnabled = false;

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    destroyCyberSparksCanvas();

    const idsToRemove = [
      'bf-sparks-canvas',
      'bf-corner-ribbon-left',
      'bf-corner-ribbon-right',
      'bf-topbar-pill',
      'bf-sound-toggle',
      'bf-dashboard-banner'
    ];

    idsToRemove.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    document.querySelectorAll('.bf-brand-tag, .bf-auth-card-badge, .bf-card-badge, .bf-copilot-wrap').forEach((el) => {
      el.remove();
    });

    const copilotLabel = document.querySelector('#copilot-fab .copilot-fab-label');
    if (copilotLabel) {
      copilotLabel.textContent = 'Copilot';
    }
  };

})();
