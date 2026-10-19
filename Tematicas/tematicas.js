/* ============================================================================
   Temáticas ParkSales · MOTOR DE TEMÁTICAS ESTACIONALES
   Lee la variable de configuración `tematica_halloween` (y futuras como navidad)
   y activa o desactiva la tematización de manera segura e instantánea.
============================================================================ */

(function () {
  'use strict';

  function aplicarTematicaActiva() {
    // 1. Comprobar temática de Halloween
    const halloweenActivo = (typeof tematica_halloween !== 'undefined' && tematica_halloween === true) ||
                            (typeof window.tematica_halloween !== 'undefined' && window.tematica_halloween === true);

    // 2. Comprobar temática de Navidad
    const navidadActiva = (typeof tematica_navidad !== 'undefined' && tematica_navidad === true) ||
                          (typeof window.tematica_navidad !== 'undefined' && window.tematica_navidad === true);

    if (halloweenActivo) {
      if (typeof window.destroyNavidadTheme === 'function') {
        window.destroyNavidadTheme();
      }
      if (typeof window.initHalloweenTheme === 'function') {
        window.initHalloweenTheme();
      }
      return;
    }

    if (navidadActiva) {
      if (typeof window.destroyHalloweenTheme === 'function') {
        window.destroyHalloweenTheme();
      }
      if (typeof window.initNavidadTheme === 'function') {
        window.initNavidadTheme();
      }
      return;
    }

    // 3. Si no hay temática activa, limpiar cualquier elemento residual
    if (typeof window.destroyHalloweenTheme === 'function') {
      window.destroyHalloweenTheme();
    }
    if (typeof window.destroyNavidadTheme === 'function') {
      window.destroyNavidadTheme();
    }
    document.documentElement.classList.remove('theme-halloween', 'theme-navidad');
    document.body.classList.remove('theme-halloween', 'theme-navidad');
  }

  // Función global para probar Halloween en vivo
  window.setTematicaHalloween = function (activar) {
    window.tematica_halloween = !!activar;
    if (activar) {
      window.tematica_navidad = false;
      if (typeof window.destroyNavidadTheme === 'function') window.destroyNavidadTheme();
      if (typeof window.initHalloweenTheme === 'function') window.initHalloweenTheme();
      if (typeof toast === 'function') toast('🎃 Temática de Halloween ACTIVADA', 'info', 2500);
    } else {
      if (typeof window.destroyHalloweenTheme === 'function') window.destroyHalloweenTheme();
      if (typeof toast === 'function') toast('Temática de Halloween DESACTIVADA', 'info', 2500);
    }
  };

  // Función global para probar Navidad en vivo
  window.setTematicaNavidad = function (activar) {
    window.tematica_navidad = !!activar;
    if (activar) {
      window.tematica_halloween = false;
      if (typeof window.destroyHalloweenTheme === 'function') window.destroyHalloweenTheme();
      if (typeof window.initNavidadTheme === 'function') window.initNavidadTheme();
      if (typeof toast === 'function') toast('🎄 Temática de Navidad ACTIVADA', 'info', 2500);
    } else {
      if (typeof window.destroyNavidadTheme === 'function') window.destroyNavidadTheme();
      if (typeof toast === 'function') toast('Temática de Navidad DESACTIVADA', 'info', 2500);
    }
  };

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarTematicaActiva);
  } else {
    aplicarTematicaActiva();
  }

  // Refuerzo tras arranque de la app
  window.addEventListener('load', () => {
    setTimeout(aplicarTematicaActiva, 120);
  });

})();
