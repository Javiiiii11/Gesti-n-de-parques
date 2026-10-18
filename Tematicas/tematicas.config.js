/* ============================================================================
   PARKSALES · CONFIGURACIÓN DE TEMÁTICAS ESTACIONALES
   ============================================================================
   Aquí estan las variables para activar o desactivar la
   tematización de la web según la época del año.

   INSTRUCCIONES:
   - Para ACTIVAR Halloween:  cambia `tematica_halloween = true;`
   - Para DESACTIVAR Halloween: cambia `tematica_halloween = false;`

   Al activar la variable, se aplicará automáticamente todo el diseño,
   decoraciones de calabazas, murciélagos, banners y efectos visuales
   sin alterar en lo más mínimo el funcionamiento ni los datos de la web.
   Al ponerla en `false`, la web volverá al diseño original limpio.
   ============================================================================ */

// 🎃 TEMÁTICA HALLOWEEN (true = ACTIVA, false = DESACTIVADA)
const tematica_halloween = true;

// 🎄 TEMÁTICA NAVIDAD (Próximamente para la temporada navideña)
const tematica_navidad = false;

// Opciones adicionales configurables para Halloween (opcional)
const CONFIG_HALLOWEEN = {
  mostrarBannerDashboard: true,     // Banner ilustrado en el Dashboard con cuenta atrás
  mostrarMurcielagos: true,         // Murciélagos animados sutiles en el fondo
  mostrarTelaranas: true,           // Telarañas finas en las esquinas superiores
  decorarCalabazasTarjetas: true,   // Calabazas en esquinas de tarjetas KPI
  sonidosTerror: false,             // Sonidos desactivados por defecto (se pueden encender en la barra)
};

