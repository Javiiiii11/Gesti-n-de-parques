/* ============================================================================
   exportar.js — vista "Exportar / Importar"
============================================================================ */

function initExportView() {
  document.getElementById('btn-export-ventas').addEventListener('click', exportVentasCSV);
  document.getElementById('btn-export-parques').addEventListener('click', exportParquesCSV);
  document.getElementById('btn-export-bonos').addEventListener('click', exportBonosCSV);
  document.getElementById('btn-export-contactos').addEventListener('click', exportContactosCSV);
  
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXLSX);
  document.getElementById('btn-export-json').addEventListener('click', exportBackupJSON);

  document.getElementById('btn-add-all-parks').addEventListener('click', addAllPredefinedParks);
  document.getElementById('btn-add-all-bonos').addEventListener('click', addAllPredefinedBonos);

  const drop = document.getElementById('import-drop');
  const fileInput = document.getElementById('import-file');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
  drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.style.borderColor = '';
    if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleImportFile(e.target.files[0]); });
}

// Datos predefinidos
const PREDEFINED_PARKS = [
  'Atlantis',
  'Aquopolis CAR',
  'Aquopolis CDA',
  'Aquopolis CULL',
  'Aquopolis TOR',
  'Aquopolis VILL',
  'Faunia',
  'PAM',
  'Selwo Aventura',
  'Selwo Marina',
  'Teleférico Benalmádena',
  'Warner',
  'Warner Beach',
  'ZOO'
];

const PREDEFINED_BONOS = [
  { nombre: 'Bono Oro', activo: true },
  { nombre: 'Bono Oro + Parking', activo: true },
  { nombre: 'Bono Plata', activo: true },
  { nombre: 'Bono Platino', activo: true },
  { nombre: 'Bono Verano Estándar', activo: true },
  { nombre: 'Bono Verano Plus', activo: true },
  { nombre: 'Bono Verano Plus + Warner Beach', activo: true },
  { nombre: 'Bono Verano Ultra (Inactivo)', activo: false },
  { nombre: 'Bono Zoollover', activo: true }
];

async function addAllPredefinedParks() {
  try {
    const currentParks = await DB.getParques();
    const existingNames = new Set(currentParks.map(p => p.nombre));
    const parksToAdd = PREDEFINED_PARKS.filter(nombre => !existingNames.has(nombre))
      .map(nombre => ({ nombre, activo: true }));

    if (parksToAdd.length === 0) {
      toast('Todos los parques ya están añadidos', 'info');
      return;
    }

    await DB.bulkInsertParques(parksToAdd);
    STATE.parques = await DB.getParques();
    fillParqueSelects();
    refreshAllViewsAfterDataChange();
    toast(`${parksToAdd.length} parque(s) añadido(s) correctamente`, 'success');
  } catch (err) {
    toast('Error al añadir los parques: ' + err.message, 'error');
  }
}

async function addAllPredefinedBonos() {
  try {
    const currentBonos = await DB.getTiposBono();
    const existingNames = new Set(currentBonos.map(b => b.nombre));
    const bonosToAdd = PREDEFINED_BONOS.filter(b => !existingNames.has(b.nombre));

    if (bonosToAdd.length === 0) {
      toast('Todos los bonos ya están añadidos', 'info');
      return;
    }

    await DB.bulkInsertTiposBono(bonosToAdd);
    STATE.tipos_bono = await DB.getTiposBono();
    fillBonoSelects();
    refreshAllViewsAfterDataChange();
    toast(`${bonosToAdd.length} tipo(s) de bono añadido(s) correctamente`, 'success');
  } catch (err) {
    toast('Error al añadir los bonos: ' + err.message, 'error');
  }
}

/* --- HEADERS PARA EXPORTACIONES --- */

function getVentasHeaders() {
  return [
    { label: 'Fecha', value: (v) => fmtDateTime(v.fecha) },
    { label: 'Tipo', value: (v) => v.tipo === 'entrada' ? 'Entradas' : 'Bonos' },
    { label: 'Detalle', value: (v) => v.tipo === 'entrada' ? parqueNombre(v.parque_id) : bonoNombre(v.bono_id) },
    { label: 'Cliente', value: (v) => v.cliente_nombre || '—' },
    { label: 'Importe total', value: (v) => v.importe_total },
  ];
}

function getParquesHeaders() {
  return [
    { label: 'ID', value: (p) => p.id },
    { label: 'Nombre', value: (p) => p.nombre },
    { label: 'Activo', value: (p) => p.activo ? 'Sí' : 'No' },
    { label: 'Creado el', value: (p) => fmtDateTime(p.created_at) }
  ];
}

function getBonosHeaders() {
  return [
    { label: 'ID', value: (b) => b.id },
    { label: 'Nombre', value: (b) => b.nombre },
    { label: 'Activo', value: (b) => b.activo ? 'Sí' : 'No' },
    { label: 'Creado el', value: (b) => fmtDateTime(b.created_at) }
  ];
}

function getContactosHeaders() {
  return [
    { label: 'Fecha', value: (c) => fmtDateTime(c.created_at) },
    { label: 'Cliente', value: (c) => c.nombre_apellidos || '—' },
    { label: 'Correo', value: (c) => c.correo || '—' },
    { label: 'Teléfono', value: (c) => c.telefono || '—' },
    { label: 'Tipo', value: (c) => c.tipo === 'entrada' ? 'Entradas' : 'Bonos' },
    { label: 'Parque/Bono', value: (c) => c.tipo === 'entrada' ? parqueNombre(c.parque_id) : bonoNombre(c.bono_id) },
    { label: 'Detalle (Cantidad)', value: (c) => c.tipo === 'entrada' ? (c.cantidad_entradas || 1) : (c.cantidad_bonos || 1) },
    { label: 'Extras', value: (c) => c.extras || '—' },
    { label: 'Nº Bono', value: (c) => c.num_bono || '—' },
    { label: 'DNI', value: (c) => c.dni || '—' },
    { label: 'Fecha Nacimiento', value: (c) => c.fecha_nacimiento ? fmtDateShort(c.fecha_nacimiento + 'T00:00:00') : '—' },
    { label: 'Importe total', value: (c) => c.importe_total },
    { label: 'Estado de pago', value: (c) => c.estado_pago },
    { label: 'Anotaciones', value: (c) => c.anotaciones || '—' }
  ];
}

/* --- FUNCIONES DE DESCARGA CSV --- */

function exportVentasCSV() {
  if (!STATE.ventas.length) { toast('No hay ventas que exportar todavía', 'error'); return; }
  const csv = toCSV(STATE.ventas, getVentasHeaders());
  downloadFile(`parksales_ventas_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('CSV de ventas descargado correctamente', 'success');
}

function exportParquesCSV() {
  if (!STATE.parques.length) { toast('No hay parques que exportar', 'error'); return; }
  const csv = toCSV(STATE.parques, getParquesHeaders());
  downloadFile(`parksales_parques_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('CSV de parques descargado correctamente', 'success');
}

function exportBonosCSV() {
  if (!STATE.tipos_bono.length) { toast('No hay bonos que exportar', 'error'); return; }
  const csv = toCSV(STATE.tipos_bono, getBonosHeaders());
  downloadFile(`parksales_bonos_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('CSV de bonos descargado correctamente', 'success');
}

function exportContactosCSV() {
  if (!STATE.contactos.length) { toast('No hay apuntes que exportar todavía', 'error'); return; }
  const csv = toCSV(STATE.contactos, getContactosHeaders());
  downloadFile(`parksales_apuntes_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('CSV de apuntes descargado correctamente', 'success');
}

/* --- EXPORTAR EXCEL MULTI-HOJA --- */

function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel. Comprueba tu conexión.', 'error', 4500); return; }
  const wb = XLSX.utils.book_new();

  // 1. Hoja de Ventas
  const ventasRows = STATE.ventas.map((v) => ({
    Fecha: fmtDateTime(v.fecha),
    Tipo: v.tipo === 'entrada' ? 'Entrada' : 'Bono',
    Detalle: v.tipo === 'entrada' ? parqueNombre(v.parque_id) : bonoNombre(v.bono_id),
    Cliente: v.cliente_nombre || '—',
    'Importe total': v.importe_total,
  }));
  const wsVentas = XLSX.utils.json_to_sheet(ventasRows);
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

  // 2. Hoja de Parques
  const parquesRows = STATE.parques.map((p) => ({
    Nombre: p.nombre,
    Activo: p.activo ? 'Sí' : 'No',
    'Ventas totales': STATE.ventas.filter((v) => v.parque_id === p.id).length,
    Creado: fmtDateTime(p.created_at)
  }));
  const wsParques = XLSX.utils.json_to_sheet(parquesRows);
  XLSX.utils.book_append_sheet(wb, wsParques, 'Parques');

  // 3. Hoja de Bonos
  const bonosRows = STATE.tipos_bono.map((b) => ({
    Nombre: b.nombre,
    Activo: b.activo ? 'Sí' : 'No',
    'Ventas totales': STATE.ventas.filter((v) => v.bono_id === b.id).length,
    Creado: fmtDateTime(b.created_at)
  }));
  const wsBonos = XLSX.utils.json_to_sheet(bonosRows);
  XLSX.utils.book_append_sheet(wb, wsBonos, 'Tipos de Bonos');

  // 4. Hoja de Apuntes
  const contactosRows = STATE.contactos.map((c) => ({
    Fecha: fmtDateTime(c.created_at),
    Cliente: c.nombre_apellidos || '—',
    Correo: c.correo || '—',
    Teléfono: c.telefono || '—',
    Tipo: c.tipo === 'entrada' ? 'Entradas' : 'Bonos',
    'Parque/Bono': c.tipo === 'entrada' ? parqueNombre(c.parque_id) : bonoNombre(c.bono_id),
    Cantidad: c.tipo === 'entrada' ? (c.cantidad_entradas || 1) : (c.cantidad_bonos || 1),
    Extras: c.extras || '—',
    'Nº Bono': c.num_bono || '—',
    DNI: c.dni || '—',
    'Fecha Nacimiento': c.fecha_nacimiento ? fmtDateShort(c.fecha_nacimiento + 'T00:00:00') : '—',
    Importe: c.importe_total,
    'Estado de pago': c.estado_pago,
    Anotaciones: c.anotaciones || '—'
  }));
  const wsContactos = XLSX.utils.json_to_sheet(contactosRows);
  XLSX.utils.book_append_sheet(wb, wsContactos, 'Apuntes y Contactos');

  XLSX.writeFile(wb, `parksales_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Excel completo descargado', 'success');
}

/* --- BACKUP JSON COMPLETO --- */

function exportBackupJSON() {
  const backup = {
    generado_en: new Date().toISOString(),
    version: 2,
    parques: STATE.parques,
    tipos_bono: STATE.tipos_bono,
    contactos: STATE.contactos,
    ventas: STATE.ventas,
  };
  downloadFile(`parksales_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast('Copia de seguridad completa descargada', 'success');
}

/* --- IMPORTACIÓN DE BACKUP --- */

function handleImportFile(file) {
  if (!file.name.endsWith('.json')) { toast('Solo se admiten archivos .json de backup', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.ventas || !data.parques) throw new Error('El archivo no tiene el formato esperado');

      confirmDialog({
        title: 'Importar copia de seguridad',
        message: `Se importarán parques, bonos, apuntes y ventas. Esto añadirá los registros sin eliminar los existentes. ¿Continuar?`,
        confirmLabel: 'Importar',
        danger: false,
        onConfirm: async () => {
          try {
            // 1. Parques
            const parqueNombreAId = {};
            STATE.parques.forEach((p) => { parqueNombreAId[p.nombre] = p.id; });
            const nuevosParques = data.parques.filter((p) => !parqueNombreAId[p.nombre]);
            if (nuevosParques.length) {
              await DB.bulkInsertParques(nuevosParques.map(({ id, created_at, updated_at, ...rest }) => rest));
            }
            STATE.parques = await DB.getParques();
            STATE.parques.forEach((p) => { parqueNombreAId[p.nombre] = p.id; });

            // 2. Bonos
            const bonoNombreAId = {};
            STATE.tipos_bono.forEach((b) => { bonoNombreAId[b.nombre] = b.id; });
            const nuevosBonos = (data.tipos_bono || []).filter((b) => !bonoNombreAId[b.nombre]);
            if (nuevosBonos.length) {
              for (const b of nuevosBonos) {
                await DB.addTipoBono({ nombre: b.nombre, activo: b.activo });
              }
            }
            STATE.tipos_bono = await DB.getTiposBono();
            STATE.tipos_bono.forEach((b) => { bonoNombreAId[b.nombre] = b.id; });

            // Helper to get matching ids
            const getNewParqueId = (oldId) => {
              const oldP = data.parques.find(p => p.id === oldId);
              return oldP ? parqueNombreAId[oldP.nombre] : null;
            };
            const getNewBonoId = (oldId) => {
              const oldB = (data.tipos_bono || []).find(b => b.id === oldId);
              return oldB ? bonoNombreAId[oldB.nombre] : null;
            };

            // 3. Ventas
            const ventasParaInsertar = data.ventas.map(({ id, created_at, parque_id, bono_id, ...rest }) => {
              const cliente_nombre = rest.cliente_nombre || 'Cliente';
              const importe_total = Number(rest.importe_total) || 0;
              return {
                fecha: rest.fecha || new Date().toISOString(),
                tipo: rest.tipo || 'entrada',
                parque_id: parque_id ? getNewParqueId(parque_id) : null,
                bono_id: bono_id ? getNewBonoId(bono_id) : null,
                cliente_nombre,
                importe_total
              };
            }).filter(v => (v.tipo === 'entrada' && v.parque_id) || (v.tipo === 'bono' && v.bono_id));

            if (ventasParaInsertar.length) {
              await DB.bulkInsertVentas(ventasParaInsertar);
            }
            STATE.ventas = await DB.getVentas();

            // 4. Apuntes (Contactos)
            if (data.contactos && data.contactos.length) {
              const apuntesParaInsertar = data.contactos.map(({ id, created_at, parque_id, bono_id, ...rest }) => {
                return {
                  tipo: rest.tipo,
                  estado_pago: rest.estado_pago || 'Apunte rápido',
                  nombre_apellidos: rest.nombre_apellidos || '—',
                  correo: rest.correo || null,
                  importe_total: Number(rest.importe_total) || 0,
                  anotaciones: rest.anotaciones || null,
                  telefono: rest.telefono || null,
                  parque_id: parque_id ? getNewParqueId(parque_id) : null,
                  cantidad_entradas: rest.cantidad_entradas || null,
                  extras: rest.extras || null,
                  num_bono: rest.num_bono || null,
                  dni: rest.dni || null,
                  fecha_nacimiento: rest.fecha_nacimiento || null,
                  bono_id: bono_id ? getNewBonoId(bono_id) : null,
                  cantidad_bonos: rest.cantidad_bonos || null,
                  created_at: created_at || new Date().toISOString()
                };
              });

              for (const apunte of apuntesParaInsertar) {
                await DB.addContacto(apunte);
              }
              STATE.contactos = await DB.getContactos();
            }

            toast('Copia de seguridad importada correctamente', 'success');
            refreshAllViewsAfterDataChange();
          } catch (err) {
            toast('Error al importar: ' + err.message, 'error');
          }
        },
      });
    } catch (err) {
      toast('El archivo no es un backup válido de ParkSales', 'error');
    }
  };
  reader.readAsText(file);
}
