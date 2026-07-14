/* ============================================================================
   auth.js — acceso por contraseña local con cookie de 1 día
   La contraseña se compara localmente. Cambia APP_PASSWORD para establecer
   tu contraseña de acceso.
============================================================================ */

const APP_PASSWORD = 'javier11'; // ← Cambia esto por tu contraseña
const COOKIE_NAME = 'parksales_auth';
const COOKIE_DAYS = 1;

/* ---- helpers de cookie ---- */

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function isCookieValid() {
  return getCookie(COOKIE_NAME) === 'ok';
}

/* ---- inicialización ---- */

function initAuthScreen() {
  const form = document.getElementById('auth-form');
  const errorBox = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    const password = document.getElementById('auth-password').value;
    const remember = document.getElementById('auth-remember').checked;

    if (password !== APP_PASSWORD) {
      errorBox.textContent = 'Contraseña incorrecta. Inténtalo de nuevo.';
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-password').focus();
      return;
    }

    if (remember) {
      setCookie(COOKIE_NAME, 'ok', COOKIE_DAYS);
    }

    enterApp();
  });
}

function enterApp() {
  // Arranca la app usando el modo local (sin Supabase) o con Supabase si está configurado
  const user = SUPABASE_CONFIGURED
    ? null   // Si hay Supabase, dejamos que checkExistingSession maneje la sesión real
    : AUTH.enterGuestMode();

  if (user) {
    bootApp(user);
    return;
  }

  // Si Supabase está configurado, intentamos recuperar la sesión existente
  // o iniciamos como invitado local
  AUTH.getCurrentUser().then((u) => {
    bootApp(u || AUTH.enterGuestMode());
  }).catch(() => {
    bootApp(AUTH.enterGuestMode());
  });
}

async function checkExistingSession() {
  // 1. Si la cookie de 1 día es válida, entramos directamente
  if (isCookieValid()) {
    enterApp();
    return;
  }
  // 2. Sin cookie válida → mostramos el formulario de contraseña
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres cerrar sesión? Se borrará la cookie de acceso.',
      confirmLabel: 'Cerrar sesión',
      onConfirm: async () => {
        deleteCookie(COOKIE_NAME);
        await AUTH.signOut().catch(() => { });
        window.location.reload();
      },
    });
  });
}

function wireAuthState() {
  // No hay escucha de estado OAuth — se maneja todo por contraseña local
}
