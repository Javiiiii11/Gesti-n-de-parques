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
  'Aquopolis CULL',
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
                via: rest.via || 'llamada',
                parque_id: parque_id ? getNewParqueId(parque_id) : null,
                bono_id: bono_id ? getNewBonoId(bono_id) : null,
                cliente_nombre,
                importe_total,
                localizador: rest.localizador || null,
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
              'aquopolis cullera': 'Aquopolis CULL',
              'aquopolis torrevieja': 'Aquopolis TOR',
              'zoo de madrid': 'ZOO'
            };
            const aliasMatch = aliases[pl];
            if (aliasMatch) parqueLine = aliasMatch;
          }

          const parqueEncontrado = STATE.parques.find(p => p.nombre.toLowerCase() === parqueLine.toLowerCase());
          if (!parqueEncontrado) throw new Error(`El parque "${parqueLine}" no existe en la app.`);

          const parqueId = parqueEncontrado.id;
          parquesInvolucrados.add(parqueEncontrado.nombre);

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
            STATE.ventas.filter(v => v.parque_id === parqueId && v.localizador).map(v => v.localizador)
          );

          for (const v of totalNuevasVentas) {
            if (v.parque_id === parqueId && v.localizador) localizadoresExistentes.add(v.localizador);
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
            const estado = row[10];

            if (estado !== 'Completado') continue;
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
              tipo: 'entrada',
              via: 'llamada',
              parque_id: parqueId,
              bono_id: null,
              cliente_nombre,
              importe_total,
              localizador
            });

            fileNuevosApuntes.push({
              tipo: 'entrada',
              via: 'llamada',
              estado_pago: 'pagado',
              nombre_apellidos: cliente_nombre,
              correo: correo || null,
              importe_total: importe_total,
              anotaciones: 'Importado de CSV telemarketing',
              telefono: telefono || null,
              parque_id: parqueId,
              cantidad_entradas: 1,
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

  // Agrupar ventas por parque para el resumen
  const countsByPark = {};
  for (const v of totalNuevasVentas) {
    const pName = STATE.parques.find(p => p.id === v.parque_id)?.nombre || 'Desconocido';
    countsByPark[pName] = (countsByPark[pName] || 0) + 1;
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
