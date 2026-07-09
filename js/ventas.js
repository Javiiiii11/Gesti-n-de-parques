/* ============================================================================
   ventas.js — vista "Registrar venta" (registro rápido)
============================================================================ */

function getResumen(tipo, itemId) {
  if (tipo === 'entrada') {
    const ventasParque = STATE.ventas.filter((v) => v.tipo === 'entrada' && v.parque_id === itemId);
    const importeTotal = ventasParque.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
    const ventasTotales = ventasParque.length;
    const mediaVenta = ventasTotales ? importeTotal / ventasTotales : 0;
    const item = STATE.parques.find(p => p.id === itemId);
    return { ventasTotales, importeTotal, mediaVenta, itemNombre: item ? item.nombre : 'Sin parque' };
  } else {
    const ventasBono = STATE.ventas.filter((v) => v.tipo === 'bono' && v.bono_id === itemId);
    const importeTotal = ventasBono.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
    const ventasTotales = ventasBono.length;
    const mediaVenta = ventasTotales ? importeTotal / ventasTotales : 0;
    const item = STATE.tipos_bono.find(b => b.id === itemId);
    return { ventasTotales, importeTotal, mediaVenta, itemNombre: item ? item.nombre : 'Sin bono' };
  }
}

function updateVentaFormVisibility() {
  const tipo = document.querySelector('input[name="v-tipo"]:checked')?.value || 'entrada';
  document.getElementById('v-field-parque').style.display = tipo === 'entrada' ? 'block' : 'none';
  document.getElementById('v-field-bono').style.display = tipo === 'bono' ? 'block' : 'none';
  updateTicketPreview();
}

function initVentaForm() {
  const form = document.getElementById('venta-form');
  
  // Añadir listeners para los campos
  ['v-parque', 'v-bono', 'v-cliente', 'v-importe'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateTicketPreview);
      el.addEventListener('change', updateTicketPreview);
    }
  });
  
  // Añadir listeners para los radio buttons
  document.querySelectorAll('input[name="v-tipo"]').forEach(el => {
    el.addEventListener('change', updateVentaFormVisibility);
  });

  form.addEventListener('submit', (e) => { 
    e.preventDefault(); 
    guardarVenta({ keepOpen: false }); 
  });
  
  document.getElementById('btn-save-and-add').addEventListener('click', () => guardarVenta({ keepOpen: true }));
  document.getElementById('btn-clear-form').addEventListener('click', resetVentaForm);

  updateVentaFormVisibility();
  updateTicketPreview();
}

function updateTicketPreview() {
  const tipo = document.querySelector('input[name="v-tipo"]:checked')?.value || 'entrada';
  let itemId;
  
  if (tipo === 'entrada') {
    itemId = document.getElementById('v-parque').value;
  } else {
    itemId = document.getElementById('v-bono').value;
  }
  
  const resumen = itemId ? getResumen(tipo, itemId) : null;
  const cliente = document.getElementById('v-cliente').value.trim() || 'Cliente sin nombre';
  const importe = Number(document.getElementById('v-importe').value) || 0;

  document.getElementById('tp-park').textContent = resumen ? resumen.itemNombre : (tipo === 'entrada' ? 'Sin parque' : 'Sin bono');
  document.getElementById('tp-type').textContent = `Cliente: ${cliente}`;
  document.getElementById('tp-cantidad').textContent = resumen ? fmtNum(resumen.ventasTotales) : '0';
  document.getElementById('tp-precio').textContent = resumen ? fmtEUR(resumen.mediaVenta) : '0,00 €';
  document.getElementById('tp-comision').textContent = resumen ? fmtEUR(resumen.importeTotal) : '0,00 €';
  document.getElementById('tp-total').textContent = fmtEUR(importe);
}

async function guardarVenta({ keepOpen }) {
  const tipo = document.querySelector('input[name="v-tipo"]:checked')?.value || 'entrada';
  const clienteNombre = document.getElementById('v-cliente').value.trim();
  const importeTotal = Number(document.getElementById('v-importe').value);
  
  let itemId;
  if (tipo === 'entrada') {
    itemId = document.getElementById('v-parque').value;
    if (!itemId) { 
      toast('Selecciona un parque', 'error'); 
      return; 
    }
  } else {
    itemId = document.getElementById('v-bono').value;
    if (!itemId) { 
      toast('Selecciona un tipo de bono', 'error'); 
      return; 
    }
  }
  
  if (!clienteNombre) { 
    toast('Indica el nombre del cliente', 'error'); 
    return; 
  }
  
  if (importeTotal === null || isNaN(importeTotal) || importeTotal < 0) { 
    toast('Indica un importe válido', 'error'); 
    return; 
  }

  const payload = {
    fecha: new Date().toISOString(),
    tipo,
    cliente_nombre: clienteNombre,
    importe_total: importeTotal,
  };
  
  if (tipo === 'entrada') {
    payload.parque_id = itemId;
    payload.bono_id = null;
  } else {
    payload.bono_id = itemId;
    payload.parque_id = null;
  }

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
  updateVentaFormVisibility();
  updateTicketPreview();
}

function refreshAllViewsAfterDataChange() {
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof renderParquesTable === 'function') renderParquesTable();
  if (typeof renderBonosTable === 'function') renderBonosTable();
  if (typeof renderEstadisticas === 'function') renderEstadisticas();
  if (typeof renderContactos === 'function') renderContactos();
}
