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

const SUPABASE_CONFIGURED =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && Boolean(window.supabase);

const AUTH_PROVIDER_HINTS = {
  google: false,
};

let supabaseClient = null;
if (SUPABASE_CONFIGURED) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  window.PARKSALES_SUPABASE_CLIENT = supabaseClient;
}

// Modo local: se activa automáticamente si Supabase no está configurado,
// o si el usuario elige explícitamente "Entrar sin cuenta".
let LOCAL_MODE = !SUPABASE_CONFIGURED;

if (!supabaseClient) {
  LOCAL_MODE = true;
}

const LOCAL_KEYS = { ventas: 'parksales_ventas', parques: 'parksales_parques', user: 'parksales_local_user' };

function localSeedIfEmpty() {
  if (!localStorage.getItem(LOCAL_KEYS.parques)) {
    const seed = [
      { id: uid(), nombre: 'PortAventura', activo: true, created_at: new Date().toISOString() },
      { id: uid(), nombre: 'Isla Mágica', activo: true, created_at: new Date().toISOString() },
      { id: uid(), nombre: 'Terra Mítica', activo: true, created_at: new Date().toISOString() },
    ];
    localStorage.setItem(LOCAL_KEYS.parques, JSON.stringify(seed));
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
  return {
    ...venta,
    cliente_nombre,
    importe_total,
  };
}
function normalizeDbError(error, tableName) {
  const message = error?.message || '';
  if (
    message.includes('Could not find the table') ||
    message.includes('schema cache') ||
    /relation .* does not exist/i.test(message)
  ) {
    return new Error(`Falta crear la tabla ${tableName} en Supabase. Ejecuta primero sql/schema.sql en el SQL Editor.`);
  }
  return error;
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
    return new Error('Correo o contraseña incorrectos. Si te registraste con Google, debes entrar con Google (cuando esté habilitado).');
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

  // ----------------------------------------------------------------- VENTAS
  async getVentas() {
    if (LOCAL_MODE) {
      localSeedIfEmpty();
      return readLocal(LOCAL_KEYS.ventas).map(normalizeVenta).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
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
    const { data, error } = await supabaseClient.from('ventas').insert(normalizeVenta(venta)).select().single();
    if (error) throw normalizeDbError(error, 'ventas');
    return data;
  },

  async updateVenta(id, changes) {
    if (LOCAL_MODE) {
      const list = readLocal(LOCAL_KEYS.ventas);
      const idx = list.findIndex(v => v.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...normalizeVenta(changes) };
      writeLocal(LOCAL_KEYS.ventas, list);
      return list[idx];
    }
    const { data, error } = await supabaseClient.from('ventas').update(normalizeVenta(changes)).eq('id', id).select().single();
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
    const { data } = await supabaseClient.auth.getSession();
    return data.session ? data.session.user : null;
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
    return data.user;
  },

  async signUp(email, password) {
    if (LOCAL_MODE) return this.signInWithPassword(email, password);
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw normalizeAuthError(error);
    return data.user;
  },

  async signInWithGoogle() {
    if (!AUTH_PROVIDER_HINTS.google) {
      throw new Error('Google no está configurado en esta app. Habilítalo en Supabase o usa correo y contraseña.');
    }
    if (LOCAL_MODE) {
      const user = { id: uid(), email: 'usuario.demo@parksales.app', name: 'Usuario demo' };
      localStorage.setItem(LOCAL_KEYS.user, JSON.stringify(user));
      return user;
    }
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
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
    return data.session ? data.session.user : null;
  },

  enterGuestMode() {
    LOCAL_MODE = true;
    const user = { id: uid(), email: 'invitado@local', name: 'Invitado (local)' };
    localStorage.setItem(LOCAL_KEYS.user, JSON.stringify(user));
    return user;
  },
};
