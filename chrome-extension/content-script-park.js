/* ============================================================================
   ParkSite Bonos Rápidos — Content Script para ParkSite
   Puente de comunicación entre la aplicación web ParkSite y la extensión.
============================================================================ */

(function () {
  console.log('[ParkSite Extension Bridge] Content script cargado en ParkSite.');

  const manifest = chrome.runtime.getManifest();
  const version = manifest.version || '1.0.0';

  // 1. Notificar a ParkSite que la extensión está lista
  function notificarParkSiteListo() {
    window.postMessage({
      type: 'PARKSITE_EXTENSION_READY',
      version: version
    }, '*');
  }

  // Notificar inmediatamente y tras un breve retraso por si la app arranca asíncrona
  notificarParkSiteListo();
  setTimeout(notificarParkSiteListo, 500);
  setTimeout(notificarParkSiteListo, 1500);

  // Solicitar sincronización inicial a ParkSite
  window.postMessage({ type: 'PARKSITE_REQUEST_SYNC' }, '*');

  // 2. Escuchar mensajes provenientes de la ventana de ParkSite
  window.addEventListener('message', (event) => {
    // Aceptar solo mensajes de la propia ventana
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    const { type, payload } = event.data;

    // Ping desde ParkSite
    if (type === 'PARKSITE_PING') {
      window.postMessage({
        type: 'PARKSITE_PONG',
        version: version
      }, '*');
    }

    // Guardar plantilla desde ParkSite
    if (type === 'PARKSITE_SAVE_TEMPLATE') {
      chrome.runtime.sendMessage({
        action: 'SAVE_TEMPLATE',
        template: payload
      }, (response) => {
        if (response && response.success) {
          window.postMessage({
            type: 'PARKSITE_SAVE_SUCCESS',
            abreviatura: payload ? payload.abreviatura : null
          }, '*');
        }
      });
    }

    // Eliminar plantilla desde ParkSite
    if (type === 'PARKSITE_DELETE_TEMPLATE') {
      chrome.runtime.sendMessage({
        action: 'DELETE_TEMPLATE',
        abreviatura: payload ? payload.abreviatura : null
      });
    }

    // Sincronización masiva de plantillas enviada por ParkSite
    if (type === 'PARKSITE_SYNC_RESPONSE') {
      if (Array.isArray(payload) && payload.length > 0) {
        chrome.runtime.sendMessage({
          action: 'SYNC_FROM_PARKSITE',
          plantillas: payload
        });
      }
    }
  });
})();

