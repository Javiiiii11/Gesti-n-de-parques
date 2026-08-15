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

function setInviteStep(step) {
  const activate = document.getElementById('invite-step-activate');
  const password = document.getElementById('invite-step-password');
  const title = document.getElementById('invite-modal-title');
  if (activate) activate.style.display = step === 'activate' ? 'block' : 'none';
  if (password) password.style.display = step === 'password' ? 'block' : 'none';
  if (title) {
    title.textContent = step === 'activate' ? 'Activa tu invitación' : 'Define tu contraseña';
  }
}

function showInvitePasswordModal(email, { step = null } = {}) {
  document.documentElement.classList.add('ps-invite-flow');
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';
  const backdrop = document.getElementById('invite-password-backdrop');
  if (backdrop) backdrop.classList.add('active');

  const pendingRedirect = typeof AUTH.hasPendingInviteRedirect === 'function' && AUTH.hasPendingInviteRedirect();
  setInviteStep(step || (pendingRedirect ? 'activate' : 'password'));

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
  const activateBtn = document.getElementById('invite-activate-btn');
  const activateError = document.getElementById('invite-activate-error');

  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      if (activateError) activateError.textContent = '';
      activateBtn.disabled = true;
      activateBtn.textContent = 'Validando invitación…';
      try {
        const user = await AUTH.activateInviteFromUrl();
        if (user?.email) {
          rememberEmail(user.email);
          const hiddenUsername = document.querySelector('#invite-password-form input[name="username"]');
          if (hiddenUsername) hiddenUsername.value = user.email;
        }
        setInviteStep('password');
        if (passwordInput) passwordInput.focus();
      } catch (err) {
        if (activateError) {
          activateError.textContent = err?.message || 'No se pudo activar la invitación.';
        }
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Continuar con la invitación';
      }
    });
  }

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
      // Si aún hay code pendiente (paso activate saltado), lo canjeamos ahora
      if (AUTH.hasPendingInviteRedirect && AUTH.hasPendingInviteRedirect()) {
        await AUTH.activateInviteFromUrl();
      }
      const user = await AUTH.updatePassword(password);
      if (AUTH.markInvitePasswordComplete) AUTH.markInvitePasswordComplete(user?.email);
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
      const msg = err?.message || 'No se pudo iniciar sesión.';
      const looksLikeNoPassword = /invalid login credentials|invalid_credentials/i.test(msg);
      showAuthError(
        looksLikeNoPassword
          ? 'Correo o contraseña incorrectos. Si te invitaron y aún no creaste contraseña, pulsa “Me invitaron y aún no tengo contraseña”.'
          : msg
      );
      password.value = '';
      password.focus();
    } finally {
      setAuthLoading(false);
    }
  });

  const setPasswordBtn = document.getElementById('auth-set-password-btn');
  if (setPasswordBtn) {
    setPasswordBtn.addEventListener('click', async () => {
      clearAuthError();
      const typedEmail = email.value.trim();
      if (!typedEmail) {
        showAuthError('Escribe tu correo arriba y pulsa de nuevo el botón.');
        email.focus();
        return;
      }
      setPasswordBtn.disabled = true;
      try {
        await AUTH.sendPasswordSetupEmail(typedEmail);
        rememberEmail(typedEmail);
        showAuthError('');
        toast('Te hemos enviado un correo para crear tu contraseña. Ábrelo en el navegador (no solo la vista previa de Outlook).', 'success', 7000);
      } catch (err) {
        showAuthError(err?.message || 'No se pudo enviar el correo.');
      } finally {
        setPasswordBtn.disabled = false;
      }
    });
  }
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
  if (AUTH.isInviteFlow()) {
    showInvitePasswordModal();
  }

  try {
    // OAuth / sesión existente: canje automático.
    // Invitaciones: no canjea hasta el clic en "Continuar".
    const result = await AUTH.consumeAuthRedirect({ interactive: false });
    if (result.error && !result.pendingInvite) throw result.error;

    if (result.pendingInvite) {
      showInvitePasswordModal(null, { step: 'activate' });
      return;
    }

    const sessionData = await AUTH.getSessionData();
    const user = result.user || sessionData?.user || null;

    if (user) {
      if (AUTH.isInviteFlow()) {
        if (AUTH.hasInvitePasswordComplete && AUTH.hasInvitePasswordComplete(user.email)) {
          exitInviteFlowUI();
          await enterApp(user);
          return;
        }
        showInvitePasswordModal(user.email, { step: 'password' });
        return;
      }
      exitInviteFlowUI();
      await enterApp(user);
      return;
    }

    if (AUTH.isInviteFlow() && !AUTH.hasPendingInviteRedirect()) {
      exitInviteFlowUI();
      showAuthError('El enlace de invitación no es válido o ha caducado. Usa “Me invitaron y aún no tengo contraseña” o pide una invitación nueva.');
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
      if (AUTH.hasInvitePasswordComplete && AUTH.hasInvitePasswordComplete(session.user?.email)) {
        exitInviteFlowUI();
        await enterApp(session.user);
        return;
      }
      showInvitePasswordModal(session.user?.email, { step: 'password' });
      return;
    }

    const authScreen = document.getElementById('auth-screen');
    if (authScreen && authScreen.style.display !== 'none') {
      await enterApp(session.user);
    }
  });
}
