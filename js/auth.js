/* ============================================================================
   auth.js — pantalla de acceso y gestión de sesión
============================================================================ */

let authMode = 'login'; // 'login' | 'signup'

function initAuthScreen() {
  const form = document.getElementById('auth-form');
  const toggleLink = document.getElementById('auth-toggle-link');
  const googleBtn = document.getElementById('google-login-btn');
  const guestLink = document.getElementById('guest-mode-link');
  const errorBox = document.getElementById('auth-error');

  if (!SUPABASE_CONFIGURED) {
    document.getElementById('auth-sub').textContent =
      'Supabase no está configurado todavía: puedes probar la app en modo local.';
  }
  if (!AUTH_PROVIDER_HINTS.google) {
    googleBtn.title = 'Activa Google en Supabase para usar este acceso';
  }

  toggleLink.addEventListener('click', () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    document.getElementById('auth-title').textContent = authMode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta';
    document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Entrar' : 'Registrarme';
    document.getElementById('auth-toggle-text').textContent = authMode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
    toggleLink.textContent = authMode === 'login' ? 'Regístrate' : 'Inicia sesión';
    errorBox.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('auth-submit-btn');
    btn.disabled = true;
    try {
      const user = authMode === 'login'
        ? await AUTH.signInWithPassword(email, password)
        : await AUTH.signUp(email, password);
      if (user) {
        await bootApp(user);
      } else {
        errorBox.textContent = 'Revisa tu correo para confirmar la cuenta antes de entrar.';
      }
    } catch (err) {
      errorBox.textContent = traducirErrorAuth(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  googleBtn.addEventListener('click', async () => {
    try {
      const user = await AUTH.signInWithGoogle();
      if (user) await bootApp(user);
    } catch (err) {
      errorBox.textContent = traducirErrorAuth(err.message);
    }
  });

  guestLink.addEventListener('click', async () => {
    const user = AUTH.enterGuestMode();
    toast('Has entrado en modo local de prueba. Los datos se guardan solo en este navegador.', 'info', 5000);
    await bootApp(user);
  });
}

function traducirErrorAuth(msg = '') {
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(msg)) return 'Ese correo ya está registrado.';
  if (/email.*confirmed|confirmar la cuenta/i.test(msg)) return 'Revisa tu correo y confirma la cuenta antes de iniciar sesión.';
  if (/google no está habilitado|provider/i.test(msg)) return 'Google no está activado en Supabase. Usa correo y contraseña o habilítalo en Authentication → Providers.';
  if (/password/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.';
  return msg || 'Ha ocurrido un error. Inténtalo de nuevo.';
}

async function checkExistingSession() {
  try {
    const user = await AUTH.getCurrentUser();
    if (user) await bootApp(user);
  } catch (e) {
    // sin sesión activa, se queda en la pantalla de login
  }
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
      onConfirm: async () => {
        await AUTH.signOut();
        window.location.reload();
      },
    });
  });
}

function wireAuthState() {
  const client = window.PARKSALES_SUPABASE_CLIENT;
  if (!SUPABASE_CONFIGURED || !client || !client.auth?.onAuthStateChange) return;
  client.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user && document.getElementById('auth-screen').style.display !== 'none') {
      await bootApp(session.user);
    }
  });
}
