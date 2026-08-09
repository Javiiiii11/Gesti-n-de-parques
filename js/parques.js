/* ============================================================================
   parques.js — vista "Gestión de parques"
============================================================================ */

async function loadParques() {
  STATE.parques = await DB.getParques();
  renderParquesTable();
  fillParqueSelects();
  // Refresh horarios view too if it exists
  if (typeof renderHorariosList === 'function') {
    renderHorariosList();
    if (selectedParkId) {
      selectParkForSchedule(selectedParkId);
    }
  }
}

async function loadBonos() {
  STATE.tipos_bono = await DB.getTiposBono();
  renderBonosTable();
  fillBonoSelects();
}

function renderParquesTable() {
  const tbody = document.getElementById('parques-tbody');
  if (!STATE.parques.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Todavía no tienes parques. Crea el primero con "Nuevo parque".</div></td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.parques.map((p) => {
    const totalVentas = STATE.ventas.filter((v) => v.parque_id === p.id).length;
    return `
      <tr>
        <td><b>${escapeHtml(p.nombre)}</b></td>
        <td><span class="badge ${p.activo ? 'on' : 'off'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td style="text-align:center; font-weight:600;">${fmtNum(totalVentas)}</td>
        <td>
          <div class="row-actions" style="justify-content:flex-end;">
            <button class="icon-btn-sm" title="Editar" data-edit-parque="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn-sm danger" title="Eliminar" data-delete-parque="${p.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-parque]').forEach((btn) =>
    btn.addEventListener('click', () => openParqueForm(btn.dataset.editParque)));
  tbody.querySelectorAll('[data-delete-parque]').forEach((btn) =>
    btn.addEventListener('click', () => deleteParqueFlow(btn.dataset.deleteParque)));
}

function renderBonosTable() {
  const tbody = document.getElementById('bonos-tbody');
  if (!tbody) return;
  if (!STATE.tipos_bono.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Todavía no tienes bonos. Crea el primero con "Nuevo bono".</div></td></tr>`;
    return;
  }
  tbody.innerHTML = STATE.tipos_bono.map((b) => {
    const totalVentas = STATE.ventas.filter((v) => v.bono_id === b.id).length;
    return `
      <tr>
        <td><b>${escapeHtml(b.nombre)}</b></td>
        <td><span class="badge ${b.activo ? 'on' : 'off'}">${b.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td style="text-align:center; font-weight:600;">${fmtNum(totalVentas)}</td>
        <td>
          <div class="row-actions" style="justify-content:flex-end;">
            <button class="icon-btn-sm" title="Editar" data-edit-bono="${b.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn-sm danger" title="Eliminar" data-delete-bono="${b.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-bono]').forEach((btn) =>
    btn.addEventListener('click', () => openBonoForm(btn.dataset.editBono)));
  tbody.querySelectorAll('[data-delete-bono]').forEach((btn) =>
    btn.addEventListener('click', () => deleteBonoFlow(btn.dataset.deleteBono)));
}

function fillParqueSelects() {
  const activos = STATE.parques.filter((p) => p.activo !== false);
  const optionsHtml = activos.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

  const selVenta = document.getElementById('v-parque');
  if (selVenta) selVenta.innerHTML = '<option value="">Seleccionar parque...</option>' + (optionsHtml || '');

  const selFiltro = document.getElementById('hist-filtro-parque');
  if (selFiltro) {
    selFiltro.innerHTML = '<option value="">Todos los parques</option>' +
      STATE.parques.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  }
}

function fillBonoSelects() {
  const activos = STATE.tipos_bono.filter((b) => b.activo !== false);
  const optionsHtml = activos.map((b) => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join('');

  const selContactoBono = document.getElementById('c-bono');
  if (selContactoBono) selContactoBono.innerHTML = optionsHtml || '<option value="">Sin bonos activos</option>';

  const selVentaBono = document.getElementById('v-bono');
  if (selVentaBono) selVentaBono.innerHTML = '<option value="">Seleccionar bono...</option>' + (optionsHtml || '');
}

function openParqueForm(id = null) {
  const parque = id ? STATE.parques.find((p) => p.id === id) : null;
  openModal({
    title: parque ? 'Editar parque' : 'Nuevo parque',
    width: '520px',
    bodyHtml: `
      <div class="form-grid">
        <div class="form-field full">
          <label for="pf-nombre">Nombre</label>
          <input type="text" id="pf-nombre" value="${parque ? escapeHtml(parque.nombre) : ''}" placeholder="Ej. PortAventura" required>
        </div>
        <div class="form-field full">
          <label class="toggle-switch">
            <input type="checkbox" id="pf-activo" ${!parque || parque.activo ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span class="toggle-switch-label">Parque activo</span>
          </label>
        </div>
      </div>`,
    footHtml: `
      <button class="btn btn-ghost" id="pf-cancel">Cancelar</button>
      <button class="btn btn-primary" id="pf-save">${parque ? 'Guardar cambios' : 'Crear parque'}</button>
    `,
  });

  document.getElementById('pf-cancel').addEventListener('click', closeModal);
  document.getElementById('pf-save').addEventListener('click', async () => {
    const nombre = document.getElementById('pf-nombre').value.trim();
    if (!nombre) { toast('El nombre del parque es obligatorio', 'error'); return; }
    const payload = {
      nombre,
      activo: document.getElementById('pf-activo').checked,
    };
    try {
      if (parque) {
        await DB.updateParque(parque.id, payload);
        toast('Parque actualizado correctamente', 'success');
      } else {
        await DB.addParque(payload);
        toast('Parque creado correctamente', 'success');
      }
      closeModal();
      await loadParques();
    } catch (err) {
      toast('Error al guardar el parque: ' + err.message, 'error');
    }
  });
}

function deleteParqueFlow(id) {
  const enUso = STATE.ventas.some((v) => v.parque_id === id);
  if (enUso) {
    toast('No puedes eliminar un parque con ventas registradas. Desactívalo en su lugar.', 'error', 4500);
    return;
  }
  confirmDialog({
    title: 'Eliminar parque',
    message: 'Esta acción no se puede deshacer. ¿Quieres continuar?',
    onConfirm: async () => {
      try {
        await DB.deleteParque(id);
        toast('Parque eliminado', 'success');
        await loadParques();
      } catch (err) {
        toast('Error al eliminar: ' + err.message, 'error');
      }
    },
  });
}

function wireParquesView() {
  const btnParque = document.getElementById('btn-nuevo-parque');
  if (btnParque) btnParque.addEventListener('click', () => openParqueForm());

  const btnBono = document.getElementById('btn-nuevo-bono');
  if (btnBono) btnBono.addEventListener('click', () => openBonoForm());
}

function openBonoForm(id = null) {
  const bono = id ? STATE.tipos_bono.find((p) => p.id === id) : null;
  openModal({
    title: bono ? 'Editar bono' : 'Nuevo bono',
    width: '520px',
    bodyHtml: `
      <div class="form-grid">
        <div class="form-field full">
          <label for="bf-nombre">Nombre</label>
          <input type="text" id="bf-nombre" value="${bono ? escapeHtml(bono.nombre) : ''}" placeholder="Ej. Bono Familiar" required>
        </div>
        <div class="form-field full">
          <label class="toggle-switch">
            <input type="checkbox" id="bf-activo" ${!bono || bono.activo ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span class="toggle-switch-label">Bono activo</span>
          </label>
        </div>
      </div>`,
    footHtml: `
      <button class="btn btn-ghost" id="bf-cancel">Cancelar</button>
      <button class="btn btn-primary" id="bf-save">${bono ? 'Guardar cambios' : 'Crear bono'}</button>
    `,
  });

  document.getElementById('bf-cancel').addEventListener('click', closeModal);
  document.getElementById('bf-save').addEventListener('click', async () => {
    const nombre = document.getElementById('bf-nombre').value.trim();
    if (!nombre) { toast('El nombre del bono es obligatorio', 'error'); return; }
    const payload = {
      nombre,
      activo: document.getElementById('bf-activo').checked,
    };
    try {
      if (bono) {
        await DB.updateTipoBono(bono.id, payload);
        toast('Bono actualizado correctamente', 'success');
      } else {
        await DB.addTipoBono(payload);
        toast('Bono creado correctamente', 'success');
      }
      closeModal();
      await loadBonos();
    } catch (err) {
      toast('Error al guardar el bono: ' + err.message, 'error');
    }
  });
}

function deleteBonoFlow(id) {
  const enUso = STATE.contactos.some((c) => c.bono_id === id);
  if (enUso) {
    toast('No puedes eliminar un bono que está en uso en contactos. Desactívalo en su lugar.', 'error', 4500);
    return;
  }
  confirmDialog({
    title: 'Eliminar bono',
    message: 'Esta acción no se puede deshacer. ¿Quieres continuar?',
    onConfirm: async () => {
      try {
        await DB.deleteTipoBono(id);
        toast('Bono eliminado', 'success');
        await loadBonos();
      } catch (err) {
        toast('Error al eliminar: ' + err.message, 'error');
      }
    },
  });
}
