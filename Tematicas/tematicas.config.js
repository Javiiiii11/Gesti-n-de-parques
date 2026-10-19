/* ============================================================================
   PARKSALES · CONFIGURACIÓN DE TEMÁTICAS ESTACIONALES
   ============================================================================
   Aquí estan las variables para activar o desactivar la
   tematización de la web según la época del año.

   INSTRUCCIONES:
   - Para ACTIVAR Halloween:  cambia `tematica_halloween = true;`  (y `tematica_navidad = false;`)
   - Para ACTIVAR Navidad:    cambia `tematica_navidad = true;`    (y `tematica_halloween = false;`)
   - Para DESACTIVAR ambas:   pon ambas en `false;`

   Al activar cualquiera de las dos, se aplicará automáticamente todo su diseño,
   efectos visuales (murciélagos/nieve), adornos, banners y sonidos opcionales
   sin alterar en lo más mínimo el funcionamiento ni los datos de la web.
   Al desactivarlas, la web vuelve al diseño corporativo original limpio.
   ============================================================================ */

// 🎃 TEMÁTICA HALLOWEEN (true = ACTIVA, false = DESACTIVADA)
const tematica_halloween = true;

// 🎄 TEMÁTICA NAVIDAD (true = ACTIVA, false = DESACTIVADA)
const tematica_navidad = false;

// Opciones adicionales configurables para Halloween
const CONFIG_HALLOWEEN = {
  mostrarBannerDashboard: true,     // Banner ilustrado en el Dashboard con cuenta atrás
  mostrarMurcielagos: true,         // Murciélagos animados sutiles en el fondo
  mostrarTelaranas: true,           // Telarañas finas en las esquinas superiores
  decorarCalabazasTarjetas: true,   // Calabazas en esquinas de tarjetas KPI
  sonidosTerror: false              // Sonidos desactivados por defecto (se pueden encender en la barra)
};

// Opciones adicionales configurables para Navidad
const CONFIG_NAVIDAD = {
  mostrarBannerDashboard: true,     // Banner ilustrado en el Dashboard con cuenta atrás a Nochebuena
  mostrarNieve: true,               // Nieve cayendo suavemente en el fondo de la pantalla
  decorarNieveTarjetas: true,       // Nieve sobre el borde superior de cada tarjeta
  decorarAdornosTarjetas: true,     // Adornos festivos en las esquinas de las tarjetas KPI
  mostrarGuirnaldas: true,          // Guirnaldas de pino y luces en las esquinas superiores
  sonidosNavidad: false             // Campanas navideñas desactivadas por defecto (se encienden en la barra)
};


