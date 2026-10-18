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

    if (halloweenActivo) {
      if (typeof window.initHalloweenTheme === 'function') {
        window.initHalloweenTheme();
      }
      return;
    }

    // 2. Comprobar futura temática de Navidad
    const navidadActiva = (typeof tematica_navidad !== 'undefined' && tematica_navidad === true) ||
                          (typeof window.tematica_navidad !== 'undefined' && window.tematica_navidad === true);

    if (navidadActiva) {
      // Reservado para la futura temática navideña
      return;
    }

    // 3. Si no hay temática activa, limpiar cualquier elemento residual
    if (typeof window.destroyHalloweenTheme === 'function') {
      window.destroyHalloweenTheme();
    }
    document.documentElement.classList.remove('theme-halloween');
    document.body.classList.remove('theme-halloween');
  }

  // Función global para que Javier o cualquier desarrollador pueda probar en vivo
  window.setTematicaHalloween = function (activar) {
    window.tematica_halloween = !!activar;
    if (activar) {
      if (typeof window.initHalloweenTheme === 'function') window.initHalloweenTheme();
      if (typeof toast === 'function') toast('🎃 Temática de Halloween ACTIVADA', 'info', 2500);
    } else {
      if (typeof window.destroyHalloweenTheme === 'function') window.destroyHalloweenTheme();
      if (typeof toast === 'function') toast('Temática de Halloween DESACTIVADA', 'info', 2500);
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
