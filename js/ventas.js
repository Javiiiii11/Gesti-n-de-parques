/* ============================================================================
   ventas.js — vista "Registrar venta" (registro rápido)
   Una venta siempre se considera pagada. Al guardar se crea una venta en el
   historial Y un apunte (contacto) con estado "pagado" para tener todos los
   detalles del cliente.
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

/* Helper: safely set textContent on an element by id */
function setPreviewText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateVentaFormVisibility() {
  const tipo = document.querySelector('input[name="v-tipo"]:checked')?.value || 'entrada';
  
  const fieldParque = document.getElementById('v-field-parque');
  const fieldBono = document.getElementById('v-field-bono');
  if (fieldParque) fieldParque.style.display = tipo === 'entrada' ? '' : 'none';
  if (fieldBono) fieldBono.style.display = tipo === 'bono' ? '' : 'none';
  
  // Toggle entrada/bono specific sections
  const secEntradas = document.getElementById('v-seccion-entradas');
  const secBonos = document.getElementById('v-seccion-bonos');
  if (secEntradas) secEntradas.style.display = tipo === 'entrada' ? 'grid' : 'none';
  if (secBonos) secBonos.style.display = tipo === 'bono' ? 'grid' : 'none';

  // Toggle entrada/bono extra sections (only if extras container is visible)
  const extrasContainer = document.getElementById('v-section-extras');
  if (extrasContainer && extrasContainer.style.display !== 'none') {
    const secEntradasExtra = document.getElementById('v-seccion-entradas-extra');
    const secBonosExtra = document.getElementById('v-seccion-bonos-extra');
    if (secEntradasExtra) secEntradasExtra.style.display = tipo === 'entrada' ? 'grid' : 'none';
    if (secBonosExtra) secBonosExtra.style.display = tipo === 'bono' ? 'grid' : 'none';
  }

  // Toggle preview rows for entrada vs bono
  const showHide = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  };
  showHide('tp-row-telefono', tipo === 'entrada');
  showHide('tp-row-extras', tipo === 'entrada');
  showHide('tp-row-cantidad', true);
  showHide('tp-row-dni', tipo === 'bono');
  // Nº de bono solo se muestra cuando los extras están visibles y es tipo bono
  const extrasVisible = extrasContainer && extrasContainer.style.display !== 'none';
  showHide('tp-row-num-bono', tipo === 'bono' && extrasVisible);
  
  updateTicketPreview();
}

function initVentaForm() {
  const form = document.getElementById('venta-form');
  if (!form) return;
  
  // Listener para TODOS los campos para que la vista previa se actualice en vivo
  const liveFields = [
    'v-parque', 'v-bono', 'v-cliente', 'v-correo', 'v-importe',
    'v-telefono', 'v-cantidad-entradas', 'v-extras',
    'v-num-bono', 'v-dni', 'v-nacimiento', 'v-cantidad-bonos',
    'v-anotaciones', 'v-anotaciones-bono', 'v-localizador'
  ];
  liveFields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateTicketPreview);
      el.addEventListener('change', updateTicketPreview);
    }
  });
  
  // Listeners para los radio buttons de tipo
  document.querySelectorAll('input[name="v-tipo"]').forEach(el => {
    el.addEventListener('change', updateVentaFormVisibility);
  });

  form.addEventListener('submit', (e) => { 
    e.preventDefault(); 
    guardarVenta({ keepOpen: false }); 
  });
  
  const btnSaveAdd = document.getElementById('btn-save-and-add');
  if (btnSaveAdd) btnSaveAdd.addEventListener('click', () => guardarVenta({ keepOpen: true }));
  
  const btnClear = document.getElementById('btn-clear-form');
  if (btnClear) btnClear.addEventListener('click', resetVentaForm);

  // Toggle extra fields
  const toggleBtn = document.getElementById('v-toggle-extras');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const extras = document.getElementById('v-section-extras');
      const text = document.getElementById('v-toggle-extras-text');
      if (extras) {
        const isHidden = extras.style.display === 'none';
        extras.style.display = isHidden ? 'block' : 'none';
        if (text) text.textContent = isHidden ? 'Ocultar campos extra' : 'Mostrar más campos';
      }
    });
  }

  // Cablear el parseo rápido
  wireQuickParse();

  updateVentaFormVisibility();
  updateTicketPreview();
}

function updateTicketPreview() {
  const tipoRadio = document.querySelector('input[name="v-tipo"]:checked');
  if (!tipoRadio) return; // form not ready yet
  const tipo = tipoRadio.value || 'entrada';
  
  let itemNombre;
  if (tipo === 'entrada') {
    const parqueEl = document.getElementById('v-parque');
    const itemId = parqueEl ? parqueEl.value : '';
    const parque = itemId ? STATE.parques.find(p => p.id === itemId) : null;
    itemNombre = parque ? parque.nombre : 'Selecciona un parque';
  } else {
    const bonoEl = document.getElementById('v-bono');
    const itemId = bonoEl ? bonoEl.value : '';
    const bono = itemId ? STATE.tipos_bono.find(b => b.id === itemId) : null;
    itemNombre = bono ? bono.nombre : 'Selecciona un bono';
  }
  
  const clienteEl = document.getElementById('v-cliente');
  const correoEl = document.getElementById('v-correo');
  const importeEl = document.getElementById('v-importe');
  
  const cliente = clienteEl ? clienteEl.value.trim() : '';
  const correo = correoEl ? correoEl.value.trim() : '';
  const importe = importeEl ? (Number(importeEl.value) || 0) : 0;

  // Header
  setPreviewText('tp-park', itemNombre);
  setPreviewText('tp-type', `Cliente: ${cliente || '—'}`);

  // Common fields
  const rowCorreo = document.getElementById('tp-row-correo');
  if (rowCorreo) {
    if (correo) {
      rowCorreo.style.display = '';
      setPreviewText('tp-correo', correo);
    } else {
      rowCorreo.style.display = 'none';
    }
  }
  const localizadorEl = document.getElementById('v-localizador');
  const locValue = localizadorEl ? localizadorEl.value.trim() : '';
  setPreviewText('tp-localizador', locValue || 'Sin localizador');
  setPreviewText('tp-total', typeof fmtEUR === 'function' ? fmtEUR(importe) : importe.toFixed(2) + ' €');

  // Entrada-specific preview
  if (tipo === 'entrada') {
    const telefonoEl = document.getElementById('v-telefono');
    const cantidadEl = document.getElementById('v-cantidad-entradas');
    const extrasEl = document.getElementById('v-extras');
    
    setPreviewText('tp-telefono', (telefonoEl && telefonoEl.value.trim()) || '—');
    setPreviewText('tp-cantidad', (cantidadEl && cantidadEl.value) || '—');
    setPreviewText('tp-extras-preview', (extrasEl && extrasEl.value.trim()) || '—');
  } else {
    // Bono-specific preview
    const numBonoEl = document.getElementById('v-num-bono');
    const dniEl = document.getElementById('v-dni');
    const cantidadEl = document.getElementById('v-cantidad-bonos');
    
    setPreviewText('tp-num-bono', (numBonoEl && numBonoEl.value.trim()) || '—');
    setPreviewText('tp-dni-preview', (dniEl && dniEl.value.trim()) || '—');
    setPreviewText('tp-cantidad', (cantidadEl && cantidadEl.value) || '—');
  }

  // Anotaciones preview — show row only if there's text
  const anotacionesEl = document.getElementById('v-anotaciones');
  const notas = anotacionesEl ? anotacionesEl.value.trim() : '';
  const rowNotas = document.getElementById('tp-row-notas');
  if (rowNotas) {
    if (notas) {
      rowNotas.style.display = '';
      setPreviewText('tp-notas', notas);
      const notasPreviewEl = document.getElementById('tp-notas');
      if (notasPreviewEl) notasPreviewEl.title = notas;
    } else {
      rowNotas.style.display = 'none';
    }
  }
}

/* ============================================================================
   PARSER RÁPIDO — Pega una línea desde una tabla y rellena el formulario
   Formato esperado para entradas:
   username    localizador    nombre_cliente    precio    fecha_hora    correo    teléfono    método_pago
   Ejemplo:
   jrodriguezj    21280354    JUAN AMADOR HERNANDEZ    179,70 €    2026/07/23 18:55:27    paolavazkez20@gmail.com    +34613218953    Scalapay
   ============================================================================ */
function wireQuickParse() {
  const textarea = document.getElementById('venta-quick-parse');
  if (!textarea || textarea.dataset.wired === '1') return;
  textarea.dataset.wired = '1';
  
  const btnParse = document.getElementById('btn-quick-parse');
  const preview = document.getElementById('quick-parse-preview');
  const btnConfirm = document.getElementById('btn-quick-confirm');
  const btnCancel = document.getElementById('btn-quick-cancel');
  
  let parsedData = null;

  function parseLine(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Detectar si es formato separado por saltos de línea (cada campo en una línea)
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 5) {
      // Formato línea por línea:
      //   0: username (ignorado)
      //   1: localizador
      //   2: nombre_cliente
      //   3: precio (179,70 €)
      //   4: fecha_hora (ignorada)
      //   5: correo
      //   6: teléfono
      //   7+: ignorado
      const localizador = lines[1]?.trim() || '';
      const nombreCliente = lines[2]?.trim() || '';
      const precioStr = (lines[3] || '0').replace('€', '').replace(',', '.').replace(/\s/g, '');
      const precio = parseFloat(precioStr) || 0;
      const correo = lines[5]?.trim() || '';
      let telefono = (lines[6] || '').replace(/\s/g, '');
      if (telefono.startsWith('+34')) telefono = telefono.substring(3);

      return { localizador, nombreCliente, precio, correo, telefono };
    }

    // Formato clásico: separado por tabs o espacios múltiples (una línea)
    //   username(0)  localizador(1)  nombre(2)  precio(3)  fecha(4)  correo(5)  tlf(6)  metodo(7)
    const parts = trimmed.split(/\t+|  +/).filter(p => p.length > 0);
    if (parts.length < 5) return null;

    const localizador = parts[1] || '';
    const nombreCliente = parts[2] || '';
    const precioStr = (parts[3] || '0').replace('€', '').replace(',', '.').replace(/\s/g, '');
    const precio = parseFloat(precioStr) || 0;
    const correo = parts[5] || '';
    let telefono = (parts[6] || '').replace(/\s/g, '');
    if (telefono.startsWith('+34')) telefono = telefono.substring(3);

    return { localizador, nombreCliente, precio, correo, telefono };
  }

  function fillForm(data) {
    if (!data) return;
    
    // Asegurar que estamos en modo "entrada"
    const radioEntrada = document.querySelector('input[name="v-tipo"][value="entrada"]');
    if (radioEntrada) radioEntrada.checked = true;
    updateVentaFormVisibility();
    
    // Mostrar campos extra si es necesario (teléfono)
    const extras = document.getElementById('v-section-extras');
    const toggleText = document.getElementById('v-toggle-extras-text');
    if (extras && extras.style.display === 'none') {
      extras.style.display = 'block';
      if (toggleText) toggleText.textContent = 'Ocultar campos extra';
    }
    
    // Rellenar campos
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('v-localizador', data.localizador);
    setVal('v-cliente', data.nombreCliente);
    setVal('v-importe', data.precio);
    setVal('v-correo', data.correo);
    setVal('v-telefono', data.telefono);
    
    // Actualizar preview
    updateTicketPreview();
  }

  btnParse.addEventListener('click', () => {
    const line = textarea.value.trim();
    if (!line) { toast('Pega el texto de la tabla primero', 'error'); return; }
    
    parsedData = parseLine(line);
    if (!parsedData) {
      toast('No se pudo interpretar el formato. Revisa que tenga: localizador, nombre, precio, correo y teléfono', 'error');
      return;
    }
    
    // Mostrar preview de lo parseado
    if (preview) {
      preview.innerHTML = `
        <div class="qp-card">
          <div class="qp-head">📋 Vista previa de datos detectados</div>
          <div class="qp-row"><span>Localizador</span><strong>${escapeHtml(parsedData.localizador)}</strong></div>
          <div class="qp-row"><span>Cliente</span><strong>${escapeHtml(parsedData.nombreCliente)}</strong></div>
          <div class="qp-row"><span>Importe</span><strong>${typeof fmtEUR === 'function' ? fmtEUR(parsedData.precio) : parsedData.precio.toFixed(2) + ' €'}</strong></div>
          <div class="qp-row"><span>Correo</span><strong>${escapeHtml(parsedData.correo)}</strong></div>
          <div class="qp-row"><span>Teléfono</span><strong>${escapeHtml(parsedData.telefono)}</strong></div>
        </div>
      `;
      preview.style.display = 'block';
    }
    if (btnConfirm) btnConfirm.style.display = 'inline-flex';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
  });

  btnConfirm.addEventListener('click', () => {
    if (!parsedData) return;
    fillForm(parsedData);
    // Ocultar preview
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (btnConfirm) btnConfirm.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    textarea.value = '';
    toast('Datos cargados en el formulario. Revisa y guarda.', 'success');
  });

  btnCancel.addEventListener('click', () => {
    parsedData = null;
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (btnConfirm) btnConfirm.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    textarea.value = '';
  });
}

async function guardarVenta({ keepOpen }) {
  const tipo = document.querySelector('input[name="v-tipo"]:checked')?.value || 'entrada';
  const clienteNombre = document.getElementById('v-cliente')?.value.trim() || '';
  const correo = document.getElementById('v-correo')?.value.trim() || '';
  const importeTotal = Number(document.getElementById('v-importe')?.value);
  const anotaciones = tipo === 'entrada'
    ? (document.getElementById('v-anotaciones')?.value.trim() || '')
    : (document.getElementById('v-anotaciones-bono')?.value.trim() || '');
  const localizador = document.getElementById('v-localizador')?.value.trim() || '';
  
  let itemId;
  if (tipo === 'entrada') {
    itemId = document.getElementById('v-parque')?.value;
    if (!itemId) { 
      toast('Selecciona un parque', 'error'); 
      return; 
    }
  } else {
    itemId = document.getElementById('v-bono')?.value;
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

  // Build contacto (apunte) payload — always "pagado" since this is a sale
  const contactoPayload = {
    tipo,
    nombre_apellidos: clienteNombre,
    correo,
    importe_total: importeTotal,
    estado_pago: 'pagado',
    anotaciones,
    localizador: localizador || null
  };

  if (tipo === 'entrada') {
    contactoPayload.telefono = document.getElementById('v-telefono')?.value.trim() || '';
    contactoPayload.parque_id = itemId;
    const cantVal = document.getElementById('v-cantidad-entradas')?.value;
    contactoPayload.cantidad_entradas = cantVal ? Number(cantVal) : null;
    contactoPayload.extras = document.getElementById('v-extras')?.value.trim() || '';
  } else {
    contactoPayload.num_bono = document.getElementById('v-num-bono')?.value.trim() || '';
    contactoPayload.dni = document.getElementById('v-dni')?.value.trim() || '';
    const fechaNac = document.getElementById('v-nacimiento')?.value;
    contactoPayload.fecha_nacimiento = fechaNac || null;
    contactoPayload.bono_id = itemId;
    const cantVal = document.getElementById('v-cantidad-bonos')?.value;
    contactoPayload.cantidad_bonos = cantVal ? Number(cantVal) : null;
  }

  const via = document.getElementById('v-via')?.value || 'llamada';

  // Build venta payload
  const ventaPayload = {
    fecha: new Date().toISOString(),
    tipo,
    via,
    cliente_nombre: clienteNombre,
    importe_total: importeTotal,
    localizador: localizador || null,
  };
  
  if (tipo === 'entrada') {
    ventaPayload.parque_id = itemId;
    ventaPayload.bono_id = null;
  } else {
    ventaPayload.bono_id = itemId;
    ventaPayload.parque_id = null;
  }

  const submitBtns = document.querySelectorAll('#venta-form button, #btn-save-and-add');
  submitBtns.forEach((b) => (b.disabled = true));

  try {
    // Create both the contacto and the venta
    await DB.addContacto(contactoPayload);
    await DB.addVenta(ventaPayload);

    STATE.ventas = await DB.getVentas();
    STATE.contactos = await DB.getContactos();
    refreshAllViewsAfterDataChange();

    toast('Venta registrada y apunte creado', 'success');

    if (keepOpen) {
      // Clear client-specific fields, keep tipo and parque/bono selection
      const fieldsToClear = [
        'v-cliente', 'v-correo', 'v-importe', 'v-anotaciones', 'v-localizador',
        'v-telefono', 'v-extras', 'v-num-bono', 'v-dni', 'v-nacimiento',
        'v-cantidad-entradas', 'v-cantidad-bonos'
      ];
      fieldsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      updateTicketPreview();
      const clienteField = document.getElementById('v-cliente');
      if (clienteField) clienteField.focus();
    } else {
      resetVentaForm();
    }
  } catch (err) {
    toast('Error al guardar: ' + err.message, 'error');
  } finally {
    submitBtns.forEach((b) => (b.disabled = false));
  }
}

function resetVentaForm() {
  const form = document.getElementById('venta-form');
  if (form) form.reset();
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