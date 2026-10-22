/* ============================================================================
   exportar.js — vista "Exportar / Importar"
============================================================================ */

function initExportView() {
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXLSX);
  document.getElementById('btn-export-plantilla').addEventListener('click', exportPlantillaVentas);
  const btnMacros = document.getElementById('btn-export-macros');
  if (btnMacros) btnMacros.addEventListener('click', descargarPlantillaMacros);
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

/* --- EXPORTAR EXCEL DE VENTAS (informe bonito, con estilos) --- */

const XL_STYLE = {
  brand: 'F5A623',
  brandDark: '0A0F1C',
  subtitleBg: 'FDF3E3',
  subtitleFg: '8A6316',
  headerBg: '1F2A44',
  headerFg: 'FFFFFF',
  rowBase: 'FFFFFF',
  rowAlt: 'F4F7FB',
  border: 'D9E1EC',
  text: '1F2A44',
  muted: '8A94A6',
  money: '1B7F5A',
  totalBg: 'FFF3D6',
};

// Colores por estado (fondo suave + texto intenso) para el Excel
const XL_ESTADO_STYLE = {
  completado: { fill: 'E6F7EE', text: '1E7A4B' },
  enviado: { fill: 'E9F1FE', text: '2C6BC4' },
  pendiente: { fill: 'FEF5E0', text: 'A9700C' },
  incompleto: { fill: 'FCEBEF', text: 'B23A50' },
  no_enviado: { fill: 'EEF1F5', text: '5B6676' },
  selwo_flexible: { fill: 'E2F7FE', text: '0284A8' },
};

const XL_HEADERS = ['Fecha / Hora', 'Localizador', 'Detalle', 'Estado', 'Importe'];
const XL_WIDTHS = [20, 18, 34, 22, 15];
const XL_MONEY_COL = 4;
const XL_CENTER_COLS = [3];
const XL_ESTADO_COL = 3;

function xlBorder() {
  const side = { style: 'thin', color: { rgb: XL_STYLE.border } };
  return { top: side, bottom: side, left: side, right: side };
}

// Construye la hoja "Mis Ventas": informe estilizado de todo el historial
function buildVentasReportSheet() {
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // Ventas ordenadas de más reciente a más antigua
  const ventas = [...STATE.ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const rows = ventas.map((v) => {
    const tipo = v.tipo || 'entrada';
    const estadoNorm = typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(v.estado) : (v.estado || 'completado');
    const info = typeof getEstadoBadgeInfo === 'function' ? getEstadoBadgeInfo(estadoNorm) : { label: estadoNorm, icon: '' };
    return {
      estado: estadoNorm,
      cells: [
        fmtDateTime(v.fecha),
        v.localizador || '—',
        tipo === 'entrada' ? parqueNombre(v.parque_id) : bonoNombre(v.bono_id),
        `${info.icon ? info.icon + ' ' : ''}${info.label}`,
        Number(v.importe_total) || 0,
      ],
    };
  });

  const total = rows.reduce((s, r) => s + (r.cells[XL_MONEY_COL] || 0), 0);
  const nCols = XL_HEADERS.length;
  const HEADER_R = 3;
  const DATA_R0 = 4;
  const DATA_R1 = DATA_R0 + rows.length - 1;
  const TOTAL_R = DATA_R1 + 1;

  // Bloque superior (título + KPIs) y tabla. El TOTAL es una fórmula viva.
  const title = '💰  MIS VENTAS';
  const kpis = `Generado el ${hoy}   ·   ${rows.length} venta${rows.length !== 1 ? 's' : ''}   ·   Total ${fmtEUR(total)}   ·   Ticket medio ${fmtEUR(rows.length ? total / rows.length : 0)}`;
  const totalRow = new Array(nCols).fill('');
  totalRow[0] = 'TOTAL';
  totalRow[XL_MONEY_COL] = { t: 'n', f: `SUM(E${DATA_R0 + 1}:E${DATA_R1 + 1})`, z: '#,##0.00 "€"' };
  const aoa = [[title], [kpis], [], XL_HEADERS, ...rows.map((r) => r.cells), totalRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

  ws['!cols'] = XL_WIDTHS.map((w) => ({ wch: w }));
  ws['!rows'] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 6 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    { s: { r: TOTAL_R, c: 0 }, e: { r: TOTAL_R, c: nCols - 2 } },
  ];

  // Banda de título
  const tCell = ws[enc(0, 0)];
  if (tCell) tCell.s = {
    font: { bold: true, sz: 18, color: { rgb: XL_STYLE.brandDark } },
    fill: { fgColor: { rgb: XL_STYLE.brand } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  // Banda de KPIs
  const sCell = ws[enc(1, 0)];
  if (sCell) sCell.s = {
    font: { sz: 10, color: { rgb: XL_STYLE.subtitleFg } },
    fill: { fgColor: { rgb: XL_STYLE.subtitleBg } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  // Cabecera de la tabla
  for (let c = 0; c < nCols; c++) {
    const cell = ws[enc(HEADER_R, c)];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 11, color: { rgb: XL_STYLE.headerFg } },
      fill: { fgColor: { rgb: XL_STYLE.headerBg } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: xlBorder(),
    };
  }

  // Filas de datos
  rows.forEach((row, i) => {
    const rowIdx = DATA_R0 + i;
    const est = XL_ESTADO_STYLE[row.estado] || XL_ESTADO_STYLE.completado;
    for (let c = 0; c < nCols; c++) {
      const cell = ws[enc(rowIdx, c)];
      if (!cell) continue;
      const isMoney = c === XL_MONEY_COL;
      const isCenter = XL_CENTER_COLS.includes(c);
      const isEstado = c === XL_ESTADO_COL;
      const isPlaceholder = String(cell.v) === '—';
      let fill = i % 2 === 0 ? XL_STYLE.rowBase : XL_STYLE.rowAlt;
      let fontColor = isMoney ? XL_STYLE.money : (isPlaceholder ? XL_STYLE.muted : XL_STYLE.text);
      let bold = isMoney;
      if (isEstado) { fill = est.fill; fontColor = est.text; bold = true; }
      cell.s = {
        font: { sz: 11, color: { rgb: fontColor }, bold },
        fill: { fgColor: { rgb: fill } },
        alignment: { vertical: 'center', horizontal: isCenter ? 'center' : (isMoney ? 'right' : 'left') },
        border: xlBorder(),
      };
      if (isMoney) cell.z = '#,##0.00 "€"';
    }
  });

  // Fila TOTAL
  for (let c = 0; c < nCols; c++) {
    const cell = ws[enc(TOTAL_R, c)];
    if (!cell) continue;
    const isMoney = c === XL_MONEY_COL;
    cell.s = {
      font: { bold: true, sz: 12, color: { rgb: XL_STYLE.brandDark } },
      fill: { fgColor: { rgb: XL_STYLE.totalBg } },
      alignment: { vertical: 'center', horizontal: 'right', indent: isMoney ? 0 : 1 },
      border: xlBorder(),
    };
    if (isMoney) cell.z = '#,##0.00 "€"';
  }

  // Autofiltro sobre la cabecera (solo cabecera + datos, sin el total)
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: HEADER_R, c: 0 }, e: { r: Math.max(HEADER_R, DATA_R1), c: nCols - 1 } }),
  };

  return ws;
}

function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel. Comprueba tu conexión.', 'error', 4500); return; }
  if (!STATE.ventas.length) { toast('Todavía no hay ventas que exportar', 'error'); return; }

  const n = STATE.ventas.length;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildVentasReportSheet(), 'Mis Ventas');
  XLSX.writeFile(wb, `parksales_ventas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast(`Excel con ${n} venta${n !== 1 ? 's' : ''} descargado`, 'success');
}

/* --- PLANTILLA EXCEL AUTO-CALCULADA (para añadir ventas) ---
   Nota: las macros VBA reales no se pueden generar desde el navegador
   (requieren un .xlsm con código binario). Esta plantilla usa fórmulas
   automáticas para conseguir el mismo efecto: escribes y todo se calcula solo. */

const XL_CAPTURA_COLS = ['Fecha / Hora', 'Localizador', 'Detalle', 'Estado', 'Importe'];
const XL_CAPTURA_WIDTHS = [20, 18, 34, 22, 15];
const XL_CAPTURA_FILAS = 60; // filas de entrada disponibles
const XL_INPUT_FILL = 'FDFCF6';

// Hoja de captura: filas vacías para escribir ventas + totales y resumen con fórmulas
function buildCapturaSheet() {
  const nCols = XL_CAPTURA_COLS.length;
  const COL_MONEY = 4;
  const HEADER_R = 3;
  const DATA_R0 = 4;
  const DATA_R1 = DATA_R0 + XL_CAPTURA_FILAS - 1;
  const TOTAL_R = DATA_R1 + 1;

  const aoa = [
    ['➕  AÑADIR VENTAS'],
    ['Escribe tus ventas en las filas de abajo. Los importes y los totales se calculan automáticamente.'],
    [],
    XL_CAPTURA_COLS,
  ];
  // Filas de entrada vacías
  for (let i = 0; i < XL_CAPTURA_FILAS; i++) aoa.push(new Array(nCols).fill(''));
  // Fila TOTAL (importe con fórmula viva)
  const totalRow = new Array(nCols).fill('');
  totalRow[0] = 'TOTAL';
  totalRow[COL_MONEY] = { t: 'n', f: `SUM(E${DATA_R0 + 1}:E${DATA_R1 + 1})`, z: '#,##0.00 "€"' };
  aoa.push(totalRow);
  aoa.push([]);
  // Resumen automático (debajo de la tabla: etiqueta en A:D, valor en E)
  const RESUMEN_INI = TOTAL_R + 2;
  const resumenTitleRow = new Array(nCols).fill('');
  resumenTitleRow[0] = '📊  RESUMEN AUTOMÁTICO';
  aoa.push(resumenTitleRow);

  const rangoA = `$A$${DATA_R0 + 1}:$A$${DATA_R1 + 1}`;
  const rangoD = `$D$${DATA_R0 + 1}:$D$${DATA_R1 + 1}`;
  const rangoE = `$E$${DATA_R0 + 1}:$E$${DATA_R1 + 1}`;
  const resumenItems = [
    ['Nº de ventas registradas', `COUNTA(${rangoA})`, '#,##0'],
    ['Importe total', `SUM(${rangoE})`, '#,##0.00 "€"'],
    ['Ticket medio', `IFERROR(AVERAGE(${rangoE}),0)`, '#,##0.00 "€"'],
    ['Completado', `SUMIF(${rangoD},"Completado",${rangoE})`, '#,##0.00 "€"'],
    ['Pendiente de pago', `SUMIF(${rangoD},"Pendiente de pago",${rangoE})`, '#,##0.00 "€"'],
    ['Enviado', `SUMIF(${rangoD},"Enviado",${rangoE})`, '#,##0.00 "€"'],
    ['Incompleto', `SUMIF(${rangoD},"Incompleto",${rangoE})`, '#,##0.00 "€"'],
  ];
  resumenItems.forEach(([label, f, z]) => {
    const fila = new Array(nCols).fill('');
    fila[0] = label;
    fila[COL_MONEY] = { t: 'n', f, z };
    aoa.push(fila);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

  ws['!cols'] = XL_CAPTURA_WIDTHS.map((w) => ({ wch: w }));
  ws['!rows'] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 6 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    { s: { r: TOTAL_R, c: 0 }, e: { r: TOTAL_R, c: COL_MONEY - 1 } },
    { s: { r: RESUMEN_INI, c: 0 }, e: { r: RESUMEN_INI, c: nCols - 1 } },
  ];
  for (let i = 0; i < resumenItems.length; i++) {
    const r = RESUMEN_INI + 1 + i;
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: COL_MONEY - 1 } });
  }

  // Banda de título
  const tCell = ws[enc(0, 0)];
  if (tCell) tCell.s = {
    font: { bold: true, sz: 18, color: { rgb: XL_STYLE.brandDark } },
    fill: { fgColor: { rgb: XL_STYLE.brand } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };
  const sCell = ws[enc(1, 0)];
  if (sCell) sCell.s = {
    font: { sz: 10, color: { rgb: XL_STYLE.subtitleFg } },
    fill: { fgColor: { rgb: XL_STYLE.subtitleBg } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  // Cabecera de la tabla de captura
  for (let c = 0; c < nCols; c++) {
    const cell = ws[enc(HEADER_R, c)];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 11, color: { rgb: XL_STYLE.headerFg } },
      fill: { fgColor: { rgb: XL_STYLE.headerBg } },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: xlBorder(),
    };
  }

  // Filas de entrada (aspecto de formulario rellenable)
  for (let r = DATA_R0; r <= DATA_R1; r++) {
    for (let c = 0; c < nCols; c++) {
      const cell = ws[enc(r, c)];
      if (!cell) continue;
      const isMoney = c === COL_MONEY;
      cell.s = {
        font: { sz: 11, color: { rgb: XL_STYLE.text } },
        fill: { fgColor: { rgb: XL_INPUT_FILL } },
        alignment: { vertical: 'center', horizontal: isMoney ? 'right' : (c === XL_ESTADO_COL ? 'center' : 'left') },
        border: xlBorder(),
      };
      if (isMoney) cell.z = '#,##0.00 "€"';
    }
  }

  // Fila TOTAL
  for (let c = 0; c < nCols; c++) {
    const cell = ws[enc(TOTAL_R, c)];
    if (!cell) continue;
    const isMoney = c === COL_MONEY;
    cell.s = {
      font: { bold: true, sz: 12, color: { rgb: XL_STYLE.brandDark } },
      fill: { fgColor: { rgb: XL_STYLE.totalBg } },
      alignment: { vertical: 'center', horizontal: 'right', indent: isMoney ? 0 : 1 },
      border: xlBorder(),
    };
    if (isMoney) cell.z = '#,##0.00 "€"';
  }

  // Estilos del bloque de resumen
  const rTitle = ws[enc(RESUMEN_INI, 0)];
  if (rTitle) rTitle.s = {
    font: { bold: true, sz: 12, color: { rgb: XL_STYLE.headerFg } },
    fill: { fgColor: { rgb: XL_STYLE.headerBg } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };
  resumenItems.forEach((_, i) => {
    const r = RESUMEN_INI + 1 + i;
    const labelCell = ws[enc(r, 0)];
    const valCell = ws[enc(r, COL_MONEY)];
    if (labelCell) labelCell.s = {
      font: { sz: 11, bold: true, color: { rgb: XL_STYLE.text } },
      fill: { fgColor: { rgb: i % 2 === 0 ? XL_STYLE.rowAlt : XL_STYLE.rowBase } },
      alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
      border: xlBorder(),
    };
    if (valCell) valCell.s = {
      font: { bold: true, sz: 11, color: { rgb: XL_STYLE.money } },
      fill: { fgColor: { rgb: i % 2 === 0 ? XL_STYLE.rowAlt : XL_STYLE.rowBase } },
      alignment: { vertical: 'center', horizontal: 'right' },
      border: xlBorder(),
    };
  });

  return ws;
}

// Hoja de listas de valores válidos (para autorrelleno/desplegables manuales)
function buildListasSheet() {
  const estados = ['Completado', 'Pendiente de pago', 'Enviado', 'Incompleto', 'No enviado', 'Flexible pendiente'];
  const parques = STATE.parques.map((p) => p.nombre);
  const bonos = STATE.tipos_bono.map((b) => b.nombre);

  const cols = [
    { titulo: 'Tipo', valores: ['Entrada', 'Bono'] },
    { titulo: 'Vía', valores: ['Llamada', 'Correo', 'Chat'] },
    { titulo: 'Estado', valores: estados },
    { titulo: 'Parques', valores: parques },
    { titulo: 'Bonos', valores: bonos },
  ];

  const nCols = cols.length;
  const maxLen = Math.max(...cols.map((c) => c.valores.length));
  const aoa = [
    ['📋  LISTAS DE VALORES'],
    ['Copia estos valores en la hoja "Añadir ventas". En Excel puedes crear desplegables con Datos → Validación de datos → Lista.'],
    [],
    cols.map((c) => c.titulo),
  ];
  for (let i = 0; i < maxLen; i++) {
    aoa.push(cols.map((c) => c.valores[i] || ''));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const enc = (r, c) => XLSX.utils.encode_cell({ r, c });

  ws['!cols'] = cols.map(() => ({ wch: 24 }));
  ws['!rows'] = [{ hpt: 36 }, { hpt: 22 }, { hpt: 6 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
  ];

  const tCell = ws[enc(0, 0)];
  if (tCell) tCell.s = {
    font: { bold: true, sz: 18, color: { rgb: XL_STYLE.brandDark } },
    fill: { fgColor: { rgb: XL_STYLE.brand } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };
  const sCell = ws[enc(1, 0)];
  if (sCell) sCell.s = {
    font: { sz: 10, color: { rgb: XL_STYLE.subtitleFg } },
    fill: { fgColor: { rgb: XL_STYLE.subtitleBg } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  for (let c = 0; c < nCols; c++) {
    const cell = ws[enc(3, c)];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 11, color: { rgb: XL_STYLE.headerFg } },
      fill: { fgColor: { rgb: XL_STYLE.headerBg } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: xlBorder(),
    };
  }
  for (let i = 0; i < maxLen; i++) {
    const r = 4 + i;
    for (let c = 0; c < nCols; c++) {
      const cell = ws[enc(r, c)];
      if (!cell) continue;
      cell.s = {
        font: { sz: 11, color: { rgb: XL_STYLE.text } },
        fill: { fgColor: { rgb: i % 2 === 0 ? XL_STYLE.rowBase : XL_STYLE.rowAlt } },
        alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
        border: xlBorder(),
      };
    }
  }

  return ws;
}

function exportPlantillaVentas() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel. Comprueba tu conexión.', 'error', 4500); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildCapturaSheet(), 'Añadir ventas');
  if (STATE.ventas.length) XLSX.utils.book_append_sheet(wb, buildVentasReportSheet(), 'Mis Ventas');
  XLSX.utils.book_append_sheet(wb, buildListasSheet(), 'Listas');
  XLSX.writeFile(wb, `parksales_plantilla_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Plantilla automática descargada', 'success');
}

/* --- PLANTILLA CON MACROS VBA (.xlsm) ---
   Las macros VBA no se pueden generar desde el navegador, así que se sirve
   como recurso ya preparado del proyecto. Incluye formulario, desplegables
   de parques, fecha de hoy automática y un botón que inserta la venta y
   recalcula los totales por mes.

   Antes de descargar, se inyectan en la hoja "Ventas" todas las ventas
   existentes de la base de datos para que el historial, los totales del mes
   y el resumen mensual ya vengan rellenos. Las macros VBA se conservan
   intactas (se toca solo el XML de la hoja de datos). */
async function descargarPlantillaMacros() {
  const ventas = (STATE.ventas || []).slice().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const url = 'assets/plantilla_ventas_macros.xlsm';
  const filename = 'Plantilla_Ventas_ParkSales.xlsm';

  // Sin JSZip no se puede inyectar nada: se descarga la plantilla tal cual.
  if (typeof JSZip === 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Plantilla con macros descargada. Ábrela en Excel y pulsa «Habilitar contenido».', 'success', 6000);
    return;
  }

  toast('Generando plantilla con tus ventas...', 'info', 3000);

  try {
    // 1. Cargar la plantilla .xlsm
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('No se pudo cargar la plantilla');
    const buffer = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // 2. Modificar la hoja "Ventas" (sheet2.xml) usando DOMParser para garantizar XML válido
    const sheetXml = await zip.file('xl/worksheets/sheet2.xml').async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(sheetXml, 'application/xml');
    const ws = doc.documentElement;

    const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const NS_X14AC = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac';

    const sheetData = Array.from(ws.getElementsByTagName('*')).find(el => el.localName === 'sheetData');
    const dimension = Array.from(ws.getElementsByTagName('*')).find(el => el.localName === 'dimension');
    const autoFilter = Array.from(ws.getElementsByTagName('*')).find(el => el.localName === 'autoFilter');

    // Número de serie de fecha Excel (días desde 1899-12-30, hora local)
    const excelSerial = (iso) => {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
      const epoch = Date.UTC(1899, 11, 30);
      return (local - epoch) / 86400000;
    };

    const DATA_START = 5;
    const n = ventas.length;
    const lastDataRow = DATA_START + n - 1;
    const maxRow = 5000;

    // Eliminar filas existentes de datos (r >= DATA_START) preservando las cabeceras (1-4)
    Array.from(sheetData.getElementsByTagName('*'))
      .filter(el => el.localName === 'row')
      .forEach((row) => {
        const r = parseInt(row.getAttribute('r'), 10);
        if (r >= DATA_START) sheetData.removeChild(row);
      });

    // Helper para crear una celda de texto inline
    const inlineCell = (rowNum, col, style, text) => {
      const c = doc.createElementNS(NS_MAIN, 'c');
      c.setAttribute('r', `${col}${rowNum}`);
      c.setAttribute('s', style);
      c.setAttribute('t', 'inlineStr');
      const is = doc.createElementNS(NS_MAIN, 'is');
      const t = doc.createElementNS(NS_MAIN, 't');
      t.textContent = text == null ? '' : String(text);
      is.appendChild(t);
      c.appendChild(is);
      return c;
    };

    // Añadir filas con datos de ventas
    ventas.forEach((v, idx) => {
      const rowNum = DATA_START + idx;
      const row = doc.createElementNS(NS_MAIN, 'row');
      row.setAttribute('r', String(rowNum));
      row.setAttribute('spans', '1:5');
      row.setAttributeNS(NS_X14AC, 'x14ac:dyDescent', '0.25');

      // A: Fecha/Hora
      const cA = doc.createElementNS(NS_MAIN, 'c');
      cA.setAttribute('r', `A${rowNum}`);
      cA.setAttribute('s', '17');
      const serial = excelSerial(v.fecha);
      if (serial !== null) {
        const vA = doc.createElementNS(NS_MAIN, 'v');
        vA.textContent = String(serial);
        cA.appendChild(vA);
      }
      row.appendChild(cA);

      // B: Localizador
      row.appendChild(inlineCell(rowNum, 'B', '7', v.localizador || ''));

      // C: Detalle
      const tipo = v.tipo || 'entrada';
      const detalle = tipo === 'entrada' ? parqueNombre(v.parque_id) : bonoNombre(v.bono_id);
      row.appendChild(inlineCell(rowNum, 'C', '7', detalle || ''));

      // D: Estado
      const estadoNorm = normalizeEstadoVenta(v.estado);
      const info = getEstadoBadgeInfo(estadoNorm);
      row.appendChild(inlineCell(rowNum, 'D', '7', info.label || estadoNorm));

      // E: Importe
      const cE = doc.createElementNS(NS_MAIN, 'c');
      cE.setAttribute('r', `E${rowNum}`);
      cE.setAttribute('s', '18');
      const vE = doc.createElementNS(NS_MAIN, 'v');
      vE.textContent = String(Number(v.importe_total) || 0);
      cE.appendChild(vE);
      row.appendChild(cE);

      sheetData.appendChild(row);
    });

    // Añadir filas vacías hasta maxRow para el efecto "infinito"
    for (let r = lastDataRow + 1; r <= maxRow; r++) {
      const row = doc.createElementNS(NS_MAIN, 'row');
      row.setAttribute('r', String(r));
      row.setAttribute('spans', '1:5');
      row.setAttributeNS(NS_X14AC, 'x14ac:dyDescent', '0.25');
      ['A', 'B', 'C', 'D', 'E'].forEach((col, ci) => {
        const c = doc.createElementNS(NS_MAIN, 'c');
        c.setAttribute('r', `${col}${r}`);
        c.setAttribute('s', ['17', '7', '7', '7', '18'][ci]);
        row.appendChild(c);
      });
      sheetData.appendChild(row);
    }

    // Ajustar anchos de columna (A=22, B=20, E=20)
    Array.from(ws.getElementsByTagName('*')).filter(el => el.localName === 'col').forEach(col => {
      const min = col.getAttribute('min');
      if (min === '1') col.setAttribute('width', '22');
      else if (min === '2') col.setAttribute('width', '20');
      else if (min === '5') col.setAttribute('width', '20');
    });

    // Actualizar dimensión y autofiltro
    if (dimension) dimension.setAttribute('ref', `A1:E${maxRow}`);
    if (autoFilter) autoFilter.setAttribute('ref', `A4:E${maxRow}`);

    // Actualizar rangos de validación de datos
    Array.from(ws.getElementsByTagName('*')).forEach((el) => {
      if (el.localName === 'sqref') {
        const text = el.textContent || '';
        if (text.includes('C5:C')) el.textContent = `C5:C${maxRow}`;
        else if (text.includes('D5:D')) el.textContent = `D5:D${maxRow}`;
      }
    });

    // Serializar de nuevo garantizando que no haya errores de etiquetas
    const serializer = new XMLSerializer();
    zip.file('xl/worksheets/sheet2.xml', serializer.serializeToString(doc));

    // --- FORZAR RECÁLCULO DE FÓRMULAS AL ABRIR ---
    // 1) calcChain: ELIMINACIÓN COMPLETA (Fichero + Relación + ContentType)
    // Es vital para evitar el error de "problema con contenido" al cambiar los datos.
    if (zip.file('xl/calcChain.xml')) {
      zip.remove('xl/calcChain.xml');

      const ctXml = await zip.file('[Content_Types].xml').async('string');
      zip.file('[Content_Types].xml', ctXml.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, ''));

      const rXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
      zip.file('xl/_rels/workbook.xml.rels', rXml.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g, ''));
    }

    // 2) workbook.xml: forzar recálculo completo y sincronizar el rango del autofiltro
    let wbXml = await zip.file('xl/workbook.xml').async('string');
    if (wbXml.includes('<calcPr')) {
      wbXml = wbXml.replace(/<calcPr([^/>]*)\/?>/, (m, attrs) => {
        let a = attrs;
        if (!a.includes('fullCalcOnLoad')) a += ' fullCalcOnLoad="1"';
        if (!a.includes('forceFullCalc')) a += ' forceFullCalc="1"';
        return `<calcPr${a}/>`;
      });
    } else {
      const pos = wbXml.indexOf('</workbook>');
      wbXml = wbXml.slice(0, pos) + '<calcPr fullCalcOnLoad="1" forceFullCalc="1"/>' + wbXml.slice(pos);
    }
    // Sincronizar _FilterDatabase
    wbXml = wbXml.replace(/(Ventas!\$A\$4:\$E\$)\d+/g, `$1${maxRow}`);
    zip.file('xl/workbook.xml', wbXml);

    // 3) Fórmulas de sheet1/sheet3: sin valor cacheado y con ca="1"
    // Se hace por regex para no tocar el resto del XML y preservar las macros del botón.
    const forceRecalcXml = (xml) => xml
      .replace(/<f(?=[\s>])(?![^>]*\bca=)([^>]*)>/g, '<f ca="1"$1>')
      .replace(/(<\/f>)\s*<v>[^<]*<\/v>/g, '$1');

    for (const shPath of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml']) {
      const sXml = await zip.file(shPath).async('string');
      zip.file(shPath, forceRecalcXml(sXml));
    }

    // ========================================================================
    // 4. HOJA "ARO": anillo con el % del objetivo del mes (como en la web)
    //    Se AÑADE una hoja nueva al final. No se toca ninguna de las existentes
    //    (ni sus fórmulas, ni el botón, ni las macros VBA).
    // ========================================================================
    const mesActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    let objetivoMes = 0;
    try {
      if (typeof getMonthlyGoalForMonth === 'function') {
        objetivoMes = Number(getMonthlyGoalForMonth(mesActual)) || 0;
      }
    } catch (e) { }
    if (!objetivoMes) {
      try {
        const lista = JSON.parse(localStorage.getItem('parksales_objetivos_mensuales') || '[]');
        const item = Array.isArray(lista) ? lista.find((o) => o && o.mes === mesActual) : null;
        if (item) objetivoMes = Number(item.importe) || 0;
      } catch (e) { }
    }

    const esEfectiva = (v) => (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(v) : true);
    const vendidoMes = ventas
      .filter((v) => String(v.fecha || '').startsWith(mesActual) && esEfectiva(v))
      .reduce((acc, v) => acc + (Number(v.importe_total) || 0), 0);

    const progreso = objetivoMes > 0 ? Math.min(vendidoMes, objetivoMes) : 0;
    const restante = objetivoMes > 0 ? Math.max(0, objetivoMes - vendidoMes) : 0;
    const pctNum = objetivoMes > 0 ? vendidoMes / objetivoMes : 0;
    const pctTexto = (pctNum * 100).toFixed(1).replace('.', ',') + '% del objetivo';

    const escXml = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const celdaTexto = (ref, estilo, texto) =>
      `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escXml(texto)}</t></is></c>`;

    const filaSimple = (r, celdas) => `<row r="${r}" spans="1:5" x14ac:dyDescent="0.25">${celdas}</row>`;

    const sheetAroXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><sheetPr/><dimension ref="A1:K22"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr baseColWidth="10" defaultRowHeight="15" x14ac:dyDescent="0.25"/><cols><col min="1" max="1" width="24.7109375" customWidth="1"/><col min="2" max="2" width="18.7109375" customWidth="1"/><col min="3" max="3" width="2.7109375" customWidth="1"/><col min="4" max="10" width="11.7109375" customWidth="1"/></cols><sheetData><row r="1" spans="1:5" ht="23.25" x14ac:dyDescent="0.35">${celdaTexto('A1', 2, 'PROGRESO DEL MES')}<c r="B1" s="1"/><c r="C1" s="1"/><c r="D1" s="1"/><c r="E1" s="1"/></row>${filaSimple(2, celdaTexto('A2', 4, 'Aro del objetivo · se recalcula solo con tus ventas') + '<c r="B2" s="3"/><c r="C2" s="3"/><c r="D2" s="3"/><c r="E2" s="3"/>')}${filaSimple(4, celdaTexto('A4', 15, 'Objetivo del mes') + `<c r="B4" s="18"><v>${objetivoMes}</v></c>`)}${filaSimple(5, celdaTexto('A5', 15, 'Vendido este mes') + `<c r="B5" s="18"><f ca="1">SUMIFS(Ventas!$E$5:$E$5000,Ventas!$A$5:$A$5000,"&gt;="&amp;EOMONTH(TODAY(),-1)+1,Ventas!$A$5:$A$5000,"&lt;="&amp;EOMONTH(TODAY(),0))</f><v>${vendidoMes}</v></c>`)}${filaSimple(6, celdaTexto('A6', 15, 'Te falta') + `<c r="B6" s="18"><f ca="1">MAX(0,B4-B5)</f><v>${restante}</v></c>`)}${filaSimple(7, celdaTexto('A7', 15, '% conseguido') + `<c r="B7" s="13" t="str"><f ca="1">TEXT(IF(B4&gt;0,B5/B4,0),"0.0%")&amp;" del objetivo"</f><v>${escXml(pctTexto)}</v></c>`)}${filaSimple(9, celdaTexto('A9', 15, 'Progreso') + `<c r="B9" s="18"><f ca="1">MIN(B5,B4)</f><v>${progreso}</v></c>`)}${filaSimple(10, celdaTexto('A10', 15, 'Restante') + `<c r="B10" s="18"><f ca="1">MAX(0,B4-B5)</f><v>${restante}</v></c>`)}</sheetData><mergeCells count="1"><mergeCell ref="A1:E1"/></mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><drawing r:id="rId1"/></worksheet>`;

    const drawingAroXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Aro del objetivo"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;

    const chartAroXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:date1904 val="0"/><c:lang val="es-ES"/><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:strRef><c:f>Aro!$B$7</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escXml(pctTexto)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:overlay val="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1400" b="1"><a:solidFill><a:srgbClr val="0A0F1C"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-ES"/></a:p></c:txPr></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Objetivo del mes</c:v></c:tx><c:dPt><c:idx val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="FF9A44"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt><c:dPt><c:idx val="1"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="E7EAF0"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt><c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:cat><c:strRef><c:f>Aro!$A$9:$A$10</c:f><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>Progreso</c:v></c:pt><c:pt idx="1"><c:v>Restante</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Aro!$B$9:$B$10</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>${progreso}</c:v></c:pt><c:pt idx="1"><c:v>${restante}</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser><c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:firstSliceAng val="0"/><c:holeSize val="68"/></c:doughnutChart></c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="es-ES"/></a:p></c:txPr></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D8DEE9"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;

    const relsAroHoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing2.xml"/></Relationships>`;

    const relsAroDibujo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;

    zip.file('xl/worksheets/sheet5.xml', sheetAroXml);
    zip.file('xl/worksheets/_rels/sheet5.xml.rels', relsAroHoja);
    zip.file('xl/drawings/drawing2.xml', drawingAroXml);
    zip.file('xl/drawings/_rels/drawing2.xml.rels', relsAroDibujo);
    zip.file('xl/charts/chart1.xml', chartAroXml);

    // Registrar la hoja nueva en [Content_Types].xml
    let ctAro = await zip.file('[Content_Types].xml').async('string');
    if (!ctAro.includes('/xl/worksheets/sheet5.xml')) {
      ctAro = ctAro.replace('</Types>',
        '<Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' +
        '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>' +
        '</Types>');
      zip.file('[Content_Types].xml', ctAro);
    }

    // Registrar la relación y la pestaña de la hoja nueva en el libro
    let wbAro = await zip.file('xl/workbook.xml').async('string');
    if (!wbAro.includes('name="Aro"')) {
      wbAro = wbAro.replace('</sheets>', '<sheet name="Aro" sheetId="5" r:id="rId10"/></sheets>');
      zip.file('xl/workbook.xml', wbAro);

      let wbRelsAro = await zip.file('xl/_rels/workbook.xml.rels').async('string');
      if (!wbRelsAro.includes('worksheets/sheet5.xml')) {
        wbRelsAro = wbRelsAro.replace('</Relationships>',
          '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/></Relationships>');
        zip.file('xl/_rels/workbook.xml.rels', wbRelsAro);
      }
    }

    // Refrescar la lista de hojas de las propiedades del documento
    try {
      let appXml = await zip.file('docProps/app.xml').async('string');
      appXml = appXml
        .replace('<vt:i4>4</vt:i4>', '<vt:i4>5</vt:i4>')
        .replace('<vt:vector size="4" baseType="lpstr">', '<vt:vector size="5" baseType="lpstr">')
        .replace('</vt:vector></TitlesOfParts>', '<vt:lpstr>Aro</vt:lpstr></vt:vector></TitlesOfParts>');
      zip.file('docProps/app.xml', appXml);
    } catch (e) { /* opcional: si falla, Excel lo regenera */ }

    // 5. Generar el blob y descargar
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);

    toast(`¡Ventas inyectadas! PASO OBLIGATORIO: Clic derecho en el archivo -> Propiedades -> marcar DESBLOQUEAR -> Aceptar.`, 'success', 10000);
  } catch (err) {
    console.error('[ParkSales] Error al generar plantilla con macros:', err);
    toast('Error al generar la plantilla: ' + err.message, 'error');
  }
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
  let totalVentasAActualizar = {}; // id -> { id, localizador, estadoAnterior, estadoNuevo, cliente_nombre, item_nombre }
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
      reader.onload = async (e) => {
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

          for (let i = headerIdx + 1; i < lines.length; i++) {
            if (i % 250 === 0) await new Promise(r => setTimeout(r, 0));
            if (!lines[i].trim()) continue;
            const row = parseCSVLine(lines[i]);
            if (row.length < 11) continue;

            const localizador = (row[1] || '').trim();
            const cliente_nombre = row[2] || '';
            const importe_total = typeof parseSpanishNumber === 'function' ? parseSpanishNumber(row[3]) : (Number(row[3]) || 0);
            const fechaVentaOriginal = row[4];
            const correo = row[5];
            const telefono = (row[6] || '').replace(/\s/g, '').replace(/^\+34/, '');
            const metodoPago = row[7];
            const estadoRaw = row[10] || 'Completado';
            const estadoNorm = typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(estadoRaw) : 'completado';
            const newPrio = typeof getEstadoPriority === 'function' ? getEstadoPriority(estadoNorm) : 1;

            if (localizador) {
              // 1. Comprobar si ya existe en la base de datos (STATE.ventas)
              const existingVenta = (STATE.ventas || []).find(v => String(v.localizador || '').trim() === localizador);
              if (existingVenta) {
                // Verificar si ya fue marcado para actualizar en una fila previa de esta importación
                const currentUpdated = totalVentasAActualizar[existingVenta.id];
                const currentPrio = currentUpdated
                  ? (typeof getEstadoPriority === 'function' ? getEstadoPriority(currentUpdated.estadoNuevo) : 1)
                  : (typeof getEstadoPriority === 'function' ? getEstadoPriority(existingVenta.estado) : 1);

                if (newPrio > currentPrio) {
                  totalVentasAActualizar[existingVenta.id] = {
                    id: existingVenta.id,
                    localizador: localizador,
                    estadoAnterior: existingVenta.estado,
                    estadoNuevo: estadoNorm,
                    cliente_nombre: existingVenta.cliente_nombre || cliente_nombre,
                    item_nombre: nombreImport
                  };
                } else {
                  fileDuplicadas++;
                }
                continue;
              }

              // 2. Comprobar si ya fue agregado en el lote actual (totalNuevasVentas o fileNuevasVentas)
              const batchVenta = totalNuevasVentas.find(v => String(v.localizador || '').trim() === localizador)
                || fileNuevasVentas.find(v => String(v.localizador || '').trim() === localizador);

              if (batchVenta) {
                const batchPrio = typeof getEstadoPriority === 'function' ? getEstadoPriority(batchVenta.estado) : 1;
                if (newPrio > batchPrio) {
                  batchVenta.estado = estadoNorm;
                  // Actualizar también el apunte correspondiente
                  const batchApunte = totalNuevosApuntes.find(a => String(a.localizador || '').trim() === localizador)
                    || fileNuevosApuntes.find(a => String(a.localizador || '').trim() === localizador);
                  if (batchApunte) {
                    let estadoPagoContacto = 'pagado';
                    if (estadoNorm === 'pendiente') estadoPagoContacto = 'pendiente';
                    else if (estadoNorm === 'incompleto') estadoPagoContacto = 'Incompleto';
                    else if (estadoNorm === 'enviado') estadoPagoContacto = 'Enviado';
                    else if (estadoNorm === 'no_enviado') estadoPagoContacto = 'No enviado';
                    batchApunte.estado_pago = estadoPagoContacto;
                  }
                } else {
                  fileDuplicadas++;
                }
                continue;
              }
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
              localizador: localizador || null,
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
              localizador: localizador || null,
              created_at: isoDate
            });
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

  const numNuevas = totalNuevasVentas.length;
  const numActualizadas = Object.keys(totalVentasAActualizar).length;

  if (numNuevas === 0 && numActualizadas === 0) {
    let msg = `No hay ventas nuevas ni actualizaciones de estado para importar. ${totalDuplicadas} duplicadas omitidas sin cambios en los archivos.\n`;
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
    listHtml += `<li><strong>${count}</strong> nueva(s) de ${escapeHtml(pName)}</li>`;
  }
  if (numActualizadas > 0) {
    listHtml += `<li><strong>${numActualizadas}</strong> venta(s) existente(s) que suben a un estado superior (ej. a Completado)</li>`;
  }
  listHtml += '</ul>';

  const resumenPartes = [];
  if (numNuevas > 0) resumenPartes.push(`<strong>${numNuevas} venta(s) nueva(s)</strong>`);
  if (numActualizadas > 0) resumenPartes.push(`<strong>${numActualizadas} venta(s) actualizada(s) de estado</strong>`);

  let messageHtml = `Se han procesado <strong>${filesProcessed} archivo(s)</strong> y encontrado ${resumenPartes.join(' y ')}:<br>${listHtml}Se omitirán ${totalDuplicadas} registros duplicados sin cambios. ¿Continuar con la importación?`;

  if (failedFiles.length > 0) {
    messageHtml += `<br><br><span style="color:var(--danger)"><strong>Atención:</strong> Hubo errores en ${failedFiles.length} archivo(s):</span><ul style="font-size:12px; margin-top:4px; margin-left: 20px;"><li>${failedFiles.map(escapeHtml).join('</li><li>')}</li></ul>`;
  }

  confirmDialog({
    title: 'Importar ventas de Vector',
    message: messageHtml,
    isHtmlMessage: true,
    confirmLabel: 'Importar todo',
    danger: false,
    onConfirm: async () => {
      try {
        // 1. Insertar nuevas ventas y contactos
        if (totalNuevasVentas.length > 0) {
          await DB.bulkInsertVentas(totalNuevasVentas);
          for (const apunte of totalNuevosApuntes) {
            await DB.addContacto(apunte);
          }
        }

        // 2. Actualizar ventas existentes cuyo estado ha mejorado
        for (const item of Object.values(totalVentasAActualizar)) {
          await DB.updateVenta(item.id, { estado: item.estadoNuevo });

          let estadoPagoContacto = 'pagado';
          if (item.estadoNuevo === 'pendiente') estadoPagoContacto = 'pendiente';
          else if (item.estadoNuevo === 'incompleto') estadoPagoContacto = 'Incompleto';
          else if (item.estadoNuevo === 'enviado') estadoPagoContacto = 'Enviado';
          else if (item.estadoNuevo === 'no_enviado') estadoPagoContacto = 'No enviado';

          const vExisting = (STATE.ventas || []).find(v => v.id === item.id);
          const linked = typeof findContactoForVenta === 'function' ? findContactoForVenta(vExisting) : null;
          if (linked?.id) {
            await DB.updateContacto(linked.id, { estado_pago: estadoPagoContacto });
          }
        }

        STATE.ventas = await DB.getVentas();
        STATE.contactos = await DB.getContactos();
        refreshAllViewsAfterDataChange();

        const toastMsgs = [];
        if (numNuevas > 0) toastMsgs.push(`${numNuevas} venta(s) importada(s)`);
        if (numActualizadas > 0) toastMsgs.push(`${numActualizadas} estado(s) actualizado(s)`);
        toast(toastMsgs.join(' y ') + ' correctamente', 'success');
      } catch (err) {
        toast('Error al guardar: ' + err.message, 'error');
      }
    }
  });
}
