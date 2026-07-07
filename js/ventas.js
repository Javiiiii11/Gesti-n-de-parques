/* ============================================================================
   ventas.js — vista "Registrar venta" (registro rápido)
============================================================================ */

function getParqueResumen(parqueId) {
  const ventasParque = STATE.ventas.filter((v) => v.parque_id === parqueId);
  const importeTotal = ventasParque.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
  const ventasTotales = ventasParque.length;
  const mediaVenta = ventasTotales ? importeTotal / ventasTotales : 0;
  return { ventasParque, ventasTotales, importeTotal, mediaVenta };
}

function initVentaForm() {
  const form = document.getElementById('venta-form');
  ['v-parque', 'v-cliente', 'v-importe'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateTicketPreview);
    document.getElementById(id).addEventListener('change', updateTicketPreview);
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); guardarVenta({ keepOpen: false }); });
  document.getElementById('btn-save-and-add').addEventListener('click', () => guardarVenta({ keepOpen: true }));
  document.getElementById('btn-clear-form').addEventListener('click', resetVentaForm);

  updateTicketPreview();
}

function updateTicketPreview() {
  const parqueId = document.getElementById('v-parque').value;
  const parque = STATE.parques.find((p) => p.id === parqueId);
  const resumen = parqueId ? getParqueResumen(parqueId) : null;
  const cliente = document.getElementById('v-cliente').value.trim() || 'Cliente sin nombre';
  const importe = Number(document.getElementById('v-importe').value) || 0;

  document.getElementById('tp-park').textContent = parque ? parque.nombre : 'Sin parque';
  document.getElementById('tp-type').textContent = `Cliente: ${cliente}`;
  document.getElementById('tp-cantidad').textContent = resumen ? fmtNum(resumen.ventasTotales) : '0';
  document.getElementById('tp-precio').textContent = resumen ? fmtEUR(resumen.mediaVenta) : '0,00 €';
  document.getElementById('tp-comision').textContent = resumen ? fmtEUR(resumen.importeTotal) : '0,00 €';
  document.getElementById('tp-total').textContent = fmtEUR(importe);
}

async function guardarVenta({ keepOpen }) {
  const parqueId = document.getElementById('v-parque').value;
  const clienteNombre = document.getElementById('v-cliente').value.trim();
  const importeTotal = Number(document.getElementById('v-importe').value);

  if (!parqueId) { toast('Selecciona un parque', 'error'); return; }
  if (!clienteNombre) { toast('Indica el nombre del cliente', 'error'); return; }
  if (importeTotal === null || isNaN(importeTotal) || importeTotal < 0) { toast('Indica un importe válido', 'error'); return; }

  const payload = {
    fecha: new Date().toISOString(),
    parque_id: parqueId,
    cliente_nombre: clienteNombre,
    importe_total: importeTotal,
  };

  const submitBtns = document.querySelectorAll('#venta-form button, #btn-save-and-add');
  submitBtns.forEach((b) => (b.disabled = true));

  try {
    await DB.addVenta(payload);
    STATE.ventas = await DB.getVentas();
    toast('Venta guardada correctamente', 'success');
    refreshAllViewsAfterDataChange();
    if (keepOpen) {
      document.getElementById('v-cliente').value = '';
      document.getElementById('v-importe').value = '';
      updateTicketPreview();
      document.getElementById('v-cliente').focus();
    } else {
      resetVentaForm();
    }
  } catch (err) {
    toast('Error al guardar la venta: ' + err.message, 'error');
  } finally {
    submitBtns.forEach((b) => (b.disabled = false));
  }
}

function resetVentaForm() {
  document.getElementById('venta-form').reset();
  updateTicketPreview();
}

function refreshAllViewsAfterDataChange() {
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof renderParquesTable === 'function') renderParquesTable();
  if (typeof renderEstadisticas === 'function') renderEstadisticas();
}
