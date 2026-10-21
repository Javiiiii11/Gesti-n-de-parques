/* ============================================================================
   Temáticas ParkSales · MOTOR DE TEMÁTICAS ESTACIONALES
   Lee las variables de configuración `tematica_blackfriday`, `tematica_halloween`,
   `tematica_navidad` y activa o desactiva la tematización de manera segura e instantánea.
   ============================================================================ */

(function () {
  'use strict';

  function limpiarTodasLasTematicas() {
    if (typeof window.destroyBlackFridayTheme === 'function') {
      window.destroyBlackFridayTheme();
    }
    if (typeof window.destroyHalloweenTheme === 'function') {
      window.destroyHalloweenTheme();
    }
    if (typeof window.destroyNavidadTheme === 'function') {
      window.destroyNavidadTheme();
    }
    document.documentElement.classList.remove('theme-halloween', 'theme-navidad', 'theme-blackfriday');
    document.body.classList.remove('theme-halloween', 'theme-navidad', 'theme-blackfriday');
  }

  function aplicarTematicaActiva() {
    // 1. Comprobar temática de Black Friday
    const blackFridayActivo = (typeof tematica_blackfriday !== 'undefined' && tematica_blackfriday === true) ||
                              (typeof window.tematica_blackfriday !== 'undefined' && window.tematica_blackfriday === true);

    // 2. Comprobar temática de Halloween
    const halloweenActivo = (typeof tematica_halloween !== 'undefined' && tematica_halloween === true) ||
                            (typeof window.tematica_halloween !== 'undefined' && window.tematica_halloween === true);

    // 3. Comprobar temática de Navidad
    const navidadActiva = (typeof tematica_navidad !== 'undefined' && tematica_navidad === true) ||
                          (typeof window.tematica_navidad !== 'undefined' && window.tematica_navidad === true);

    if (blackFridayActivo) {
      limpiarTodasLasTematicas();
      if (typeof window.initBlackFridayTheme === 'function') {
        window.initBlackFridayTheme();
      }
      return;
    }

    if (halloweenActivo) {
      limpiarTodasLasTematicas();
      if (typeof window.initHalloweenTheme === 'function') {
        window.initHalloweenTheme();
      }
      return;
    }

    if (navidadActiva) {
      limpiarTodasLasTematicas();
      if (typeof window.initNavidadTheme === 'function') {
        window.initNavidadTheme();
      }
      return;
    }

    // 4. Si no hay temática activa, limpiar cualquier elemento residual
    limpiarTodasLasTematicas();
  }

  // Función global para activar/desactivar Black Friday en vivo
  window.setTematicaBlackFriday = function (activar) {
    window.tematica_blackfriday = !!activar;
    if (activar) {
      window.tematica_halloween = false;
      window.tematica_navidad = false;
      limpiarTodasLasTematicas();
      if (typeof window.initBlackFridayTheme === 'function') window.initBlackFridayTheme();
      if (typeof toast === 'function') toast('⚡ Temática Black Friday ACTIVADA', 'info', 2500);
    } else {
      if (typeof window.destroyBlackFridayTheme === 'function') window.destroyBlackFridayTheme();
      if (typeof toast === 'function') toast('Temática Black Friday DESACTIVADA', 'info', 2500);
    }
  };

  // Función global para probar Halloween en vivo
  window.setTematicaHalloween = function (activar) {
    window.tematica_halloween = !!activar;
    if (activar) {
      window.tematica_blackfriday = false;
      window.tematica_navidad = false;
      limpiarTodasLasTematicas();
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
      window.tematica_blackfriday = false;
      window.tematica_halloween = false;
      limpiarTodasLasTematicas();
      if (typeof window.initNavidadTheme === 'function') window.initNavidadTheme();
      if (typeof toast === 'function') toast('🎄 Temática de Navidad ACTIVADA', 'info', 2500);
    } else {
      if (typeof window.destroyNavidadTheme === 'function') window.destroyNavidadTheme();
      if (typeof toast === 'function') toast('Temática de Navidad DESACTIVADA', 'info', 2500);
    }
  };

  // Selector unificado de temáticas
  window.cambiarTematica = function (nombre) {
    switch ((nombre || '').toLowerCase()) {
      case 'blackfriday':
      case 'black_friday':
      case 'bf':
        window.setTematicaBlackFriday(true);
        break;
      case 'halloween':
        window.setTematicaHalloween(true);
        break;
      case 'navidad':
      case 'xmas':
        window.setTematicaNavidad(true);
        break;
      default:
        window.tematica_blackfriday = false;
        window.tematica_halloween = false;
        window.tematica_navidad = false;
        limpiarTodasLasTematicas();
        if (typeof toast === 'function') toast('Diseño corporativo original restaurado', 'info', 2500);
        break;
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
