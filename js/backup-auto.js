/* ============================================================================
   backup-auto.js — copias de seguridad automáticas en IndexedDB
   Totalmente compatible con GitHub Pages. Los backups se guardan dentro
   del navegador y se pueden descargar como .json cuando quieras.
============================================================================ */

const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const BACKUP_MAX_FILES = 15;
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

/* --- Activación automática al arrancar la app --- */
async function initAutoBackup() {
  // Las copias automáticas se activan SIEMPRE al iniciar la app
  autoBackupEnabled = true;
  updateBackupUI();
  startBackupInterval();

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
async function runBackupNow() {
  try {
    const backup = {
      generado_en: new Date().toISOString(),
      version: 2,
      parques: STATE.parques,
      tipos_bono: STATE.tipos_bono,
      contactos: STATE.contactos,
      ventas: STATE.ventas,
    };

    const entry = await saveBackupToDB(backup);
    await cleanupOldBackupsDB();

    setBackupStatus(`Última copia: ${new Date().toLocaleString('es-ES')}`);
  } catch (err) {
    console.error('Error al generar la copia automática:', err);
    setBackupStatus('Error al generar la última copia: ' + err.message);
  }
}

/* --- Mostrar lista de backups guardados (para la UI) --- */
async function showBackupList() {
  const backups = await getBackupsFromDB();
  if (backups.length === 0) {
    toast('No hay backups guardados todavía', 'info');
    return;
  }

  let html = `<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;">`;
  for (const b of backups) {
    const fecha = new Date(b.fecha).toLocaleString('es-ES');
    const size = new Blob([JSON.stringify(b.data)]).size;
    const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
    html += `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${fecha}</div>
          <div style="font-size:11px;color:var(--text-muted);">${sizeStr}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-secondary btn-sm" onclick="downloadBackup('${b.id}')" title="Descargar">
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
    title: `Backups guardados (${backups.length})`,
    bodyHtml: html,
    footHtml: `<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>`,
  });
}

/* --- Descargar un backup específico --- */
window.downloadBackup = async function(id) {
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
window.deleteBackupUI = async function(id) {
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

  // Botón para ver lista de backups
  const btnList = document.getElementById('btn-list-backups');
  if (btnList) btnList.addEventListener('click', showBackupList);
}

wireAutoBackupUI();
