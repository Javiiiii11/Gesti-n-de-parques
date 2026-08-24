/* ============================================================================
   contactos.js — vista "Apuntes y Contactos"
============================================================================ */

let CONTACTOS_STATE = {
  search: '',
  tipo: '',
  via: '',
  estado: '',
  sortBy: 'fecha',
  sortDir: 'desc',
  selectedContactos: new Set()
};

function wireContactosView() {
  document.getElementById('btn-nuevo-contacto').addEventListener('click', () => openContactoForm());

  document.getElementById('contactos-search').addEventListener('input', debounce((e) => {
    CONTACTOS_STATE.search = e.target.value.trim().toLowerCase();
    renderContactos();
  }, 300));

  document.getElementById('contactos-filtro-tipo').addEventListener('change', (e) => {
    CONTACTOS_STATE.tipo = e.target.value;
    renderContactos();
  });

  document.getElementById('contactos-filtro-via').addEventListener('change', (e) => {
    CONTACTOS_STATE.via = e.target.value;
    renderContactos();
  });

  document.getElementById('contactos-filtro-estado').addEventListener('change', (e) => {
    CONTACTOS_STATE.estado = e.target.value;
    renderContactos();
  });

  document.getElementById('contactos-filtro-clear').addEventListener('click', () => {
    CONTACTOS_STATE.search = '';
    CONTACTOS_STATE.tipo = '';
    CONTACTOS_STATE.via = '';
    CONTACTOS_STATE.estado = '';
    CONTACTOS_STATE.sortBy = 'fecha';
    CONTACTOS_STATE.sortDir = 'desc';
    document.getElementById('contactos-search').value = '';
    document.getElementById('contactos-filtro-tipo').value = '';
    document.getElementById('contactos-filtro-via').value = '';
    document.getElementById('contactos-filtro-estado').value = '';
    renderContactos();
  });

  document.querySelectorAll('#contactos-table thead th[data-sort]').forEach((th) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (CONTACTOS_STATE.sortBy === key) {
        CONTACTOS_STATE.sortDir = CONTACTOS_STATE.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        CONTACTOS_STATE.sortBy = key;
        CONTACTOS_STATE.sortDir = 'asc';
      }
      renderContactos();
    });
  });

  document.getElementById('contactos-select-all').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.contactos-row-cb').forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) CONTACTOS_STATE.selectedContactos.add(cb.dataset.id);
      else CONTACTOS_STATE.selectedContactos.delete(cb.dataset.id);
    });
    updateContactosBatchUI();
  });

  document.getElementById('contactos-batch-delete').addEventListener('click', () => {
    if (CONTACTOS_STATE.selectedContactos.size === 0) return;
    confirmDialog({
      title: 'Eliminar apuntes seleccionados',
      message: `¿Estás seguro de que quieres eliminar ${CONTACTOS_STATE.selectedContactos.size} apuntes de forma permanente?`,
      confirmLabel: 'Eliminar seleccionados',
      danger: true,
      onConfirm: async () => {
        try {
          const arr = Array.from(CONTACTOS_STATE.selectedContactos);
          for (const id of arr) {
            await DB.deleteContacto(id);
          }
          CONTACTOS_STATE.selectedContactos.clear();
          STATE.contactos = await DB.getContactos();
          refreshAllViewsAfterDataChange();
          toast(`Se han eliminado ${arr.length} apuntes`, 'success');
        } catch (err) {
          toast('Error al eliminar apuntes: ' + err.message, 'error');
        }
      }
    });
  });
}

function updateContactosBatchUI() {
  const btn = document.getElementById('contactos-batch-delete');
  const count = document.getElementById('contactos-batch-count');
  const allCb = document.getElementById('contactos-select-all');
  const size = CONTACTOS_STATE.selectedContactos.size;

  if (size > 0) {
    btn.style.display = 'inline-flex';
    count.textContent = size;
  } else {
    btn.style.display = 'none';
  }

  const cbs = Array.from(document.querySelectorAll('.contactos-row-cb'));
  if (cbs.length > 0 && cbs.every(cb => cb.checked)) {
    allCb.checked = true;
  } else {
    allCb.checked = false;
  }
}

/* ============================================================================
   PARSER RÁPIDO — Pega una línea desde una tabla y rellena el formulario
   Formato esperado para entradas:
   username    localizador    nombre_cliente    precio    fecha_hora    correo    teléfono    método_pago
   ============================================================================ */
function wireContactoQuickParse(updateFormVisibility) {
  const textarea = document.getElementById('cf-quick-parse');
  if (!textarea) return;

  const btnParse = document.getElementById('btn-cf-quick-parse');
  const preview = document.getElementById('cf-quick-parse-preview');
  const btnConfirm = document.getElementById('btn-cf-quick-confirm');
  const btnCancel = document.getElementById('btn-cf-quick-cancel');

  if (!btnParse || !preview || !btnConfirm || !btnCancel) return;

  let parsedData = null;

  function parseLineContacto(text) {
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

  function fillContactoForm(data) {
    if (!data) return;

    // Asegurar que estamos en modo "entrada"
    const radioEntrada = document.querySelector('input[name="cf-tipo"][value="entrada"]');
    if (radioEntrada) radioEntrada.checked = true;
    if (typeof updateFormVisibility === 'function') updateFormVisibility();

    // Mostrar campos extra si es necesario (teléfono, correo)
    const extras = document.getElementById('cf-section-extras');
    const toggleText = document.getElementById('cf-toggle-extras-text');
    if (extras && extras.style.display === 'none') {
      extras.style.display = 'block';
      if (toggleText) toggleText.textContent = 'Ocultar campos extra';
      if (typeof updateFormVisibility === 'function') updateFormVisibility();
    }

    // Rellenar campos
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('cf-localizador', data.localizador);
    setVal('cf-nombre', data.nombreCliente);
    setVal('cf-importe', data.precio);
    setVal('cf-correo', data.correo);
    setVal('cf-telefono', data.telefono);
  }

  function showPreview(data) {
    if (preview) {
      preview.innerHTML = `
        <div class="qp-card">
          <div class="qp-head">📋 Vista previa de datos detectados</div>
          <div class="qp-row"><span>Localizador</span><strong>${escapeHtml(data.localizador) || '<i style="color:var(--text-muted)">—</i>'}</strong></div>
          <div class="qp-row"><span>Cliente</span><strong>${escapeHtml(data.nombreCliente) || '<i style="color:var(--text-muted)">—</i>'}</strong></div>
          <div class="qp-row"><span>Importe</span><strong>${typeof fmtEUR === 'function' ? fmtEUR(data.precio) : data.precio.toFixed(2) + ' €'}</strong></div>
          <div class="qp-row"><span>Correo</span><strong>${escapeHtml(data.correo) || '<i style="color:var(--text-muted)">—</i>'}</strong></div>
          <div class="qp-row"><span>Teléfono</span><strong>${escapeHtml(data.telefono) || '<i style="color:var(--text-muted)">—</i>'}</strong></div>
        </div>
      `;
      preview.style.display = 'block';
    }
    if (btnConfirm) btnConfirm.style.display = 'inline-flex';
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (btnParse) btnParse.style.display = 'none';
  }

  function hidePreview() {
    parsedData = null;
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (btnConfirm) btnConfirm.style.display = 'none';
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnParse) btnParse.style.display = 'inline-flex';
  }

  const doAutoParse = () => {
    const text = textarea.value.trim();
    if (!text) { hidePreview(); return; }
    const result = parseLineContacto(text);
    if (result) {
      parsedData = result;
      showPreview(parsedData);
    } else {
      hidePreview();
    }
  };

  // Auto-interpret on paste (like ventas)
  textarea.addEventListener('paste', () => {
    setTimeout(doAutoParse, 50);
  });
  textarea.addEventListener('input', doAutoParse);

  // Manual parse button as fallback
  btnParse.addEventListener('click', () => {
    const line = textarea.value.trim();
    if (!line) { toast('Pega el texto de la tabla primero', 'error'); return; }
    parsedData = parseLineContacto(line);
    if (!parsedData) {
      toast('No se pudo interpretar el formato. Revisa que tenga: localizador, nombre, precio, correo y teléfono', 'error');
      return;
    }
    showPreview(parsedData);
  });

  btnConfirm.addEventListener('click', () => {
    if (!parsedData) return;
    fillContactoForm(parsedData);
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

function renderContactos() {
  const tbody = document.getElementById('contactos-tbody');
  if (!tbody) return;

  let filtrados = STATE.contactos.filter((c) => {
    // Por defecto, ocultar los apuntes ya pagados de la lista general
    // (ya que se consideran ventas y van al Historial), a menos que se filtre por ellos.
    if (!CONTACTOS_STATE.estado && c.estado_pago === 'pagado') return false;

    if (CONTACTOS_STATE.tipo && c.tipo !== CONTACTOS_STATE.tipo) return false;
    if (CONTACTOS_STATE.via && (c.via || 'llamada') !== CONTACTOS_STATE.via) return false;
    if (CONTACTOS_STATE.estado && c.estado_pago !== CONTACTOS_STATE.estado) return false;
    if (CONTACTOS_STATE.search) {
      const s = CONTACTOS_STATE.search;
      const matchName = (c.nombre_apellidos || '').toLowerCase().includes(s);
      const matchEmail = (c.correo || '').toLowerCase().includes(s);
      const matchTlf = (c.telefono || '').toLowerCase().includes(s);
      const matchDni = (c.dni || '').toLowerCase().includes(s);
      const matchLoc = (c.localizador || '').toLowerCase().includes(s);
      return matchName || matchEmail || matchTlf || matchDni || matchLoc;
    }
    return true;
  });

  // Ordenación por columna
  const dir = CONTACTOS_STATE.sortDir === 'asc' ? 1 : -1;
  const key = CONTACTOS_STATE.sortBy;
  filtrados.sort((a, b) => {
    let va, vb;
    if (key === 'fecha') {
      va = new Date(a.created_at || 0).getTime();
      vb = new Date(b.created_at || 0).getTime();
    } else if (key === 'cliente') {
      va = (a.nombre_apellidos || '').toLowerCase();
      vb = (b.nombre_apellidos || '').toLowerCase();
    } else if (key === 'tipo') {
      va = a.tipo || 'entrada';
      vb = b.tipo || 'entrada';
    } else if (key === 'via') {
      va = a.via || 'llamada';
      vb = b.via || 'llamada';
    } else if (key === 'detalles') {
      va = (a.tipo === 'entrada' ? parqueNombre(a.parque_id) : bonoNombre(a.bono_id)).toLowerCase();
      vb = (b.tipo === 'entrada' ? parqueNombre(b.parque_id) : bonoNombre(b.bono_id)).toLowerCase();
    } else if (key === 'localizador') {
      va = (a.localizador || '').toLowerCase();
      vb = (b.localizador || '').toLowerCase();
    } else if (key === 'importe') {
      va = Number(a.importe_total) || 0;
      vb = Number(b.importe_total) || 0;
    } else if (key === 'estado') {
      va = (a.estado_pago || '').toLowerCase();
      vb = (b.estado_pago || '').toLowerCase();
    } else {
      va = a[key] ?? '';
      vb = b[key] ?? '';
    }
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  // Actualizar flechas de cabecera
  document.querySelectorAll('#contactos-table thead th[data-sort]').forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) {
      arrow.textContent = th.dataset.sort === CONTACTOS_STATE.sortBy
        ? (CONTACTOS_STATE.sortDir === 'asc' ? ' ▲' : ' ▼')
        : '';
    }
  });

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      No se han encontrado apuntes con estos filtros.</div></td></tr>`;
    return;
  }

  const viaLabels = { llamada: '📞 Llamada', correo: '✉️ Correo', chat: '💬 Chat' };
  const viaClasses = { llamada: 'badge-via-llamada', correo: 'badge-via-correo', chat: 'badge-via-chat' };

  tbody.innerHTML = filtrados.map((c) => {
    let tipoLabel = c.tipo === 'entrada' ? 'Entradas' : 'Bonos';
    let badgeClass = c.tipo === 'entrada' ? 'bg-info' : 'bg-accent';
    const via = c.via || 'llamada';

    let detalles = '';
    if (c.tipo === 'entrada') {
      detalles = `${fmtNum(c.cantidad_entradas || 1)}x ${parqueNombre(c.parque_id)}<br><small style="color:var(--text-muted)">${c.extras ? 'Extras: ' + escapeHtml(c.extras) : 'Sin extras'}</small>`;
    } else {
      let bonosCount = c.cantidad_bonos || 1;
      try {
        if (c.extras && (c.extras.startsWith('[') || c.extras.startsWith('{'))) {
          const parsed = JSON.parse(c.extras);
          if (Array.isArray(parsed) && parsed.length > 0) {
            bonosCount = parsed.length;
          }
        }
      } catch (e) { }
      detalles = `${fmtNum(bonosCount)}x ${bonoNombre(c.bono_id)}`;
    }

    let estadoBadge = '';
    if (c.estado_pago === 'pagado') {
      estadoBadge = '<span class="badge on">Pagado</span>';
    } else if (c.estado_pago === 'Apunte rápido') {
      estadoBadge = '<span class="badge neutral">Apunte rápido</span>';
    } else {
      estadoBadge = '<span class="badge off" style="color:var(--accent); border-color:var(--accent)">Pendiente de pago</span>';
    }

    const infoSubtext = [c.correo, c.telefono].filter(Boolean).map(escapeHtml).join(' · ');
    const subtextHtml = infoSubtext || '&nbsp;';
    const checked = CONTACTOS_STATE.selectedContactos.has(c.id) ? 'checked' : '';

    const ahora = Date.now();
    const creadoMs = c.created_at ? new Date(c.created_at).getTime() : ahora;
    const diasEdad = Math.floor((ahora - creadoMs) / 86400000);
    let edadLabel = '';
    if (diasEdad === 0) edadLabel = 'Hoy';
    else if (diasEdad === 1) edadLabel = 'Ayer';
    else if (diasEdad < 7) edadLabel = `Hace ${diasEdad} días`;
    else if (diasEdad < 14) edadLabel = 'La semana pasada';
    else edadLabel = `Hace ${Math.floor(diasEdad / 7)} sem.`;

    // Color de fila según fecha_maxima
    let rowStyle = '';
    let fechaMaxBadge = '';
    if (c.fecha_maxima) {
      const maxMs = new Date(c.fecha_maxima + 'T23:59:59').getTime();
      const diasMax = Math.floor((maxMs - ahora) / 86400000);
      if (diasMax < 0) {
        rowStyle = 'opacity:0.5; text-decoration:line-through;';
        fechaMaxBadge = `<span style="display:inline-block;margin-top:3px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(239,68,68,0.15);color:#ef4444;">Fecha límite pasada</span>`;
      } else if (diasMax <= 2) {
        rowStyle = 'background:rgba(239,68,68,0.06);';
        fechaMaxBadge = `<span style="display:inline-block;margin-top:3px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(239,68,68,0.15);color:#ef4444;">🔴 ${diasMax === 0 ? 'Hoy' : diasMax + 'd'}</span>`;
      } else if (diasMax <= 7) {
        rowStyle = 'background:rgba(234,179,8,0.05);';
        fechaMaxBadge = `<span style="display:inline-block;margin-top:3px;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;background:rgba(234,179,8,0.15);color:#d97706;">🟡 ${diasMax}d</span>`;
      } else {
        fechaMaxBadge = `<span style="display:inline-block;margin-top:3px;font-size:10px;padding:1px 6px;border-radius:999px;background:var(--bg-elevated);color:var(--text-muted);">📅 ${diasMax}d</span>`;
      }
    }

    return `
      <tr style="${rowStyle}">
        <td style="text-align:center;"><input type="checkbox" class="contactos-row-cb" data-id="${c.id}" ${checked}></td>
        <td style="white-space:nowrap; color:var(--text-secondary); font-size:12px;">
          ${fmtDateShort(c.created_at)}
          <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${edadLabel}</div>
          ${fechaMaxBadge}
        </td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.nombre_apellidos)}</div>
          <small style="color:var(--text-muted); display:block; min-height:16px; font-size:12px;">${subtextHtml}</small>
        </td>
        <td><span class="badge" style="background:var(--bg-hover)">${tipoLabel}</span></td>
        <td><span class="badge ${viaClasses[via] || 'badge-via-llamada'}">${viaLabels[via] || '📞 Llamada'}</span></td>
        <td>${detalles}</td>
        <td style="color:var(--text-secondary); font-size:13px;">${escapeHtml(c.localizador || '—')}</td>
        <td class="amount"><b>${fmtEUR(c.importe_total)}</b></td>
        <td>${estadoBadge}</td>
        <td>
          <div class="row-actions" style="justify-content:flex-end;">
            ${c.estado_pago !== 'pagado' ? `
              <button class="icon-btn-sm" title="Marcar como pagado" data-pay-contacto="${c.id}" style="color:var(--success)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </button>
            ` : ''}
            <button class="icon-btn-sm" title="Editar" data-edit-contacto="${c.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn-sm danger" title="Eliminar" data-delete-contacto="${c.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-contacto]').forEach((btn) =>
    btn.addEventListener('click', () => openContactoForm(btn.dataset.editContacto)));
  tbody.querySelectorAll('[data-delete-contacto]').forEach((btn) =>
    btn.addEventListener('click', () => deleteContactoFlow(btn.dataset.deleteContacto)));
  tbody.querySelectorAll('[data-pay-contacto]').forEach((btn) =>
    btn.addEventListener('click', () => payContactoFlow(btn.dataset.payContacto)));

  tbody.querySelectorAll('.contactos-row-cb').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) CONTACTOS_STATE.selectedContactos.add(e.target.dataset.id);
      else CONTACTOS_STATE.selectedContactos.delete(e.target.dataset.id);
      updateContactosBatchUI();
    });
  });

  updateContactosBatchUI();
}

let NUEVO_APUNTE_DRAFT = null;
let CURRENT_BONOS_LIST = [];
let SELECTED_MAIN_BONO_INDEX = 0;

function saveNuevoApunteDraft() {
  const modal = document.getElementById('modal-body');
  if (!modal) return;
  const tipo = document.querySelector('input[name="cf-tipo"]:checked')?.value || 'entrada';
  NUEVO_APUNTE_DRAFT = {
    tipo,
    nombre_apellidos: document.getElementById('cf-nombre')?.value || '',
    importe_total: document.getElementById('cf-importe')?.value || '',
    localizador: document.getElementById('cf-localizador')?.value || '',
    via: document.getElementById('cf-via')?.value || 'llamada',
    estado_pago: document.getElementById('cf-estado')?.value || 'pendiente',
    anotaciones: document.getElementById('cf-anotaciones')?.value || '',
    parque_id: document.getElementById('cf-parque')?.value || '',
    bono_id: document.getElementById('cf-bono')?.value || '',
    correo: document.getElementById('cf-correo')?.value || '',
    telefono: document.getElementById('cf-telefono')?.value || '',
    cantidad_entradas: document.getElementById('cf-cantidad-entradas')?.value || '1',
    extras: document.getElementById('cf-extras')?.value || '',
    bonosList: JSON.parse(JSON.stringify(CURRENT_BONOS_LIST)),
    selectedMainBonoIndex: SELECTED_MAIN_BONO_INDEX,
    showExtras: document.getElementById('cf-section-extras')?.style.display !== 'none'
  };
}

function openContactoForm(id = null) {
  const isEdit = Boolean(id);
  if (!isEdit) NUEVO_APUNTE_DRAFT = null;
  const c = isEdit
    ? STATE.contactos.find((x) => x.id === id)
    : (NUEVO_APUNTE_DRAFT ? {
      tipo: NUEVO_APUNTE_DRAFT.tipo,
      nombre_apellidos: NUEVO_APUNTE_DRAFT.nombre_apellidos,
      importe_total: NUEVO_APUNTE_DRAFT.importe_total,
      localizador: NUEVO_APUNTE_DRAFT.localizador,
      via: NUEVO_APUNTE_DRAFT.via,
      estado_pago: NUEVO_APUNTE_DRAFT.estado_pago,
      anotaciones: NUEVO_APUNTE_DRAFT.anotaciones,
      parque_id: NUEVO_APUNTE_DRAFT.parque_id,
      bono_id: NUEVO_APUNTE_DRAFT.bono_id,
      correo: NUEVO_APUNTE_DRAFT.correo,
      telefono: NUEVO_APUNTE_DRAFT.telefono,
      cantidad_entradas: NUEVO_APUNTE_DRAFT.cantidad_entradas,
      extras: NUEVO_APUNTE_DRAFT.extras
    } : null);

  if (isEdit) {
    SELECTED_MAIN_BONO_INDEX = 0;
    let list = [];
    try {
      if (c && c.extras && (c.extras.startsWith('[') || c.extras.startsWith('{'))) {
        const parsed = JSON.parse(c.extras);
        list = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) { }
    if (!list.length) {
      list = [{
        nombre_apellidos: c?.nombre_apellidos || '',
        fecha_nacimiento: c?.fecha_nacimiento || '',
        dni: c?.dni || '',
        num_bono: c?.num_bono || '',
        anotaciones: ''
      }];
    }
    CURRENT_BONOS_LIST = list;
  } else {
    SELECTED_MAIN_BONO_INDEX = NUEVO_APUNTE_DRAFT?.selectedMainBonoIndex ?? 0;
    if (NUEVO_APUNTE_DRAFT && Array.isArray(NUEVO_APUNTE_DRAFT.bonosList) && NUEVO_APUNTE_DRAFT.bonosList.length > 0) {
      CURRENT_BONOS_LIST = JSON.parse(JSON.stringify(NUEVO_APUNTE_DRAFT.bonosList));
    } else {
      CURRENT_BONOS_LIST = [{
        nombre_apellidos: '',
        fecha_nacimiento: '',
        dni: '',
        num_bono: '',
        anotaciones: ''
      }];
    }
  }

  const initialTipo = c ? c.tipo : 'entrada';

  openModal({
    title: isEdit ? 'Editar apunte' : 'Nuevo apunte',
    width: !isEdit ? '1050px' : '550px',
    bodyHtml: `
      ${!isEdit ? `
      <!-- ====== PARSER RÁPIDO ====== -->
      <div class="card card-pad quick-parse-card" style="margin-bottom: 16px; padding: 14px 16px; background: var(--bg-elevated); border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div class="qp-header" style="margin-bottom:8px;">
          <h3 style="margin:0; font-size:15px; color: var(--accent);">⚡ Pegado rápido</h3>
          <p class="desc" style="margin:2px 0 0; font-size:12.5px;">Pega una línea de la tabla para rellenar automáticamente (solo entradas)</p>
        </div>
        <div class="qp-body">
          <textarea id="cf-quick-parse" class="qp-textarea" placeholder="Pega aquí la línea de la tabla&#10;Ej: usuario    21280354    Cliente    00,00 €    2026/01/01 00:00:00    correo@gmail.com    +34 123456789    Estado del pago" rows="2" style="width:100%; min-height:54px;"></textarea>
          <div class="qp-actions" style="margin-top:8px; display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cf-quick-parse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;margin-right:4px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Interpretar
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-cf-quick-confirm" style="display:none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>
              Confirmar y rellenar
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-cf-quick-cancel" style="display:none;">
              Cancelar
            </button>
          </div>
          <div id="cf-quick-parse-preview" style="display:none; margin-top:12px;"></div>
        </div>
      </div>
      ` : ''}
      
      <!-- Grid principal de campos -->
      <div style="display:flex; flex-wrap:wrap; gap:12px;">
        <div class="form-field" style="flex: 1 1 100%; min-width: 0;">
          <label>Tipo de apunte</label>
          <div style="display:flex; gap:16px; margin-top:2px;">
            <label style="flex-direction:row; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="cf-tipo" value="entrada" ${initialTipo === 'entrada' ? 'checked' : ''} style="width:auto"> Entradas
            </label>
            <label style="flex-direction:row; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="cf-tipo" value="bono" ${initialTipo === 'bono' ? 'checked' : ''} style="width:auto"> Bonos
            </label>
          </div>
        </div>

        <div class="form-field" style="flex: 2 1 240px; min-width: 0;">
          <label for="cf-nombre">👤 Nombre y apellidos</label>
          <input type="text" id="cf-nombre" placeholder="Nombre completo del cliente..." value="${escapeHtml(c?.nombre_apellidos || '')}" required>
        </div>
        <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
          <label for="cf-importe">💵 Importe total (€)</label>
          <input type="number" placeholder="0.0€" step="0.01" min="0" id="cf-importe" value="${c?.importe_total || ''}" required>
        </div>

        <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
          <label for="cf-localizador">🚩 Localizador</label>
          <input type="text" id="cf-localizador" value="${escapeHtml(c?.localizador || '')}" placeholder="Sin localizador">
        </div>
        <div class="form-field" style="flex: 1 1 160px; min-width: 0;">
          <label for="cf-fecha-maxima">📅 Fecha máx. de visita</label>
          <input type="date" id="cf-fecha-maxima" value="${c?.fecha_maxima || ''}">
        </div>
        <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
          <label for="cf-via">Vía de venta</label>
          <select id="cf-via">
            <option value="llamada" ${(!c || c.via === 'llamada') ? 'selected' : ''}>📞 Llamada</option>
            <option value="correo" ${c?.via === 'correo' ? 'selected' : ''}>✉️ Correo</option>
            <option value="chat" ${c?.via === 'chat' ? 'selected' : ''}>💬 Chat</option>
          </select>
        </div>
        <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
          <label for="cf-estado">💳 Estado de pago</label>
          <select id="cf-estado">
            <option value="Apunte rápido" ${c?.estado_pago === 'Apunte rápido' ? 'selected' : ''}>Apunte rápido</option>
            <option value="pendiente" ${(!c || c.estado_pago === 'pendiente') ? 'selected' : ''}>Pendiente de pago</option>
            <option value="pagado" ${c?.estado_pago === 'pagado' ? 'selected' : ''}>Pagado (Sumará a ventas)</option>
          </select>
        </div>

        <!-- Entrada-specific field -->
        <div class="form-field" id="cf-field-parque" style="flex: 1 1 100%; min-width: 0;">
          <label for="cf-parque">🎢 Parque</label>
          <select id="cf-parque">
            <option value="">Selecciona un parque...</option>
            ${STATE.parques.filter(p => p.activo !== false).map(p => `<option value="${p.id}" ${c?.parque_id === p.id ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')}
          </select>
        </div>
        <!-- Bono-specific field -->
        <div class="form-field" id="cf-field-bono" style="flex: 1 1 100%; min-width: 0; display:none;">
          <label for="cf-bono">🪪 Tipo de bono</label>
          <select id="cf-bono">
            <option value="">Selecciona un bono...</option>
            ${STATE.tipos_bono.filter(b => b.activo !== false).map(b => `<option value="${b.id}" ${c?.bono_id === b.id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`).join('')}
          </select>
        </div>

        <div class="form-field" style="flex: 1 1 100%; min-width: 0; margin-top:4px;">
          <label for="cf-anotaciones">📝 Anotaciones</label>
          <textarea id="cf-anotaciones" rows="2" placeholder="Apuntes sobre el cliente...">${escapeHtml(c?.anotaciones || '')}</textarea>
        </div>
      </div>

      <!-- Botón para mostrar/ocultar campos extra -->
      <div style="margin-top:12px; text-align:center;">
        <button type="button" class="btn btn-ghost btn-sm" id="cf-toggle-extras">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"><path d="M12 5v14M5 12h14"/></svg>
          <span id="cf-toggle-extras-text">Mostrar más campos</span>
        </button>
      </div>

      <!-- Campos extras (ocultos por defecto) -->
      <div id="cf-section-extras" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
        <div class="form-grid">
          <div class="form-field full">
            <label for="cf-correo">Correo electrónico</label>
            <input type="email" id="cf-correo" value="${escapeHtml(c?.correo || '')}">
          </div>
        </div>
        <!-- Campos extra para Entradas -->
        <div id="cf-seccion-entradas-extra" class="form-grid" style="margin-top:12px;">
          <div class="form-field">
            <label for="cf-telefono">Teléfono</label>
            <input type="text" id="cf-telefono" value="${escapeHtml(c?.telefono || '')}">
          </div>
          <div class="form-field">
            <label for="cf-cantidad-entradas">Cantidad de entradas</label>
            <input type="number" min="1" id="cf-cantidad-entradas" value="${c?.cantidad_entradas || 1}">
          </div>
          <div class="form-field full">
            <label for="cf-extras">Extras (ej. Comida, pase rápido...)</label>
            <input type="text" id="cf-extras" value="${escapeHtml(c?.extras || '')}" placeholder="Sin extras">
          </div>
        </div>

        <!-- Campos extra para Bonos -->
        <div id="cf-seccion-bonos-extra" style="margin-top:12px; display:none;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <span style="font-weight:600; font-size:13px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              🪪 Detalle de Bonos (<span id="cf-bonos-count">1</span>)
            </span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-bono-item" style="gap:4px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Añadir otro bono al pedido
            </button>
          </div>
          <div id="cf-bonos-list-container" style="display:flex; flex-direction:column; gap:12px;"></div>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="cf-cancel">Cancelar</button>
      <button class="btn btn-secondary" id="cf-clear">Limpiar</button>
      <button class="btn btn-primary" id="cf-save">${isEdit ? 'Guardar cambios' : 'Crear apunte'}</button>
    `
  });

  if (!isEdit) {
    const modalBody = document.getElementById('modal-body');
    if (modalBody) {
      modalBody.addEventListener('input', saveNuevoApunteDraft);
      modalBody.addEventListener('change', saveNuevoApunteDraft);
    }
  }

  const updateFormVisibility = () => {
    const tipoRadio = document.querySelector('input[name="cf-tipo"]:checked');
    const tipo = tipoRadio ? tipoRadio.value : 'entrada';

    const fieldParque = document.getElementById('cf-field-parque');
    const fieldBono = document.getElementById('cf-field-bono');
    if (fieldParque) fieldParque.style.display = tipo === 'entrada' ? 'block' : 'none';
    if (fieldBono) fieldBono.style.display = tipo === 'bono' ? 'block' : 'none';

    const extrasContainer = document.getElementById('cf-section-extras');
    const toggleText = document.getElementById('cf-toggle-extras-text');
    const secEntradasExtra = document.getElementById('cf-seccion-entradas-extra');
    const secBonosExtra = document.getElementById('cf-seccion-bonos-extra');

    const isVisible = extrasContainer && extrasContainer.style.display !== 'none';

    if (toggleText) {
      if (tipo === 'bono') {
        toggleText.textContent = isVisible ? 'Ocultar tarjetas de bonos' : 'Mostrar tarjetas de bonos';
      } else {
        toggleText.textContent = isVisible ? 'Ocultar campos extra' : 'Mostrar más campos';
      }
    }

    if (isVisible) {
      if (secEntradasExtra) secEntradasExtra.style.display = tipo === 'entrada' ? 'grid' : 'none';
      if (secBonosExtra) secBonosExtra.style.display = tipo === 'bono' ? 'block' : 'none';
    }
  };

  const renderBonosListUI = () => {
    const container = document.getElementById('cf-bonos-list-container');
    const countEl = document.getElementById('cf-bonos-count');
    if (!container) return;
    if (countEl) countEl.textContent = CURRENT_BONOS_LIST.length;

    if (SELECTED_MAIN_BONO_INDEX >= CURRENT_BONOS_LIST.length) {
      SELECTED_MAIN_BONO_INDEX = 0;
    }

    container.innerHTML = CURRENT_BONOS_LIST.map((b, idx) => `
      <div class="bono-item-card" data-index="${idx}" style="background:var(--bg-elevated); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius-m); padding:16px 18px; margin-bottom:4px; box-shadow:0 2px 8px rgba(0,0,0,0.12);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:700; font-size:13.5px; color:var(--accent); display:flex; align-items:center; gap:6px;">
              🪪 Bono #${idx + 1}
            </span>
            <label title="Usar el nombre de esta tarjeta como titular principal del apunte" style="display:inline-flex; align-items:center; gap:5px; margin-left:6px; cursor:pointer; background:rgba(255,255,255,0.05); border:1px solid var(--border); padding:3px 9px; border-radius:12px; font-size:11px; color:var(--text-secondary);">
              <input type="radio" name="cf-main-bono-check" class="bono-radio-main" value="${idx}" ${SELECTED_MAIN_BONO_INDEX === idx ? 'checked' : ''} style="width:auto; cursor:pointer; accent-color:var(--accent);">
              <span>Titular principal</span>
            </label>
          </div>
          ${CURRENT_BONOS_LIST.length > 1 ? `
            <button type="button" class="btn btn-ghost btn-sm danger btn-remove-bono" data-index="${idx}" style="padding:4px 10px; font-size:12px; gap:4px;">
              🗑️ Eliminar este bono
            </button>
          ` : ''}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:12px;">
          <div class="form-field" style="flex: 1 1 100%; min-width: 0;">
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">👤 Nombre y Apellidos del titular</label>
            <input type="text" class="bono-input-nombre" data-index="${idx}" value="${escapeHtml(b.nombre_apellidos || '')}" placeholder="Nombre completo del titular del bono...">
          </div>
          <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">🎂 Fecha de nacimiento</label>
            <input type="date" class="bono-input-nacimiento" data-index="${idx}" value="${b.fecha_nacimiento || ''}">
          </div>
          <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">🪪 DNI / NIF</label>
            <input type="text" class="bono-input-dni" data-index="${idx}" value="${escapeHtml(b.dni || '')}" placeholder="DNI...">
          </div>
          <div class="form-field" style="flex: 1 1 140px; min-width: 0;">
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">🔢 Nº de bono</label>
            <input type="text" class="bono-input-num" data-index="${idx}" value="${escapeHtml(b.num_bono || '')}" placeholder="Ej: B-12345">
          </div>
          <div class="form-field" style="flex: 1 1 100%; min-width: 0;">
            <label style="font-size:12px; font-weight:600; color:var(--text-secondary);">📝 Anotaciones de este bono</label>
            <input type="text" class="bono-input-anotaciones" data-index="${idx}" value="${escapeHtml(b.anotaciones || '')}" placeholder="Observaciones o notas específicas para este bono...">
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.bono-radio-main').forEach(radio => {
      radio.addEventListener('change', (e) => {
        SELECTED_MAIN_BONO_INDEX = parseInt(e.target.value);
        const activeBono = CURRENT_BONOS_LIST[SELECTED_MAIN_BONO_INDEX];
        if (activeBono && activeBono.nombre_apellidos) {
          const mainNombre = document.getElementById('cf-nombre');
          if (mainNombre) mainNombre.value = activeBono.nombre_apellidos;
        }
        saveNuevoApunteDraft();
      });
    });

    container.querySelectorAll('input:not(.bono-radio-main)').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        if (isNaN(index) || !CURRENT_BONOS_LIST[index]) return;
        if (e.target.classList.contains('bono-input-nombre')) {
          CURRENT_BONOS_LIST[index].nombre_apellidos = e.target.value;
          if (index === SELECTED_MAIN_BONO_INDEX) {
            const mainNombre = document.getElementById('cf-nombre');
            if (mainNombre) mainNombre.value = e.target.value;
          }
        }
        if (e.target.classList.contains('bono-input-nacimiento')) CURRENT_BONOS_LIST[index].fecha_nacimiento = e.target.value;
        if (e.target.classList.contains('bono-input-dni')) CURRENT_BONOS_LIST[index].dni = e.target.value;
        if (e.target.classList.contains('bono-input-num')) CURRENT_BONOS_LIST[index].num_bono = e.target.value;
        if (e.target.classList.contains('bono-input-anotaciones')) CURRENT_BONOS_LIST[index].anotaciones = e.target.value;
        saveNuevoApunteDraft();
      });
    });

    container.querySelectorAll('.btn-remove-bono').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(btn.dataset.index);
        if (!isNaN(index) && CURRENT_BONOS_LIST.length > 1) {
          CURRENT_BONOS_LIST.splice(index, 1);
          if (SELECTED_MAIN_BONO_INDEX >= CURRENT_BONOS_LIST.length) {
            SELECTED_MAIN_BONO_INDEX = Math.max(0, CURRENT_BONOS_LIST.length - 1);
          }
          renderBonosListUI();
          saveNuevoApunteDraft();
        }
      });
    });
  };

  const addBonoBtn = document.getElementById('btn-add-bono-item');
  if (addBonoBtn) {
    addBonoBtn.addEventListener('click', () => {
      CURRENT_BONOS_LIST.push({ nombre_apellidos: '', fecha_nacimiento: '', dni: '', num_bono: '', anotaciones: '' });
      renderBonosListUI();
      saveNuevoApunteDraft();
    });
  }

  document.querySelectorAll('input[name="cf-tipo"]').forEach(el => el.addEventListener('change', updateFormVisibility));

  // Toggle extra fields
  const toggleBtn = document.getElementById('cf-toggle-extras');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const extras = document.getElementById('cf-section-extras');
      if (extras) {
        const isHidden = extras.style.display === 'none';
        extras.style.display = isHidden ? 'block' : 'none';
        updateFormVisibility();
        saveNuevoApunteDraft();
      }
    });
  }

  // ===== Quick Parse para apuntes (solo modo nuevo) =====
  if (!isEdit) {
    wireContactoQuickParse(updateFormVisibility);
  }

  renderBonosListUI();

  // Auto expand extras if bono, has extras or draft has showExtras
  const isBono = (document.querySelector('input[name="cf-tipo"][value="bono"]:checked') || initialTipo === 'bono');
  const hasExtras = c && (c.correo || c.telefono || c.extras || c.dni || c.fecha_nacimiento || c.num_bono);
  const extrasContainer = document.getElementById('cf-section-extras');

  if (extrasContainer) {
    if (isBono || hasExtras || (!isEdit && NUEVO_APUNTE_DRAFT && NUEVO_APUNTE_DRAFT.showExtras !== false)) {
      extrasContainer.style.display = 'block';
    }
  }

  updateFormVisibility();

  document.getElementById('cf-cancel').addEventListener('click', closeModal);
  document.getElementById('cf-clear').addEventListener('click', () => {
    if (!isEdit) NUEVO_APUNTE_DRAFT = null;
    CURRENT_BONOS_LIST = [{ nombre_apellidos: '', fecha_nacimiento: '', dni: '', num_bono: '', anotaciones: '' }];
    renderBonosListUI();
    // Reset common fields
    document.getElementById('cf-nombre').value = '';
    document.getElementById('cf-importe').value = '';
    document.getElementById('cf-localizador').value = '';
    document.getElementById('cf-estado').value = 'pendiente';
    document.getElementById('cf-anotaciones').value = '';
    document.getElementById('cf-correo').value = '';
    if (document.getElementById('cf-field-parque').style.display !== 'none') {
      document.getElementById('cf-telefono').value = '';
      document.getElementById('cf-cantidad-entradas').value = '1';
      document.getElementById('cf-extras').value = '';
      document.getElementById('cf-parque').value = '';
    }
    if (document.getElementById('cf-field-bono').style.display !== 'none') {
      document.getElementById('cf-bono').value = '';
    }
  });
  document.getElementById('cf-save').addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="cf-tipo"]:checked').value;
    const nombre_apellidos = document.getElementById('cf-nombre').value.trim();
    const importe_total = Number(document.getElementById('cf-importe').value) || 0;
    const estado_pago = document.getElementById('cf-estado').value;

    if (!nombre_apellidos) { toast('El nombre es obligatorio', 'error'); return; }

    const localizadorVal = document.getElementById('cf-localizador')?.value.trim() || '';
    const viaVal = document.getElementById('cf-via')?.value || 'llamada';
    let payload = {
      tipo,
      via: viaVal,
      nombre_apellidos,
      correo: document.getElementById('cf-correo').value.trim(),
      importe_total,
      estado_pago,
      anotaciones: document.getElementById('cf-anotaciones').value.trim(),
      localizador: localizadorVal || null,
      fecha_maxima: document.getElementById('cf-fecha-maxima')?.value || null
    };

    if (tipo === 'entrada') {
      const parque_id = document.getElementById('cf-parque').value;
      if (!parque_id) { toast('Selecciona un parque', 'error'); return; }
      payload.telefono = document.getElementById('cf-telefono').value.trim();
      payload.parque_id = parque_id;
      payload.cantidad_entradas = Number(document.getElementById('cf-cantidad-entradas').value) || 1;
      payload.extras = document.getElementById('cf-extras').value.trim();
    } else {
      const bono_id = document.getElementById('cf-bono').value;
      if (!bono_id) { toast('Selecciona un tipo de bono', 'error'); return; }

      const firstBono = CURRENT_BONOS_LIST[0] || {};
      payload.num_bono = firstBono.num_bono || '';
      payload.dni = firstBono.dni || '';
      payload.fecha_nacimiento = firstBono.fecha_nacimiento || null;
      payload.bono_id = bono_id;
      payload.cantidad_bonos = CURRENT_BONOS_LIST.length;
      payload.extras = JSON.stringify(CURRENT_BONOS_LIST);
    }

    // Check if transitioning from unpaid to pagado
    const wasNotPagado = isEdit && c && c.estado_pago !== 'pagado';
    const isNowPagado = estado_pago === 'pagado';
    const createVenta = (isNowPagado && (!isEdit || wasNotPagado));

    try {
      if (isEdit) {
        await DB.updateContacto(c.id, payload);
        toast('Apunte actualizado', 'success');
      } else {
        await DB.addContacto(payload);
        NUEVO_APUNTE_DRAFT = null;
        toast('Apunte creado', 'success');
      }

      if (createVenta) {
        // Automatically create a venta
        const ventaPayload = {
          fecha: new Date().toISOString(),
          tipo: payload.tipo,
          via: payload.via || 'llamada',
          cliente_nombre: payload.nombre_apellidos,
          importe_total: payload.importe_total,
          localizador: payload.localizador || null
        };
        if (payload.tipo === 'entrada') {
          ventaPayload.parque_id = payload.parque_id;
        } else {
          ventaPayload.bono_id = payload.bono_id;
        }
        await DB.addVenta(ventaPayload);
        toast('Venta generada automáticamente a partir del apunte pagado', 'success');
      }

      closeModal();
      STATE.contactos = await DB.getContactos();
      STATE.ventas = await DB.getVentas();
      refreshAllViewsAfterDataChange();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });
}

function deleteContactoFlow(id) {
  confirmDialog({
    title: 'Eliminar apunte',
    message: '¿Seguro que quieres eliminar este apunte? Esta acción no se puede deshacer.',
    onConfirm: async () => {
      try {
        await DB.deleteContacto(id);
        toast('Apunte eliminado', 'success');
        STATE.contactos = await DB.getContactos();
        renderContactos();
      } catch (err) {
        toast('Error al eliminar: ' + err.message, 'error');
      }
    }
  });
}

async function payContactoFlow(id) {
  const c = STATE.contactos.find(x => x.id === id);
  if (!c) return;

  confirmDialog({
    title: 'Marcar como pagado',
    message: c.tipo === 'entrada'
      ? 'Esto marcará el apunte como pagado y creará una nueva Venta en el historial. ¿Continuar?'
      : 'Esto marcará el bono como pagado y creará una nueva Venta en el historial. ¿Continuar?',
    confirmLabel: 'Sí, marcar pagado',
    danger: false,
    onConfirm: async () => {
      try {
        // First, update the contact to paid - this is the most important part!
        await DB.updateContacto(id, { estado_pago: 'pagado' });

        // Now update STATE.contactos immediately so UI updates right away!
        STATE.contactos = await DB.getContactos();
        refreshAllViewsAfterDataChange();

        // Try to add the venta, but if it fails it's okay - the contact is already marked as paid!
        try {
          const loc = c.localizador || c.localizador_bono || null;
          const ventaPayload = {
            fecha: new Date().toISOString(),
            tipo: c.tipo,
            via: c.via || 'llamada',
            cliente_nombre: c.nombre_apellidos,
            importe_total: c.importe_total,
            localizador: loc
          };

          if (c.tipo === 'entrada') {
            ventaPayload.parque_id = c.parque_id;
          } else {
            ventaPayload.bono_id = c.bono_id;
          }

          await DB.addVenta(ventaPayload);

          // Refresh ventas only if we successfully added one
          STATE.ventas = await DB.getVentas();
          refreshAllViewsAfterDataChange();
          toast('Pagado. Venta añadida al historial.', 'success');
        } catch (ventaErr) {
          // If adding the venta fails, show a warning but don't fail the whole thing!
          console.error('Error adding venta:', ventaErr);
          toast('Contacto marcado como pagado, pero no se pudo añadir la venta al historial.', 'info');
        }
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
    }
  });
}
