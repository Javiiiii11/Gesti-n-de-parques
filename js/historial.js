/* ============================================================================
   historial.js — vista "Historial de ventas"
============================================================================ */

const HIST_STATE = {
  page: 1,
  pageSize: 20,
  sortBy: 'fecha',
  sortDir: 'desc',
  search: '',
  tipoVenta: '',
  parqueId: '',
  bonoId: '',
  desde: '',
  hasta: '',
};

function getBonoNombre(bonoId) {
  const bono = STATE.tipos_bono.find(b => b.id === bonoId);
  return bono ? bono.nombre : '—';
}

function initHistorialView() {
  document.getElementById('hist-search').addEventListener('input', debounce((e) => {
    HIST_STATE.search = e.target.value.trim().toLowerCase();
    HIST_STATE.page = 1;
    renderHistorial();
  }, 200));

  document.getElementById('hist-filtro-tipo-venta').addEventListener('change', (e) => {
    HIST_STATE.tipoVenta = e.target.value;
    HIST_STATE.page = 1;
    renderHistorial();
  });
  document.getElementById('hist-filtro-parque').addEventListener('change', (e) => {
    HIST_STATE.parqueId = e.target.value;
    HIST_STATE.page = 1;
    renderHistorial();
  });
  document.getElementById('hist-filtro-bono').addEventListener('change', (e) => {
    HIST_STATE.bonoId = e.target.value;
    HIST_STATE.page = 1;
    renderHistorial();
  });
  document.getElementById('hist-filtro-desde').addEventListener('change', (e) => {
    HIST_STATE.desde = e.target.value;
    HIST_STATE.page = 1;
    renderHistorial();
  });
  document.getElementById('hist-filtro-hasta').addEventListener('change', (e) => {
    HIST_STATE.hasta = e.target.value;
    HIST_STATE.page = 1;
    renderHistorial();
  });
  document.getElementById('hist-filtro-clear').addEventListener('click', () => {
    HIST_STATE.search = '';
    HIST_STATE.tipoVenta = '';
    HIST_STATE.parqueId = '';
    HIST_STATE.bonoId = '';
    HIST_STATE.desde = '';
    HIST_STATE.hasta = '';
    HIST_STATE.page = 1;
    document.getElementById('hist-search').value = '';
    document.getElementById('hist-filtro-tipo-venta').value = '';
    document.getElementById('hist-filtro-parque').value = '';
    document.getElementById('hist-filtro-bono').value = '';
    document.getElementById('hist-filtro-desde').value = '';
    document.getElementById('hist-filtro-hasta').value = '';
    renderHistorial();
  });

  document.querySelectorAll('#historial-table thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (HIST_STATE.sortBy === key) HIST_STATE.sortDir = HIST_STATE.sortDir === 'asc' ? 'desc' : 'asc';
      else { HIST_STATE.sortBy = key; HIST_STATE.sortDir = 'asc'; }
      renderHistorial();
    });
  });

  document.getElementById('hist-prev').addEventListener('click', () => { if (HIST_STATE.page > 1) { HIST_STATE.page--; renderHistorial(); } });
  document.getElementById('hist-next').addEventListener('click', () => { HIST_STATE.page++; renderHistorial(); });
}

function fillParqueFiltro() {
  const sel = document.getElementById('hist-filtro-parque');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los parques</option>' + 
    STATE.parques.map((p) => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
  sel.value = current;
}

function fillBonoFiltro() {
  const sel = document.getElementById('hist-filtro-bono');
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los bonos</option>' + 
    STATE.tipos_bono.filter(b => b.activo).map((b) => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join('');
  sel.value = current;
}

function getFilteredSortedVentas() {
  let rows = STATE.ventas.map((v) => ({ 
    ...v, 
    parqueNombreCache: parqueNombre(v.parque_id),
    bonoNombreCache: getBonoNombre(v.bono_id)
  }));

  if (HIST_STATE.search) {
    const q = HIST_STATE.search;
    rows = rows.filter((v) =>
      v.parqueNombreCache.toLowerCase().includes(q) ||
      v.bonoNombreCache.toLowerCase().includes(q) ||
      (v.cliente_nombre || '').toLowerCase().includes(q));
  }
  if (HIST_STATE.tipoVenta) rows = rows.filter((v) => v.tipo === HIST_STATE.tipoVenta);
  if (HIST_STATE.parqueId) rows = rows.filter((v) => v.parque_id === HIST_STATE.parqueId);
  if (HIST_STATE.bonoId) rows = rows.filter((v) => v.bono_id === HIST_STATE.bonoId);
  if (HIST_STATE.desde) rows = rows.filter((v) => new Date(v.fecha) >= new Date(HIST_STATE.desde));
  if (HIST_STATE.hasta) rows = rows.filter((v) => new Date(v.fecha) <= new Date(HIST_STATE.hasta + 'T23:59:59'));

  const dir = HIST_STATE.sortDir === 'asc' ? 1 : -1;
  const key = HIST_STATE.sortBy;
  rows.sort((a, b) => {
    let va, vb;
    if (key === 'parque') {
      va = a.tipo === 'entrada' ? a.parqueNombreCache : a.bonoNombreCache;
      vb = b.tipo === 'entrada' ? b.parqueNombreCache : b.bonoNombreCache;
    } else if (key === 'tipo') {
      va = a.tipo || 'entrada';
      vb = b.tipo || 'entrada';
    } else if (key === 'fecha') {
      va = new Date(a[key]).getTime();
      vb = new Date(b[key]).getTime();
    } else if (key === 'cliente_nombre') {
      va = a.cliente_nombre || '';
      vb = b.cliente_nombre || '';
    } else {
      va = a[key];
      vb = b[key];
    }
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  return rows;
}

function renderHistorial() {
  fillParqueFiltro();
  fillBonoFiltro();
  
  const allRows = getFilteredSortedVentas();
  const totalPages = Math.max(1, Math.ceil(allRows.length / HIST_STATE.pageSize));
  HIST_STATE.page = Math.min(HIST_STATE.page, totalPages);
  const start = (HIST_STATE.page - 1) * HIST_STATE.pageSize;
  const pageRows = allRows.slice(start, start + HIST_STATE.pageSize);

  document.querySelectorAll('#historial-table thead th[data-sort]').forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.sort === HIST_STATE.sortBy) arrow.textContent = HIST_STATE.sortDir === 'asc' ? '▲' : '▼';
    else arrow.textContent = '';
  });

  const tbody = document.getElementById('historial-tbody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      No se han encontrado ventas con estos filtros.</div></td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map((v) => {
      const tipo = v.tipo || 'entrada';
      const detalle = tipo === 'entrada' ? v.parqueNombreCache : v.bonoNombreCache;
      return `
        <tr>
          <td>${fmtDateTime(v.fecha)}</td>
          <td><span class="badge ${tipo === 'entrada' ? 'badge-primary' : 'badge-success'}">${tipo === 'entrada' ? 'Entrada' : 'Bono'}</span></td>
          <td>${escapeHtml(detalle)}</td>
          <td>${escapeHtml(v.cliente_nombre || '—')}</td>
          <td class="amount">${fmtEUR(v.importe_total)}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn-sm" title="Editar" data-edit-venta="${v.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
              <button class="icon-btn-sm danger" title="Eliminar" data-delete-venta="${v.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  document.getElementById('hist-pagination-info').textContent =
    allRows.length ? `Mostrando ${start + 1}–${Math.min(start + HIST_STATE.pageSize, allRows.length)} de ${allRows.length} ventas` : 'Sin resultados';
  document.getElementById('hist-prev').disabled = HIST_STATE.page <= 1;
  document.getElementById('hist-next').disabled = HIST_STATE.page >= totalPages;

  tbody.querySelectorAll('[data-edit-venta]').forEach((btn) => btn.addEventListener('click', () => openEditVenta(btn.dataset.editVenta)));
  tbody.querySelectorAll('[data-delete-venta]').forEach((btn) => btn.addEventListener('click', () => deleteVentaFlow(btn.dataset.deleteVenta)));
}

function openEditVenta(id) {
  const v = STATE.ventas.find((x) => x.id === id);
  if (!v) return;
  const tipo = v.tipo || 'entrada';
  
  const parquesOptions = STATE.parques.map((p) => `<option value="${p.id}" ${p.id === v.parque_id ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
  const bonosOptions = STATE.tipos_bono.filter(b => b.activo).map((b) => `<option value="${b.id}" ${b.id === v.bono_id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`).join('');

  openModal({
    title: 'Editar venta',
    bodyHtml: `
      <div class="form-grid">
        <div class="form-field full">
          <label>Tipo de venta</label>
          <div style="display:flex; gap:16px;">
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="radio" name="ev-tipo" value="entrada" ${tipo === 'entrada' ? 'checked' : ''} style="width:auto"> Entradas
            </label>
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="radio" name="ev-tipo" value="bono" ${tipo === 'bono' ? 'checked' : ''} style="width:auto"> Bonos
            </label>
          </div>
        </div>
        <div class="form-field full" id="ev-field-parque">
          <label for="ev-parque">Parque</label>
          <select id="ev-parque">${parquesOptions}</select>
        </div>
        <div class="form-field full" id="ev-field-bono" style="display:none;">
          <label for="ev-bono">Tipo de bono</label>
          <select id="ev-bono">${bonosOptions}</select>
        </div>
        <div class="form-field full">
          <label for="ev-fecha">Fecha y hora</label>
          <input type="datetime-local" id="ev-fecha" value="${toLocalDatetimeInputValue(new Date(v.fecha))}">
        </div>
        <div class="form-field">
          <label for="ev-cliente">Cliente</label>
          <input type="text" id="ev-cliente" value="${escapeHtml(v.cliente_nombre || '')}">
        </div>
        <div class="form-field">
          <label for="ev-importe">Importe (€)</label>
          <input type="number" id="ev-importe" min="0" step="0.01" value="${v.importe_total}">
        </div>
      </div>`,
    footHtml: `
      <button class="btn btn-ghost" id="ev-cancel">Cancelar</button>
      <button class="btn btn-primary" id="ev-save">Guardar cambios</button>
    `,
  });

  // Add listeners for tipo radio buttons
  document.querySelectorAll('input[name="ev-tipo"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const tipo = e.target.value;
      document.getElementById('ev-field-parque').style.display = tipo === 'entrada' ? 'block' : 'none';
      document.getElementById('ev-field-bono').style.display = tipo === 'bono' ? 'block' : 'none';
    });
  });
  
  // Set initial visibility
  document.getElementById('ev-field-parque').style.display = tipo === 'entrada' ? 'block' : 'none';
  document.getElementById('ev-field-bono').style.display = tipo === 'bono' ? 'block' : 'none';

  document.getElementById('ev-cancel').addEventListener('click', closeModal);
  document.getElementById('ev-save').addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="ev-tipo"]:checked').value;
    const changes = {
      fecha: new Date(document.getElementById('ev-fecha').value).toISOString(),
      tipo,
      cliente_nombre: document.getElementById('ev-cliente').value.trim(),
      importe_total: Number(document.getElementById('ev-importe').value) || 0,
    };
    
    if (tipo === 'entrada') {
      changes.parque_id = document.getElementById('ev-parque').value;
      changes.bono_id = null;
    } else {
      changes.bono_id = document.getElementById('ev-bono').value;
      changes.parque_id = null;
    }
    
    try {
      await DB.updateVenta(v.id, changes);
      STATE.ventas = await DB.getVentas();
      toast('Venta actualizada', 'success');
      closeModal();
      refreshAllViewsAfterDataChange();
    } catch (err) {
      toast('Error al actualizar: ' + err.message, 'error');
    }
  });
}

function deleteVentaFlow(id) {
  confirmDialog({
    title: 'Eliminar venta',
    message: 'Esta venta se eliminará permanentemente. ¿Continuar?',
    onConfirm: async () => {
      try {
        await DB.deleteVenta(id);
        STATE.ventas = await DB.getVentas();
        toast('Venta eliminada', 'success');
        refreshAllViewsAfterDataChange();
      } catch (err) {
        toast('Error al eliminar: ' + err.message, 'error');
      }
    },
  });
}
