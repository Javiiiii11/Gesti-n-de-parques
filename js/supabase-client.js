/* ============================================================================
   supabase-client.js
   Configuración de conexión a Supabase + capa de acceso a datos (DB).

   👉 PASO OBLIGATORIO: sustituye SUPABASE_URL y SUPABASE_ANON_KEY por los
   valores de tu proyecto (Supabase → Project Settings → API).
   Mientras no los configures, la app funciona en "modo local de prueba"
   guardando los datos en el navegador (localStorage), para que puedas
   probar toda la interfaz sin backend.
============================================================================ */

const SUPABASE_URL = 'https://yabkrcwpkhyvtxjzxxkz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Er3PivbrTAlZ715JlZZlpA_9XoEjCo_';

/**
 * URL pública de la app en GitHub Pages.
 * Los enlaces de invitación / Google / recuperación deben volver aquí
 * (no a localhost). También hay que ponerla en Supabase → Authentication
 * → URL Configuration como Site URL y Redirect URL.
 */
const APP_PUBLIC_URL = 'https://javiiiii11.github.io/Gesti-n-de-parques/';

const SUPABASE_CONFIGURED =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && Boolean(window.supabase);

const AUTH_PROVIDER_HINTS = {
  google: true,
};

const INVITE_FLOW_STORAGE_KEY = 'parksales_invite_flow_pending';
const INVITE_COMPLETED_STORAGE_KEY = 'parksales_invite_password_completed';

const AUTH_LINK_TYPES = new Set(['invite', 'recovery', 'email', 'signup', 'magiclink']);

function normalizePublicUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function getAuthRedirectUrl() {
  const production = normalizePublicUrl(APP_PUBLIC_URL);
  if (production) return production;

  const protocol = window.location.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return '';
  if (!window.location.origin || window.location.origin === 'null') return '';
  const path = window.location.pathname || '/';
  return `${window.location.origin}${path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/')}`;
}

/** @deprecated usar getAuthRedirectUrl */
function getOAuthRedirectUrl() {
  return getAuthRedirectUrl();
}

let supabaseClient = null;
if (SUPABASE_CONFIGURED) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Importante: no canjear el ?code= automáticamente al cargar.
      // Outlook / Safe Links previsualizan el enlace y invalidarían el código.
      // Lo canjeamos a mano tras un clic del usuario (invitaciones) o en OAuth.
      detectSessionInUrl: false,
    },
  });
  window.PARKSALES_SUPABASE_CLIENT = supabaseClient;
}

// Si Supabase está configurado usamos backend real; si no, fallback local.
let LOCAL_MODE = !SUPABASE_CONFIGURED;

const LOCAL_KEYS = { 
  ventas: 'parksales_ventas', 
  parques: 'parksales_parques', 
  user: 'parksales_local_user',
  tipos_bono: 'parksales_tipos_bono',
  contactos: 'parksales_contactos'
};

function localSeedIfEmpty() {
  if (!localStorage.getItem(LOCAL_KEYS.parques)) {
    localStorage.setItem(LOCAL_KEYS.parques, JSON.stringify([]));
  }
  if (!localStorage.getItem(LOCAL_KEYS.tipos_bono)) {
    localStorage.setItem(LOCAL_KEYS.tipos_bono, JSON.stringify([]));
  }
  if (!localStorage.getItem(LOCAL_KEYS.contactos)) {
    localStorage.setItem(LOCAL_KEYS.contactos, JSON.stringify([]));
  }
  if (!localStorage.getItem(LOCAL_KEYS.ventas)) {
    localStorage.setItem(LOCAL_KEYS.ventas, JSON.stringify([]));
  }
}

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function readLocal(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function writeLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function sanitizeParque(parque) {
  const { comision_fija, comision_porcentual, ...rest } = parque || {};
  return rest;
}
function normalizeVenta(venta) {
  const cliente_nombre = venta?.cliente_nombre || venta?.nombre_cliente || venta?.tipo_entrada || 'Cliente';
  const importe_total = Number(venta?.importe_total ?? (Number(venta?.cantidad || 0) * Number(venta?.precio_unitario || 0))) || 0;
  const row = {
    fecha: venta?.fecha,
    tipo: venta?.tipo || 'entrada',
    via: venta?.via || 'llamada',
    parque_id: venta?.parque_id || null,
    bono_id: venta?.bono_id || null,
    cliente_nombre,
    importe_total,
  };
  // localizador es opcional: schemas antiguos de ventas pueden no tenerla
  if (venta?.localizador && !knownMissingColumns.has('ventas.localizador')) {
    row.localizador = venta.localizador;
  }
  return row;
}

const CONTACTO_COLUMNS = [
  'tipo', 'estado_pago', 'nombre_apellidos', 'correo', 'importe_total', 'anotaciones',
  'telefono', 'parque_id', 'cantidad_entradas', 'extras', 'num_bono', 'dni',
  'fecha_nacimiento', 'bono_id', 'cantidad_bonos', 'via', 'localizador', 'localizador_bono',
];

/** Columnas que pueden no existir en schemas antiguos de Supabase */
const CONTACTO_OPTIONAL_COLUMNS = new Set(['via', 'localizador', 'localizador_bono']);
/** Cache "tabla.columna" detectadas como inexistentes */
const knownMissingColumns = new Set();

function normalizeContacto(contacto, { partial = false } = {}) {
  const src = contacto || {};
  const row = {};

  for (const key of CONTACTO_COLUMNS) {
    if (partial && !Object.prototype.hasOwnProperty.call(src, key)) continue;
    if (knownMissingColumns.has(`contactos.${key}`)) continue;

    if (key === 'tipo') row.tipo = src.tipo || 'entrada';
    else if (key === 'estado_pago') row.estado_pago = src.estado_pago || 'pendiente';
    else if (key === 'nombre_apellidos') row.nombre_apellidos = src.nombre_apellidos || '';
    else if (key === 'correo') row.correo = src.correo || null;
    else if (key === 'importe_total') row.importe_total = Number(src.importe_total) || 0;
    else if (key === 'cantidad_entradas') row.cantidad_entradas = src.cantidad_entradas ?? null;
    else if (key === 'cantidad_bonos') row.cantidad_bonos = src.cantidad_bonos ?? null;
    else if (CONTACTO_OPTIONAL_COLUMNS.has(key)) {
      if (src[key]) row[key] = src[key];
    } else {
      row[key] = src[key] ?? null;
    }
  }
  return row;
}

/** Extrae el nombre de columna de errores PostgREST PGRST204 / 42703 */
function missingColumnFromError(error) {
  const message = error?.message || '';
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/column [\w.]+\.([^\s]+) does not exist/i);
  return match ? match[1] : null;
}

/**
 * Insert/update con reintento: si Supabase dice que falta una columna,
 * la quitamos del payload y reintentamos (compatible con schemas antiguos).
 */
async function withMissingColumnRetry(run, payload, tableName) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await run(current);
    if (!result.error) return result;
    const col = missingColumnFromError(result.error);
    if (!col || !Object.prototype.hasOwnProperty.call(current, col)) {
      return result;
    }
    console.warn(`[ParkSales] Columna "${tableName}.${col}" no existe en Supabase; se omite y se reintenta.`);
    knownMissingColumns.add(`${tableName}.${col}`);
    delete current[col];
  }
  return run(current);
}

function normalizeDbError(error, tableName) {
  console.error('Original Supabase error:', error);
  const message = error?.message || '';
  if (/row-level security policy|violates row-level security policy/i.test(message)) {
    return new Error('Tu sesión no tiene permisos para guardar en Supabase. Cierra sesión y vuelve a entrar (Google o correo) para refrescar la autenticación.');
  }
  const missingCol = missingColumnFromError(error);
  if (missingCol) {
    return new Error(
      `Falta la columna "${missingCol}" en la tabla ${tableName}. Ejecuta sql/fix_columns.sql en el SQL Editor de Supabase y recarga la página.`
    );
  }
  if (
    message.includes('Could not find the table') ||
    /relation .* does not exist/i.test(message)
  ) {
    return new Error(`Falta crear la tabla ${tableName} en Supabase. Ejecuta primero sql/schema.sql en el SQL Editor.`);
  }
  return error instanceof Error ? error : new Error(message || 'Error de base de datos');
}

function normalizeAuthError(error) {
  const message = String(error?.message || error || '');
  if (/provider is not enabled/i.test(message) || /unsupported provider/i.test(message)) {
    return new Error('Google no está activado en Supabase. Ve a Authentication → Providers y habilita Google o usa correo y contraseña.');
  }
  if (/email not confirmed/i.test(message)) {
    return new Error('Tu correo todavía no está confirmado. Revisa el email de Supabase y confirma la cuenta antes de iniciar sesión.');
  }
  if (/invalid login credentials/i.test(message)) {
    return new Error('Correo o contraseña incorrectos o la invitación ya no es válida.');
  }
  if (/password should be at least/i.test(message)) {
    return new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (/same password/i.test(message)) {
    return new Error('La nueva contraseña debe ser distinta de la anterior.');
  }
  return error instanceof Error ? error : new Error(message || 'Ha ocurrido un error de autenticación.');
}

/* ============================================================================
   DB: capa única que usa el resto de la app, ya sea con Supabase real
   o con el almacenamiento local de prueba. Misma interfaz en ambos casos.
============================================================================ */
const DB = {

  isLocal() { return LOCAL_MODE; },

  // ---------------------------------------------------------------- PARQUES
  async getParques() {
    if (LOCAL_MODE) {
      localSeedIfEmpty();
      return readLocal(LOCAL_KEYS.parques).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    const { data, error } = await supabaseClient.from('parques').select('*').order('nombre');
    if (error) throw normalizeDbError(error, 'parques');
    return data;
  },

  async addParque(parque) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.parques);
      const nuevo = { id: uid(), created_at: new Date().toISOString(), ...sanitizeParque(parque) };
      list.push(nuevo);
      writeLocal(LOCAL_KEYS.parques, list);
      return nuevo;
    }
    const { data, error } = await supabaseClient.from('parques').insert(sanitizeParque(parque)).select().single();
    if (error) throw normalizeDbError(error, 'parques');
    return data;
  },

  async updateParque(id, changes) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.parques);
      const idx = list.findIndex(p => p.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...sanitizeParque(changes) };
      writeLocal(LOCAL_KEYS.parques, list);
      return list[idx];
    }
    const { data, error } = await supabaseClient.from('parques').update(sanitizeParque(changes)).eq('id', id).select().single();
    if (error) throw normalizeDbError(error, 'parques');
    return data;
  },

  async deleteParque(id) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.parques).filter(p => p.id !== id);
      writeLocal(LOCAL_KEYS.parques, list);
      return true;
    }
    const { error } = await supabaseClient.from('parques').delete().eq('id', id);
    if (error) throw normalizeDbError(error, 'parques');
    return true;
  },

  // ---------------------------------------------------------------- TIPOS DE BONO
  async getTiposBono() {
    if (LOCAL_MODE) {
      localSeedIfEmpty();
      return readLocal(LOCAL_KEYS.tipos_bono).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    const { data, error } = await supabaseClient.from('tipos_bono').select('*').order('nombre');
    if (error) throw normalizeDbError(error, 'tipos_bono');
    return data;
  },

  async addTipoBono(bono) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.tipos_bono);
      const nuevo = { id: uid(), created_at: new Date().toISOString(), ...sanitizeParque(bono) };
      list.push(nuevo);
      writeLocal(LOCAL_KEYS.tipos_bono, list);
      return nuevo;
    }
    const { data, error } = await supabaseClient.from('tipos_bono').insert(sanitizeParque(bono)).select().single();
    if (error) throw normalizeDbError(error, 'tipos_bono');
    return data;
  },

  async updateTipoBono(id, changes) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.tipos_bono);
      const idx = list.findIndex(p => p.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...sanitizeParque(changes) };
      writeLocal(LOCAL_KEYS.tipos_bono, list);
      return list[idx];
    }
    const { data, error } = await supabaseClient.from('tipos_bono').update(sanitizeParque(changes)).eq('id', id).select().single();
    if (error) throw normalizeDbError(error, 'tipos_bono');
    return data;
  },

  async deleteTipoBono(id) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.tipos_bono).filter(p => p.id !== id);
      writeLocal(LOCAL_KEYS.tipos_bono, list);
      return true;
    }
    const { error } = await supabaseClient.from('tipos_bono').delete().eq('id', id);
    if (error) throw normalizeDbError(error, 'tipos_bono');
    return true;
  },

  // ---------------------------------------------------------------- CONTACTOS
  async getContactos() {
    if (LOCAL_MODE) {
      localSeedIfEmpty();
      return readLocal(LOCAL_KEYS.contactos).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    const { data, error } = await supabaseClient.from('contactos').select('*').order('created_at', { ascending: false });
    if (error) throw normalizeDbError(error, 'contactos');
    return data;
  },

  async addContacto(contacto) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.contactos);
      const nuevo = { id: uid(), created_at: new Date().toISOString(), ...normalizeContacto(contacto) };
      list.push(nuevo);
      writeLocal(LOCAL_KEYS.contactos, list);
      return nuevo;
    }
    const { data, error } = await withMissingColumnRetry(
      (payload) => supabaseClient.from('contactos').insert(payload).select().single(),
      normalizeContacto(contacto),
      'contactos'
    );
    if (error) throw normalizeDbError(error, 'contactos');
    return data;
  },

  async updateContacto(id, changes) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.contactos);
      const idx = list.findIndex(c => c.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...normalizeContacto(changes, { partial: true }) };
      writeLocal(LOCAL_KEYS.contactos, list);
      return list[idx];
    }
    const { data, error } = await withMissingColumnRetry(
      (payload) => supabaseClient.from('contactos').update(payload).eq('id', id).select().single(),
      normalizeContacto(changes, { partial: true }),
      'contactos'
    );
    if (error) throw normalizeDbError(error, 'contactos');
    return data;
  },

  async deleteContacto(id) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.contactos).filter(c => c.id !== id);
      writeLocal(LOCAL_KEYS.contactos, list);
      return true;
    }
    const { error } = await supabaseClient.from('contactos').delete().eq('id', id);
    if (error) throw normalizeDbError(error, 'contactos');
    return true;
  },

  // ----------------------------------------------------------------- VENTAS
  async getVentas() {
    if (LOCAL_MODE) {
      localSeedIfEmpty();
      return readLocal(LOCAL_KEYS.ventas).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
    const { data, error } = await supabaseClient.from('ventas').select('*').order('fecha', { ascending: false });
    if (error) throw normalizeDbError(error, 'ventas');
    return data;
  },

  async addVenta(venta) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.ventas);
      const nueva = { id: uid(), created_at: new Date().toISOString(), ...normalizeVenta(venta) };
      list.push(nueva);
      writeLocal(LOCAL_KEYS.ventas, list);
      return nueva;
    }
    const { data, error } = await withMissingColumnRetry(
      (payload) => supabaseClient.from('ventas').insert(payload).select().single(),
      normalizeVenta(venta),
      'ventas'
    );
    if (error) throw normalizeDbError(error, 'ventas');
    return data;
  },

  async updateVenta(id, changes) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.ventas);
      const idx = list.findIndex(v => v.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...normalizeVenta({ ...list[idx], ...changes }) };
      writeLocal(LOCAL_KEYS.ventas, list);
      return list[idx];
    }
    const { data, error } = await withMissingColumnRetry(
      (payload) => supabaseClient.from('ventas').update(payload).eq('id', id).select().single(),
      normalizeVenta(changes),
      'ventas'
    );
    if (error) throw normalizeDbError(error, 'ventas');
    return data;
  },

  async deleteVenta(id) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.ventas).filter(v => v.id !== id);
      writeLocal(LOCAL_KEYS.ventas, list);
      return true;
    }
    const { error } = await supabaseClient.from('ventas').delete().eq('id', id);
    if (error) throw normalizeDbError(error, 'ventas');
    return true;
  },

  async bulkInsertVentas(ventas) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.ventas);
      ventas.forEach(v => list.push({ id: v.id || uid(), created_at: v.created_at || new Date().toISOString(), ...normalizeVenta(v) }));
      writeLocal(LOCAL_KEYS.ventas, list);
      return true;
    }
    const { error } = await supabaseClient.from('ventas').insert(ventas.map(normalizeVenta));
    if (error) throw normalizeDbError(error, 'ventas');
    return true;
  },

  async bulkInsertParques(parques) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.parques);
      parques.forEach(p => list.push({ id: p.id || uid(), created_at: p.created_at || new Date().toISOString(), ...sanitizeParque(p) }));
      writeLocal(LOCAL_KEYS.parques, list);
      return true;
    }
    const { error } = await supabaseClient.from('parques').insert(parques.map(sanitizeParque));
    if (error) throw normalizeDbError(error, 'parques');
    return true;
  },

  async bulkInsertTiposBono(tiposBono) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.tipos_bono);
      tiposBono.forEach(b => list.push({ id: b.id || uid(), created_at: b.created_at || new Date().toISOString(), ...sanitizeParque(b) }));
      writeLocal(LOCAL_KEYS.tipos_bono, list);
      return true;
    }
    const { error } = await supabaseClient.from('tipos_bono').insert(tiposBono.map(sanitizeParque));
    if (error) throw normalizeDbError(error, 'tipos_bono');
    return true;
  },
};

/* ============================================================================
   AUTH: envoltorio simple sobre supabase.auth, con modo local de prueba
============================================================================ */
const AUTH = {
  async getSession() {
    if (LOCAL_MODE) {
      const u = localStorage.getItem(LOCAL_KEYS.user);
      return u ? JSON.parse(u) : null;
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw normalizeAuthError(error);
    return data.session ? data.session.user : null;
  },

  async getSessionData() {
    if (LOCAL_MODE) {
      const user = await this.getSession();
      return { session: user ? { user } : null, user };
    }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw normalizeAuthError(error);
    return { session: data.session || null, user: data.session?.user || null };
  },

  async getCurrentUser() {
    if (LOCAL_MODE) return this.getSession();
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) throw normalizeAuthError(error);
    return data.user || null;
  },

  async signInWithPassword(email, password) {
    if (LOCAL_MODE) {
      const user = { id: uid(), email, name: email.split('@')[0] };
      localStorage.setItem(LOCAL_KEYS.user, JSON.stringify(user));
      return user;
    }
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw normalizeAuthError(error);
    LOCAL_MODE = false;
    return data.user;
  },

  async signUp(email, password) {
    if (LOCAL_MODE) return this.signInWithPassword(email, password);
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    if (error) throw normalizeAuthError(error);
    LOCAL_MODE = false;
    return data.session?.user || data.user || null;
  },

  async updatePassword(password) {
    if (LOCAL_MODE) return this.getSession();
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw normalizeAuthError(error);
    return data.user || null;
  },

  /** Analiza la URL actual buscando code / tokens de auth */
  parseAuthRedirectParams() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
    const nestedConfirmationUrl = url.searchParams.get('confirmation_url') || hashParams.get('confirmation_url') || '';
    let nestedParams = null;

    if (nestedConfirmationUrl) {
      try {
        const nestedUrl = new URL(nestedConfirmationUrl);
        nestedParams = nestedUrl.searchParams;
      } catch (err) {
        nestedParams = new URLSearchParams(nestedConfirmationUrl.replace(/^[?#]/, ''));
      }
    }

    const type = url.searchParams.get('type') || hashParams.get('type') || nestedParams?.get('type') || '';
    const code = url.searchParams.get('code') || hashParams.get('code') || '';
    const access_token = hashParams.get('access_token') || '';
    const refresh_token = hashParams.get('refresh_token') || '';
    const token_hash =
      url.searchParams.get('token_hash') ||
      hashParams.get('token_hash') ||
      nestedParams?.get('token_hash') ||
      nestedParams?.get('token') ||
      url.searchParams.get('token') ||
      hashParams.get('token') ||
      '';
    const isInviteOrRecovery = type === 'invite' || type === 'recovery';
    const fromMailClient = /safelinks\.protection\.outlook|outlook\.office|office365/i.test(document.referrer || '');
    return { url, hashParams, type, code, access_token, refresh_token, token_hash, isInviteOrRecovery, fromMailClient };
  },

  clearAuthRedirectParams(url) {
    const clean = new URL(url.href);
    clean.searchParams.delete('code');
    clean.searchParams.delete('type');
    clean.searchParams.delete('token');
    clean.searchParams.delete('token_hash');
    clean.searchParams.delete('confirmation_url');
    clean.hash = '';
    window.history.replaceState({}, document.title, clean.pathname + clean.search);
  },

  /**
   * Canjea el enlace de auth.
   * - Invitación/recuperación: solo si interactive=true (clic humano; evita Outlook).
   * - OAuth (Google) u otros: se canjea automáticamente.
   * Devuelve { user, pendingInvite, error }.
   */
  async consumeAuthRedirect({ interactive = false } = {}) {
    if (LOCAL_MODE) {
      const user = await this.getSession();
      return { user, pendingInvite: false, error: null };
    }

    const params = this.parseAuthRedirectParams();
    // Si Outlook abre el enlace (o hay type=invite/recovery), no canjear hasta un clic.
    const mustDefer = params.isInviteOrRecovery || Boolean(params.token_hash) || (params.fromMailClient && Boolean(params.code || params.access_token));

    if (params.isInviteOrRecovery || params.token_hash || (params.fromMailClient && params.code)) {
      sessionStorage.setItem(INVITE_FLOW_STORAGE_KEY, '1');
    }

    const hasRedirectPayload = Boolean(params.code || params.access_token || params.token_hash);
    if (!hasRedirectPayload) {
      const user = await this.getSession();
      return { user, pendingInvite: false, error: null };
    }

    if (mustDefer && !interactive) {
      return { user: null, pendingInvite: true, error: null };
    }

    try {
      let sessionUser = null;

      if (params.token_hash) {
        const verifyType = AUTH_LINK_TYPES.has(params.type) ? params.type : 'invite';
        const { data, error } = await supabaseClient.auth.verifyOtp({
          token_hash: params.token_hash,
          type: verifyType,
        });
        if (error) throw error;
        sessionUser = data.session?.user || data.user || null;
      } else if (params.code) {
        const { data, error } = await supabaseClient.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
        sessionUser = data.session?.user || null;
      } else if (params.access_token) {
        const { data, error } = await supabaseClient.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token || '',
        });
        if (error) throw error;
        sessionUser = data.session?.user || null;
      }

      this.clearAuthRedirectParams(params.url);
      LOCAL_MODE = false;
      return { user: sessionUser, pendingInvite: false, error: null };
    } catch (err) {
      const existing = await this.getSessionData().catch(() => null);
      const existingUser = existing?.user || null;
      if (existingUser && mustDefer) {
        this.clearAuthRedirectParams(params.url);
        LOCAL_MODE = false;
        return { user: existingUser, pendingInvite: false, error: null };
      }
      this.clearAuthRedirectParams(params.url);
      return { user: null, pendingInvite: mustDefer, error: normalizeAuthError(err) };
    }
  },

  async exchangeCodeForSessionIfNeeded() {
    const result = await this.consumeAuthRedirect({ interactive: false });
    if (result.error && !result.pendingInvite) throw result.error;
    return result.user;
  },

  /** Activación manual de invitación (botón Continuar) */
  async activateInviteFromUrl() {
    const result = await this.consumeAuthRedirect({ interactive: true });
    if (result.error) {
      const existing = await this.getSessionData().catch(() => null);
      if (existing?.user) {
        sessionStorage.setItem(INVITE_FLOW_STORAGE_KEY, '1');
        return existing.user;
      }
      throw result.error;
    }
    if (!result.user) {
      const existing = await this.getSessionData().catch(() => null);
      if (existing?.user) {
        sessionStorage.setItem(INVITE_FLOW_STORAGE_KEY, '1');
        return existing.user;
      }
      throw new Error('No se pudo activar la invitación. El enlace puede haber caducado o haberse usado ya. Pide una invitación nueva.');
    }
    sessionStorage.setItem(INVITE_FLOW_STORAGE_KEY, '1');
    return result.user;
  },

  isInviteFlow() {
    const params = this.parseAuthRedirectParams();
    return params.isInviteOrRecovery || sessionStorage.getItem(INVITE_FLOW_STORAGE_KEY) === '1';
  },

  markInvitePasswordComplete(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return;
    try {
      const raw = localStorage.getItem(INVITE_COMPLETED_STORAGE_KEY);
      const completed = raw ? JSON.parse(raw) : {};
      completed[clean] = true;
      localStorage.setItem(INVITE_COMPLETED_STORAGE_KEY, JSON.stringify(completed));
    } catch (err) { /* localStorage no disponible */ }
  },

  hasInvitePasswordComplete(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return false;
    try {
      const raw = localStorage.getItem(INVITE_COMPLETED_STORAGE_KEY);
      const completed = raw ? JSON.parse(raw) : {};
      return completed[clean] === true;
    } catch (err) {
      return false;
    }
  },

  hasPendingInviteRedirect() {
    const params = this.parseAuthRedirectParams();
    return Boolean(params.code || params.access_token || params.token_hash) && (
      params.isInviteOrRecovery ||
      params.token_hash ||
      params.fromMailClient ||
      sessionStorage.getItem(INVITE_FLOW_STORAGE_KEY) === '1'
    );
  },

  clearInviteFlow() {
    sessionStorage.removeItem(INVITE_FLOW_STORAGE_KEY);
  },

  async onAuthStateChange(callback) {
    if (LOCAL_MODE) return { data: { subscription: { unsubscribe() {} } } };
    return supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session?.user) LOCAL_MODE = false;
      callback(event, session);
    });
  },

  async signInWithGoogle() {
    if (LOCAL_MODE) {
      const user = { id: uid(), email: 'usuario.demo@parksales.app', name: 'Usuario demo' };
      localStorage.setItem(LOCAL_KEYS.user, JSON.stringify(user));
      return user;
    }
    if (!AUTH_PROVIDER_HINTS.google) {
      throw new Error('Google no está configurado en esta app. Habilítalo en Supabase o usa correo y contraseña.');
    }
    const redirectTo = getAuthRedirectUrl();
    if (!redirectTo) {
      throw new Error('Google Login requiere abrir la app con http(s). Si la abriste como archivo local (file://), usa GitHub Pages o un servidor local.');
    }
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw normalizeAuthError(error);
  },

  async signOut() {
    if (LOCAL_MODE) {
      localStorage.removeItem(LOCAL_KEYS.user);
      return;
    }
    await supabaseClient.auth.signOut();
  },

  async refreshSession() {
    if (LOCAL_MODE) return this.getSession();
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (error) throw normalizeAuthError(error);
    LOCAL_MODE = !data.session;
    return data.session ? data.session.user : null;
  },

  enterGuestMode() {
    LOCAL_MODE = true;
    const user = { id: uid(), email: 'javier@parksales', name: 'Javier Rodríguez' };
    localStorage.setItem(LOCAL_KEYS.user, JSON.stringify(user));
    return user;
  },
};
