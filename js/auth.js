/* ============================================================================
   auth.js — autenticación con Supabase por correo/contraseña e invitación
============================================================================ */

let inviteModalBound = false;
let appEnteredFromAuth = false;

const REMEMBERED_EMAIL_KEY = 'parksales_remembered_email';

function rememberEmail(email) {
  const clean = String(email || '').trim();
  if (!clean) return;
  try { localStorage.setItem(REMEMBERED_EMAIL_KEY, clean); } catch (err) { /* localStorage no disponible */ }
}

function getRememberedEmail() {
  try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch (err) { return ''; }
}

function getAuthElements() {
  return {
    form: document.getElementById('auth-form'),
    email: document.getElementById('auth-email'),
    password: document.getElementById('auth-password'),
    errorBox: document.getElementById('auth-error'),
    submitBtn: document.getElementById('auth-submit-btn'),
  };
}

function setAuthLoading(isLoading) {
  const { submitBtn, email, password } = getAuthElements();
  if (submitBtn) submitBtn.disabled = isLoading;
  if (email) email.disabled = isLoading;
  if (password) password.disabled = isLoading;
}

function showAuthError(message) {
  const { errorBox } = getAuthElements();
  if (errorBox) errorBox.textContent = message || '';
}

function clearAuthError() {
  showAuthError('');
}

function showInvitePasswordModal(email) {
  document.documentElement.classList.add('ps-invite-flow');
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';
  const backdrop = document.getElementById('invite-password-backdrop');
  if (backdrop) backdrop.classList.add('active');

  // El correo se coge automáticamente de la sesión de Supabase (sin
  // pedirlo al usuario) y se guarda en un campo oculto de tipo "username"
  // para que el gestor de contraseñas del navegador pueda ofrecer guardar
  // el correo junto con la contraseña nueva.
  if (email) {
    rememberEmail(email);
    const hiddenUsername = document.querySelector('#invite-password-form input[name="username"]');
    if (hiddenUsername) hiddenUsername.value = email;
  }
}

function hideInvitePasswordModal() {
  const backdrop = document.getElementById('invite-password-backdrop');
  if (backdrop) backdrop.classList.remove('active');
}

function exitInviteFlowUI() {
  AUTH.clearInviteFlow();
  document.documentElement.classList.remove('ps-invite-flow');
  hideInvitePasswordModal();
}

function wireInvitePasswordModal() {
  if (inviteModalBound) return;
  inviteModalBound = true;

  const form = document.getElementById('invite-password-form');
  const errorBox = document.getElementById('invite-password-error');
  const submitBtn = document.getElementById('invite-password-submit');
  const passwordInput = document.getElementById('invite-password');
  const confirmInput = document.getElementById('invite-password-confirm');

  if (!form || !errorBox || !submitBtn || !passwordInput || !confirmInput) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';

    const password = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    if (password.length < 6) {
      errorBox.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      errorBox.textContent = 'Las contraseñas no coinciden.';
      confirmInput.focus();
      return;
    }

    submitBtn.disabled = true;
    passwordInput.disabled = true;
    confirmInput.disabled = true;

    try {
      const user = await AUTH.updatePassword(password);
      exitInviteFlowUI();
      toast('Contraseña guardada. Bienvenido/a.', 'success');
      await enterApp(user);
    } catch (err) {
      errorBox.textContent = err?.message || 'No se pudo actualizar la contraseña.';
    } finally {
      submitBtn.disabled = false;
      passwordInput.disabled = false;
      confirmInput.disabled = false;
    }
  });
}

function initAuthScreen() {
  const { form, email, password } = getAuthElements();
  wireInvitePasswordModal();
  if (!form || !email || !password) return;

  // Precarga el correo completo recordado de un inicio de sesión anterior,
  // así el usuario solo tiene que escribir la contraseña la siguiente vez.
  const remembered = getRememberedEmail();
  if (remembered && !email.value) {
    email.value = remembered;
    password.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    setAuthLoading(true);

    const typedEmail = email.value.trim();

    try {
      const user = await AUTH.signInWithPassword(typedEmail, password.value);
      rememberEmail(typedEmail);
      await enterApp(user);
    } catch (err) {
      showAuthError(err?.message || 'No se pudo iniciar sesión.');
      password.value = '';
      password.focus();
    } finally {
      setAuthLoading(false);
    }
  });
}

async function enterApp(user) {
  if (appEnteredFromAuth) return;
  appEnteredFromAuth = true;

  try {
    const resolvedUser = user || await AUTH.getCurrentUser();
    if (!resolvedUser) return;
    rememberEmail(resolvedUser.email);
    await bootApp(resolvedUser);
  } finally {
    appEnteredFromAuth = false;
  }
}

async function checkExistingSession() {
  // Si el script inline del <head> ya detectó un enlace de invitación/
  // recuperación, el modal de contraseña ya está visible (vía CSS) antes
  // de que se ejecute este código. Aquí solo confirmamos con showInvitePasswordModal
  // (idempotente) y evitamos entrar al dashboard mientras no se cambie la contraseña.
  if (AUTH.isInviteFlow()) {
    showInvitePasswordModal();
  }

  try {
    await AUTH.exchangeCodeForSessionIfNeeded();
    const sessionData = await AUTH.getSessionData();
    const user = sessionData?.user || null;

    if (user) {
      if (AUTH.isInviteFlow()) {
        showInvitePasswordModal(user.email);
        return;
      }
      exitInviteFlowUI();
      await enterApp(user);
      return;
    }

    // No hay sesión: si el enlace de invitación falló o expiró, avisamos
    // y dejamos ver el login en vez de quedarnos con el modal bloqueado.
    if (AUTH.isInviteFlow()) {
      exitInviteFlowUI();
      showAuthError('El enlace de invitación no es válido o ha caducado. Pide uno nuevo.');
    }
    document.getElementById('auth-screen').style.display = 'flex';
  } catch (err) {
    exitInviteFlowUI();
    showAuthError(err?.message || 'No se pudo recuperar la sesión.');
    document.getElementById('auth-screen').style.display = 'flex';
  }
}

function wireLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', () => {
    confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: async () => {
        exitInviteFlowUI();
        await AUTH.signOut().catch(() => {});
        window.location.reload();
      },
    });
  });
}

function wireAuthState() {
  AUTH.onAuthStateChange(async function (event, session) {
    if (event === 'SIGNED_OUT') return;
    if (!session || !session.user) return;

    if (AUTH.isInviteFlow()) {
      showInvitePasswordModal(session.user?.email);
      return;
    }

    const authScreen = document.getElementById('auth-screen');
    if (authScreen && authScreen.style.display !== 'none') {
      await enterApp(session.user);
    }
  });
}
