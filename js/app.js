/* ============================================================================
   app.js — arranque de la aplicación, enrutado de vistas y UI global
============================================================================ */

const VIEW_TITLES = {
  'dashboard': 'Dashboard',
  'venta-rapida': 'Registrar venta',
  'historial': 'Historial de ventas',
  'contactos': 'Apuntes / Contactos',
  'notas-rapidas': 'Notas rápidas',
  'llamadas': 'Llamadas',
  'horarios': 'Horarios y Promociones',
  'parques': 'Parques / Bonos',
  'estadisticas': 'Estadísticas',
  'exportar': 'Exportar / Importar',
  'chat-ia': 'Chat IA',
};

function switchView(viewId) {
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
  if (viewId === 'llamadas') initLlamadasView();
  if (viewId === 'horarios') initHorarios();
  if (viewId === 'notas-rapidas') {
    const txt = document.getElementById('notas-rapidas-textarea');
    if (txt) txt.focus();
  }
}

function wireSidebarNav() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  document.getElementById('quick-add-btn').addEventListener('click', () => switchView('venta-rapida'));
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
  const name = user.name || (user.email ? user.email.split('@')[0] : 'Usuario');
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-role').textContent = LOCAL_MODE ? 'Modo local' : (user.email || '');
  document.getElementById('user-avatar').textContent = name.slice(0, 1).toUpperCase();
}

// bootApp puede recibir más de una invocación durante el arranque de sesión
// (login manual + evento onAuthStateChange de Supabase casi simultáneos).
// APP_BOOTED evita que la fase de "cableado" de listeners (initVentaForm,
// initHistorialView, etc.) se ejecute más de una vez, ya que cada llamada
// añade nuevos listeners sin quitar los anteriores: si se cableaban dos
// veces, cada clic en "Guardar venta" disparaba guardarVenta() dos veces
// y la venta quedaba duplicada en la base de datos.
let APP_BOOTED = false;

async function bootApp(user) {
  STATE.currentUser = user;
  document.getElementById('auth-screen').style.display = 'none';

  try {
    if (!DB || typeof DB.getTiposBono !== 'function') {
      throw new Error('DB.getTiposBono is not a function. (DB=' + String(typeof DB) + ')');
    }

    STATE.parques = await DB.getParques();
    STATE.tipos_bono = await DB.getTiposBono();
    STATE.contactos = await DB.getContactos();
    STATE.ventas = await DB.getVentas();
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error', 6000);
  }


  setUserChip(user);

  // Cada paso de inicialización va protegido: un fallo puntual (p. ej. que
  // una librería externa como Chart.js no haya cargado por falta de red)
  // no debe impedir que el resto de la aplicación quede utilizable.
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
  safe(initEstadisticasView, 'vista de estadísticas');
  safe(initExportView, 'vista de exportación');
  safe(initAutoBackup, 'copia de seguridad automática');
  safe(wireParquesView, 'vista de parques');
  safe(wireContactosView, 'vista de contactos');
  safe(initNotasRapidas, 'bloc de notas rápidas');
  safe(initLlamadasView, 'vista de llamadas');
  safe(initHorarios, 'vista de horarios');
  safe(initPomodoro, 'temporizador y pendientes');
  safe(initChatIA, 'Chat IA');
  safe(renderHistorial, 'renderizado de historial');
  safe(renderContactos, 'renderizado de contactos');
  safe(renderDashboard, 'renderizado de dashboard');

  document.getElementById('app').classList.add('ready');

  const hashView = window.location.hash.replace('#', '');
  switchView(VIEW_TITLES[hashView] ? hashView : 'dashboard');
}

document.addEventListener('DOMContentLoaded', () => {
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
/* COPILOT FLOTANTE — abre Microsoft Copilot en ventana popup centrada        */
/* -------------------------------------------------------------------------- */

function abrirCopilot() {
  const url = 'https://m365.cloud.microsoft/chat/';
  const w = 820;
  const h = 660;
  const left = Math.round((screen.width  - w) / 2);
  const top  = Math.round((screen.height - h) / 2);
  const features = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no`;

  const popup = window.open(url, 'copilot-popup', features);

  // Si el navegador bloqueó el popup, abrir en pestaña nueva como fallback
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    toast('💡 Activa las ventanas emergentes para una mejor experiencia con Copilot.', 'info', 4000);
  }
}
