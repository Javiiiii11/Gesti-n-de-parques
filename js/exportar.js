/* ============================================================================
   exportar.js — vista "Exportar / Importar"
============================================================================ */

function initExportView() {
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-xlsx').addEventListener('click', exportXLSX);
  document.getElementById('btn-export-json').addEventListener('click', exportBackupJSON);

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

function ventasHeaders() {
  return [
    { label: 'Fecha', value: (v) => fmtDateTime(v.fecha) },
    { label: 'Parque', value: (v) => parqueNombre(v.parque_id) },
    { label: 'Cliente', value: (v) => v.cliente_nombre || '—' },
    { label: 'Importe total', value: (v) => v.importe_total },
  ];
}

function exportCSV() {
  if (!STATE.ventas.length) { toast('No hay ventas que exportar todavía', 'error'); return; }
  const csv = toCSV(STATE.ventas, ventasHeaders());
  downloadFile(`parksales_ventas_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('CSV descargado correctamente', 'success');
}

function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('No se pudo cargar la librería de Excel. Comprueba tu conexión.', 'error', 4500); return; }
  if (!STATE.ventas.length && !STATE.parques.length) { toast('No hay datos que exportar todavía', 'error'); return; }
  const wb = XLSX.utils.book_new();

  const ventasRows = STATE.ventas.map((v) => ({
    Fecha: fmtDateTime(v.fecha), Parque: parqueNombre(v.parque_id), Cliente: v.cliente_nombre || '—',
    'Importe total': v.importe_total,
  }));
  const wsVentas = XLSX.utils.json_to_sheet(ventasRows);
  XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

  const parquesRows = STATE.parques.map((p) => ({
    Nombre: p.nombre, Activo: p.activo ? 'Sí' : 'No', 'Ventas totales': STATE.ventas.filter((v) => v.parque_id === p.id).length,
  }));
  const wsParques = XLSX.utils.json_to_sheet(parquesRows);
  XLSX.utils.book_append_sheet(wb, wsParques, 'Parques');

  XLSX.writeFile(wb, `parksales_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Excel descargado correctamente', 'success');
}

function exportBackupJSON() {
  const backup = {
    generado_en: new Date().toISOString(),
    version: 1,
    parques: STATE.parques,
    ventas: STATE.ventas,
  };
  downloadFile(`parksales_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast('Copia de seguridad descargada', 'success');
}

function handleImportFile(file) {
  if (!file.name.endsWith('.json')) { toast('Solo se admiten archivos .json de backup', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.ventas || !data.parques) throw new Error('El archivo no tiene el formato esperado');

      confirmDialog({
        title: 'Importar copia de seguridad',
        message: `Se importarán ${data.parques.length} parques y ${data.ventas.length} ventas. Esto añadirá los registros sin eliminar los existentes. ¿Continuar?`,
        confirmLabel: 'Importar',
        danger: false,
        onConfirm: async () => {
          try {
            const nombreAId = {};
            STATE.parques.forEach((p) => { nombreAId[p.nombre] = p.id; });
            const nuevosParques = data.parques.filter((p) => !nombreAId[p.nombre]);
            if (nuevosParques.length) await DB.bulkInsertParques(nuevosParques.map(({ id, created_at, updated_at, comision_fija, comision_porcentual, ...rest }) => rest));

            STATE.parques = await DB.getParques();
            STATE.parques.forEach((p) => { nombreAId[p.nombre] = p.id; });

            const ventasParaInsertar = data.ventas.map(({ id, created_at, parque_id, ...rest }) => {
              const parqueOriginal = data.parques.find((p) => p.id === parque_id);
              const nuevoParqueId = parqueOriginal ? nombreAId[parqueOriginal.nombre] : null;
              const cliente_nombre = rest.cliente_nombre || rest.nombre_cliente || rest.tipo_entrada || 'Cliente';
              const importe_total = Number(rest.importe_total ?? (Number(rest.cantidad || 0) * Number(rest.precio_unitario || 0))) || 0;
              return { parque_id: nuevoParqueId, cliente_nombre, importe_total };
            }).filter((v) => v.parque_id);

            if (ventasParaInsertar.length) await DB.bulkInsertVentas(ventasParaInsertar);

            STATE.ventas = await DB.getVentas();
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
