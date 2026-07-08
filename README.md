# ParkSales — Gestión y análisis de ventas de entradas a parques de ocio

Aplicación web (HTML/CSS/JS vanilla) para registrar ventas de entradas de forma
rápida y consultar estadísticas, ingresos y comisiones. Pensada para GitHub
Pages + Supabase, modo oscuro por defecto, 100% responsive.

## 1. Estructura del proyecto

```
park-sales-app/
├── index.html              # App completa (SPA)
├── css/
│   └── style.css
├── js/
│   ├── supabase-client.js  # Configuración de Supabase + capa de datos (DB/AUTH)
│   ├── utils.js            # Helpers, toasts, modal, formato
│   ├── auth.js              # Login / registro / Google / modo invitado
│   ├── parques.js           # CRUD de parques
│   ├── ventas.js             # Registro rápido de ventas
│   ├── historial.js          # Tabla de historial (filtros, orden, paginación)
│   ├── dashboard.js          # KPIs y gráficos del panel principal
│   ├── estadisticas.js       # Comparativas, tendencias y rankings
│   ├── exportar.js           # CSV / Excel / JSON, import de backups
│   └── app.js                 # Enrutado de vistas e inicialización
├── sql/
│   └── schema.sql            # Esquema completo de Supabase (tablas + RLS)
└── README.md
```

## 2. Probar la app sin configurar nada (modo local)

Puedes abrir `index.html` directamente (o servirlo con GitHub Pages) y pulsar
**"Entrar sin cuenta (modo local de prueba)"** en la pantalla de acceso. La
app funcionará al 100% guardando los datos en el `localStorage` del navegador,
para que puedas probar todo el flujo antes de conectar Supabase.

> Nota: el acceso con Google requiere ejecutar la app en una URL `http/https`
> (por ejemplo, GitHub Pages o `http://localhost`). Si abres el archivo con
> `file://`, Google OAuth no puede completar la redirección.

## 3. Configurar Supabase (producción)

### 3.1 Crear el proyecto
1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

### 3.2 Crear las tablas
1. Abre **SQL Editor → New query**.
2. Pega el contenido completo de `sql/schema.sql` y ejecútalo.
3. Verifica en **Table Editor** que existen `parques` (con 3 parques de
   ejemplo) y `ventas` (vacía).

### 3.3 Activar autenticación
1. Ve a **Authentication → Providers**.
2. **Email**: actívalo si no lo está (activado por defecto).
3. **Google** (opcional): actívalo y añade tu `Client ID` / `Client Secret`
   de Google Cloud Console. En **Authentication → URL Configuration**, añade
   la URL de tu GitHub Pages (p. ej. `https://tuusuario.github.io/parksales/`)
   como *Redirect URL*.

### 3.4 Conectar la app
Edita `js/supabase-client.js` y sustituye:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-CLAVE-ANON-PUBLICA';
```

por tus valores reales. En esta copia ya están configurados con tu proyecto,
así que la app debería usar Supabase directamente y reservar el modo local
solo para pruebas sin backend.

## 4. Desplegar en GitHub Pages

1. Sube esta carpeta (`park-sales-app/`) a un repositorio de GitHub.
2. Ve a **Settings → Pages**.
3. En **Source**, elige la rama (`main`) y la carpeta raíz (`/` o `/docs` si
   renombras la carpeta).
4. Guarda. Tu app quedará disponible en
   `https://tuusuario.github.io/nombre-repo/`.
5. No hace falta build ni bundler: es HTML/CSS/JS puro servido tal cual.

## 5. Funcionalidades incluidas

- **Dashboard**: ventas de hoy/semana/mes, total acumulado, comisiones,
  entradas vendidas, parque más vendido, gráfico de evolución (30 días),
  reparto por parque, ranking y objetivo mensual configurable.
- **Registro rápido de ventas**: formulario optimizado con cálculo automático
  de importe y comisión, vista previa tipo "ticket", botones *Guardar*,
  *Guardar y añadir otra* y *Limpiar*.
- **Gestión de parques**: alta/edición/baja, comisión fija + porcentual,
  estado activo/inactivo (protegido si el parque tiene ventas asociadas).
- **Historial de ventas**: búsqueda instantánea, filtros por fecha/parque/tipo,
  orden por columna, edición y eliminación con confirmación, paginación.
- **Estadísticas**: ventas por parque/mes/día de la semana, comisiones por
  periodo, rankings, comparativa mensual con variación %.
- **Exportación / Importación**: CSV, Excel (.xlsx), backup completo en JSON
  e importación de backups previos.
- **Modo oscuro por defecto**, con alternancia a modo claro persistente.
- **100% responsive**: sidebar colapsable en móvil, tablas con scroll
  horizontal, tarjetas adaptables.

## 6. Seguridad

- Row Level Security (RLS) activado en `parques` y `ventas`: solo usuarios
  autenticados pueden leer/escribir.
- Validación de formularios en cliente (cantidades > 0, precios ≥ 0, campos
  obligatorios) y restricciones `CHECK` a nivel de base de datos.
- Nunca se expone la `service_role key`: la app solo usa la `anon key`,
  diseñada para ser pública y protegida por RLS.
- Un parque no puede eliminarse si tiene ventas asociadas (se recomienda
  desactivarlo en su lugar), evitando referencias huérfanas.

## 7. Preparado para crecer

- El esquema SQL incluye índices en las columnas más consultadas (`fecha`,
  `parque_id`, `tipo_entrada`) para mantener el rendimiento con miles de
  registros.
- La tabla `ventas` ya incluye `user_id`, lista para cuando quieras separar
  datos por vendedor/usuario (solo tendrías que ajustar las políticas RLS
  añadiendo `user_id = auth.uid()`).
- La capa `DB` en `supabase-client.js` centraliza todo el acceso a datos, así
  que añadir nuevas consultas o tablas es cuestión de ampliar ese único
  archivo.

## 8. Personalización rápida

- **Objetivo mensual**: se edita directamente desde la tarjeta "Objetivo del
  mes" del Dashboard.
- **Tipos de entrada sugeridos**: edita el array `TIPOS_ENTRADA_SUGERIDOS` en
  `js/ventas.js`.
- **Colores / tema**: variables CSS en la cabecera de `css/style.css`
  (`:root`), fácilmente ajustables sin tocar el resto del código.
