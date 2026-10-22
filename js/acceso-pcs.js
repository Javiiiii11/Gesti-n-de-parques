/* ============================================================================
   acceso-pcs.js — Control de acceso por PC, Camuflaje 404 y Modo Sigilo (Stealth)
   ============================================================================
   1. CAMUFLAJE 404: Si no estás autorizado, muestra un error 404 de GitHub Pages.
   2. ATAJO ACCESO (404): 5 clics seguidos en "404" (o Ctrl+Shift+A / ?acceso).
   3. BOTÓN DE PÁNICO RÁPIDO:
      - Alt + B  (o Alt + X / Ctrl + Shift + B) -> Bloquea la web al instante con 404
      - Vuelve a pulsar Alt + B para desbloquearla y volver a ParkSales al instante.
   4. ATAJOS SIGILO (Ventanas mini ultra discretas con auto-cierre en 10s):
      - Alt + V (o Ctrl + Shift + V) -> Añadir nueva venta rápida
      - Alt + P (o Ctrl + Shift + P) -> Aro de porcentaje de objetivo
      - Alt + H (o Ctrl + Shift + H) -> Lo vendido hoy
      - Escape -> Cerrar panel inmediatamente
   ============================================================================ */

const CONFIG_ACCESO_PC = {
  // 💻 LISTA DE IDENTIFICADORES DE PCs AUTORIZADOS:
  // Pega aquí los códigos de los ordenadores que tienen permiso para ver y usar la web:
  PCS_AUTORIZADOS: [
    'PC-58FD-A74C', // PC torre casa
    // NO FUNCIONA SOLUCIONAR **********************************
  ],

  // 🔑 CLAVE MAESTRA DE DESBLOQUEO:
  CLAVE_MAESTRA: 'parksales2026',

  // 🕵️ MODO CAMUFLAJE ERROR 404:
  // true = Si no está autorizado, muestra una página de error 404 de GitHub Pages.
  MODO_CAMUFLAJE_404: true,

  // 🛠️ Permitir acceso directo en desarrollo local (localhost / 127.0.0.1)
  PERMITIR_LOCALHOST: false,
};

// ============================================================================
// LÓGICA DE DETECCIÓN Y CAMUFLAJE
// ============================================================================

(function () {
  const STORAGE_KEY_AUTH = 'parksales_pc_autorizado';
  const STORAGE_KEY_CUSTOM_ID = 'parksales_pc_alias';
  const STORAGE_KEY_PANIC = 'parksales_bloqueo_panico';

  // 1. Generar huella digital única y estable del PC
  function calcularIdPC() {
    try {
      const datos = [
        navigator.userAgent || '',
        screen.width + 'x' + screen.height + 'x' + (screen.colorDepth || 24),
        navigator.hardwareConcurrency || 'cpu',
        navigator.deviceMemory || 'ram',
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        navigator.language || '',
      ];

      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            datos.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
          }
        }
      } catch (e) { }

      const texto = datos.join('###');
      let h1 = 5381;
      let h2 = 52711;
      for (let i = 0; i < texto.length; i++) {
        const c = texto.charCodeAt(i);
        h1 = ((h1 * 33) ^ c) >>> 0;
        h2 = ((h2 * 33) ^ c) >>> 0;
      }

      const s1 = h1.toString(16).toUpperCase().padStart(8, '0');
      const s2 = h2.toString(16).toUpperCase().padStart(8, '0');
      return 'PC-' + s1.slice(0, 4) + '-' + s2.slice(0, 4);
    } catch (err) {
      return 'PC-GENERIC-DEVICE';
    }
  }

  const pcId = calcularIdPC();

  // 2. Comprobar si el PC está en la lista de autorizados
  function verificarAutorizacion() {
    // Si ya está autorizado en esta sesión por clave maestra, permitir
    try {
      if (localStorage.getItem(STORAGE_KEY_AUTH) === 'autorizado_maestro') return true;
    } catch(e){}

    if (CONFIG_ACCESO_PC.PERMITIR_LOCALHOST) {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:') {
        return true;
      }
    }

    const currentId = pcId.toUpperCase().trim();
    const listaNormalizada = (CONFIG_ACCESO_PC.PCS_AUTORIZADOS || [])
      .map(id => String(id || '').trim().toUpperCase())
      .filter(id => id.length > 0);

    // DEBUG: Log para ayudar al usuario a ver su ID real
    console.log('[ParkSales] ID detectado:', currentId);
    console.log('[ParkSales] IDs autorizados:', listaNormalizada);

    if (listaNormalizada.includes(currentId)) {
      return true;
    }

    try {
      const guardado = localStorage.getItem(STORAGE_KEY_AUTH);
      if (guardado === 'autorizado_' + currentId) {
        return true;
      }
      const aliasGuardado = localStorage.getItem(STORAGE_KEY_CUSTOM_ID);
      if (aliasGuardado && listaNormalizada.includes(aliasGuardado.toUpperCase().trim())) {
        return true;
      }
    } catch (e) { }

    return false;
  }

  const estaAutorizado = verificarAutorizacion();
  const hayBloqueoPanico = sessionStorage.getItem(STORAGE_KEY_PANIC) === '1';

  // Exponer objeto global para inspección
  window.SEGURIDAD_PC = {
    id: pcId,
    // true si el PC está en la lista blanca (independientemente del bloqueo temporal)
    pcAutorizado: estaAutorizado,
    autorizado: estaAutorizado && !hayBloqueoPanico,
    desautorizarEstePC: function () {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_CUSTOM_ID);
      sessionStorage.removeItem(STORAGE_KEY_PANIC);
      window.location.reload();
    }
  };

  // API pública del botón de pánico (mismo bloqueo 404 que Alt+B)
  window.PARKSALES_PANICO = {
    activar: function () { activarPanico(); },
    desactivar: function () { desactivarPanico(); },
    toggle: function () { togglePanico(); },
    activo: function () { return sessionStorage.getItem(STORAGE_KEY_PANIC) === '1'; }
  };

  // Inyectar siempre los estilos de bloqueo y modo sigilo para que el pánico sea instantáneo
  const estiloCamuflaje = document.createElement('style');
  estiloCamuflaje.id = 'pc-lock-styles';
  estiloCamuflaje.textContent = `
    html.pc-bloqueado, html.pc-bloqueado body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #24292f !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif !important;
      height: 100% !important;
      overflow: auto !important;
    }
    html.pc-bloqueado body > *:not(#pc-camouflage-root):not(#stealth-panel-overlay) {
      display: none !important;
    }

    #pc-camouflage-root {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 85vh;
      padding: 32px 16px;
      box-sizing: border-box;
      text-align: center;
    }
    .gh-404-box {
      max-width: 600px;
      margin: 0 auto;
    }
    .gh-404-logo {
      margin-bottom: 24px;
      color: #24292f;
    }
    .gh-404-title {
      font-size: 72px;
      font-weight: 700;
      line-height: 1;
      margin: 0 0 16px 0;
      color: #24292f;
      cursor: default;
      user-select: none;
    }
    .gh-404-subtitle {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #24292f;
    }
    .gh-404-text {
      font-size: 14px;
      line-height: 1.6;
      color: #57606a;
      margin: 0 0 24px 0;
    }
    .gh-404-text a {
      color: #0969da;
      text-decoration: none;
    }
    .gh-404-text a:hover {
      text-decoration: underline;
    }

    #pc-secret-modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      z-index: 9999999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
      color: #f1f5f9;
    }
    #pc-secret-modal.visible {
      display: flex;
    }
    .pc-secret-card {
      width: 100%;
      max-width: 440px;
      background: #111a2e;
      border: 1px solid #23354d;
      border-radius: 14px;
      padding: 24px 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: left;
      position: relative;
    }
    .pc-secret-close {
      position: absolute;
      top: 14px;
      right: 14px;
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
    }
    .pc-secret-close:hover { color: #ffffff; }
    .pc-secret-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .pc-secret-icon { font-size: 22px; }
    .pc-secret-title { font-size: 16px; font-weight: 700; color: #ffffff; margin: 0; }
    .pc-secret-id-box {
      background: #090e18;
      border: 1px dashed #334e68;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .pc-secret-id-code {
      font-family: ui-monospace, Consolas, monospace;
      font-size: 16px;
      font-weight: 700;
      color: #FF9A44;
    }
    .pc-secret-copy-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    .pc-secret-copy-btn:hover { background: #334155; }
    .pc-secret-input-row { display: flex; gap: 8px; margin-top: 8px; }
    .pc-secret-input {
      flex: 1;
      background: #090e18;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 10px;
      color: #ffffff;
      font-size: 13px;
      outline: none;
    }
    .pc-secret-input:focus { border-color: #FF9A44; }
    .pc-secret-submit {
      background: linear-gradient(135deg, #FF9A44, #FC6076);
      border: none;
      border-radius: 6px;
      color: #ffffff;
      font-weight: 600;
      font-size: 12.5px;
      padding: 8px 14px;
      cursor: pointer;
    }
    .pc-secret-error { color: #ef4444; font-size: 11px; margin-top: 6px; display: none; }
  `;
  document.head.appendChild(estiloCamuflaje);

  // Iniciar siempre los atajos del modo sigilo y botón de pánico
  iniciarSistemaStealth();

  // Si no está autorizado O está en bloqueo de pánico: aplicar 404 de inmediato
  if (!estaAutorizado || hayBloqueoPanico) {
    aplicarBloqueoVisual404();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', montarCamuflaje);
    } else {
      montarCamuflaje();
    }
    return;
  }

  // Si está autorizado y no hay pánico:
  console.log('%c[ParkSales] PC autorizado: ' + pcId, 'color: #22c55e; font-weight: bold;');
  document.addEventListener('DOMContentLoaded', () => {
    const pcLabel = document.getElementById('user-menu-pc-id');
    if (pcLabel) pcLabel.textContent = pcId;
  });

  // ============================================================================
  // FUNCIONES DE BLOQUEO Y DESBLOQUEO RÁPIDO (BOTÓN DE PÁNICO)
  // ============================================================================
  function aplicarBloqueoVisual404() {
    document.title = '404 - File not found';
    const iconLink = document.querySelector('link[rel*="icon"]');
    if (iconLink) iconLink.setAttribute('href', 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>');
    document.documentElement.classList.add('pc-bloqueado');
  }

  function restaurarVisualApp() {
    document.title = 'ParkSales · Gestión de ventas de entradas';
    const iconLink = document.querySelector('link[rel*="icon"]');
    if (iconLink) {
      iconLink.setAttribute('href', 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 34 34%22><defs><linearGradient id=%22l%22 x1=%220%22 y1=%220%22 x2=%2234%22 y2=%2234%22><stop offset=%220%%22 stop-color=%22%23FF9A44%22/><stop offset=%22100%%22 stop-color=%22%23FC6076%22/></linearGradient></defs><rect width=%2234%22 height=%2234%22 rx=%2210%22 fill=%22url(%23l)%22/><circle cx=%2217%22 cy=%2217%22 r=%227%22 stroke=%22white%22 stroke-width=%222%22 stroke-dasharray=%223 3%22/><circle cx=%2217%22 cy=%2217%22 r=%223%22 fill=%22white%22/><path d=%22M17 17 L22 27 M17 17 L12 27%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22/></svg>');
    }
    document.documentElement.classList.remove('pc-bloqueado');
  }

  // Activa el bloqueo 404 al instante (0ms)
  function activarPanico() {
    try { sessionStorage.setItem(STORAGE_KEY_PANIC, '1'); } catch (e) { }
    aplicarBloqueoVisual404();
    montarCamuflaje();
    const camRoot = document.getElementById('pc-camouflage-root');
    if (camRoot) camRoot.style.display = 'flex';
    const secretModal = document.getElementById('pc-secret-modal');
    if (secretModal) secretModal.classList.remove('visible');
    const stealthOverlay = document.getElementById('stealth-panel-overlay');
    if (stealthOverlay) stealthOverlay.classList.remove('active');
    console.warn('[ParkSales] 🚨 BLOQUEO DE PÁNICO ACTIVADO (404)');
  }

  // Desactiva el bloqueo y vuelve a ParkSales si el PC está autorizado
  function desactivarPanico() {
    try { sessionStorage.removeItem(STORAGE_KEY_PANIC); } catch (e) { }
    if (estaAutorizado) {
      restaurarVisualApp();
      const camRoot = document.getElementById('pc-camouflage-root');
      if (camRoot) camRoot.style.display = 'none';
      console.log('[ParkSales] ✅ Bloqueo desactivado. Bienvenido.');
    } else {
      // Si el PC aún no está en la lista, abrir el modal de clave
      const secretModal = document.getElementById('pc-secret-modal');
      if (secretModal) secretModal.classList.add('visible');
    }
  }

  function togglePanico() {
    const estaEnPanico = sessionStorage.getItem(STORAGE_KEY_PANIC) === '1' || document.documentElement.classList.contains('pc-bloqueado');
    if (estaEnPanico) {
      desactivarPanico();
    } else {
      activarPanico();
    }
  }

  // Montar pantalla de camuflaje 404
  function montarCamuflaje() {
    if (document.getElementById('pc-camouflage-root')) return;

    const params = new URLSearchParams(window.location.search || '');
    const solicitaAccesoDirecto = params.has('acceso') || params.has('setup') || params.has('clave') || params.has('activar');

    const root = document.createElement('div');
    root.id = 'pc-camouflage-root';
    root.innerHTML = `
      <div class="gh-404-box">
        <div class="gh-404-logo" id="gh-404-logo">
          <svg height="40" viewBox="0 0 16 16" version="1.1" width="40" aria-hidden="true">
            <path fill="#24292f" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
        </div>
        <h1 class="gh-404-title" id="gh-404-trigger" title="">404</h1>
        <div class="gh-404-subtitle">There isn't a GitHub Pages site here.</div>
        <p class="gh-404-text">
          If you're trying to publish one, read the <a href="https://docs.github.com/pages" target="_blank" rel="noopener">full documentation</a> to learn how to set up GitHub Pages for your repository, or contact GitHub Support if you need help.
        </p>
      </div>

      <div id="pc-secret-modal" class="${solicitaAccesoDirecto ? 'visible' : ''}">
        <div class="pc-secret-card">
          <button type="button" class="pc-secret-close" id="pc-secret-close-btn">&times;</button>
          <div class="pc-secret-header">
            <span class="pc-secret-icon">🔒</span>
            <h3 class="pc-secret-title">Panel de Autorización de PC</h3>
          </div>

          <div class="pc-secret-id-box">
            <div>
              <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">ID de este PC</div>
              <span class="pc-secret-id-code">${pcId}</span>
            </div>
            <button type="button" class="pc-secret-copy-btn" id="pc-secret-copy">📋 Copiar ID</button>
          </div>

          <div>
            <label style="font-size: 11.5px; color: #94a3b8; font-weight: 600;">Clave:</label>
            <div class="pc-secret-input-row">
              <input type="password" id="pc-secret-pass" class="pc-secret-input" placeholder="Clave" autocomplete="off" />
              <button type="button" id="pc-secret-submit" class="pc-secret-submit">Autorizar</button>
            </div>
            <div id="pc-secret-err" class="pc-secret-error">Clave incorrecta.</div>
          </div>
        </div>
      </div>
    `;

    document.body.prepend(root);

    const modal = document.getElementById('pc-secret-modal');
    const closeBtn = document.getElementById('pc-secret-close-btn');
    const trigger404 = document.getElementById('gh-404-trigger');
    const triggerLogo = document.getElementById('gh-404-logo');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => { modal.classList.remove('visible'); });
    }

    function abrirPanelAutorizacion() {
      modal.classList.add('visible');
      const passInp = document.getElementById('pc-secret-pass');
      if (passInp) passInp.focus();
    }

    // Contador de clics reutilizable (5 clics en <600ms)
    function wireClickCounter(el, onFiveClicks) {
      if (!el) return;
      let count = 0;
      let timer = null;
      el.addEventListener('click', () => {
        count++;
        clearTimeout(timer);
        timer = setTimeout(() => { count = 0; }, 600);
        if (count >= 5) {
          count = 0;
          onFiveClicks();
        }
      });
    }

    // 404 x5 → SIEMPRE abre el Panel de Autorización de PC (para ver/copiar el ID)
    wireClickCounter(trigger404, abrirPanelAutorizacion);

    // Logo de GitHub x5 → comportamiento anterior: desbloquea si está autorizado,
    // si no, abre el panel para introducir la clave.
    wireClickCounter(triggerLogo, () => {
      if (estaAutorizado) {
        desactivarPanico();
      } else {
        abrirPanelAutorizacion();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (estaAutorizado) {
          desactivarPanico();
        } else {
          modal.classList.add('visible');
          const passInp = document.getElementById('pc-secret-pass');
          if (passInp) passInp.focus();
        }
      }
    });

    const copyBtn = document.getElementById('pc-secret-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(pcId).then(() => {
          copyBtn.textContent = '✓ ¡Copiado!';
          setTimeout(() => { copyBtn.textContent = '📋 Copiar ID'; }, 2000);
        }).catch(() => {
          prompt('Copia este identificador:', pcId);
        });
      });
    }

    const passInput = document.getElementById('pc-secret-pass');
    const submitBtn = document.getElementById('pc-secret-submit');
    const errBox = document.getElementById('pc-secret-err');

    function validarClave() {
      const val = (passInput.value || '').trim();
      if (!val) return;

      const claveConfig = String(CONFIG_ACCESO_PC.CLAVE_MAESTRA || '').trim();
      const listaNormalizada = (CONFIG_ACCESO_PC.PCS_AUTORIZADOS || []).map(id => String(id || '').trim().toUpperCase());

      if (val === claveConfig || listaNormalizada.includes(val.toUpperCase())) {
        try {
          localStorage.setItem(STORAGE_KEY_AUTH, 'autorizado_' + pcId);
          sessionStorage.removeItem(STORAGE_KEY_PANIC);
          if (listaNormalizada.includes(val.toUpperCase())) {
            localStorage.setItem(STORAGE_KEY_CUSTOM_ID, val.toUpperCase());
          }
        } catch (e) { }

        errBox.style.display = 'none';
        submitBtn.textContent = '✓ Autorizado';
        submitBtn.style.background = '#22c55e';
        setTimeout(() => {
          window.location.href = window.location.pathname;
        }, 500);
      } else {
        errBox.style.display = 'block';
        passInput.focus();
        passInput.select();
      }
    }

    if (submitBtn) submitBtn.addEventListener('click', validarClave);
    if (passInput) {
      passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validarClave();
        }
      });
    }
  }

  // ============================================================================
  // MODO SIGILO (STEALTH): Mini paneles flotantes con temporizador de 10 segundos
  // ============================================================================
  function iniciarSistemaStealth() {
    let stealthTimer = null;
    let secondsLeft = 10;
    let vistaActual = 'venta';

    const stealthStyle = document.createElement('style');
    stealthStyle.id = 'stealth-panel-styles';
    stealthStyle.textContent = `
      #stealth-panel-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(3px);
        z-index: 2147483646;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 12px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #stealth-panel-overlay.active {
        display: flex;
        animation: stealthFadeIn 0.15s ease-out;
      }
      @keyframes stealthFadeIn {
        from { opacity: 0; transform: scale(0.97); }
        to { opacity: 1; transform: scale(1); }
      }
      .stealth-card {
        width: 100%;
        max-width: 275px;
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 12px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
        overflow: hidden;
        position: relative;
        color: #e5e7eb;
        text-align: left;
      }
      .stealth-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px 10px;
        background: #0b0f19;
        border-bottom: 1px solid #1f2937;
      }
      .stealth-tabs {
        display: flex;
        gap: 3px;
      }
      .stealth-tab-btn {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 5px;
        color: #9ca3af;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 6px;
        cursor: pointer;
        line-height: 1;
        transition: all 0.15s;
      }
      .stealth-tab-btn:hover { color: #f3f4f6; }
      .stealth-tab-btn.active {
        background: #1f2937;
        color: #38bdf8;
        border-color: #374151;
      }
      .stealth-close-btn {
        background: transparent;
        border: none;
        color: #6b7280;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
        padding: 0 2px;
      }
      .stealth-close-btn:hover { color: #f3f4f6; }
      .stealth-body {
        padding: 12px 14px;
        font-size: 12px;
      }
      .stealth-timer-track {
        height: 2px;
        background: #1f2937;
        width: 100%;
        position: relative;
      }
      .stealth-timer-bar {
        height: 100%;
        background: #38bdf8;
        width: 100%;
        transition: width 0.1s linear;
      }
      .stealth-field {
        margin-bottom: 8px;
      }
      .stealth-label {
        display: block;
        font-size: 9.5px;
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 3px;
      }
      .stealth-input, .stealth-select {
        width: 100%;
        box-sizing: border-box;
        background: #1f2937;
        color: #f3f4f6;
        border: 1px solid #374151;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 12px;
        outline: none;
        transition: border-color 0.15s;
      }
      .stealth-input:focus, .stealth-select:focus {
        border-color: #38bdf8;
      }
      .stealth-btn-save {
        width: 100%;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 7px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 4px;
        transition: opacity 0.15s;
      }
      .stealth-btn-save:hover { opacity: 0.9; }
      .stealth-toast {
        color: #22c55e;
        font-size: 11px;
        text-align: center;
        margin-top: 6px;
        display: none;
        font-weight: 600;
      }
    `;
    document.head.appendChild(stealthStyle);

    function leerVentas() {
      if (window.STATE?.ventas?.length) return window.STATE.ventas;
      try {
        return JSON.parse(localStorage.getItem('parksales_ventas') || '[]');
      } catch (e) { return []; }
    }

    function leerParques() {
      if (window.STATE?.parques?.length) return window.STATE.parques;
      try {
        const p = JSON.parse(localStorage.getItem('parksales_parques') || '[]');
        if (p.length) return p;
      } catch (e) { }
      return [
        { id: 'parque_warner', nombre: 'Parque Warner' },
        { id: 'parque_atracciones', nombre: 'Parque de Atracciones' },
        { id: 'port_aventura', nombre: 'PortAventura' },
        { id: 'faunia', nombre: 'Faunia' },
        { id: 'zoo_madrid', nombre: 'Zoo Aquarium' },
        { id: 'selwo_marina', nombre: 'Selwo Marina' },
        { id: 'selwo_aventura', nombre: 'Selwo Aventura' },
        { id: 'teleferico_benalmadena', nombre: 'Teleférico' },
      ];
    }

    function leerObjetivoMes(mesKey) {
      if (window.STATE?.objetivosMensuales) {
        const item = window.STATE.objetivosMensuales.find(o => o.mes === mesKey);
        if (item && item.importe) return Number(item.importe);
      }
      try {
        const list = JSON.parse(localStorage.getItem('parksales_objetivos_mensuales') || '[]');
        const item = list.find(o => o.mes === mesKey);
        if (item && item.importe) return Number(item.importe);
      } catch (e) { }
      return 3500;
    }

    function fmtDinero(num) {
      return Number(num || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    function obtenerOverlay() {
      let overlay = document.getElementById('stealth-panel-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'stealth-panel-overlay';
        overlay.innerHTML = `
          <div class="stealth-card" id="stealth-card">
            <div class="stealth-header">
              <div class="stealth-tabs">
                <button type="button" class="stealth-tab-btn" data-tab="venta">+ Venta</button>
                <button type="button" class="stealth-tab-btn" data-tab="aro">% Aro</button>
                <button type="button" class="stealth-tab-btn" data-tab="hoy">Hoy</button>
              </div>
              <button type="button" class="stealth-close-btn" id="stealth-close">&times;</button>
            </div>
            <div class="stealth-body" id="stealth-body-content"></div>
            <div class="stealth-timer-track">
              <div class="stealth-timer-bar" id="stealth-timer-bar"></div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.stealth-tab-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cambiarVista(btn.dataset.tab);
            reiniciarTimer();
          });
        });

        document.getElementById('stealth-close').addEventListener('click', cerrarPanel);

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) cerrarPanel();
        });

        ['mousemove', 'mousedown', 'keydown', 'input', 'touchstart'].forEach(evt => {
          overlay.addEventListener(evt, reiniciarTimer);
        });
      }
      return overlay;
    }

    function reiniciarTimer() {
      secondsLeft = 10;
      const bar = document.getElementById('stealth-timer-bar');
      if (bar) bar.style.width = '100%';
    }

    function iniciarContador() {
      reiniciarTimer();
      clearInterval(stealthTimer);
      stealthTimer = setInterval(() => {
        secondsLeft -= 0.1;
        const bar = document.getElementById('stealth-timer-bar');
        if (bar) {
          const pct = Math.max(0, (secondsLeft / 10) * 100);
          bar.style.width = pct + '%';
        }
        if (secondsLeft <= 0) {
          cerrarPanel();
        }
      }, 100);
    }

    function cerrarPanel() {
      clearInterval(stealthTimer);
      const overlay = document.getElementById('stealth-panel-overlay');
      if (overlay) overlay.classList.remove('active');
    }

    function cambiarVista(tab) {
      vistaActual = tab;
      const overlay = obtenerOverlay();
      overlay.querySelectorAll('.stealth-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });

      const body = document.getElementById('stealth-body-content');
      if (tab === 'venta') renderVistaVenta(body);
      else if (tab === 'aro') renderVistaAro(body);
      else if (tab === 'hoy') renderVistaHoy(body);
    }

    function renderVistaVenta(container) {
      const parques = leerParques();
      const opcionesParques = parques.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

      container.innerHTML = `
        <form id="stealth-form-venta" onsubmit="return false;">
          <div class="stealth-field">
            <label class="stealth-label">Parque</label>
            <select id="stealth-parque" class="stealth-select">${opcionesParques}</select>
          </div>
          <div style="display: flex; gap: 6px;" class="stealth-field">
            <div style="flex: 1.1;">
              <label class="stealth-label">Importe (€)</label>
              <input type="number" step="0.01" min="0" id="stealth-importe" class="stealth-input" placeholder="0.00" required autocomplete="off" />
            </div>
            <div style="flex: 0.9;">
              <label class="stealth-label">Localizador</label>
              <input type="text" id="stealth-loc" class="stealth-input" placeholder="Opc." autocomplete="off" />
            </div>
          </div>
          <button type="submit" id="stealth-submit-venta" class="stealth-btn-save">Guardar venta</button>
          <div id="stealth-save-status" class="stealth-toast">✓ Venta guardada</div>
        </form>
      `;

      const inputImp = document.getElementById('stealth-importe');
      if (inputImp) setTimeout(() => inputImp.focus(), 60);

      const form = document.getElementById('stealth-form-venta');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const parqueId = document.getElementById('stealth-parque').value;
        const importe = parseFloat(document.getElementById('stealth-importe').value);
        const loc = (document.getElementById('stealth-loc').value || '').trim();
        const submitBtn = document.getElementById('stealth-submit-venta');
        const toastEl = document.getElementById('stealth-save-status');

        if (isNaN(importe) || importe <= 0) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando…';

        const nuevaVenta = {
          fecha: new Date().toISOString(),
          tipo: 'entrada',
          via: 'llamada',
          cliente_nombre: '',
          importe_total: importe,
          localizador: loc || null,
          estado: 'completado',
          parque_id: parqueId,
          bono_id: null
        };

        const nuevoContacto = {
          tipo: 'entrada',
          nombre_apellidos: '',
          correo: '',
          telefono: '',
          parque_id: parqueId,
          importe_total: importe,
          estado_pago: 'pagado',
          anotaciones: 'Venta rápida sigilo',
          localizador: loc || null
        };

        try {
          if (typeof DB !== 'undefined' && typeof DB.addVenta === 'function') {
            await DB.addVenta(nuevaVenta);
            if (typeof DB.addContacto === 'function') await DB.addContacto(nuevoContacto);
            if (window.STATE) {
              window.STATE.ventas = await DB.getVentas();
              window.STATE.contactos = await DB.getContactos();
            }
          } else {
            const vList = JSON.parse(localStorage.getItem('parksales_ventas') || '[]');
            vList.unshift({ id: 'v_' + Date.now(), created_at: new Date().toISOString(), ...nuevaVenta });
            localStorage.setItem('parksales_ventas', JSON.stringify(vList));
          }

          if (typeof refreshAllViewsAfterDataChange === 'function') {
            refreshAllViewsAfterDataChange();
          }

          toastEl.style.display = 'block';
          submitBtn.textContent = '✓ Guardado';
          submitBtn.style.background = '#22c55e';
          setTimeout(cerrarPanel, 700);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Error al guardar';
        }
      });
    }

    function renderVistaAro(container) {
      const hoy = new Date();
      const mesKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
      const objetivo = leerObjetivoMes(mesKey);
      const ventas = leerVentas();

      const ventasMes = ventas.filter(v => {
        if (!v.fecha) return false;
        return v.fecha.startsWith(mesKey) && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(v) : true);
      });
      const totalMes = ventasMes.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
      const pct = objetivo > 0 ? (totalMes / objetivo) * 100 : 0;

      const perimetro = 175.9;
      const pctClamped = Math.min(100, Math.max(0, pct));
      const offset = perimetro - (perimetro * pctClamped) / 100;
      const colorAro = pct >= 100 ? '#22c55e' : (pct >= 70 ? '#38bdf8' : '#FF9A44');

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 4px 0;">
          <div style="position: relative; width: 68px; height: 68px; margin-bottom: 8px;">
            <svg viewBox="0 0 70 70" style="width: 68px; height: 68px; transform: rotate(-90deg);">
              <circle cx="35" cy="35" r="28" fill="none" stroke="#1f2937" stroke-width="5" />
              <circle cx="35" cy="35" r="28" fill="none" stroke="${colorAro}" stroke-width="5"
                stroke-dasharray="${perimetro}" stroke-dashoffset="${offset}" stroke-linecap="round" />
            </svg>
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #f3f4f6;">
              ${pct.toFixed(1)}%
            </div>
          </div>
          <div style="width: 100%; border-top: 1px solid #1f2937; padding-top: 6px; font-size: 11px; line-height: 1.5; color: #9ca3af;">
            <div style="display: flex; justify-content: space-between;">
              <span>Llevas:</span>
              <strong style="color: #f3f4f6;">${fmtDinero(totalMes)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Meta:</span>
              <span>${fmtDinero(objetivo)}</span>
            </div>
          </div>
        </div>
      `;
    }

    function renderVistaHoy(container) {
      const hoy = new Date();
      const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      const ventas = leerVentas();

      const ventasHoy = ventas.filter(v => {
        if (!v.fecha) return false;
        const fechaVenta = v.fecha.split('T')[0];
        return fechaVenta === hoyStr && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(v) : true);
      });

      const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
      const entradasHoy = ventasHoy.reduce((acc, v) => {
        const ad = Number(v.entradas_adulto || 0);
        const ju = Number(v.entradas_junior || 0);
        const se = Number(v.entradas_senior || 0);
        const bon = v.tipo === 'bono' ? Number(v.cantidad_bonos || 1) : 0;
        return acc + (ad + ju + se + bon || 1);
      }, 0);

      const parques = leerParques();
      function getNombreParque(id) {
        const p = parques.find(item => item.id === id);
        return p ? p.nombre : 'General';
      }

      const ultimas3 = ventasHoy.slice(0, 3).map(v => {
        const hora = v.fecha ? new Date(v.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        return `
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #9ca3af; padding: 2px 0;">
            <span>${hora} · ${getNombreParque(v.parque_id)}</span>
            <strong style="color: #e5e7eb;">${fmtDinero(v.importe_total)}</strong>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div style="padding: 2px 0;">
          <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em;">Vendido hoy</div>
          <div style="font-size: 17px; font-weight: 700; color: #38bdf8; margin: 2px 0 4px;">${fmtDinero(totalHoy)}</div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
            ${ventasHoy.length} ${ventasHoy.length === 1 ? 'venta' : 'ventas'} · ${entradasHoy} entradas
          </div>
          ${ventasHoy.length > 0 ? `
            <div style="border-top: 1px solid #1f2937; padding-top: 5px;">
              ${ultimas3}
            </div>
          ` : `
            <div style="font-size: 11px; color: #6b7280; font-style: italic;">Sin ventas registradas hoy</div>
          `}
        </div>
      `;
    }

    function abrirPanel(tab) {
      const overlay = obtenerOverlay();
      overlay.classList.add('active');
      cambiarVista(tab);
      iniciarContador();
    }

    // ============================================================================
    // ESCUCHADOR GLOBAL DE TECLADO:
    // Alt + B (o Alt+X / Ctrl+Shift+B) -> 🚨 BOTÓN DE PÁNICO (Bloqueo/desbloqueo 404)
    // Alt + V (o Ctrl+Shift+V)        -> Venta rápida
    // Alt + P (o Ctrl+Shift+P)        -> Aro %
    // Alt + H (o Ctrl+Shift+H)        -> Hoy vendido
    // Escape                          -> Cerrar mini panel
    // ============================================================================
    window.addEventListener('keydown', (e) => {
      const key = (e.key || '').toLowerCase();

      // 1. 🚨 BOTÓN DE PÁNICO / BLOQUEO RÁPIDO 404:
      // Pulsa Alt + B  (o Alt + X  o  Ctrl + Shift + B / X)
      if ((e.altKey && (key === 'b' || key === 'x')) || (e.ctrlKey && e.shiftKey && (key === 'b' || key === 'x'))) {
        e.preventDefault();
        togglePanico();
        return;
      }

      // Escape: cerrar mini panel si está abierto
      if (e.key === 'Escape') {
        cerrarPanel();
        return;
      }

      // 2. Venta rápida: Alt + V  o  Ctrl + Shift + V
      if ((e.altKey && key === 'v') || (e.ctrlKey && e.shiftKey && key === 'v')) {
        e.preventDefault();
        abrirPanel('venta');
        return;
      }

      // 3. Aro %: Alt + P  o  Ctrl + Shift + P
      if ((e.altKey && key === 'p') || (e.ctrlKey && e.shiftKey && key === 'p')) {
        e.preventDefault();
        abrirPanel('aro');
        return;
      }

      // 4. Hoy vendido: Alt + H  o  Ctrl + Shift + H
      if ((e.altKey && key === 'h') || (e.ctrlKey && e.shiftKey && key === 'h')) {
        e.preventDefault();
        abrirPanel('hoy');
        return;
      }
    });
  }
})();
