/* ============================================================================
   exportar.js — vista "Exportar / Importar"
============================================================================ */

function initExportView() {
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXLSX);
  document.getElementById('btn-export-json').addEventListener('click', exportBackupJSON);

  const drop = document.getElementById('import-drop');
  const fileInput = document.getElementById('import-file');
  if (drop && fileInput) {
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.style.borderColor = '';
      if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleImportFile(e.target.files[0]); });
  }

  const csvDrop = document.getElementById('import-csv-drop');
  const csvFileInput = document.getElementById('import-csv-file');
  if (csvDrop && csvFileInput) {
    csvDrop.addEventListener('click', () => csvFileInput.click());
    csvDrop.addEventListener('dragover', (e) => { e.preventDefault(); csvDrop.style.borderColor = 'var(--accent)'; });
    csvDrop.addEventListener('dragleave', () => { csvDrop.style.borderColor = ''; });
    csvDrop.addEventListener('drop', (e) => {
      e.preventDefault(); csvDrop.style.borderColor = '';
      if (e.dataTransfer.files.length) handleImportCSVFiles(e.dataTransfer.files);
    });
    csvFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleImportCSVFiles(e.target.files); });
  }
}

// Datos predefinidos
const PREDEFINED_PARKS = [
  'Atlantis',
  'Aquopolis CAR',
  'Aquopolis CDA',
  'Aquopolis CUL',
  'Aquopolis TOR',
  'Aquopolis VIL',
  'Faunia',
  'Hotel Selwo',
  'PAM',
  'Selwo Aventura',
  'Selwo Marina',
  'Teleférico Benalmádena',
  'Parque Warner',
  'Warner Beach',
  'ZOO',
];

const PREDEFINED_BONOS = [
  { nombre: 'Bono Oro', activo: true },
  { nombre: 'Bono Oro + Parking', activo: true },
  { nombre: 'Bono Plata', activo: true },
  { nombre: 'Bono Platino', activo: true },
  { nombre: 'Bono Verano Estándar', activo: false },
  { nombre: 'Bono Verano Plus', activo: false },
  { nombre: 'Bono Verano Plus + Warner Beach', activo: false },
  { nombre: 'Bono Verano Ultra', activo: false },
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
    { label: 'Vía', value: (v) => { const viaLabels = { llamada: '📞 Llamada', correo: '✉️ Correo', chat: '💬 Chat' }; return viaLabels[v.via] || v.via || '📞 Llamada'; } },
    { label: 'Cliente', value: (v) => v.cliente_nombre || '—' },
    { label: 'Localizador', value: (v) => v.localizador || '—' },
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
  const viaLabels = { llamada: '📞 Llamada', correo: '✉️ Correo', chat: '💬 Chat' };
  const ventasRows = STATE.ventas.map((v) => ({
    Fecha: fmtDateTime(v.fecha),
    Tipo: v.tipo === 'entrada' ? 'Entrada' : 'Bono',
    Detalle: v.tipo === 'entrada' ? parqueNombre(v.parque_id) : bonoNombre(v.bono_id),
    'Vía': viaLabels[v.via] || v.via || '📞 Llamada',
    Cliente: v.cliente_nombre || '—',
    Localizador: v.localizador || '—',
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

function buildFullBackupData() {
  // Cuadrantes
  let cuadList = [];
  try {
    cuadList = JSON.parse(localStorage.getItem(LOCAL_KEYS.cuadrante_list) || '[]');
  } catch (e) { cuadList = []; }

  const cuadData = {};
  if (Array.isArray(cuadList)) {
    cuadList.forEach(item => {
      if (item && item.mes) {
        const raw = localStorage.getItem(LOCAL_KEYS.cuadrante_data + '_' + item.mes);
        if (raw) {
          try { cuadData[item.mes] = JSON.parse(raw); } catch (e) { }
        }
      }
    });
  }

  let cuadAliases = {};
  try {
    cuadAliases = JSON.parse(localStorage.getItem('parksales_cuadrante_aliases') || '{}');
  } catch (e) { cuadAliases = {}; }

  // Llamadas
  let llamadas = [];
  try {
    llamadas = JSON.parse(localStorage.getItem('parksales_llamadas') || '[]');
  } catch (e) { llamadas = []; }

  // Objetivos mensuales
  let objetivos = [];
  try {
    objetivos = JSON.parse(localStorage.getItem(LOCAL_KEYS.objetivos_mensuales) || '[]');
  } catch (e) { objetivos = []; }

  // Notas rápidas
  const notasRapidas = localStorage.getItem('parksales_quick_notes') || '';

  return {
    generado_en: new Date().toISOString(),
    version: 3,
    app: 'ParkSales',
    parques: STATE.parques || [],
    tipos_bono: STATE.tipos_bono || [],
    contactos: STATE.contactos || [],
    ventas: STATE.ventas || [],
    llamadas,
    notas_rapidas: notasRapidas,
    objetivos_mensuales: objetivos,
    cuadrantes: {
      list: cuadList,
      data: cuadData,
      aliases: cuadAliases
    }
  };
}

function exportBackupJSON() {
  const backup = buildFullBackupData();
  const numVentas = backup.ventas.length;
  const numContactos = backup.contactos.length;
  const numLlamadas = backup.llamadas.length;
  const hasNotas = Boolean(backup.notas_rapidas && backup.notas_rapidas.trim());

  downloadFile(`parksales_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast(`Copia total descargada (${numVentas} ventas, ${numContactos} apuntes, ${numLlamadas} llamadas${hasNotas ? ', notas rápidas' : ''})`, 'success');
}

/* --- IMPORTACIÓN DE BACKUP --- */

function backupIsoKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 19);
  return d.toISOString().slice(0, 19);
}

function ventaDupKey(v) {
  const loc = String(v.localizador || '').trim().toLowerCase();
  if (loc) return `loc|${v.tipo || 'entrada'}|${loc}`;
  return [
    'fp',
    backupIsoKey(v.fecha),
    v.tipo || 'entrada',
    v.parque_id || '',
    v.bono_id || '',
    Number(v.importe_total) || 0,
    String(v.cliente_nombre || '').trim().toLowerCase(),
    v.via || '',
    v.estado || 'completado',
  ].join('|');
}

function contactoDupKey(c) {
  const loc = String(c.localizador || c.localizador_bono || '').trim().toLowerCase();
  if (loc) return `loc|${c.tipo || 'entrada'}|${loc}`;
  return [
    'fp',
    backupIsoKey(c.created_at),
    c.tipo || 'entrada',
    c.parque_id || '',
    c.bono_id || '',
    Number(c.importe_total) || 0,
    String(c.nombre_apellidos || '').trim().toLowerCase(),
    String(c.telefono || '').replace(/\s/g, ''),
    String(c.correo || '').trim().toLowerCase(),
  ].join('|');
}

function llamadaDupKey(c) {
  if (c.id) return `id|${c.id}`;
  return [
    'll',
    backupIsoKey(c.fecha_hora),
    String(c.telefono || '').replace(/\s/g, ''),
    String(c.cliente || '').trim().toLowerCase(),
    c.tipo || 'entrada',
    String(c.notas || '').trim().toLowerCase()
  ].join('|');
}

async function applyBackupData(data) {
  const stats = {
    parques: 0,
    bonos: 0,
    ventas: 0,
    contactos: 0,
    llamadas: 0,
    notas: false,
    objetivos: 0,
    cuadrantes: 0
  };

  // 1. Parques
  const parqueNombreAId = {};
  STATE.parques.forEach((p) => { parqueNombreAId[p.nombre] = p.id; });
  const nuevosParques = (data.parques || []).filter((p) => !parqueNombreAId[p.nombre]);
  if (nuevosParques.length) {
    await DB.bulkInsertParques(nuevosParques.map(({ id, created_at, updated_at, ...rest }) => rest));
    stats.parques = nuevosParques.length;
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
    stats.bonos = nuevosBonos.length;
  }
  STATE.tipos_bono = await DB.getTiposBono();
  STATE.tipos_bono.forEach((b) => { bonoNombreAId[b.nombre] = b.id; });

  // Helper to get matching ids
  const getNewParqueId = (oldId) => {
    const oldP = (data.parques || []).find(p => p.id === oldId);
    return oldP ? parqueNombreAId[oldP.nombre] : null;
  };
  const getNewBonoId = (oldId) => {
    const oldB = (data.tipos_bono || []).find(b => b.id === oldId);
    return oldB ? bonoNombreAId[oldB.nombre] : null;
  };

  // 3. Ventas
  if (Array.isArray(data.ventas) && data.ventas.length) {
    const existingVentaKeys = new Set(STATE.ventas.map(ventaDupKey));
    const ventasParaInsertar = data.ventas.map(({ id, created_at, parque_id, bono_id, ...rest }) => {
      const cliente_nombre = rest.cliente_nombre || 'Cliente';
      const importe_total = Number(rest.importe_total) || 0;
      return {
        fecha: rest.fecha || new Date().toISOString(),
        tipo: rest.tipo || 'entrada',
        via: rest.via || 'llamada',
        parque_id: parque_id ? getNewParqueId(parque_id) : null,
        bono_id: bono_id ? getNewBonoId(bono_id) : null,
        cliente_nombre,
        importe_total,
        localizador: rest.localizador || null,
        estado: rest.estado || 'completado',
      };
    }).filter(v => (v.tipo === 'entrada' && v.parque_id) || (v.tipo === 'bono' && v.bono_id))
      .filter(v => !existingVentaKeys.has(ventaDupKey(v)));

    if (ventasParaInsertar.length) {
      await DB.bulkInsertVentas(ventasParaInsertar);
      stats.ventas = ventasParaInsertar.length;
    }
    STATE.ventas = await DB.getVentas();
  }

  // 4. Apuntes (Contactos)
  if (Array.isArray(data.contactos) && data.contactos.length) {
    const existingContactoKeys = new Set(STATE.contactos.map(contactoDupKey));
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
        via: rest.via || null,
        localizador: rest.localizador || null,
        localizador_bono: rest.localizador_bono || null,
        fecha_maxima: rest.fecha_maxima || null,
        created_at: created_at || new Date().toISOString()
      };
    }).filter(c => !existingContactoKeys.has(contactoDupKey(c)));

    for (const apunte of apuntesParaInsertar) {
      await DB.addContacto(apunte);
    }
    stats.contactos = apuntesParaInsertar.length;
    STATE.contactos = await DB.getContactos();
  }

  // 5. Llamadas (gestionadas, realizadas, pendientes)
  const rawCalls = Array.isArray(data.llamadas) ? data.llamadas : (Array.isArray(data.calls) ? data.calls : null);
  if (rawCalls && rawCalls.length) {
    let currentCalls = [];
    try {
      currentCalls = JSON.parse(localStorage.getItem('parksales_llamadas') || '[]');
    } catch (e) { currentCalls = []; }

    const existingCallIds = new Set(currentCalls.map(c => c.id).filter(Boolean));
    const existingCallKeys = new Set(currentCalls.map(llamadaDupKey));
    let llamadasNuevasCount = 0;

    for (const call of rawCalls) {
      if (!call) continue;
      let resolvedItemId = call.item_id;
      let resolvedItemNombre = call.item_nombre;
      if (call.tipo === 'entrada' && call.item_id) {
        resolvedItemId = getNewParqueId(call.item_id) || call.item_id;
        const p = STATE.parques.find(x => x.id === resolvedItemId);
        if (p) resolvedItemNombre = p.nombre;
      } else if (call.tipo === 'bono' && call.item_id) {
        resolvedItemId = getNewBonoId(call.item_id) || call.item_id;
        const b = STATE.tipos_bono.find(x => x.id === resolvedItemId);
        if (b) resolvedItemNombre = b.nombre;
      }

      const dupKey = llamadaDupKey(call);
      const existsById = call.id && existingCallIds.has(call.id);
      const existsBySignature = existingCallKeys.has(dupKey);

      if (!existsById && !existsBySignature) {
        currentCalls.push({
          ...call,
          id: call.id || uid(),
          item_id: resolvedItemId,
          item_nombre: resolvedItemNombre || call.item_nombre || ''
        });
        if (call.id) existingCallIds.add(call.id);
        existingCallKeys.add(dupKey);
        llamadasNuevasCount++;
      } else if (existsById) {
        const idx = currentCalls.findIndex(c => c.id === call.id);
        if (idx !== -1) {
          if (call.completada && !currentCalls[idx].completada) currentCalls[idx].completada = true;
          if (call.cancelada && !currentCalls[idx].cancelada) currentCalls[idx].cancelada = true;
          if (call.notas && !currentCalls[idx].notas) currentCalls[idx].notas = call.notas;
        }
      }
    }

    localStorage.setItem('parksales_llamadas', JSON.stringify(currentCalls));
    if (typeof mirrorPut === 'function') {
      mirrorPut('parksales_llamadas', JSON.stringify(currentCalls));
    }
    stats.llamadas = llamadasNuevasCount;

    if (typeof renderLlamadasList === 'function') {
      try { renderLlamadasList(); } catch (e) { }
    }
    if (typeof startAlarmChecker === 'function') {
      try { startAlarmChecker(); } catch (e) { }
    }
  }

  // 6. Notas rápidas
  if (typeof data.notas_rapidas === 'string' && data.notas_rapidas.trim()) {
    const notasActuales = localStorage.getItem('parksales_quick_notes') || '';
    let finalNotes = '';
    if (notasActuales.trim()) {
      if (!notasActuales.includes(data.notas_rapidas.trim())) {
        finalNotes = notasActuales + '\n\n--- Restaurado del backup ---\n' + data.notas_rapidas;
        stats.notas = true;
      } else {
        finalNotes = notasActuales;
      }
    } else {
      finalNotes = data.notas_rapidas;
      stats.notas = true;
    }
    localStorage.setItem('parksales_quick_notes', finalNotes);
    if (typeof mirrorPut === 'function') {
      mirrorPut('parksales_quick_notes', finalNotes);
    }
    const txtArea = document.getElementById('notas-rapidas-textarea');
    if (txtArea) {
      txtArea.value = finalNotes;
      const charCountEl = document.getElementById('notes-char-count');
      const wordCountEl = document.getElementById('notes-word-count');
      if (charCountEl) charCountEl.textContent = `${finalNotes.length} caracteres`;
      if (wordCountEl) {
        const words = finalNotes.trim() ? finalNotes.trim().split(/\s+/).length : 0;
        wordCountEl.textContent = `${words} palabras`;
      }
    }
  }

  // 7. Objetivos mensuales
  if (Array.isArray(data.objetivos_mensuales) && data.objetivos_mensuales.length) {
    let currentObjs = [];
    try {
      currentObjs = JSON.parse(localStorage.getItem(LOCAL_KEYS.objetivos_mensuales) || '[]');
    } catch (e) { currentObjs = []; }
    const objKeys = new Set(currentObjs.map(o => `${o.mes || o.month}_${o.anio || o.year}`));
    let nuevosObjs = 0;
    for (const obj of data.objetivos_mensuales) {
      const key = `${obj.mes || obj.month}_${obj.anio || obj.year}`;
      if (!objKeys.has(key)) {
        currentObjs.push(obj);
        objKeys.add(key);
        nuevosObjs++;
      }
    }
    if (nuevosObjs > 0) {
      writeLocal(LOCAL_KEYS.objetivos_mensuales, currentObjs);
      stats.objetivos = nuevosObjs;
    }
  }

  // 8. Cuadrantes
  if (data.cuadrantes) {
    if (Array.isArray(data.cuadrantes.list) && data.cuadrantes.list.length) {
      let currentCuadList = [];
      try {
        currentCuadList = JSON.parse(localStorage.getItem(LOCAL_KEYS.cuadrante_list) || '[]');
      } catch (e) { currentCuadList = []; }
      const cuadKeys = new Set(currentCuadList.map(c => c.mes));
      for (const item of data.cuadrantes.list) {
        if (item?.mes && !cuadKeys.has(item.mes)) {
          currentCuadList.push(item);
          cuadKeys.add(item.mes);
        }
      }
      writeLocal(LOCAL_KEYS.cuadrante_list, currentCuadList);
    }
    if (data.cuadrantes.data && typeof data.cuadrantes.data === 'object') {
      for (const [mesKey, monthData] of Object.entries(data.cuadrantes.data)) {
        const storageKey = LOCAL_KEYS.cuadrante_data + '_' + mesKey;
        const currentData = localStorage.getItem(storageKey);
        if (!currentData && monthData) {
          writeLocal(storageKey, monthData);
          stats.cuadrantes++;
        }
      }
    }
    if (data.cuadrantes.aliases && typeof data.cuadrantes.aliases === 'object') {
      let currentAliases = {};
      try {
        currentAliases = JSON.parse(localStorage.getItem('parksales_cuadrante_aliases') || '{}');
      } catch (e) { currentAliases = {}; }
      const mergedAliases = { ...data.cuadrantes.aliases, ...currentAliases };
      localStorage.setItem('parksales_cuadrante_aliases', JSON.stringify(mergedAliases));
      if (typeof mirrorPut === 'function') mirrorPut('parksales_cuadrante_aliases', JSON.stringify(mergedAliases));
    }
  }

  refreshAllViewsAfterDataChange();
  return stats;
}

function handleImportFile(file) {
  if (!file.name.endsWith('.json')) { toast('Solo se admiten archivos .json de backup', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.ventas && !data.parques && !data.contactos && !data.llamadas && !data.notas_rapidas) {
        throw new Error('El archivo no tiene el formato esperado');
      }

      const totalVentas = Array.isArray(data.ventas) ? data.ventas.length : 0;
      const totalContactos = Array.isArray(data.contactos) ? data.contactos.length : 0;
      const totalLlamadas = Array.isArray(data.llamadas) ? data.llamadas.length : (Array.isArray(data.calls) ? data.calls.length : 0);
      const hasNotas = Boolean(data.notas_rapidas && String(data.notas_rapidas).trim());

      const descPartes = [];
      if (totalVentas) descPartes.push(`<strong>${totalVentas}</strong> ventas`);
      if (totalContactos) descPartes.push(`<strong>${totalContactos}</strong> apuntes`);
      if (totalLlamadas) descPartes.push(`<strong>${totalLlamadas}</strong> llamadas gestionadas/pendientes`);
      if (hasNotas) descPartes.push(`notas rápidas`);
      if (data.cuadrantes) descPartes.push(`cuadrantes y turnos`);

      const detalleTexto = descPartes.length ? descPartes.join(', ') : 'todos los registros del backup';

      confirmDialog({
        title: 'Importar copia de seguridad total',
        message: `El archivo contiene ${detalleTexto}.<br><br>Se añadirán los registros respetando los que ya existan para no duplicar. ¿Continuar con la importación?`,
        isHtmlMessage: true,
        confirmLabel: 'Importar todo',
        danger: false,
        onConfirm: async () => {
          try {
            const stats = await applyBackupData(data);
            const summaryParts = [];
            if (stats.ventas > 0) summaryParts.push(`${stats.ventas} ventas`);
            if (stats.contactos > 0) summaryParts.push(`${stats.contactos} apuntes`);
            if (stats.llamadas > 0) summaryParts.push(`${stats.llamadas} llamadas`);
            if (stats.notas) summaryParts.push(`notas actualizadas`);

            const msg = summaryParts.length
              ? `Copia importada: ${summaryParts.join(', ')} añadidas correctamente`
              : `Copia de seguridad importada (los registros ya estaban al día)`;

            toast(msg, 'success', 5000);
          } catch (err) {
            console.error('[ParkSales] Error al importar backup:', err);
            toast('Error al importar: ' + err.message, 'error');
          }
        },
      });
    } catch (err) {
      toast('El archivo no es un backup válido de ParkSales: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

async function handleImportCSVFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    toast('No se encontraron archivos .csv válidos', 'error');
    return;
  }

  let totalNuevasVentas = [];
  let totalNuevosApuntes = [];
  let totalDuplicadas = 0;
  let parquesInvolucrados = new Set();
  let filesProcessed = 0;
  let failedFiles = [];

  // Simple CSV parser helper to handle quotes
  const parseCSVLine = (str) => {
    const result = [];
    let inQuotes = false;
    let current = "";
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '"') {
        inQuotes = !inQuotes;
      } else if (str[i] === ',' && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += str[i];
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  };

  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          if (lines.length < 5) throw new Error('Archivo demasiado corto o sin formato válido.');

          let parqueLine = lines[1].split(',')[0].trim();

          let pl = parqueLine.toLowerCase().trim();
          
          if (pl.includes('zoo') && pl.includes('aquarium')) {
            parqueLine = 'ZOO';
          } else if (pl.includes('atracciones')) {
            parqueLine = 'PAM';
          } else if (pl.includes('warner beach')) {
            parqueLine = 'Warner Beach';
          } else if (pl.includes('warner')) {
            parqueLine = 'Parque Warner';
          } else if (pl.includes('teleferico') || pl.includes('teleférico')) {
            parqueLine = 'Teleférico Benalmádena';
          } else {
            const aliases = {
              'aquopolis villanueva': 'Aquopolis VIL',
              'aquopolis villanueva de la cañada': 'Aquopolis VIL',
              'aquopolis cartaya': 'Aquopolis CAR',
              'aquopolis costa dorada': 'Aquopolis CDA',
              'aquopolis cullera': 'Aquopolis CUL',
              'aquopolis torrevieja': 'Aquopolis TOR',
              'zoo de madrid': 'ZOO'
            };
            const aliasMatch = aliases[pl];
            if (aliasMatch) parqueLine = aliasMatch;
          }

          // --- Detección parque / bono / Multipark -> Sin especificar ---
          let tipoImport = 'entrada';
          let parqueId = null;
          let bonoId = null;
          let nombreImport = '';

          const parqueEncontrado = STATE.parques.find(p => p.nombre.toLowerCase() === parqueLine.toLowerCase());
          const bonoEncontrado = STATE.tipos_bono.find(b => b.nombre.toLowerCase() === parqueLine.toLowerCase() || pl === b.nombre.toLowerCase());
          const bonoAliases = {
            'bono oro': 'Bono Oro',
            'bono oro + parking': 'Bono Oro + Parking',
            'bono plata': 'Bono Plata',
            'bono platino': 'Bono Platino',
            'bono verano': 'Bono Verano Estándar'
          };
          let bonoPorAlias = bonoAliases[pl] ? STATE.tipos_bono.find(b => b.nombre === bonoAliases[pl]) : null;

          if (parqueEncontrado) {
            tipoImport = 'entrada';
            parqueId = parqueEncontrado.id;
            nombreImport = parqueEncontrado.nombre;
            parquesInvolucrados.add(nombreImport);
          } else if (bonoEncontrado) {
            tipoImport = 'bono';
            bonoId = bonoEncontrado.id;
            nombreImport = bonoEncontrado.nombre;
            parquesInvolucrados.add(nombreImport);
          } else if (bonoPorAlias) {
            tipoImport = 'bono';
            bonoId = bonoPorAlias.id;
            nombreImport = bonoPorAlias.nombre;
            parquesInvolucrados.add(nombreImport);
          } else if (pl.includes('multipark') || pl === '') {
            // Multipark SOLO sale al exportar bonos (los parques sí traen su nombre)
            // No lo hemos roto: los parques siguen entrando por el if de arriba
            tipoImport = 'bono';
            bonoId = null;
            nombreImport = 'Sin especificar · Bono';
            parquesInvolucrados.add(nombreImport);
          } else {
            throw new Error(`Ni parque ni bono "${parqueLine}" existe. Para bonos usa "Bono Oro" en la línea 2; para Multipark se guardará como Sin especificar.`);
          }

          let headerIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('Autor,Localizador de pedido,Cliente,Importe total,Fecha de venta')) {
              headerIdx = i;
              break;
            }
          }
          if (headerIdx === -1) throw new Error('No se encontró la cabecera de datos esperada (Autor, Localizador de pedido...).');

          let fileDuplicadas = 0;
          const fileNuevasVentas = [];
          const fileNuevosApuntes = [];

          const localizadoresExistentes = new Set(
            STATE.ventas.filter(v => {
              if (tipoImport === 'entrada') return v.parque_id === parqueId && v.localizador;
              return v.bono_id === bonoId && v.localizador;
            }).map(v => v.localizador)
          );

          for (const v of totalNuevasVentas) {
            if (tipoImport === 'entrada' && v.parque_id === parqueId && v.localizador) localizadoresExistentes.add(v.localizador);
            if (tipoImport === 'bono' && v.bono_id === bonoId && v.localizador) localizadoresExistentes.add(v.localizador);
          }

          for (let i = headerIdx + 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const row = parseCSVLine(lines[i]);
            if (row.length < 11) continue;

            const localizador = row[1];
            const cliente_nombre = row[2];
            const importe_total = Number(row[3]) || 0;
            const fechaVentaOriginal = row[4];
            const correo = row[5];
            const telefono = row[6].replace(/\s/g, '').replace(/^\+34/, '');
            const metodoPago = row[7];
            const estadoRaw = row[10] || 'Completado';
            const estadoNorm = typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(estadoRaw) : 'completado';

            if (localizador && localizadoresExistentes.has(localizador)) {
              fileDuplicadas++;
              continue;
            }

            let isoDate = new Date().toISOString();
            if (fechaVentaOriginal) {
              const parts = fechaVentaOriginal.trim().split(' ');
              const d = parts[0].split('/');
              if (d.length === 3) {
                const day = d[0].padStart(2, '0');
                const month = d[1].padStart(2, '0');
                const year = d[2];
                const t = parts[1] || '12:00:00';
                try {
                  const parsedDate = new Date(`${year}-${month}-${day}T${t}`);
                  if (!isNaN(parsedDate.getTime())) isoDate = parsedDate.toISOString();
                } catch (e) { }
              }
            }

            fileNuevasVentas.push({
              fecha: isoDate,
              tipo: tipoImport,
              via: 'llamada',
              parque_id: tipoImport === 'entrada' ? parqueId : null,
              bono_id: tipoImport === 'bono' ? bonoId : null,
              cliente_nombre,
              importe_total,
              localizador,
              estado: estadoNorm,
            });

            let estadoPagoContacto = 'pagado';
            if (estadoNorm === 'pendiente') estadoPagoContacto = 'pendiente';
            else if (estadoNorm === 'incompleto') estadoPagoContacto = 'Incompleto';
            else if (estadoNorm === 'enviado') estadoPagoContacto = 'Enviado';
            else if (estadoNorm === 'no_enviado') estadoPagoContacto = 'No enviado';

            fileNuevosApuntes.push({
              tipo: tipoImport,
              via: 'llamada',
              estado_pago: estadoPagoContacto,
              nombre_apellidos: cliente_nombre,
              correo: correo || null,
              importe_total: importe_total,
              anotaciones: 'Importado de CSV telemarketing' + (tipoImport === 'bono' ? ' · Bono' : '') + (nombreImport === 'Sin especificar' ? ' · Sin especificar' : ''),
              telefono: telefono || null,
              parque_id: tipoImport === 'entrada' ? parqueId : null,
              bono_id: tipoImport === 'bono' ? bonoId : null,
              cantidad_entradas: tipoImport === 'entrada' ? 1 : null,
              cantidad_bonos: tipoImport === 'bono' ? 1 : null,
              extras: metodoPago ? `Método: ${metodoPago}` : null,
              localizador: localizador,
              created_at: isoDate
            });

            if (localizador) localizadoresExistentes.add(localizador);
          }

          resolve({ fileNuevasVentas, fileNuevosApuntes, fileDuplicadas });
        } catch (err) {
          reject(new Error(`${file.name}: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error(`Error al leer ${file.name}`));
      reader.readAsText(file, 'utf-8');
    });
  };

  toast(`Procesando ${files.length} archivo(s)...`, 'info', 2000);

  for (const file of files) {
    try {
      const res = await processFile(file);
      totalNuevasVentas.push(...res.fileNuevasVentas);
      totalNuevosApuntes.push(...res.fileNuevosApuntes);
      totalDuplicadas += res.fileDuplicadas;
      filesProcessed++;
    } catch (err) {
      failedFiles.push(err.message);
    }
  }

  const fileInput = document.getElementById('import-csv-file');
  if (fileInput) fileInput.value = '';

  if (filesProcessed === 0 && failedFiles.length > 0) {
    alert('No se pudo procesar ningún archivo:\n\n' + failedFiles.join('\n'));
    return;
  }

  if (totalNuevasVentas.length === 0) {
    let msg = `No hay ventas nuevas para importar. ${totalDuplicadas} duplicadas omitidas en los archivos.\n`;
    if (failedFiles.length > 0) msg += `\nErrores en algunos archivos:\n${failedFiles.join('\n')}`;
    alert(msg);
    return;
  }

  // Agrupar ventas por parque/bono para el resumen
  const countsByPark = {};
  for (const v of totalNuevasVentas) {
    const name = v.tipo === 'bono'
      ? (v.bono_id ? (STATE.tipos_bono.find(b => b.id === v.bono_id)?.nombre || 'Bono') : 'Sin especificar')
      : (v.parque_id ? (STATE.parques.find(p => p.id === v.parque_id)?.nombre || 'Desconocido') : 'Sin especificar');
    const key = name + (v.tipo === 'bono' ? ' · Bono' : '');
    countsByPark[key] = (countsByPark[key] || 0) + 1;
  }

  let listHtml = '<ul style="margin: 8px 0 16px 20px; font-size: 13px;">';
  for (const [pName, count] of Object.entries(countsByPark)) {
    listHtml += `<li><strong>${count}</strong> de ${escapeHtml(pName)}</li>`;
  }
  listHtml += '</ul>';

  let messageHtml = `Se han procesado <strong>${filesProcessed} archivo(s)</strong> y encontrado <strong>${totalNuevasVentas.length} ventas nuevas</strong> en total:<br>${listHtml}Se omitirán ${totalDuplicadas} ventas ya existentes o duplicadas entre archivos. ¿Continuar con la importación?`;

  if (failedFiles.length > 0) {
    messageHtml += `<br><br><span style="color:var(--danger)"><strong>Atención:</strong> Hubo errores en ${failedFiles.length} archivo(s):</span><ul style="font-size:12px; margin-top:4px; margin-left: 20px;"><li>${failedFiles.map(escapeHtml).join('</li><li>')}</li></ul>`;
  }

  confirmDialog({
    title: 'Importar múltiples ventas',
    message: messageHtml,
    isHtmlMessage: true,
    confirmLabel: 'Importar todo',
    danger: false,
    onConfirm: async () => {
      try {
        await DB.bulkInsertVentas(totalNuevasVentas);
        for (const apunte of totalNuevosApuntes) {
          await DB.addContacto(apunte);
        }

        STATE.ventas = await DB.getVentas();
        STATE.contactos = await DB.getContactos();
        refreshAllViewsAfterDataChange();

        toast(`${totalNuevasVentas.length} ventas importadas correctamente`, 'success');
      } catch (err) {
        toast('Error al guardar: ' + err.message, 'error');
      }
    }
  });
}
