/* ============================================================================
   llamadas.js — Gestión de llamadas programadas con alarmas
   ============================================================================ */

const CALLS_STORAGE_KEY = 'parksales_llamadas';

let callsAlarmInterval = null;
let callsNotified10min = new Set();
let callsNotifiedExact = new Set();
let editingCallId = null;

function getCalls() {
  try {
    return JSON.parse(localStorage.getItem(CALLS_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveCalls(calls) {
  localStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(calls));
}

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getEstadoLlamada(llamada) {
  const ahora = new Date();
  const hora = new Date(llamada.fecha_hora);
  if (llamada.completada) return 'completada';
  if (llamada.cancelada) return 'cancelada';
  if (hora < ahora) return 'vencida';
  return 'pendiente';
}

/* ============================================================================
   Renderizado
   ============================================================================ */
function initLlamadasView() {
  renderLlamadas();
  wireLlamadasForm();
  startAlarmChecker();
}

function renderLlamadas() {
  renderLlamadasForm();
  renderLlamadasList();
}

function setDefaultLlamadaFecha() {
  const fechaEl = document.getElementById('ll-fecha');
  if (!fechaEl) return;
  const hoy = new Date();
  const pad = n => String(n).padStart(2, '0');
  fechaEl.value = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
}

function renderLlamadasForm() {
  // Default date = today
  setDefaultLlamadaFecha();

  // Fill park and bono selects
  const selParque = document.getElementById('ll-parque');
  const selBono = document.getElementById('ll-bono');
  if (selParque) {
    const activos = (STATE.parques || []).filter(p => p.activo !== false);
    selParque.innerHTML = '<option value="">Seleccionar parque...</option>' +
      activos.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  }
  if (selBono) {
    const activos = (STATE.tipos_bono || []).filter(b => b.activo !== false);
    selBono.innerHTML = '<option value="">Seleccionar bono...</option>' +
      activos.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join('');
  }
}

function wireLlamadasForm() {
  const form = document.getElementById('llamada-form');
  if (!form || form.dataset.wired === '1') return;
  form.dataset.wired = '1';

  // Botón cancelar edición
  const cancelEditBtn = document.getElementById('ll-cancel-edit');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      resetLlamadaForm();
      toast('Edición cancelada', 'info');
    });
  }

  // Deshabilitar validación nativa del navegador para que el submit
  // event se dispare siempre y la validación la maneje nuestro JS
  form.noValidate = true;

  // Tipo selector
  document.querySelectorAll('input[name="ll-tipo"]').forEach(el => {
    el.addEventListener('change', () => {
      const tipo = document.querySelector('input[name="ll-tipo"]:checked')?.value || 'entrada';
      const parqueField = document.getElementById('ll-field-parque');
      const bonoField = document.getElementById('ll-field-bono');
      if (parqueField) parqueField.style.display = tipo === 'entrada' ? '' : 'none';
      if (bonoField) bonoField.style.display = tipo === 'bono' ? '' : 'none';
    });
  });

  // Toggle extras
  const toggleBtn = document.getElementById('ll-toggle-extras');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const extras = document.getElementById('ll-section-extras');
      const text = document.getElementById('ll-toggle-extras-text');
      if (extras) {
        const isHidden = extras.style.display === 'none';
        extras.style.display = isHidden ? 'block' : 'none';
        if (text) text.textContent = isHidden ? 'Ocultar opciones extra' : 'Más opciones';
      }
    });
  }

  // Submit
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarLlamada();
    });
  }
}

function guardarLlamada() {
  try {
    const tipo = document.querySelector('input[name="ll-tipo"]:checked')?.value || 'entrada';
    const fecha = document.getElementById('ll-fecha')?.value;
    const hora = document.getElementById('ll-hora')?.value;
    const telefono = document.getElementById('ll-telefono')?.value.trim() || '';
    const cliente = document.getElementById('ll-cliente')?.value.trim() || '';
    const prioridad = document.getElementById('ll-prioridad')?.value || 'normal';
    const notas = document.getElementById('ll-notas')?.value.trim() || '';
    const correo = document.getElementById('ll-correo')?.value.trim() || '';
    const localizador = document.getElementById('ll-localizador')?.value.trim() || '';

    if (!fecha || !hora) { toast('Indica fecha y hora de la llamada', 'error'); return; }
    if (!telefono) { toast('Indica el teléfono', 'error'); return; }
    if (!cliente) { toast('Indica el nombre del cliente', 'error'); return; }
    if (tipo === 'entrada') {
      const parqueId = document.getElementById('ll-parque')?.value;
      if (!parqueId) { toast('Selecciona un parque', 'error'); return; }
    } else {
      const bonoId = document.getElementById('ll-bono')?.value;
      if (!bonoId) { toast('Selecciona un tipo de bono', 'error'); return; }
    }

    let itemId = null;
    let itemNombre = '';
    if (tipo === 'entrada') {
      itemId = document.getElementById('ll-parque')?.value || null;
      const parque = itemId ? STATE.parques.find(p => p.id === itemId) : null;
      itemNombre = parque ? parque.nombre : '';
    } else {
      itemId = document.getElementById('ll-bono')?.value || null;
      const bono = itemId ? STATE.tipos_bono.find(b => b.id === itemId) : null;
      itemNombre = bono ? bono.nombre : '';
    }

    const fechaHora = `${fecha}T${hora}:00`;

    const calls = getCalls();

    if (editingCallId) {
      // === MODO EDICIÓN: actualizar llamada existente ===
      const idx = calls.findIndex(c => c.id === editingCallId);
      if (idx === -1) {
        toast('No se encontró la llamada a editar', 'error');
        resetLlamadaForm();
        return;
      }
      const existing = calls[idx];
      calls[idx] = {
        ...existing,
        fecha_hora: fechaHora,
        tipo,
        item_id: itemId,
        item_nombre: itemNombre,
        telefono,
        cliente,
        prioridad,
        notas,
        correo,
        localizador,
        // Al editar, reactivamos la llamada (quita completada/cancelada)
        completada: false,
        cancelada: false,
        updated_at: new Date().toISOString(),
      };
      saveCalls(calls);
      toast('Llamada actualizada ✓', 'success');
      playBeep(900, 100);
      // Limpiar notificaciones previas para que las alarmas vuelvan a sonar
      callsNotified10min.delete(editingCallId);
      callsNotifiedExact.delete(editingCallId);
      resetLlamadaForm();
      renderLlamadasList();
      startAlarmChecker();
      return;
    }

    // === MODO NUEVO: crear llamada ===
    const llamada = {
      id: uid(),
      created_at: new Date().toISOString(),
      fecha_hora: fechaHora,
      tipo,
      item_id: itemId,
      item_nombre: itemNombre,
      telefono,
      cliente,
      prioridad,
      notas,
      correo,
      localizador,
      completada: false,
      cancelada: false,
    };

    calls.push(llamada);
    saveCalls(calls);

    toast('Llamada programada ✓', 'success');

    // Play a subtle confirmation sound
    playBeep(800, 100);

    resetLlamadaForm();
    renderLlamadasList();
    startAlarmChecker();
  } catch (err) {
    console.error('Error al guardar la llamada:', err);
    toast('Error al programar la llamada: ' + err.message, 'error');
  }
}

function resetLlamadaForm() {
  editingCallId = null;
  const form = document.getElementById('llamada-form');
  if (form) form.reset();
  // Default date = today (restaurar tras reset)
  setDefaultLlamadaFecha();
  const parqueField = document.getElementById('ll-field-parque');
  const bonoField = document.getElementById('ll-field-bono');
  if (parqueField) parqueField.style.display = '';
  if (bonoField) bonoField.style.display = 'none';
  const extras = document.getElementById('ll-section-extras');
  if (extras) extras.style.display = 'none';
  const text = document.getElementById('ll-toggle-extras-text');
  if (text) text.textContent = 'Más opciones';
  // Reset título y botones
  const title = document.getElementById('llamada-form-title');
  if (title) title.textContent = '📞 Programar llamada';
  const submitText = document.getElementById('llamada-submit-text');
  if (submitText) submitText.textContent = 'Programar llamada';
  const cancelBtn = document.getElementById('ll-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function getLlamadaPriorityWeight(llamada) {
  if (llamada.prioridad === 'grupo') return 2;
  if (llamada.prioridad === 'Buena venta') return 1;
  return 0;
}

function renderLlamadasList() {
  const container = document.getElementById('llamadas-list');
  if (!container) return;
  const calls = getCalls();

  // Separate active vs historical
  const ahora = new Date();
  const activas = calls.filter(c => {
    if (c.completada || c.cancelada) return false;
    const h = new Date(c.fecha_hora);
    // Keep visible for 2 hours after expiration
    return (h - ahora) > -7200000;
  });
  const historial = calls.filter(c => {
    if (c.completada || c.cancelada) return true;
    const h = new Date(c.fecha_hora);
    return (h - ahora) <= -7200000;
  });

  // Sort: pending by time asc; when tied, grupo > Buena venta > normal
  activas.sort((a, b) => {
    const diff = new Date(a.fecha_hora) - new Date(b.fecha_hora);
    if (diff !== 0) return diff;
    return getLlamadaPriorityWeight(b) - getLlamadaPriorityWeight(a);
  });
  historial.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

  if (!activas.length && !historial.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span>No hay llamadas programadas</span>
        <span style="font-size:12px;color:var(--text-muted)">Añade una llamada con el formulario de arriba</span>
      </div>`;
    return;
  }

  let html = '';

  if (activas.length) {
    html += `<div class="ll-section-header"><span class="ll-section-badge active-count">${activas.length} pendiente${activas.length !== 1 ? 's' : ''}</span><h3>Próximas llamadas</h3></div>`;
    html += activas.map(c => renderLlamadaCard(c)).join('');
  }

  if (historial.length) {
    html += `<div class="ll-section-header" style="margin-top:24px;"><span class="ll-section-badge hist-count">${historial.length}</span><h3>Historial</h3></div>`;
    html += historial.map(c => renderLlamadaCard(c)).join('');
  }

  container.innerHTML = html;

  // Wire buttons
  container.querySelectorAll('[data-complete-llamada]').forEach(btn =>
    btn.addEventListener('click', () => toggleCompletarLlamada(btn.dataset.completeLlamada)));
  container.querySelectorAll('[data-cancel-llamada]').forEach(btn =>
    btn.addEventListener('click', () => toggleCancelarLlamada(btn.dataset.cancelLlamada)));
  container.querySelectorAll('[data-delete-llamada]').forEach(btn =>
    btn.addEventListener('click', () => deleteLlamada(btn.dataset.deleteLlamada)));
  container.querySelectorAll('[data-call-phone]').forEach(btn =>
    btn.addEventListener('click', () => {
      const phone = btn.dataset.callPhone;
      if (phone) window.open(`tel:${phone}`, '_self');
    }));
  container.querySelectorAll('[data-edit-llamada]').forEach(btn =>
    btn.addEventListener('click', () => editarLlamada(btn.dataset.editLlamada)));
  container.querySelectorAll('[data-reactivate-llamada]').forEach(btn =>
    btn.addEventListener('click', () => reactivarLlamada(btn.dataset.reactivateLlamada)));
}

function renderLlamadaCard(c) {
  const estado = getEstadoLlamada(c);
  const fecha = new Date(c.fecha_hora);
  const ahora = new Date();
  const diffMs = fecha - ahora;
  const isUrgent = diffMs > 0 && diffMs < 600000; // less than 10 min
  const isOverdue = estado === 'vencida';

  const timeStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  const isToday = fecha.toDateString() === ahora.toDateString();

  let estadoClass = 'll-status-pending';
  let estadoIcon = '⏳';
  let estadoText = 'Pendiente';
  if (estado === 'completada') { estadoClass = 'll-status-done'; estadoIcon = '✅'; estadoText = 'Completada'; }
  else if (estado === 'cancelada') { estadoClass = 'll-status-cancel'; estadoIcon = '❌'; estadoText = 'Cancelada'; }
  else if (estado === 'vencida') { estadoClass = 'll-status-overdue'; estadoIcon = '⚠️'; estadoText = 'Vencida'; }
  else if (isUrgent) { estadoClass = 'll-status-urgent'; estadoIcon = '🔔'; estadoText = '¡Ahora!'; }

  const showActions = estado === 'pendiente' || estado === 'vencida';
  const showReactivate = estado === 'completada' || estado === 'cancelada';

  const prioridad = c.prioridad || 'normal';
  const prioridadLabel = prioridad === 'grupo' ? 'Grupo' : prioridad === 'Buena venta' ? 'Buena venta' : 'Normal';
  const prioridadClass = prioridad === 'grupo' ? 'll-priority-group' : prioridad === 'Buena venta' ? 'll-priority-important' : 'll-priority-normal';

  return `
    <div class="ll-card ${estadoClass} ${isUrgent ? 'll-urgent-pulse' : ''} ${prioridadClass}">
      <div class="ll-card-left">
        <div class="ll-time">
          <span class="ll-time-hour">${timeStr}</span>
          <span class="ll-time-date">${isToday ? 'Hoy' : dateStr}</span>
        </div>
        <div class="ll-connector"></div>
        <div class="ll-status-dot ${estadoClass}">${estadoIcon}</div>
      </div>
      <div class="ll-card-body">
        <div class="ll-card-head">
          <div class="ll-card-client">
            <span class="ll-client-name">${escapeHtml(c.cliente)}</span>
            <span class="ll-client-phone">📞 ${escapeHtml(c.telefono)}</span>
          </div>
          <div class="ll-card-badges">
            <span class="ll-badge ${prioridadClass}">${prioridadLabel}</span>
            <span class="ll-badge ${estadoClass}">${estadoText}</span>
          </div>
        </div>
        <div class="ll-card-meta">
          ${c.item_nombre ? `<span class="ll-meta-tag">${c.tipo === 'entrada' ? '🎢' : '🎟️'} ${escapeHtml(c.item_nombre)}</span>` : ''}
          ${c.correo ? `<span class="ll-meta-tag">✉️ ${escapeHtml(c.correo)}</span>` : ''}
          ${c.localizador ? `<span class="ll-meta-tag">🔖 ${escapeHtml(c.localizador)}</span>` : ''}
        </div>
        ${c.notas ? `<div class="ll-card-notes">📝 ${escapeHtml(c.notas)}</div>` : ''}
        <div class="ll-card-footer">
          <div class="ll-card-actions">
            ${showActions ? `
              <button class="ll-action-btn primary" data-complete-llamada="${c.id}" title="Marcar como realizada">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Hecho
              </button>
              <button class="ll-action-btn call" data-call-phone="${c.telefono}" title="Llamar ahora">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Llamar
              </button>
              <button class="ll-action-btn danger" data-cancel-llamada="${c.id}" title="Cancelar llamada">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            ` : ``}
            ${showReactivate ? `
              <button class="ll-action-btn reactivate" data-reactivate-llamada="${c.id}" title="Reactivar llamada">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reactivar
              </button>
            ` : ``}
            <button class="ll-action-btn edit" data-edit-llamada="${c.id}" title="Editar llamada">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="ll-action-btn ghost" data-delete-llamada="${c.id}" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

/* ============================================================================
   Acciones
   ============================================================================ */
function toggleCompletarLlamada(id) {
  const calls = getCalls();
  const c = calls.find(c => c.id === id);
  if (!c) return;
  c.completada = !c.completada;
  c.cancelada = false;
  if (c.completada) {
    playBeep(1200, 200);
    toast('Llamada marcada como realizada ✅', 'success');
  }
  saveCalls(calls);
  renderLlamadasList();
}

function toggleCancelarLlamada(id) {
  const calls = getCalls();
  const c = calls.find(c => c.id === id);
  if (!c) return;
  c.cancelada = !c.cancelada;
  c.completada = false;
  saveCalls(calls);
  renderLlamadasList();
}

function editarLlamada(id) {
  const calls = getCalls();
  const c = calls.find(c => c.id === id);
  if (!c) return;

  editingCallId = id;

  // Rellenar el formulario con los datos de la llamada
  const tipoRadio = document.querySelector(`input[name="ll-tipo"][value="${c.tipo}"]`);
  if (tipoRadio) tipoRadio.checked = true;

  // Mostrar/ocultar campos según tipo
  const parqueField = document.getElementById('ll-field-parque');
  const bonoField = document.getElementById('ll-field-bono');
  if (parqueField) parqueField.style.display = c.tipo === 'entrada' ? '' : 'none';
  if (bonoField) bonoField.style.display = c.tipo === 'bono' ? '' : 'none';

  // Rellenar selects
  const selParque = document.getElementById('ll-parque');
  const selBono = document.getElementById('ll-bono');
  if (selParque && c.tipo === 'entrada') selParque.value = c.item_id || '';
  if (selBono && c.tipo === 'bono') selBono.value = c.item_id || '';

  // Rellenar campos (usar hora local para no desviar con UTC)
  const fechaHora = new Date(c.fecha_hora);
  const pad = n => String(n).padStart(2, '0');
  const fechaStr = `${fechaHora.getFullYear()}-${pad(fechaHora.getMonth() + 1)}-${pad(fechaHora.getDate())}`;
  const horaStr = `${pad(fechaHora.getHours())}:${pad(fechaHora.getMinutes())}`;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };
  setVal('ll-fecha', fechaStr);
  setVal('ll-hora', horaStr);
  setVal('ll-telefono', c.telefono);
  setVal('ll-cliente', c.cliente);
  setVal('ll-prioridad', c.prioridad || 'normal');
  setVal('ll-notas', c.notas);
  setVal('ll-correo', c.correo);
  setVal('ll-localizador', c.localizador);

  // Mostrar extras si hay correo o localizador
  const extras = document.getElementById('ll-section-extras');
  if (extras && (c.correo || c.localizador)) {
    extras.style.display = 'block';
    const text = document.getElementById('ll-toggle-extras-text');
    if (text) text.textContent = 'Ocultar opciones extra';
  }

  // Actualizar título y botones
  const title = document.getElementById('llamada-form-title');
  if (title) title.textContent = '✏️ Editando llamada';
  const submitText = document.getElementById('llamada-submit-text');
  if (submitText) submitText.textContent = 'Guardar cambios';
  const cancelBtn = document.getElementById('ll-cancel-edit');
  if (cancelBtn) cancelBtn.style.display = '';

  // Scroll al formulario
  const form = document.getElementById('llamada-form');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });

  toast('Editando llamada — modifica los datos y guarda', 'info');
}

function reactivarLlamada(id) {
  const calls = getCalls();
  const c = calls.find(c => c.id === id);
  if (!c) return;

  // Reactivar: quitar completada/cancelada y limpiar notificaciones previas
  c.completada = false;
  c.cancelada = false;
  callsNotified10min.delete(c.id);
  callsNotifiedExact.delete(c.id);

  saveCalls(calls);
  renderLlamadasList();
  startAlarmChecker();
  playBeep(1000, 150);
  toast('Llamada reactivada 🔄', 'success');
}

function deleteLlamada(id) {
  confirmDialog({
    title: 'Eliminar llamada',
    width: '500px',
    message: '¿Estás seguro de que quieres eliminar esta llamada? Esta acción no se puede deshacer.',
    onConfirm: () => {
      let calls = getCalls();
      calls = calls.filter(c => c.id !== id);
      saveCalls(calls);
      renderLlamadasList();
      toast('Llamada eliminada', 'info');
    }
  });
}

/* ============================================================================
   Indicador de notificaciones en la barra lateral
   Solo aparece cuando YA ha saltado la alarma:
   - Falta menos de 10 min (alarma pre)
   - Ya pasó la hora exacta (alarma exact / vencida)
   ============================================================================ */
function updateCallsNotifBadge() {
  const badge = document.getElementById('calls-sidebar-badge');
  if (!badge) return;

  const calls = getCalls();
  const ahora = new Date();

  // Solo mostrar badge para llamadas que YA deberían haber notificado:
  // - A menos de 10 minutos (rango de la alarma pre)
  // - Ya vencidas (pasó su hora)
  const alarmadas = calls.filter(c => {
    if (c.completada || c.cancelada) return false;
    const h = new Date(c.fecha_hora);
    const diffMs = h - ahora;
    // Menos de 10 min para que suene (o ya sonó) -> mostrar badge
    return diffMs < 600000; // menos de 10 min o ya pasó
  });

  // Contar las que están sonando ahora (menos de 1 min o recién pasadas)
  const sonandoAhora = alarmadas.filter(c => {
    const h = new Date(c.fecha_hora);
    const diffMs = h - ahora;
    return diffMs < 60000; // menos de 1 minuto o ya pasó
  });

  const total = alarmadas.length;

  if (total > 0) {
    badge.textContent = total > 9 ? '9+' : total;
    badge.style.display = 'inline-flex';
    if (sonandoAhora.length > 0) {
      badge.style.animation = 'nav-badge-pop 0.3s cubic-bezier(.4,0,.2,1), notifPulse 2s infinite ease-in-out';
    } else {
      badge.style.animation = 'nav-badge-pop 0.3s cubic-bezier(.4,0,.2,1)';
    }
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================================================
   Alarmas
   ============================================================================ */
function startAlarmChecker() {
  if (callsAlarmInterval) clearInterval(callsAlarmInterval);
  callsAlarmInterval = setInterval(checkAlarms, 15000); // every 15 seconds
  checkAlarms(); // immediate check
}

function checkAlarms() {
  const calls = getCalls();
  const ahora = new Date();

  calls.forEach(c => {
    if (c.completada || c.cancelada) return;
    const hora = new Date(c.fecha_hora);
    const diffMs = hora - ahora;
    const diffMin = Math.round(diffMs / 60000);

    // Alarm 10 minutes before
    if (diffMin <= 10 && diffMin > 0 && !callsNotified10min.has(c.id)) {
      callsNotified10min.add(c.id);
      showAlarmNotification(c, 'pre');
      playAlarmSound();
    }

    // Exact alarm
    if (diffMs <= 0 && diffMs > -60000 && !callsNotifiedExact.has(c.id)) {
      callsNotifiedExact.add(c.id);
      showAlarmNotification(c, 'exact');
      playAlarmSound();
      // Refresh list to show urgent state
      renderLlamadasList();
    }
  });

  // Clean up old entries from sets (calls older than 2 hours)
  calls.forEach(c => {
    const hora = new Date(c.fecha_hora);
    if ((ahora - hora) > 7200000) {
      callsNotified10min.delete(c.id);
      callsNotifiedExact.delete(c.id);
    }
  });

  // Update the notification badge in the sidebar
  updateCallsNotifBadge();
}

function showAlarmNotification(c, type) {
  const title = type === 'pre' ? '🔔 Recordatorio: Llamada en 10 min' : '📞 ¡Llamada ahora!';
  const body = `${c.cliente} — ${c.telefono}${c.item_nombre ? ' (' + c.item_nombre + ')' : ''}`;

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="%23F5A623"/><text x="12" y="17" font-size="14" text-anchor="middle" fill="%230A0F1C" font-family="sans-serif" font-weight="bold">L</text></svg>' });
    } catch (e) { /* silent fail */ }
  }

  // Also show a toast
  if (type === 'exact') {
    toast(`📞 ${title}: ${body}`, 'info', 10000);
  } else {
    toast(`🔔 ${title}: ${body}`, 'info', 8000);
  }
}

/* ============================================================================
   Sonidos
   ============================================================================ */
function playAlarmSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [800, 1000, 800, 1000, 1200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.15);
    });
  } catch (e) { /* silent fail */ }
}

function playBeep(freq, duration) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch (e) { /* silent fail */ }
}

/* ============================================================================
   Request notification permission
   ============================================================================ */
if ('Notification' in window && Notification.permission === 'default') {
  document.addEventListener('click', () => {
    Notification.requestPermission();
  }, { once: true });
}
