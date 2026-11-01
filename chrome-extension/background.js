/* ============================================================================
   ParkSite Bonos Rápidos — Background Service Worker (Manifest V3)
   Gestiona la persistencia local de plantillas y la sincronización con ParkSite.
============================================================================ */

const DEFAULT_CONFIG = {
  enabled: true,
  triggerKey: 'space', // 'space', 'tab', 'enter', 'auto'
  lastSync: null
};

// Inicialización de almacenamiento en instalación o arranque
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['plantillas_bonos', 'config'], (res) => {
    const updates = {};
    if (!res.plantillas_bonos) {
      updates.plantillas_bonos = {};
    }
    if (!res.config) {
      updates.config = DEFAULT_CONFIG;
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
  console.log('[ParkSite Extension] Instalada y lista.');
});

// Listener de mensajes entre Content Scripts, Popup y Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  // 1. Guardar o actualizar una plantilla
  if (action === 'SAVE_TEMPLATE') {
    const template = request.template;
    if (!template || !template.abreviatura) {
      sendResponse({ success: false, error: 'Abreviatura requerida' });
      return true;
    }

    const key = template.abreviatura.trim().toLowerCase();
    chrome.storage.local.get(['plantillas_bonos'], (res) => {
      const templates = res.plantillas_bonos || {};
      templates[key] = {
        ...template,
        updated_at: new Date().toISOString()
      };

      chrome.storage.local.set({ plantillas_bonos: templates }, () => {
        console.log(`[ParkSite Extension] Plantilla ${template.abreviatura} guardada en storage local.`);
        sendResponse({ success: true, count: Object.keys(templates).length });
      });
    });
    return true; // Asíncrono
  }

  // 2. Obtener todas las plantillas
  if (action === 'GET_TEMPLATES') {
    chrome.storage.local.get(['plantillas_bonos'], (res) => {
      const templates = res.plantillas_bonos || {};
      const list = Object.values(templates).sort((a, b) => 
        (a.abreviatura || '').localeCompare(b.abreviatura || '', undefined, { numeric: true })
      );
      sendResponse({ success: true, plantillas: list });
    });
    return true;
  }

  // 3. Eliminar una plantilla
  if (action === 'DELETE_TEMPLATE') {
    const key = (request.abreviatura || '').trim().toLowerCase();
    chrome.storage.local.get(['plantillas_bonos'], (res) => {
      const templates = res.plantillas_bonos || {};
      if (templates[key]) {
        delete templates[key];
        chrome.storage.local.set({ plantillas_bonos: templates }, () => {
          sendResponse({ success: true, remaining: Object.keys(templates).length });
        });
      } else {
        sendResponse({ success: true, remaining: Object.keys(templates).length });
      }
    });
    return true;
  }

  // 4. Sincronización masiva desde ParkSite
  if (action === 'SYNC_FROM_PARKSITE') {
    const incomingList = request.plantillas || [];
    chrome.storage.local.get(['plantillas_bonos', 'config'], (res) => {
      const templates = res.plantillas_bonos || {};
      incomingList.forEach(t => {
        if (t && t.abreviatura) {
          templates[t.abreviatura.trim().toLowerCase()] = t;
        }
      });
      const cfg = res.config || DEFAULT_CONFIG;
      cfg.lastSync = new Date().toISOString();

      chrome.storage.local.set({ plantillas_bonos: templates, config: cfg }, () => {
        sendResponse({ success: true, total: Object.keys(templates).length });
      });
    });
    return true;
  }

  // 5. Configuración
  if (action === 'GET_CONFIG') {
    chrome.storage.local.get(['config'], (res) => {
      sendResponse({ success: true, config: res.config || DEFAULT_CONFIG });
    });
    return true;
  }

  if (action === 'SET_CONFIG') {
    chrome.storage.local.get(['config'], (res) => {
      const current = res.config || DEFAULT_CONFIG;
      const updated = { ...current, ...(request.config || {}) };
      chrome.storage.local.set({ config: updated }, () => {
        sendResponse({ success: true, config: updated });
      });
    });
    return true;
  }

  // 6. Ping / Status
  if (action === 'PING') {
    sendResponse({ pong: true, version: chrome.runtime.getManifest().version });
    return false;
  }
});

