/* ============================================================================
   backup-auto.js — copias de seguridad automáticas en IndexedDB
   Totalmente compatible con GitHub Pages. Los backups se guardan dentro
   del navegador y se pueden descargar como .json cuando quieras.
============================================================================ */

const BACKUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

// Horas fijas de copia al final del día (hora local, formato [H, M])
const BACKUP_SCHEDULED_TIMES = [
  [16, 55], // 4:55 PM
  [17, 55], // 5:55 PM
  [19, 55], // 7:55 PM
];

let scheduledBackupTimers = [];
const BACKUP_MAX_FILES = 30;
const BACKUP_DB_NAME = 'parksales_backups_db';
const BACKUP_DB_STORE = 'backups';

let autoBackupEnabled = false;
let backupIntervalId = null;

/* --- IndexedDB: abrir base de datos de backups --- */
function openBackupDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(BACKUP_DB_STORE, { keyPath: 'id' });
      store.createIndex('fecha', 'fecha', { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* --- Guardar un backup en IndexedDB --- */
async function saveBackupToDB(backupData) {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DB_STORE, 'readwrite');
    const store = tx.objectStore(BACKUP_DB_STORE);
    const entry = {
      id: new Date().toISOString().replace(/[:.]/g, '-'),
      fecha: new Date().toISOString(),
      data: backupData,
    };
    store.put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

/* --- Obtener todos los backups guardados --- */
async function getBackupsFromDB() {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DB_STORE, 'readonly');
    const store = tx.objectStore(BACKUP_DB_STORE);
    const index = store.index('fecha');
    const req = index.openCursor(null, 'prev'); // orden descendente por fecha
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/* --- Eliminar backups antiguos (deja solo los últimos BACKUP_MAX_FILES) --- */
async function cleanupOldBackupsDB() {
  const all = await getBackupsFromDB();
  if (all.length <= BACKUP_MAX_FILES) return;
  const toDelete = all.slice(BACKUP_MAX_FILES);
  const db = await openBackupDB();
  const tx = db.transaction(BACKUP_DB_STORE, 'readwrite');
  const store = tx.objectStore(BACKUP_DB_STORE);
  for (const entry of toDelete) {
    store.delete(entry.id);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* --- Eliminar un backup específico por ID --- */
async function deleteBackupFromDB(id) {
  const db = await openBackupDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_DB_STORE, 'readwrite');
    tx.objectStore(BACKUP_DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* --- UI de estado --- */
function setBackupStatus(text) {
  const el = document.getElementById('backup-auto-status');
  if (el) el.textContent = text;
}
function setButtonTextKeepingIcon(btn, text) {
  const textNode = Array.from(btn.childNodes).find((node) =>
    node.nodeType === Node.TEXT_NODE && node.textContent.trim()
  );

  if (textNode) {
    textNode.textContent = ` ${text}`;
  } else {
    btn.appendChild(document.createTextNode(text));
  }
}
function setBackupButtonLabel(text) {
  const btn = document.getElementById('btn-enable-auto-backup');
  if (btn) setButtonTextKeepingIcon(btn, text);
}

/* --- Activar copias automáticas --- */
async function enableAutoBackup() {
  autoBackupEnabled = true;
  updateBackupUI();
  setBackupButtonLabel('Desactivar copias automáticas');
  await runBackupNow();
  startBackupInterval();
  toast('Copias de seguridad automáticas activadas', 'success');
}

/* --- Desactivar copias automáticas --- */
function disableAutoBackup() {
  autoBackupEnabled = false;
  if (backupIntervalId) {
    clearInterval(backupIntervalId);
    backupIntervalId = null;
  }
  updateBackupUI();
  setBackupButtonLabel('Activar copias automáticas');
  setBackupStatus('Copias automáticas desactivadas.');
  toast('Copias automáticas desactivadas', 'info');
}

/* --- Toggle activar/desactivar --- */
async function toggleAutoBackup() {
  if (autoBackupEnabled) {
    disableAutoBackup();
  } else {
    await enableAutoBackup();
  }
}

/* --- Hacer una copia manual ahora --- */
async function manualBackupNow() {
  await runBackupNow();
  toast('Copia de seguridad realizada', 'success');
}

/* --- Actualizar la UI de todos los botones --- */
function updateBackupUI() {
  document.querySelectorAll('.backup-toggle-btn').forEach(btn => {
    setButtonTextKeepingIcon(
      btn,
      autoBackupEnabled ? 'Desactivar copias automáticas' : 'Activar copias automáticas'
    );
  });
  if (autoBackupEnabled) {
    document.querySelectorAll('.backup-folder-label').forEach(el => {
      el.textContent = 'Backups guardados en el navegador';
    });
  }
}

/* --- Fijar Almacenamiento Persistente en el Navegador --- */
async function requestPersistentStorage() {
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[ParkSales] Almacenamiento persistente ${granted ? 'concedido por el navegador' : 'no concedido'}`);
      } else {
        console.log('[ParkSales] Almacenamiento persistente del navegador activo');
      }
    } catch (err) {
      console.warn('[ParkSales] Error al solicitar almacenamiento persistente:', err);
    }
  }
}

/* --- Activación automática al arrancar la app --- */
let cloudBackupIntervalId = null;
let currentCloudFrequencyMinutes = 120; // 2 horas por defecto

async function initCloudAutoBackup() {
  try {
    currentCloudFrequencyMinutes = await DB.getCloudBackupFrequency();
  } catch (e) {
    currentCloudFrequencyMinutes = 120;
  }

  startCloudBackupInterval(currentCloudFrequencyMinutes);

  // Ejecutar copia al arrancar si hace más del intervalo o no se ha hecho hoy
  const lastSyncStr = localStorage.getItem('parksales_last_cloud_backup_time');
  const now = Date.now();
  const intervalMs = currentCloudFrequencyMinutes * 60 * 1000;

  if (!lastSyncStr || (now - new Date(lastSyncStr).getTime() > intervalMs)) {
    // Retrasar 4 segundos tras arrancar para que carguen todos los estados
    setTimeout(() => {
      runCloudBackupNow('auto_inicio');
    }, 4000);
  }
}

function startCloudBackupInterval(minutes) {
  if (cloudBackupIntervalId) {
    clearInterval(cloudBackupIntervalId);
    cloudBackupIntervalId = null;
  }
  const intervalMs = Math.max(15, minutes) * 60 * 1000;
  cloudBackupIntervalId = setInterval(async () => {
    // Comprobar primero si hay un forzado pendiente (de otro usuario/admin)
    try {
      const hasPending = await DB.checkPendingForceBackup();
      if (hasPending) {
        await runCloudBackupNow('forzado_admin');
        return; // Ya se guardó, no duplicar
      }
    } catch (e) { /* no bloquear el ciclo normal */ }
    runCloudBackupNow('auto_interval');
  }, intervalMs);

  // Comprobación adicional cada 5 minutos para detectar backups forzados rápidamente
  if (!window._forceBackupCheckIntervalId) {
    window._forceBackupCheckIntervalId = setInterval(async () => {
      try {
        const hasPending = await DB.checkPendingForceBackup();
        if (hasPending) {
          console.log('[ParkSales] Backup forzado por admin detectado — ejecutando copia ahora');
          await runCloudBackupNow('forzado_admin');
        }
      } catch (e) { /* ignorar */ }
    }, 5 * 60 * 1000); // cada 5 minutos
  }
}

async function runCloudBackupNow(tipo = 'auto') {
  try {
    let backup;
    if (typeof buildFullBackupData === 'function') {
      backup = buildFullBackupData();
    } else {
      let llamadas = [];
      try { llamadas = JSON.parse(localStorage.getItem('parksales_llamadas') || '[]'); } catch (e) { }
      backup = {
        generado_en: new Date().toISOString(),
        version: 3,
        app: 'ParkSales',
        parques: STATE.parques || [],
        tipos_bono: STATE.tipos_bono || [],
        contactos: STATE.contactos || [],
        ventas: STATE.ventas || [],
        llamadas,
        notas_rapidas: localStorage.getItem('parksales_quick_notes') || '',
      };
    }

    const res = await DB.saveUserBackupToCloud(backup, { tipo });
    localStorage.setItem('parksales_last_cloud_backup_time', new Date().toISOString());
    console.log(`[ParkSales] Copia en BD realizada con éxito (${tipo}):`, new Date().toLocaleTimeString('es-ES'));
    return res;
  } catch (err) {
    console.warn('[ParkSales] Error al guardar copia en BD:', err);
    return null;
  }
}

async function initAutoBackup() {
  // Solicitar almacenamiento persistente al navegador para evitar limpiezas automáticas
  await requestPersistentStorage();

  // Las copias automáticas locales se activan SIEMPRE al iniciar la app
  autoBackupEnabled = true;
  updateBackupUI();
  startBackupInterval();
  // Programar copias a horas fijas del día (16:55, 17:55, 19:55)
  startScheduledBackups();

  // Inicializar copias automáticas en la nube (BD Supabase cada 2h)
  await initCloudAutoBackup();

  // Mostrar estado con el último backup guardado (si existe)
  try {
    const backups = await getBackupsFromDB();
    if (backups.length > 0) {
      setBackupStatus(`${backups.length} backup(s) guardados. Último: ${new Date(backups[0].fecha).toLocaleString('es-ES')}`);
    } else {
      // Primera vez: hacer una copia inmediatamente
      await runBackupNow();
    }
  } catch (err) {
    setBackupStatus('Listo para guardar backups');
  }
}


function startBackupInterval() {
  if (backupIntervalId) clearInterval(backupIntervalId);
  backupIntervalId = setInterval(runBackupNow, BACKUP_INTERVAL_MS);
}

/* --- Generar y guardar el backup en IndexedDB --- */
async function runBackupNow(label) {
  try {
    let backup;
    if (typeof buildFullBackupData === 'function') {
      backup = buildFullBackupData();
    } else {
      let llamadas = [];
      try {
        llamadas = JSON.parse(localStorage.getItem('parksales_llamadas') || '[]');
      } catch (e) { llamadas = []; }

      backup = {
        generado_en: new Date().toISOString(),
        version: 3,
        app: 'ParkSales',
        parques: STATE.parques || [],
        tipos_bono: STATE.tipos_bono || [],
        contactos: STATE.contactos || [],
        ventas: STATE.ventas || [],
        llamadas,
        notas_rapidas: localStorage.getItem('parksales_quick_notes') || '',
      };
    }

    const entry = await saveBackupToDB(backup);
    await cleanupOldBackupsDB();

    // También sincronizar copia a la nube si corresponde
    runCloudBackupNow(label || 'auto');

    const tipoLabel = label ? ` (${label})` : '';
    setBackupStatus(`Última copia${tipoLabel}: ${new Date().toLocaleString('es-ES')}`);
  } catch (err) {
    console.error('Error al generar la copia automática:', err);
    setBackupStatus('Error al generar la última copia: ' + err.message);
  }
}

/* --- Programar copias a horas fijas del día --- */
function scheduleFixedTimeBackup([hour, minute]) {
  function schedule() {
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);

    // Si ya pasó la hora hoy, programar para mañana
    if (target <= now) target.setDate(target.getDate() + 1);

    const msUntil = target - now;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const timerId = setTimeout(async () => {
      await runBackupNow(`copia de las ${timeStr}`);
      // Programar de nuevo para el día siguiente
      schedule();
    }, msUntil);

    scheduledBackupTimers.push(timerId);
  }
  schedule();
}

function startScheduledBackups() {
  // Limpiar timers previos si los hubiera
  scheduledBackupTimers.forEach(id => clearTimeout(id));
  scheduledBackupTimers = [];

  BACKUP_SCHEDULED_TIMES.forEach(scheduleFixedTimeBackup);
}

/* --- Mostrar lista de backups locales guardados (para la UI) --- */
async function showBackupList() {
  const backups = await getBackupsFromDB();
  if (backups.length === 0) {
    toast('No hay backups guardados todavía', 'info');
    return;
  }

  let html = `<div style="display:flex;flex-direction:column;gap:8px;">`;
  for (const b of backups) {
    const fecha = new Date(b.fecha).toLocaleString('es-ES');
    const size = new Blob([JSON.stringify(b.data)]).size;
    const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
    const vCount = Array.isArray(b.data?.ventas) ? b.data.ventas.length : 0;
    const cCount = Array.isArray(b.data?.contactos) ? b.data.contactos.length : 0;
    const lCount = Array.isArray(b.data?.llamadas) ? b.data.llamadas.length : (Array.isArray(b.data?.calls) ? b.data.calls.length : 0);
    const hasN = Boolean(b.data?.notas_rapidas && String(b.data.notas_rapidas).trim());
    const totalImporteVentas = Array.isArray(b.data?.ventas)
      ? b.data.ventas.reduce((acc, v) => acc + (Number(v.importe_total) || 0), 0)
      : 0;

    const resumenTags = [];
    const fmtTotal = typeof fmtEUR === 'function' ? fmtEUR(totalImporteVentas) : `${totalImporteVentas.toFixed(2)} €`;
    resumenTags.push(`${vCount} ventas${vCount > 0 ? ' (' + fmtTotal + ')' : ''}`);
    if (cCount) resumenTags.push(`${cCount} apuntes`);
    if (lCount) resumenTags.push(`${lCount} llamadas`);
    if (hasN) resumenTags.push(`notas`);
    const resumenStr = resumenTags.join(' · ');

    html += `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${fecha}</div>
          <div style="font-size:11px;color:var(--text-muted);">${sizeStr} — <span style="color:var(--brand-primary);">${resumenStr}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-primary btn-sm" onclick="restoreBackupUI('${b.id}')" title="Restaurar esta copia">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Restaurar
          </button>
          <button class="btn btn-secondary btn-sm" onclick="downloadBackup('${b.id}')" title="Descargar .json">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            Descargar
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteBackupUI('${b.id}')" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
  }
  html += `</div>`;

  openModal({
    title: `Backups guardados en navegador (${backups.length})`,
    width: '600px',
    sizeClass: 'modal-cuadradito',
    bodyHtml: html,
    footHtml: `<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>`,
  });
}

/* --- Restaurar un backup específico desde la lista --- */
window.restoreBackupUI = async function (id) {
  try {
    const db = await openBackupDB();
    const tx = db.transaction(BACKUP_DB_STORE, 'readonly');
    const req = tx.objectStore(BACKUP_DB_STORE).get(id);
    req.onsuccess = () => {
      if (!req.result || !req.result.data) {
        toast('No se encontró el backup solicitado', 'error');
        return;
      }
      const data = req.result.data;
      const fecha = new Date(req.result.fecha).toLocaleString('es-ES');

      const totalVentas = Array.isArray(data.ventas) ? data.ventas.length : 0;
      const totalContactos = Array.isArray(data.contactos) ? data.contactos.length : 0;
      const totalLlamadas = Array.isArray(data.llamadas) ? data.llamadas.length : (Array.isArray(data.calls) ? data.calls.length : 0);
      const hasNotas = Boolean(data.notas_rapidas && String(data.notas_rapidas).trim());

      const descPartes = [];
      if (totalVentas) descPartes.push(`<strong>${totalVentas}</strong> ventas`);
      if (totalContactos) descPartes.push(`<strong>${totalContactos}</strong> apuntes`);
      if (totalLlamadas) descPartes.push(`<strong>${totalLlamadas}</strong> llamadas`);
      if (hasNotas) descPartes.push(`notas rápidas`);

      const detalleTexto = descPartes.length ? descPartes.join(', ') : 'todos los registros';

      confirmDialog({
        title: 'Restaurar copia de seguridad',
        message: `¿Deseas restaurar la copia del <strong>${fecha}</strong>?<br><br>Incluye ${detalleTexto}. Se añadirán los registros sin duplicar los existentes.`,
        isHtmlMessage: true,
        confirmLabel: 'Restaurar ahora',
        danger: false,
        onConfirm: async () => {
          try {
            if (typeof applyBackupData === 'function') {
              const stats = await applyBackupData(data);
              closeModal();
              toast(`Copia restaurada correctamente: ${stats.ventas} ventas, ${stats.contactos} apuntes, ${stats.llamadas} llamadas`, 'success', 5000);
            } else {
              toast('Función de importación no disponible en este momento', 'error');
            }
          } catch (err) {
            console.error('Error al restaurar backup:', err);
            toast('Error al restaurar: ' + err.message, 'error');
          }
        }
      });
    };
  } catch (err) {
    toast('Error al leer el backup: ' + err.message, 'error');
  }
};

/* --- Descargar un backup específico --- */
window.downloadBackup = async function (id) {
  const db = await openBackupDB();
  const tx = db.transaction(BACKUP_DB_STORE, 'readonly');
  const req = tx.objectStore(BACKUP_DB_STORE).get(id);
  req.onsuccess = () => {
    if (req.result) {
      const fecha = req.result.fecha.slice(0, 10);
      downloadFile(`parksales_backup_${fecha}.json`, JSON.stringify(req.result.data, null, 2), 'application/json');
      toast('Backup descargado', 'success');
    }
  };
};

/* --- Eliminar un backup desde la UI --- */
window.deleteBackupUI = async function (id) {
  confirmDialog({
    title: 'Eliminar backup',
    message: '¿Estás seguro de que quieres eliminar este backup?',
    confirmLabel: 'Eliminar',
    onConfirm: async () => {
      await deleteBackupFromDB(id);
      toast('Backup eliminado', 'info');
      // Recargar la lista si el modal está abierto
      showBackupList();
    },
  });
};

/* ============================================================================
   PANEL DE RECUPERACIÓN DE COOKIES Y BACKUPS EN LA NUBE (ADMIN)
============================================================================ */

const ADMIN_COOKIES_PASSWORD = 'cookie2026';
let adminBackupsCache = [];
let adminSelectedUserFilter = '';

function requestAdminCookiesPassword(onSuccess) {
  if (sessionStorage.getItem('parksales_cookies_admin_unlocked') === '1') {
    onSuccess();
    return;
  }

  openModal({
    title: '🛡️ Panel de Recuperación de Cookies y Backups',
    width: '420px',
    bodyHtml: `
      <div style="text-align:center; margin-bottom:16px;">
        <div style="width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:rgba(255,154,68,0.15);display:flex;align-items:center;justify-content:center;color:#FF9A44;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px;">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <p style="color:var(--text-secondary);font-size:13px;line-height:1.5;margin:0;">
          Introduce la clave de administración para acceder al panel de copias de seguridad de todos los usuarios.
        </p>
      </div>
      <div class="form-field">
        <label for="admin-cookies-pwd">Contraseña</label>
        <input type="password" id="admin-cookies-pwd" placeholder="Introduce la contraseña" autocomplete="off">
      </div>
      <div id="admin-cookies-error" class="auth-error" style="margin-top:8px;display:none;"></div>
    `,
    footHtml: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="admin-cookies-submit">Entrar</button>
    `,
  });

  const pwdInput = document.getElementById('admin-cookies-pwd');
  const errorEl = document.getElementById('admin-cookies-error');
  const submitBtn = document.getElementById('admin-cookies-submit');

  const checkPassword = () => {
    const val = pwdInput.value.trim();
    if (val === ADMIN_COOKIES_PASSWORD) {
      sessionStorage.setItem('parksales_cookies_admin_unlocked', '1');
      closeModal();
      onSuccess();
    } else {
      errorEl.textContent = 'Contraseña incorrecta';
      errorEl.style.display = 'block';
      pwdInput.value = '';
      pwdInput.focus();
    }
  };

  submitBtn.addEventListener('click', checkPassword);
  pwdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkPassword();
    }
  });

  setTimeout(() => pwdInput.focus(), 120);
}

function openAdminCookiesRecoveryPanel() {
  requestAdminCookiesPassword(async () => {
    renderAdminRecoveryPanelModal();
  });
}

async function renderAdminRecoveryPanelModal() {
  openModal({
    title: '🛡️ Panel de Recuperación de Cookies y Backups (Nube)',
    width: '940px',
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- Banner Explicativo -->
        <div style="background:rgba(0,198,255,0.06);border:1px solid rgba(0,198,255,0.25);border-radius:var(--radius-m);padding:14px 16px;display:flex;gap:12px;align-items:flex-start;">
          <div style="color:#00C6FF;font-size:20px;line-height:1;">💡</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">
            <strong>Recuperación de datos:</strong> Si algún usuario borra las cookies o el navegador pierde la sesión, busca aquí su usuario, descarga su archivo <strong>.json</strong> y pásaselo para que lo importe en la sección <em>Exportar / Importar &rarr; Restaurar Datos</em>.
          </div>
        </div>

        <!-- Barra de Configuración de Frecuencia y Forzar Copia -->
        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-m);padding:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0;">
              ⏱️ Guardar copias en BD cada:
            </label>
            <select id="admin-freq-select" class="filter-select" style="width:auto;min-width:180px;">
              <option value="30">Cada 30 minutos</option>
              <option value="60">Cada 1 hora</option>
              <option value="120" selected>Cada 2 horas (Recomendado)</option>
              <option value="240">Cada 4 horas</option>
              <option value="360">Cada 6 horas</option>
              <option value="720">Cada 12 horas</option>
              <option value="1440">Cada 24 horas (1 vez al día)</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="btn-save-cloud-freq" title="Guardar intervalo">
              Guardar frecuencia
            </button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="btn-force-cloud-backup-now" title="Guardar solo mi copia en BD ahora">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              Guardar mi copia ahora
            </button>
            <button class="btn btn-warning btn-sm" id="btn-force-all-users-backup" title="Forzar que TODOS los usuarios guarden su copia en cuanto estén activos" style="background:linear-gradient(135deg,#FF9A44,#FC6076);border:none;color:#fff;font-weight:700;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              ⚡ Forzar guardado de TODOS
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-refresh-cloud-backups" title="Recargar lista">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
        </div>

        <!-- Filtro por Usuario y Buscador -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">Filtrar usuario:</label>
            <select id="admin-user-filter" class="filter-select" style="flex:1;">
              <option value="">Cargando usuarios...</option>
            </select>
          </div>
          <div class="search-box" style="flex:1;min-width:200px;margin:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="text" id="admin-search-cloud" placeholder="Buscar por fecha, notas...">
          </div>
        </div>

        <!-- Contenedor del listado -->
        <div id="admin-cloud-backups-container" style="min-height:220px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;">
          <div style="text-align:center;padding:32px;color:var(--text-muted);">
            <div class="spinner" style="margin:0 auto 12px;"></div>
            Cargando copias de seguridad de la base de datos...
          </div>
        </div>
      </div>
    `,
    footHtml: `
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
        <span id="admin-cloud-total-count" style="font-size:12px;color:var(--text-muted);">0 copias encontradas</span>
        <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
      </div>
    `,
  });

  // Inicializar selector de frecuencia
  try {
    const freq = await DB.getCloudBackupFrequency();
    const selectEl = document.getElementById('admin-freq-select');
    if (selectEl) selectEl.value = String(freq);
  } catch (e) { }

  document.getElementById('btn-save-cloud-freq')?.addEventListener('click', async () => {
    const sel = document.getElementById('admin-freq-select');
    if (!sel) return;
    const mins = parseInt(sel.value, 10) || 120;
    await DB.setCloudBackupFrequency(mins);
    currentCloudFrequencyMinutes = mins;
    startCloudBackupInterval(mins);
    toast(`Frecuencia guardada: Cada ${mins >= 60 ? (mins / 60) + ' hora(s)' : mins + ' minutos'}`, 'success');
  });

  document.getElementById('btn-force-cloud-backup-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-force-cloud-backup-now');
    if (btn) btn.disabled = true;
    try {
      await runCloudBackupNow('manual_admin');
      toast('Copia actual subida correctamente a la Base de Datos', 'success');
      await loadAndRenderAdminCloudBackups();
    } catch (e) {
      toast('Error al forzar copia: ' + e.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btn-force-all-users-backup')?.addEventListener('click', async () => {
    await forceAllUsersBackupNow();
  });

  document.getElementById('btn-refresh-cloud-backups')?.addEventListener('click', () => {
    loadAndRenderAdminCloudBackups();
  });

  document.getElementById('admin-user-filter')?.addEventListener('change', (e) => {
    adminSelectedUserFilter = e.target.value;
    filterAndRenderAdminCloudList();
  });

  document.getElementById('admin-search-cloud')?.addEventListener('input', () => {
    filterAndRenderAdminCloudList();
  });

  // Cargar lista inicial
  await loadAndRenderAdminCloudBackups();
}

async function loadAndRenderAdminCloudBackups() {
  const container = document.getElementById('admin-cloud-backups-container');
  if (!container) return;

  try {
    const list = await DB.getCloudBackupsList();
    adminBackupsCache = Array.isArray(list) ? list : [];

    // Poblar selector de usuarios únicos
    const userSelect = document.getElementById('admin-user-filter');
    if (userSelect) {
      const userMap = new Map();
      adminBackupsCache.forEach(b => {
        const email = b.user_email || 'usuario@parksales';
        const name = b.user_name || email.split('@')[0];
        const count = (userMap.get(email)?.count || 0) + 1;
        userMap.set(email, { email, name, count });
      });

      let opts = `<option value="">Todos los usuarios (${adminBackupsCache.length} copias)</option>`;
      userMap.forEach(u => {
        const isSel = adminSelectedUserFilter === u.email ? 'selected' : '';
        opts += `<option value="${escapeHtml(u.email)}" ${isSel}>${escapeHtml(u.name)} (${escapeHtml(u.email)}) — ${u.count} copias</option>`;
      });
      userSelect.innerHTML = opts;
    }

    filterAndRenderAdminCloudList();
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);">
          <p style="color:#FC6076;margin-bottom:8px;">No se pudieron cargar las copias de Supabase: ${escapeHtml(err.message)}</p>
          <p style="font-size:12px;">Asegúrate de haber ejecutado el script <strong>sql/copias_seguridad.sql</strong> en el SQL Editor de tu panel de Supabase.</p>
        </div>
      `;
    }
  }
}

function filterAndRenderAdminCloudList() {
  const container = document.getElementById('admin-cloud-backups-container');
  const countEl = document.getElementById('admin-cloud-total-count');
  if (!container) return;

  const userFilter = (document.getElementById('admin-user-filter')?.value || '').trim().toLowerCase();
  const searchFilter = (document.getElementById('admin-search-cloud')?.value || '').trim().toLowerCase();

  let filtered = adminBackupsCache;

  if (userFilter) {
    filtered = filtered.filter(b => (b.user_email || '').toLowerCase() === userFilter);
  }

  if (searchFilter) {
    filtered = filtered.filter(b => {
      const email = (b.user_email || '').toLowerCase();
      const name = (b.user_name || '').toLowerCase();
      const fecha = new Date(b.fecha).toLocaleString('es-ES').toLowerCase();
      const tipo = (b.tipo || '').toLowerCase();
      return email.includes(searchFilter) || name.includes(searchFilter) || fecha.includes(searchFilter) || tipo.includes(searchFilter);
    });
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} copia(s) encontrada(s)`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:36px 16px;color:var(--text-muted);border:1px dashed var(--border);border-radius:var(--radius-s);">
        No hay copias de seguridad en la BD que coincidan con el filtro seleccionado.
      </div>
    `;
    return;
  }

  // Agrupación visual por días (Hoy, Ayer, Días anteriores)
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let html = '';
  filtered.forEach(b => {
    const bDate = new Date(b.fecha);
    const dateDayStr = bDate.toISOString().slice(0, 10);
    const timeStr = bDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateStr = bDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    let tagDay = '';
    let tagColor = 'var(--text-muted)';
    let tagBg = 'rgba(255,255,255,0.05)';

    if (dateDayStr === todayStr) {
      tagDay = 'Hoy';
      tagColor = '#38EF7D';
      tagBg = 'rgba(56,239,125,0.12)';
    } else if (dateDayStr === yesterdayStr) {
      tagDay = 'Ayer';
      tagColor = '#00C6FF';
      tagBg = 'rgba(0,198,255,0.12)';
    } else {
      tagDay = fullDateStr;
    }

    const st = b.stats || {};
    const vCount = st.ventas ?? (Array.isArray(b.data?.ventas) ? b.data.ventas.length : 0);
    const vTotal = st.importe_total ?? (Array.isArray(b.data?.ventas) ? b.data.ventas.reduce((a, v) => a + (Number(v.importe_total) || 0), 0) : 0);
    const cCount = st.contactos ?? (Array.isArray(b.data?.contactos) ? b.data.contactos.length : 0);
    const lCount = st.llamadas ?? (Array.isArray(b.data?.llamadas) ? b.data.llamadas.length : 0);
    const hasNotas = st.has_notas ?? Boolean(b.data?.notas_rapidas && String(b.data.notas_rapidas).trim());

    const fmtTotal = typeof fmtEUR === 'function' ? fmtEUR(vTotal) : `${Number(vTotal || 0).toFixed(2)} €`;

    const resumenParts = [];
    resumenParts.push(`<strong>${vCount}</strong> ventas (${fmtTotal})`);
    if (cCount) resumenParts.push(`<strong>${cCount}</strong> apuntes`);
    if (lCount) resumenParts.push(`<strong>${lCount}</strong> llamadas`);
    if (hasNotas) resumenParts.push(`notas`);

    const userDisplayName = b.user_name || (b.user_email ? b.user_email.split('@')[0] : 'Usuario');

    html += `
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:all 0.2s;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--text-primary);">${escapeHtml(userDisplayName)}</span>
            <span style="font-size:11px;color:var(--text-muted);">(${escapeHtml(b.user_email || '—')})</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 6px;border-radius:4px;background:${tagBg};color:${tagColor};">
              ${tagDay} · ${timeStr}
            </span>
            ${b.tipo === 'manual_admin' ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,154,68,0.15);color:#FF9A44;font-weight:600;">Manual</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">
            ${resumenParts.join(' · ')}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-primary btn-sm" onclick="downloadCloudBackupJson('${b.id}', '${escapeHtml(b.user_email || 'usuario')}', '${b.fecha}')" title="Descargar archivo .json para enviar al usuario">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            Descargar JSON
          </button>
          <button class="btn btn-secondary btn-sm" onclick="restoreCloudBackupDirectly('${b.id}')" title="Restaurar en este navegador">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Restaurar
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteCloudBackupUI('${b.id}')" title="Eliminar de la BD">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.downloadCloudBackupJson = async function (id, userEmail, fecha) {
  try {
    toast('Descargando copia de la base de datos...', 'info', 2000);
    const item = await DB.getCloudBackupDetail(id);
    if (!item || !item.data) {
      toast('No se encontró el contenido de la copia', 'error');
      return;
    }

    const cleanEmail = String(userEmail || 'usuario').replace(/[@.]/g, '_');
    const dateSlug = (fecha || new Date().toISOString()).slice(0, 10);
    const fileName = `parksales_backup_${cleanEmail}_${dateSlug}.json`;

    downloadFile(fileName, JSON.stringify(item.data, null, 2), 'application/json');
    toast(`✅ Archivo ${fileName} descargado. Pásaselo al usuario para que lo importe en "Restaurar Datos".`, 'success', 6000);
  } catch (err) {
    toast('Error al descargar: ' + err.message, 'error');
  }
};

window.restoreCloudBackupDirectly = async function (id) {
  try {
    const item = await DB.getCloudBackupDetail(id);
    if (!item || !item.data) {
      toast('No se encontró la copia seleccionada', 'error');
      return;
    }

    const data = item.data;
    const fecha = new Date(item.fecha).toLocaleString('es-ES');
    const userLabel = item.user_name || item.user_email || 'usuario';

    confirmDialog({
      title: 'Restaurar copia en este navegador',
      message: `¿Deseas restaurar en tu navegador la copia de <strong>${escapeHtml(userLabel)}</strong> del <strong>${fecha}</strong>?<br><br>Se añadirán los registros sin sobreescribir los duplicados existentes.`,
      isHtmlMessage: true,
      confirmLabel: 'Restaurar ahora',
      danger: false,
      onConfirm: async () => {
        try {
          if (typeof applyBackupData === 'function') {
            const stats = await applyBackupData(data);
            closeModal();
            toast(`Copia restaurada: ${stats.ventas} ventas, ${stats.contactos} apuntes, ${stats.llamadas} llamadas`, 'success', 5000);
          } else {
            toast('Función de importación no disponible', 'error');
          }
        } catch (err) {
          toast('Error al restaurar: ' + err.message, 'error');
        }
      }
    });
  } catch (err) {
    toast('Error al leer copia de BD: ' + err.message, 'error');
  }
};

window.deleteCloudBackupUI = async function (id) {
  confirmDialog({
    title: 'Eliminar copia de la Base de Datos',
    message: '¿Estás seguro de que quieres eliminar esta copia de seguridad de la BD?',
    confirmLabel: 'Eliminar',
    onConfirm: async () => {
      try {
        await DB.deleteCloudBackup(id);
        toast('Copia eliminada de la base de datos', 'info');
        await loadAndRenderAdminCloudBackups();
      } catch (err) {
        toast('Error al eliminar: ' + err.message, 'error');
      }
    },
  });
};

/* ============================================================================
   FORZAR BACKUP DE TODOS LOS USUARIOS
============================================================================ */
async function forceAllUsersBackupNow() {
  const btn = document.getElementById('btn-force-all-users-backup');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:12px;height:12px;border-width:2px;vertical-align:middle;margin-right:6px;"></span> Enviando señal...`;
  }

  try {
    // 1. Guardar copia propia del admin en BD
    await runCloudBackupNow('forzado_admin');

    // 2. Escribir la señal en BD para que todos los demás la detecten
    const requestedAt = await DB.requestForceBackupAll();
    const hora = new Date(requestedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    toast(
      `✅ Señal enviada a todos los usuarios. Cada usuario guardará su copia automáticamente en cuanto esté activo (máx. 5 min). La señal se emitió a las ${hora}.`,
      'success',
      8000
    );

    // 3. Recargar lista para ver la nueva copia del admin
    setTimeout(() => loadAndRenderAdminCloudBackups(), 1500);
  } catch (e) {
    toast('Error al enviar señal de backup: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

window.forceAllUsersBackupNow = forceAllUsersBackupNow;

function wireAutoBackupUI() {
  // Botón de la sección Exportar
  const btnExport = document.getElementById('btn-enable-auto-backup');
  if (btnExport) btnExport.addEventListener('click', toggleAutoBackup);

  // Botones con clase .backup-toggle-btn (toggle activar/desactivar)
  document.querySelectorAll('.backup-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleAutoBackup);
  });

  // Botones con clase .backup-now-btn (hacer copia ahora)
  document.querySelectorAll('.backup-now-btn').forEach(btn => {
    btn.addEventListener('click', manualBackupNow);
  });

  // Botón para ver lista de backups locales
  const btnList = document.getElementById('btn-list-backups');
  if (btnList) btnList.addEventListener('click', showBackupList);

  // Botón para abrir el panel protegido de recuperación de cookies
  const btnCloudRecovery = document.getElementById('btn-open-cloud-recovery');
  if (btnCloudRecovery) btnCloudRecovery.addEventListener('click', openAdminCookiesRecoveryPanel);

  const tbmCloudRecovery = document.getElementById('tbm-cloud-recovery-btn');
  if (tbmCloudRecovery) tbmCloudRecovery.addEventListener('click', () => {
    if (typeof toggleTopbarUserMenu === 'function') toggleTopbarUserMenu(false);
    openAdminCookiesRecoveryPanel();
  });

  document.querySelectorAll('.cloud-recovery-trigger').forEach(btn => {
    btn.addEventListener('click', openAdminCookiesRecoveryPanel);
  });
}

wireAutoBackupUI();

