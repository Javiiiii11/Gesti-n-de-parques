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
  via: '',
  parqueId: '',
  bonoId: '',
  desde: '',
  hasta: '',
  estado: '',
  selectedVentas: new Set(),
};

function getBonoNombre(bonoId) {
  return bonoNombre(bonoId);
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
  document.getElementById('hist-filtro-via').addEventListener('change', (e) => {
    HIST_STATE.via = e.target.value;
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

  const estadoSelect = document.getElementById('hist-filtro-estado');
  if (estadoSelect) {
    estadoSelect.addEventListener('change', (e) => {
      HIST_STATE.estado = e.target.value;
      HIST_STATE.page = 1;
      renderHistorial();
    });
  }

  // Píldoras interactivas de filtro por estado
  document.querySelectorAll('.hist-status-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetStatus = pill.dataset.status || '';
      HIST_STATE.estado = targetStatus;
      HIST_STATE.page = 1;
      if (estadoSelect) estadoSelect.value = targetStatus;
      renderHistorial();
    });
  });

  document.getElementById('hist-filtro-clear').addEventListener('click', () => {
    HIST_STATE.search = '';
    HIST_STATE.tipoVenta = '';
    HIST_STATE.via = '';
    HIST_STATE.parqueId = '';
    HIST_STATE.bonoId = '';
    HIST_STATE.desde = '';
    HIST_STATE.hasta = '';
    HIST_STATE.estado = '';
    HIST_STATE.page = 1;
    document.getElementById('hist-search').value = '';
    document.getElementById('hist-filtro-tipo-venta').value = '';
    document.getElementById('hist-filtro-via').value = '';
    document.getElementById('hist-filtro-parque').value = '';
    document.getElementById('hist-filtro-bono').value = '';
    document.getElementById('hist-filtro-desde').value = '';
    document.getElementById('hist-filtro-hasta').value = '';
    if (estadoSelect) estadoSelect.value = '';
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

  document.getElementById('hist-select-all').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.hist-row-cb').forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) HIST_STATE.selectedVentas.add(cb.dataset.id);
      else HIST_STATE.selectedVentas.delete(cb.dataset.id);
    });
    updateHistBatchUI();
  });

  document.getElementById('hist-batch-delete').addEventListener('click', () => {
    if (HIST_STATE.selectedVentas.size === 0) return;
    confirmDialog({
      title: 'Eliminar ventas seleccionadas',
      message: `¿Estás seguro de que quieres eliminar ${HIST_STATE.selectedVentas.size} ventas de forma permanente? No se eliminarán los apuntes de contacto asociados, solo el registro de venta.`,
      confirmLabel: 'Eliminar seleccionadas',
      danger: true,
      onConfirm: async () => {
        try {
          const arr = Array.from(HIST_STATE.selectedVentas);
          for (const id of arr) {
            await DB.deleteVenta(id);
          }
          HIST_STATE.selectedVentas.clear();
          STATE.ventas = await DB.getVentas();
          refreshAllViewsAfterDataChange();
          toast(`Se han eliminado ${arr.length} ventas`, 'success');
        } catch (err) {
          toast('Error al eliminar ventas: ' + err.message, 'error');
        }
      }
    });
  });
}

function updateHistBatchUI() {
  const btn = document.getElementById('hist-batch-delete');
  const count = document.getElementById('hist-batch-count');
  const allCb = document.getElementById('hist-select-all');
  const size = HIST_STATE.selectedVentas.size;
  
  if (size > 0) {
    btn.style.display = 'inline-flex';
    count.textContent = size;
  } else {
    btn.style.display = 'none';
  }
  
  // Check if all checkboxes in current view are selected
  const cbs = Array.from(document.querySelectorAll('.hist-row-cb'));
  if (cbs.length > 0 && cbs.every(cb => cb.checked)) {
    allCb.checked = true;
  } else {
    allCb.checked = false;
  }
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

function updateHistStatusPillsCounts() {
  const counts = {
    all: STATE.ventas.length,
    completado: 0,
    enviado: 0,
    pendiente: 0,
    incompleto: 0,
    no_enviado: 0,
  };

  STATE.ventas.forEach((v) => {
    const estado = typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(v.estado) : 'completado';
    if (counts[estado] !== undefined) counts[estado]++;
    else counts.completado++;
  });

  document.querySelectorAll('.hist-status-pill').forEach(pill => {
    const st = pill.dataset.status || '';
    const key = st || 'all';
    const badge = pill.querySelector('.pill-badge');
    if (badge) badge.textContent = fmtNum(counts[key] || 0);

    if (st === HIST_STATE.estado) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function getFilteredSortedVentas() {
  let rows = STATE.ventas.map((v) => ({ 
    ...v, 
    parqueNombreCache: parqueNombre(v.parque_id),
    bonoNombreCache: getBonoNombre(v.bono_id),
    estadoNorm: typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(v.estado) : (v.estado || 'completado')
  }));

  if (HIST_STATE.search) {
    const q = HIST_STATE.search;
    rows = rows.filter((v) =>
      v.parqueNombreCache.toLowerCase().includes(q) ||
      v.bonoNombreCache.toLowerCase().includes(q) ||
      (v.cliente_nombre || '').toLowerCase().includes(q) ||
      (v.localizador || '').toLowerCase().includes(q));
  }
  if (HIST_STATE.tipoVenta) rows = rows.filter((v) => v.tipo === HIST_STATE.tipoVenta);
  if (HIST_STATE.via) rows = rows.filter((v) => (v.via || 'llamada') === HIST_STATE.via);
  if (HIST_STATE.parqueId) rows = rows.filter((v) => v.parque_id === HIST_STATE.parqueId);
  if (HIST_STATE.bonoId) rows = rows.filter((v) => v.bono_id === HIST_STATE.bonoId);
  if (HIST_STATE.desde) rows = rows.filter((v) => new Date(v.fecha) >= new Date(HIST_STATE.desde));
  if (HIST_STATE.hasta) rows = rows.filter((v) => new Date(v.fecha) <= new Date(HIST_STATE.hasta + 'T23:59:59'));
  if (HIST_STATE.estado) rows = rows.filter((v) => v.estadoNorm === HIST_STATE.estado);

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
    } else if (key === 'via') {
      va = a.via || 'llamada';
      vb = b.via || 'llamada';
    } else if (key === 'estado') {
      va = a.estadoNorm || 'completado';
      vb = b.estadoNorm || 'completado';
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
  updateHistStatusPillsCounts();
  
  const allRows = getFilteredSortedVentas();
  const totalPages = Math.max(1, Math.ceil(allRows.length / HIST_STATE.pageSize));
  HIST_STATE.page = Math.min(HIST_STATE.page, totalPages);
  const start = (HIST_STATE.page - 1) * HIST_STATE.pageSize;
  const pageRows = allRows.slice(start, start + HIST_STATE.pageSize);

  document.querySelectorAll('#historial-table thead th[data-sort]').forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) {
      if (th.dataset.sort === HIST_STATE.sortBy) arrow.textContent = HIST_STATE.sortDir === 'asc' ? '▲' : '▼';
      else arrow.textContent = '';
    }
  });

  const tbody = document.getElementById('historial-tbody');
  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      No se han encontrado ventas con estos filtros.</div></td></tr>`;
  } else {
    const viaLabels = { llamada: '📞 Llamada', correo: '✉️ Correo', chat: '💬 Chat' };
    const viaClasses = { llamada: 'badge-via-llamada', correo: 'badge-via-correo', chat: 'badge-via-chat' };

    tbody.innerHTML = pageRows.map((v) => {
      const tipo = v.tipo || 'entrada';
      const via = v.via || 'llamada';
      const detalle = tipo === 'entrada' ? v.parqueNombreCache : v.bonoNombreCache;
      const loc = v.localizador || '—';
      const checked = HIST_STATE.selectedVentas.has(v.id) ? 'checked' : '';
      const estadoNorm = v.estadoNorm || 'completado';
      const badgeInfo = typeof getEstadoBadgeInfo === 'function' ? getEstadoBadgeInfo(estadoNorm) : { label: estadoNorm, colorBg: 'rgba(0,138,0,0.18)', textColor: '#00E676', colorBorder: '#008A00' };

      return `
        <tr>
          <td style="text-align:center;"><input type="checkbox" class="hist-row-cb" data-id="${v.id}" ${checked}></td>
          <td>${fmtDateTime(v.fecha)}</td>
          <td><span class="badge ${tipo === 'entrada' ? 'badge-primary' : 'badge-success'}">${tipo === 'entrada' ? 'Entrada' : 'Bono'}</span></td>
          <td><span class="badge ${viaClasses[via] || 'badge-via-llamada'}">${viaLabels[via] || '📞 Llamada'}</span></td>
          <td>${escapeHtml(detalle)}</td>
          <td>${escapeHtml(v.cliente_nombre || '—')}</td>
          <td>${escapeHtml(loc)}</td>
          <td>
            <div class="hist-quick-status-wrap">
              <select class="hist-quick-status-select" data-venta-id="${v.id}" title="Cambiar estado rápidamente" style="background:${badgeInfo.colorBg}; color:${badgeInfo.textColor}; border: 1px solid ${badgeInfo.colorBorder};">
                <option value="completado" ${estadoNorm === 'completado' ? 'selected' : ''}>✅ Completado</option>
                <option value="enviado" ${estadoNorm === 'enviado' ? 'selected' : ''}>📤 Enviado</option>
                <option value="pendiente" ${estadoNorm === 'pendiente' ? 'selected' : ''}>⏳ Pendiente de pago</option>
                <option value="incompleto" ${estadoNorm === 'incompleto' ? 'selected' : ''}>❌ Incompleto</option>
                <option value="no_enviado" ${estadoNorm === 'no_enviado' ? 'selected' : ''}>⏸️ No enviado</option>
              </select>
            </div>
          </td>
          <td class="amount">${fmtEUR(v.importe_total)}</td>
          <td>
            <div class="row-actions" style="justify-content:flex-end;">
              <button class="icon-btn-sm" title="Editar venta" data-edit-venta="${v.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
              <button class="icon-btn-sm danger" title="Eliminar venta" data-delete-venta="${v.id}">
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
  
  // Quick change status listener
  tbody.querySelectorAll('.hist-quick-status-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const vId = e.target.dataset.ventaId;
      const nextEstado = e.target.value;
      await quickChangeVentaEstado(vId, nextEstado);
    });
  });

  tbody.querySelectorAll('.hist-row-cb').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) HIST_STATE.selectedVentas.add(e.target.dataset.id);
      else HIST_STATE.selectedVentas.delete(e.target.dataset.id);
      updateHistBatchUI();
    });
  });
  
  updateHistBatchUI();
}

async function quickChangeVentaEstado(id, newEstado) {
  const v = STATE.ventas.find(x => x.id === id);
  if (!v) return;
  const prevEstado = v.estado || 'completado';
  if (prevEstado === newEstado) return;

  try {
    await DB.updateVenta(id, { estado: newEstado });

    // Mapear estado_pago para contacto vinculado
    let estadoPagoContacto = 'pagado';
    if (newEstado === 'pendiente') estadoPagoContacto = 'pendiente';
    else if (newEstado === 'incompleto') estadoPagoContacto = 'Incompleto';
    else if (newEstado === 'enviado') estadoPagoContacto = 'Enviado';
    else if (newEstado === 'no_enviado') estadoPagoContacto = 'No enviado';

    const linked = findContactoForVenta(v);
    if (linked?.id) {
      await DB.updateContacto(linked.id, { estado_pago: estadoPagoContacto });
    }

    STATE.ventas = await DB.getVentas();
    STATE.contactos = await DB.getContactos();

    const info = typeof getEstadoBadgeInfo === 'function' ? getEstadoBadgeInfo(newEstado) : { label: newEstado };
    toast(`Estado cambiado a ${info.label}`, 'success');
    refreshAllViewsAfterDataChange();
  } catch (err) {
    toast('Error al actualizar estado: ' + err.message, 'error');
    renderHistorial();
  }
}

function findContactoForVenta(venta) {
  const list = STATE.contactos || [];
  if (!venta || !list.length) return null;

  const name = String(venta.cliente_nombre || '').trim().toLowerCase();
  const loc = String(venta.localizador || '').trim();
  const importe = Number(venta.importe_total) || 0;

  if (loc) {
    const byLoc = list.find((c) => {
      const cLoc = String(c.localizador || c.localizador_bono || '').trim();
      return cLoc && cLoc === loc;
    });
    if (byLoc) return byLoc;
  }

  const candidates = list.filter((c) => {
    if (String(c.nombre_apellidos || '').trim().toLowerCase() !== name) return false;
    if (c.estado_pago && c.estado_pago !== 'pagado') return false;
    if (venta.tipo === 'entrada' && venta.parque_id && c.parque_id && c.parque_id !== venta.parque_id) return false;
    if (venta.tipo === 'bono' && venta.bono_id && c.bono_id && c.bono_id !== venta.bono_id) return false;
    return true;
  });

  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const byImporte = candidates.find((c) => Number(c.importe_total) === importe);
  return byImporte || candidates[0];
}

function openEditVenta(id) {
  const v = STATE.ventas.find((x) => x.id === id);
  if (!v) return;

  const tipo = v.tipo || 'entrada';
  const contacto = findContactoForVenta(v) || {};
  const hasExtras = Boolean(
    contacto.correo ||
    contacto.telefono ||
    contacto.extras ||
    contacto.num_bono ||
    contacto.dni ||
    contacto.fecha_nacimiento ||
    (contacto.cantidad_entradas && Number(contacto.cantidad_entradas) !== 1) ||
    (contacto.cantidad_bonos && Number(contacto.cantidad_bonos) !== 1)
  );

  const parquesOptions = STATE.parques.map((p) =>
    `<option value="${p.id}" ${p.id === v.parque_id ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`
  ).join('');
  const bonosOptions = STATE.tipos_bono.filter((b) => b.activo !== false).map((b) =>
    `<option value="${b.id}" ${b.id === v.bono_id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`
  ).join('');

  const fechaNac = contacto.fecha_nacimiento
    ? String(contacto.fecha_nacimiento).slice(0, 10)
    : '';

  const estadoActual = v.estado || 'completado';

  openModal({
    title: 'Editar venta',
    width: '640px',
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

        <div class="form-field" id="ev-field-parque">
          <label for="ev-parque">Parque</label>
          <select id="ev-parque">${parquesOptions}</select>
        </div>
        <div class="form-field" id="ev-field-bono" style="display:none;">
          <label for="ev-bono">Tipo de bono</label>
          <select id="ev-bono">${bonosOptions}</select>
        </div>

        <div class="form-field">
          <label for="ev-cliente">Nombre del cliente</label>
          <input type="text" id="ev-cliente" value="${escapeHtml(v.cliente_nombre || contacto.nombre_apellidos || '')}">
        </div>
        <div class="form-field">
          <label for="ev-importe">Importe total (€)</label>
          <input type="number" id="ev-importe" min="0" step="0.01" value="${v.importe_total}">
        </div>
        <div class="form-field">
          <label for="ev-localizador">Localizador</label>
          <input type="text" id="ev-localizador" value="${escapeHtml(v.localizador || contacto.localizador || '')}" placeholder="Sin localizador">
        </div>
        <div class="form-field">
          <label for="ev-via">Vía de venta</label>
          <select id="ev-via">
            <option value="llamada" ${(v.via || 'llamada') === 'llamada' ? 'selected' : ''}>📞 Llamada</option>
            <option value="correo" ${v.via === 'correo' ? 'selected' : ''}>✉️ Correo</option>
            <option value="chat" ${v.via === 'chat' ? 'selected' : ''}>💬 Chat</option>
          </select>
        </div>
        <div class="form-field">
          <label for="ev-estado">Estado de la venta</label>
          <select id="ev-estado">
            <option value="completado" ${estadoActual === 'completado' ? 'selected' : ''}>✅ Completado</option>
            <option value="enviado" ${estadoActual === 'enviado' ? 'selected' : ''}>📤 Enviado</option>
            <option value="pendiente" ${estadoActual === 'pendiente' ? 'selected' : ''}>⏳ Pendiente de pago</option>
            <option value="incompleto" ${estadoActual === 'incompleto' ? 'selected' : ''}>❌ Incompleto</option>
            <option value="no_enviado" ${estadoActual === 'no_enviado' ? 'selected' : ''}>⏸️ No enviado</option>
          </select>
        </div>
      </div>

      <div id="ev-seccion-entradas" class="form-grid" style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
        <div class="form-field full">
          <label for="ev-anotaciones">Anotaciones</label>
          <textarea id="ev-anotaciones" rows="2" placeholder="Apuntes sobre el cliente...">${escapeHtml(contacto.anotaciones || '')}</textarea>
        </div>
      </div>

      <div id="ev-seccion-bonos" class="form-grid" style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border); display:none;">
        <div class="form-field full">
          <label for="ev-anotaciones-bono">Anotaciones</label>
          <textarea id="ev-anotaciones-bono" rows="2" placeholder="Apuntes sobre el bono...">${escapeHtml(contacto.anotaciones || '')}</textarea>
        </div>
      </div>

      <div style="margin-top:12px; text-align:center;">
        <button type="button" class="btn btn-ghost btn-sm" id="ev-toggle-extras">
          <span id="ev-toggle-extras-text">${hasExtras ? 'Ocultar campos extra' : 'Mostrar más campos'}</span>
        </button>
      </div>

      <div id="ev-section-extras" style="display:${hasExtras ? 'block' : 'none'}; margin-top:14px; padding-top:14px; border-top:1px solid var(--border);">
        <div class="form-grid">
          <div class="form-field full">
            <label for="ev-correo">Correo electrónico</label>
            <input type="email" id="ev-correo" value="${escapeHtml(contacto.correo || '')}" placeholder="cliente@ejemplo.com">
          </div>
        </div>

        <div id="ev-seccion-entradas-extra" class="form-grid" style="margin-top:12px;">
          <div class="form-field">
            <label for="ev-telefono">Teléfono</label>
            <input type="text" id="ev-telefono" value="${escapeHtml(contacto.telefono || '')}" placeholder="Ej. 612 345 678">
          </div>
          <div class="form-field">
            <label for="ev-cantidad-entradas">Cantidad de entradas</label>
            <input type="number" min="1" id="ev-cantidad-entradas" value="${contacto.cantidad_entradas != null ? Number(contacto.cantidad_entradas) : 1}">
          </div>
          <div class="form-field full">
            <label for="ev-extras">Extras (ej. Comida, pase rápido...)</label>
            <input type="text" id="ev-extras" value="${escapeHtml(contacto.extras || '')}" placeholder="Sin extras">
          </div>
        </div>

        <div id="ev-seccion-bonos-extra" class="form-grid" style="margin-top:12px; display:none;">
          <div class="form-field">
            <label for="ev-num-bono">Nº de bono</label>
            <input type="text" id="ev-num-bono" value="${escapeHtml(contacto.num_bono || '')}">
          </div>
          <div class="form-field">
            <label for="ev-dni">DNI</label>
            <input type="text" id="ev-dni" value="${escapeHtml(contacto.dni || '')}">
          </div>
          <div class="form-field">
            <label for="ev-nacimiento">Fecha de nacimiento</label>
            <input type="date" id="ev-nacimiento" value="${escapeHtml(fechaNac)}">
          </div>
          <div class="form-field">
            <label for="ev-cantidad-bonos">Cantidad de bonos</label>
            <input type="number" min="1" id="ev-cantidad-bonos" value="${contacto.cantidad_bonos != null ? Number(contacto.cantidad_bonos) : 1}">
          </div>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="ev-cancel">Cancelar</button>
      <button class="btn btn-primary" id="ev-save">Guardar cambios</button>
    `,
  });

  const syncTipoVisibility = () => {
    const currentTipo = document.querySelector('input[name="ev-tipo"]:checked')?.value || 'entrada';
    const isEntrada = currentTipo === 'entrada';
    document.getElementById('ev-field-parque').style.display = isEntrada ? 'block' : 'none';
    document.getElementById('ev-field-bono').style.display = isEntrada ? 'none' : 'block';
    document.getElementById('ev-seccion-entradas').style.display = isEntrada ? 'grid' : 'none';
    document.getElementById('ev-seccion-bonos').style.display = isEntrada ? 'none' : 'grid';
    document.getElementById('ev-seccion-entradas-extra').style.display = isEntrada ? 'grid' : 'none';
    document.getElementById('ev-seccion-bonos-extra').style.display = isEntrada ? 'none' : 'grid';
  };

  document.querySelectorAll('input[name="ev-tipo"]').forEach((el) => {
    el.addEventListener('change', syncTipoVisibility);
  });
  syncTipoVisibility();

  const extrasSection = document.getElementById('ev-section-extras');
  const toggleExtrasBtn = document.getElementById('ev-toggle-extras');
  const toggleExtrasText = document.getElementById('ev-toggle-extras-text');
  toggleExtrasBtn.addEventListener('click', () => {
    const open = extrasSection.style.display !== 'none';
    extrasSection.style.display = open ? 'none' : 'block';
    toggleExtrasText.textContent = open ? 'Mostrar más campos' : 'Ocultar campos extra';
  });

  document.getElementById('ev-cancel').addEventListener('click', closeModal);
  document.getElementById('ev-save').addEventListener('click', async () => {
    const nextTipo = document.querySelector('input[name="ev-tipo"]:checked').value;
    const clienteNombre = document.getElementById('ev-cliente').value.trim();
    const importeTotal = Number(document.getElementById('ev-importe').value);
    const localizador = document.getElementById('ev-localizador')?.value.trim() || null;
    const via = document.getElementById('ev-via').value;
    const nextEstado = document.getElementById('ev-estado')?.value || 'completado';
    const anotaciones = nextTipo === 'entrada'
      ? (document.getElementById('ev-anotaciones')?.value.trim() || '')
      : (document.getElementById('ev-anotaciones-bono')?.value.trim() || '');

    if (!clienteNombre) {
      toast('Indica el nombre del cliente', 'error');
      return;
    }
    if (Number.isNaN(importeTotal) || importeTotal < 0) {
      toast('Indica un importe válido', 'error');
      return;
    }

    const changes = {
      fecha: v.fecha,
      tipo: nextTipo,
      via,
      cliente_nombre: clienteNombre,
      importe_total: importeTotal,
      localizador,
      estado: nextEstado,
    };

    let itemId = null;
    if (nextTipo === 'entrada') {
      itemId = document.getElementById('ev-parque').value;
      if (!itemId) { toast('Selecciona un parque', 'error'); return; }
      changes.parque_id = itemId;
      changes.bono_id = null;
    } else {
      itemId = document.getElementById('ev-bono').value;
      if (!itemId) { toast('Selecciona un tipo de bono', 'error'); return; }
      changes.bono_id = itemId;
      changes.parque_id = null;
    }

    let estadoPagoContacto = 'pagado';
    if (nextEstado === 'pendiente') estadoPagoContacto = 'pendiente';
    else if (nextEstado === 'incompleto') estadoPagoContacto = 'Incompleto';
    else if (nextEstado === 'enviado') estadoPagoContacto = 'Enviado';
    else if (nextEstado === 'no_enviado') estadoPagoContacto = 'No enviado';

    const contactoPayload = {
      tipo: nextTipo,
      nombre_apellidos: clienteNombre,
      correo: document.getElementById('ev-correo')?.value.trim() || '',
      importe_total: importeTotal,
      estado_pago: estadoPagoContacto,
      anotaciones,
      localizador,
      via,
    };

    if (nextTipo === 'entrada') {
      contactoPayload.telefono = document.getElementById('ev-telefono')?.value.trim() || '';
      contactoPayload.parque_id = itemId;
      contactoPayload.bono_id = null;
      const cantVal = document.getElementById('ev-cantidad-entradas')?.value;
      contactoPayload.cantidad_entradas = cantVal ? Number(cantVal) : null;
      contactoPayload.extras = document.getElementById('ev-extras')?.value.trim() || '';
      contactoPayload.num_bono = null;
      contactoPayload.dni = null;
      contactoPayload.fecha_nacimiento = null;
      contactoPayload.cantidad_bonos = null;
    } else {
      contactoPayload.num_bono = document.getElementById('ev-num-bono')?.value.trim() || '';
      contactoPayload.dni = document.getElementById('ev-dni')?.value.trim() || '';
      contactoPayload.fecha_nacimiento = document.getElementById('ev-nacimiento')?.value || null;
      contactoPayload.bono_id = itemId;
      contactoPayload.parque_id = null;
      const cantVal = document.getElementById('ev-cantidad-bonos')?.value;
      contactoPayload.cantidad_bonos = cantVal ? Number(cantVal) : null;
      contactoPayload.telefono = null;
      contactoPayload.cantidad_entradas = null;
      contactoPayload.extras = null;
    }

    const saveBtn = document.getElementById('ev-save');
    if (saveBtn) saveBtn.disabled = true;

    try {
      await DB.updateVenta(v.id, changes);

      const linked = findContactoForVenta(v);
      if (linked?.id) {
        await DB.updateContacto(linked.id, contactoPayload);
      } else {
        await DB.addContacto(contactoPayload);
      }

      STATE.ventas = await DB.getVentas();
      STATE.contactos = await DB.getContactos();
      toast('Venta actualizada', 'success');
      closeModal();
      refreshAllViewsAfterDataChange();
    } catch (err) {
      toast('Error al actualizar: ' + err.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
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
