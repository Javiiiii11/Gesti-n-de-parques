/* ============================================================================
   app.js â€” arranque de la aplicaciÃ³n, enrutado de vistas y UI global
============================================================================ */

const VIEW_TITLES = {
  'dashboard': 'Dashboard',
  'venta-rapida': 'Registrar venta',
  'historial': 'Historial de ventas',
  'contactos': 'Apuntes / Contactos',
  'notas-rapidas': 'Notas rÃ¡pidas',
  'cuadrante': 'Mi cuadrante',
  'llamadas': 'Llamadas',
  'horarios': 'Horarios y Archivos',
  'parques': 'Parques / Bonos',
  'estadisticas': 'EstadÃ­sticas',
  'exportar': 'Exportar / Importar',
  'chat-ia': 'Chat IA',
};

function switchView(viewId) {
  // Bloquear acceso directo a parques sin contraseÃ±a
  if (viewId === 'parques' && sessionStorage.getItem('parksales_parques_unlocked') !== '1') {
    viewId = 'dashboard';
  }

  // Con el modo editor del cuadrante activo no se puede salir de la pantalla
  // sin pasar por la confirmaciÃ³n (que muestra los cambios hechos).
  if (typeof cuadEditorMode !== 'undefined' && cuadEditorMode && viewId !== 'cuadrante') {
    const currentView = document.querySelector('.view.active')?.id?.replace('view-', '');
    if (currentView === 'cuadrante' && typeof cuadConfirmLeaveEditor === 'function') {
      cuadConfirmLeaveEditor(() => switchView(viewId));
      return; // No cambiar de vista aÃºn
    }
  }

  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === viewId));
  document.getElementById('topbar-title').textContent = VIEW_TITLES[viewId] || 'ParkSales';
  closeSidebarMobile();
  window.scrollTo({ top: 0 });
  window.location.hash = viewId;

  if (viewId === 'dashboard') requestAnimationFrame(renderDashboard);
  if (viewId === 'venta-rapida') updateTicketPreview();
  if (viewId === 'estadisticas') renderEstadisticas();
  if (viewId === 'contactos') renderContactos();
  if (viewId === 'llamadas') {
    initLlamadasView();
    if (typeof markCallsAlertAsRead === 'function') markCallsAlertAsRead();
  }
  if (viewId === 'horarios') initHorarios();
  if (viewId === 'cuadrante' && typeof cuadOnView === 'function') cuadOnView();
  if (viewId === 'notas-rapidas') {
    const txt = document.getElementById('notas-rapidas-textarea');
    if (txt) txt.focus();
  }
}

function wireSidebarNav() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
}

function wireMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  document.getElementById('menu-toggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  });
  overlay.addEventListener('click', closeSidebarMobile);
}
function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

function wireThemeToggle() {
  const saved = localStorage.getItem('parksales_theme');
  if (saved === 'light') document.body.classList.add('light-mode');
  document.getElementById('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('parksales_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    renderDashboard();
    if (document.getElementById('view-estadisticas').classList.contains('active')) renderEstadisticas();
  });
}

function wireGlobalSearch() {
  document.getElementById('global-search').addEventListener('input', debounce((e) => {
    const q = e.target.value.trim();
    if (!q) return;
    switchView('historial');
    document.getElementById('hist-search').value = q;
    HIST_STATE.search = q.toLowerCase();
    HIST_STATE.page = 1;
    renderHistorial();
  }, 300));
}

function setUserChip(user) {
  const name = getUserDisplayName(user);
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role').textContent = user.email || '';

  const avatarEl = document.getElementById('user-avatar');
  if (!avatarEl) return;

  avatarEl.classList.add('ps-avatar', 'ps-avatar--chip');
  const candidates = getUserAvatarCandidates(user);
  const initials = escapeHtml(getUserInitials(user));

  if (candidates.length) {
    avatarEl.innerHTML = `
      <img class="ps-avatar-img" src="${escapeHtml(candidates[0])}" alt="" decoding="async" referrerpolicy="no-referrer" data-fallbacks="${escapeHtml(JSON.stringify(candidates.slice(1)))}" onerror="window.__psAvatarFallback && window.__psAvatarFallback(this)">
      <span class="ps-avatar-initials" hidden>${initials}</span>
    `;
  } else {
    avatarEl.innerHTML = `<span class="ps-avatar-initials">${initials}</span>`;
  }
}

// bootApp puede recibir mÃ¡s de una invocaciÃ³n durante el arranque de sesiÃ³n
// (login manual + evento onAuthStateChange de Supabase casi simultÃ¡neos).
// APP_BOOTED evita que la fase de "cableado" de listeners (initVentaForm,
// initHistorialView, etc.) se ejecute mÃ¡s de una vez, ya que cada llamada
// aÃ±ade nuevos listeners sin quitar los anteriores: si se cableaban dos
// veces, cada clic en "Guardar venta" disparaba guardarVenta() dos veces
// y la venta quedaba duplicada en la base de datos.
let APP_BOOTED = false;

async function bootApp(user) {
  STATE.currentUser = user;
  document.getElementById('auth-screen').style.display = 'none';

  try {
    if (typeof restoreMirroredData === 'function') {
      await restoreMirroredData();
    }
    STATE.parques = await DB.getParques();
    STATE.tipos_bono = await DB.getTiposBono();
    STATE.contactos = await DB.getContactos();
    STATE.ventas = await DB.getVentas();
    STATE.objetivosMensuales = await DB.getObjetivosMensuales();
    if (typeof migrateLegacyMonthlyGoal === 'function') {
      await migrateLegacyMonthlyGoal();
    }
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error', 6000);
  }


  setUserChip(user);

  // Cada paso de inicializaciÃ³n va protegido: un fallo puntual (p. ej. que
  // una librerÃ­a externa como Chart.js no haya cargado por falta de red)
  // no debe impedir que el resto de la aplicaciÃ³n quede utilizable.
  const safe = (fn, label) => { try { fn(); } catch (err) { console.error(`Error inicializando ${label}:`, err); } };

  if (APP_BOOTED) {
    // Ya se cablearon los listeners antes: solo refrescamos datos y vistas,
    // sin volver a llamar a initVentaForm/initHistorialView/etc.
    safe(fillParqueSelects, 'selects de parques');
    safe(fillBonoSelects, 'selects de bonos');
    safe(renderParquesTable, 'tabla de parques');
    safe(renderBonosTable, 'tabla de bonos');
    safe(renderHistorial, 'renderizado de historial');
    safe(renderDashboard, 'renderizado de dashboard');
    safe(renderContactos, 'renderizado de contactos');
    document.getElementById('app').classList.add('ready');
    return;
  }
  APP_BOOTED = true;

  safe(fillParqueSelects, 'selects de parques');
  safe(fillBonoSelects, 'selects de bonos');
  safe(renderParquesTable, 'tabla de parques');
  safe(renderBonosTable, 'tabla de bonos');
  safe(initVentaForm, 'formulario de venta');
  safe(initHistorialView, 'vista de historial');
  safe(initEstadisticasView, 'vista de estadÃ­sticas');
  safe(initExportView, 'vista de exportaciÃ³n');
  safe(initAutoBackup, 'copia de seguridad automÃ¡tica');
  safe(wireParquesView, 'vista de parques');
  safe(wireContactosView, 'vista de contactos');
  safe(initNotasRapidas, 'bloc de notas rÃ¡pidas');
  safe(initLlamadasView, 'vista de llamadas');
  safe(initHorarios, 'vista de horarios');
  safe(initPomodoro, 'temporizador y pendientes');
  safe(initChatIA, 'Chat IA');
  safe(checkAndAutoCompleteFlexibles, 'auto-completado de flexibles');
  safe(renderHistorial, 'renderizado de historial');
  safe(renderContactos, 'renderizado de contactos');
  safe(renderDashboard, 'renderizado de dashboard');

  // Comprobar periÃ³dicamente si han llegado fechas de visitas flexibles (cada 30 min)
  setInterval(() => safe(checkAndAutoCompleteFlexibles, 'verificaciÃ³n periÃ³dica flexibles'), 30 * 60 * 1000);

  document.getElementById('app').classList.add('ready');

  const hashView = window.location.hash.replace('#', '');
  switchView(VIEW_TITLES[hashView] ? hashView : 'dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
  // ComprobaciÃ³n de seguridad por PC / dispositivo
  // (solo se detiene si el PC no estÃ¡ autorizado; un bloqueo temporal de
  //  inactividad NO impide arrancar la app, para que la sesiÃ³n se recuerde)
  if (window.SEGURIDAD_PC && window.SEGURIDAD_PC.pcAutorizado === false) {
    console.warn('[ParkSales] InicializaciÃ³n detenida: PC no autorizado.');
    return;
  }

  initAuthScreen();
  wireLogout();
  if (typeof wireAuthState === 'function') wireAuthState();
  wireSidebarNav();
  wireMobileSidebar();
  wireThemeToggle();
  if (typeof wireMusicToggle === 'function') wireMusicToggle();
  if (typeof initCalculator === 'function') initCalculator();
  wireGlobalSearch();

  initTopbarPomo();
  setupSessionTimeout();

  const savedTheme = localStorage.getItem('parksales_theme');
  if (savedTheme === 'light') document.body.classList.add('light-mode');

  checkExistingSession();
});

function initTopbarPomo() {
  const wrap = document.getElementById('topbar-pomo');
  if (!wrap || wrap.dataset.wired === '1') return;
  wrap.dataset.wired = '1';

  const expandBtn = document.getElementById('tp-expand');

  function togglePomoMenu(force) {
    const next = typeof force === 'boolean' ? force : !wrap.classList.contains('open');
    wrap.classList.toggle('open', next);
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePomoMenu();
    });
  }

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) togglePomoMenu(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') togglePomoMenu(false);
  });
}

/* -------------------------------------------------------------------------- */
/* SESSION TIMEOUT — bloquea la web (404 igual que Alt+B) por inactividad     */
/* -------------------------------------------------------------------------- */

// ⚙️ CONFIGURACIÓN DEL BLOQUEO POR INACTIVIDAD
// true  = si no usas la web durante el tiempo indicado, se bloquea con el 404
// false = nunca se bloquea por inactividad (tampoco al recargar la página)
const BLOQUEO_INACTIVIDAD_ACTIVO = true;
// Segundos sin actividad (ratón, teclado, clic, táctil, scroll) antes de bloquear
const BLOQUEO_INACTIVIDAD_SEGUNDOS = 60;

function setupSessionTimeout() {
  if (!BLOQUEO_INACTIVIDAD_ACTIVO) return;
  if (window.__sessionTimeoutWired) return;
  window.__sessionTimeoutWired = true;

<<<<<<< HEAD
  const INACTIVITY_TIMEOUT = 60 * 1000; // 60 segundos
=======
  const INACTIVITY_TIMEOUT = Math.max(1, Number(BLOQUEO_INACTIVIDAD_SEGUNDOS) || 30) * 1000;
>>>>>>> 0efb120c2584851c06d3d1def2e6baf11d92543f
  let lastActivity = Date.now();
  let armed = false;

  function estaBloqueado() {
    return document.documentElement.classList.contains('pc-bloqueado');
  }

  function bloquearPorInactividad() {
    if (estaBloqueado()) return;
    if (window.PARKSALES_PANICO && typeof window.PARKSALES_PANICO.activar === 'function') {
      window.PARKSALES_PANICO.activar();
    } else {
      // Respaldo si el módulo de seguridad no está disponible
      document.documentElement.classList.add('pc-bloqueado');
      document.title = '404 - File not found';
    }
  }

  function marcarActividad() {
    lastActivity = Date.now();
  }

  function armar() {
    if (armed) return;
    armed = true;
    lastActivity = Date.now();
    // Si la página viene de una recarga, se bloquea al instante (a menos que estemos fuera de la oficina).
    const fueraOficina = localStorage.getItem('parksales_fuera_oficina') === 'true';
    if (esRecargaDePagina() && !fueraOficina) {
      bloquearPorInactividad();
    }
  }

  // El temporizador solo empieza cuando la app está cargada (usuario dentro)
  const appEl = document.getElementById('app');
  function intentarArmar() {
    if (appEl && appEl.classList.contains('ready')) {
      armar();
      return true;
    }
    return false;
  }

  if (!intentarArmar() && appEl) {
    const obsReady = new MutationObserver(() => {
      if (intentarArmar()) obsReady.disconnect();
    });
    obsReady.observe(appEl, { attributes: true, attributeFilter: ['class'] });
  }

  // Comprobación periódica robusta: si pasan los segundos configurados sin actividad, se bloquea
  setInterval(() => {
    if (!armed || estaBloqueado()) return;

    // Si el modo "Fuera de oficina" está activo, no bloquear nunca
    const fueraOficina = localStorage.getItem('parksales_fuera_oficina') === 'true';
    if (fueraOficina) return;

    if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT) {
      bloquearPorInactividad();
    }
  }, 1000);

  // Al desbloquearse (Alt+B), reiniciar el contador
  const obsDoc = new MutationObserver(() => {
    if (!estaBloqueado()) lastActivity = Date.now();
  });
  obsDoc.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
  events.forEach((event) => {
    document.addEventListener(event, marcarActividad, { passive: true });
  });

  const originalSwitchView = window.switchView;
  if (originalSwitchView) {
    window.switchView = function(viewId) {
      marcarActividad();
      return originalSwitchView.apply(this, arguments);
    };
  }
}

/* Detects a browser reload (F5 / Ctrl+R / refresh button) */
function esRecargaDePagina() {
  try {
    // La recarga automática de normalización (para quitar el POST) no cuenta
    if (sessionStorage.getItem('parksales_normalizing') === '1') {
      sessionStorage.removeItem('parksales_normalizing');
      return false;
    }
  } catch (e) { /* ignore */ }
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav) return nav.type === 'reload';
    if (performance.navigation) return performance.navigation.type === 1; // legacy: TYPE_RELOAD
  } catch (e) { /* ignore */ }
  return false;
}

/* -------------------------------------------------------------------------- */
/* COPILOT FLOTANTE â€” abre Microsoft Copilot en ventana popup centrada        */
/* -------------------------------------------------------------------------- */

function abrirCopilot() {
  const url = 'https://m365.cloud.microsoft/chat/';
  const w = 820;
  const h = 660;
  const left = Math.round((screen.width  - w) / 2);
  const top  = Math.round((screen.height - h) / 2);
  const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no`;

  const popup = window.open(url, 'copilot-popup', features);

  // Si el navegador bloqueÃ³ el popup, abrir en pestaÃ±a nueva como fallback
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    toast('ðŸ’¡ Activa las ventanas emergentes para una mejor experiencia con Copilot.', 'info', 4000);
  }
}
