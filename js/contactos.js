/* ============================================================================
   contactos.js — vista "Apuntes y Contactos"
============================================================================ */

let CONTACTOS_STATE = {
  search: '',
  tipo: '',
  estado: ''
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

  document.getElementById('contactos-filtro-estado').addEventListener('change', (e) => {
    CONTACTOS_STATE.estado = e.target.value;
    renderContactos();
  });
}

function renderContactos() {
  const tbody = document.getElementById('contactos-tbody');
  if (!tbody) return;

  let filtrados = STATE.contactos.filter((c) => {
    if (CONTACTOS_STATE.tipo && c.tipo !== CONTACTOS_STATE.tipo) return false;
    if (CONTACTOS_STATE.estado && c.estado_pago !== CONTACTOS_STATE.estado) return false;
    if (CONTACTOS_STATE.search) {
      const s = CONTACTOS_STATE.search;
      const matchName = (c.nombre_apellidos || '').toLowerCase().includes(s);
      const matchEmail = (c.correo || '').toLowerCase().includes(s);
      const matchTlf = (c.telefono || '').toLowerCase().includes(s);
      const matchDni = (c.dni || '').toLowerCase().includes(s);
      return matchName || matchEmail || matchTlf || matchDni;
    }
    return true;
  });

  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      No se han encontrado apuntes con estos filtros.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map((c) => {
    let tipoLabel = c.tipo === 'entrada' ? 'Entradas' : 'Bonos';
    let badgeClass = c.tipo === 'entrada' ? 'bg-info' : 'bg-accent';

    let detalles = '';
    if (c.tipo === 'entrada') {
      detalles = `${fmtNum(c.cantidad_entradas || 1)}x ${parqueNombre(c.parque_id)}<br><small style="color:var(--text-muted)">${c.extras ? 'Extras: ' + escapeHtml(c.extras) : 'Sin extras'}</small>`;
    } else {
      detalles = `${fmtNum(c.cantidad_bonos || 1)}x ${bonoNombre(c.bono_id)}<br><small style="color:var(--text-muted)">Nº: ${escapeHtml(c.num_bono)}</small>`;
    }

    let estadoBadge = '';
    if (c.estado_pago === 'pagado') {
      estadoBadge = '<span class="badge on">Pagado</span>';
    } else if (c.estado_pago === 'Apunte rápido') {
      estadoBadge = '<span class="badge neutral">Apunte rápido</span>';
    } else {
      estadoBadge = '<span class="badge off" style="color:var(--accent); border-color:var(--accent)">Pendiente de pago</span>';
    }

    return `
      <tr>
        <td style="white-space:nowrap; color:var(--text-secondary)">${fmtDateShort(c.created_at)}</td>
        <td>
          <b>${escapeHtml(c.nombre_apellidos)}</b><br>
          <small style="color:var(--text-muted)">${escapeHtml(c.correo || '')} ${c.telefono ? '· ' + escapeHtml(c.telefono) : ''}</small>
        </td>
        <td><span class="badge" style="background:var(--bg-hover)">${tipoLabel}</span></td>
        <td>${detalles}</td>
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
}

function openContactoForm(id = null) {
  const c = id ? STATE.contactos.find((x) => x.id === id) : null;
  const initialTipo = c ? c.tipo : 'entrada';

  openModal({
    title: c ? 'Editar apunte' : 'Nuevo apunte',
    bodyHtml: `
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="form-field full">
          <label>Tipo de apunte</label>
          <div style="display:flex; gap:16px;">
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="radio" name="cf-tipo" value="entrada" ${initialTipo === 'entrada' ? 'checked' : ''} style="width:auto"> Entradas
            </label>
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="radio" name="cf-tipo" value="bono" ${initialTipo === 'bono' ? 'checked' : ''} style="width:auto"> Bonos
            </label>
          </div>
        </div>
      </div>
      
      <!-- Campos Comunes -->
      <div class="form-grid">
        <div class="form-field full">
          <label for="cf-nombre">Nombre y apellidos</label>
          <input type="text" id="cf-nombre" value="${escapeHtml(c?.nombre_apellidos || '')}" required>
        </div>
        <div class="form-field">
          <label for="cf-correo">Correo electrónico</label>
          <input type="email" id="cf-correo" value="${escapeHtml(c?.correo || '')}">
        </div>
        <div class="form-field">
          <label for="cf-importe">Importe total (€)</label>
          <input type="number" step="0.01" min="0" id="cf-importe" value="${c?.importe_total || ''}" required>
        </div>
        <div class="form-field full">
          <label for="cf-estado">Estado de pago</label>
          <select id="cf-estado">
            <option value="Apunte rápido" ${(!c || c.estado_pago === 'Apunte rápido') ? 'selected' : ''}>Apunte rápido</option>
            <option value="pendiente" ${c?.estado_pago === 'pendiente' ? 'selected' : ''}>Pendiente de pago</option>
            <option value="pagado" ${c?.estado_pago === 'pagado' ? 'selected' : ''}>Pagado (Sumará a ventas)</option>
          </select>
        </div>
      </div>

      <!-- Campos Entradas -->
      <div id="cf-seccion-entradas" class="form-grid" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
        <div class="form-field">
          <label for="cf-telefono">Teléfono</label>
          <input type="text" id="cf-telefono" value="${escapeHtml(c?.telefono || '')}">
        </div>
        <div class="form-field">
          <label for="cf-parque">Parque</label>
          <select id="cf-parque">
            <option value="">Selecciona un parque...</option>
            ${STATE.parques.filter(p => p.activo !== false).map(p => `<option value="${p.id}" ${c?.parque_id === p.id ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="cf-cantidad-entradas">Cantidad de entradas</label>
          <input type="number" min="1" id="cf-cantidad-entradas" value="${c?.cantidad_entradas || 1}">
        </div>
        <div class="form-field full">
          <label for="cf-extras">Extras (ej. Comida, pase rápido...)</label>
          <input type="text" id="cf-extras" value="${escapeHtml(c?.extras || '')}" placeholder="Opcional">
        </div>
      </div>

      <!-- Campos Bonos -->
      <div id="cf-seccion-bonos" class="form-grid" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border); display:none;">
        <div class="form-field">
          <label for="cf-num-bono">Nº de bono</label>
          <input type="text" id="cf-num-bono" value="${escapeHtml(c?.num_bono || '')}">
        </div>
        <div class="form-field">
          <label for="cf-dni">DNI</label>
          <input type="text" id="cf-dni" value="${escapeHtml(c?.dni || '')}">
        </div>
        <div class="form-field">
          <label for="cf-nacimiento">Fecha de nacimiento</label>
          <input type="date" id="cf-nacimiento" value="${c?.fecha_nacimiento || ''}">
        </div>
        <div class="form-field">
          <label for="cf-bono">Tipo de bono</label>
          <select id="cf-bono">
            <option value="">Selecciona un bono...</option>
            ${STATE.tipos_bono.filter(b => b.activo !== false).map(b => `<option value="${b.id}" ${c?.bono_id === b.id ? 'selected' : ''}>${escapeHtml(b.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="cf-cantidad-bonos">Cantidad de bonos</label>
          <input type="number" min="1" id="cf-cantidad-bonos" value="${c?.cantidad_bonos || 1}">
        </div>
      </div>

      <!-- Anotaciones Comunes -->
      <div class="form-grid" style="margin-top:16px;">
        <div class="form-field full">
          <label for="cf-anotaciones">Anotaciones</label>
          <textarea id="cf-anotaciones" rows="3" placeholder="Apuntes sobre el cliente, pagos pendientes...">${escapeHtml(c?.anotaciones || '')}</textarea>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="cf-cancel">Cancelar</button>
      <button class="btn btn-primary" id="cf-save">${c ? 'Guardar cambios' : 'Crear apunte'}</button>
    `
  });

  const updateFormVisibility = () => {
    const tipo = document.querySelector('input[name="cf-tipo"]:checked').value;
    document.getElementById('cf-seccion-entradas').style.display = tipo === 'entrada' ? 'grid' : 'none';
    document.getElementById('cf-seccion-bonos').style.display = tipo === 'bono' ? 'grid' : 'none';
  };

  document.querySelectorAll('input[name="cf-tipo"]').forEach(el => el.addEventListener('change', updateFormVisibility));
  updateFormVisibility();

  document.getElementById('cf-cancel').addEventListener('click', closeModal);
  document.getElementById('cf-save').addEventListener('click', async () => {
    const tipo = document.querySelector('input[name="cf-tipo"]:checked').value;
    const nombre_apellidos = document.getElementById('cf-nombre').value.trim();
    const importe_total = Number(document.getElementById('cf-importe').value) || 0;
    const estado_pago = document.getElementById('cf-estado').value;

    if (!nombre_apellidos) { toast('El nombre es obligatorio', 'error'); return; }

    let payload = {
      tipo,
      nombre_apellidos,
      correo: document.getElementById('cf-correo').value.trim(),
      importe_total,
      estado_pago,
      anotaciones: document.getElementById('cf-anotaciones').value.trim()
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
      payload.num_bono = document.getElementById('cf-num-bono').value.trim();
      payload.dni = document.getElementById('cf-dni').value.trim();
      const fechaNacimientoValue = document.getElementById('cf-nacimiento').value;
      payload.fecha_nacimiento = fechaNacimientoValue ? fechaNacimientoValue : null;
      payload.bono_id = bono_id;
      payload.cantidad_bonos = Number(document.getElementById('cf-cantidad-bonos').value) || 1;
    }

    // Check if transitioning from unpaid to pagado
    const wasNotPagado = c && c.estado_pago !== 'pagado';
    const isNowPagado = estado_pago === 'pagado';
    const createVenta = (isNowPagado && (!c || wasNotPagado));

    try {
      if (c) {
        await DB.updateContacto(c.id, payload);
        toast('Apunte actualizado', 'success');
      } else {
        await DB.addContacto(payload);
        toast('Apunte creado', 'success');
      }

      if (createVenta && tipo === 'entrada') {
        // Automatically create a venta
        await DB.addVenta({
          fecha: new Date().toISOString(),
          parque_id: payload.parque_id,
          cliente_nombre: payload.nombre_apellidos,
          importe_total: payload.importe_total,
          cantidad: payload.cantidad_entradas
        });
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
          const ventaPayload = {
            fecha: new Date().toISOString(),
            tipo: c.tipo,
            cliente_nombre: c.nombre_apellidos,
            importe_total: c.importe_total
          };

          if (c.tipo === 'entrada') {
            ventaPayload.parque_id = c.parque_id;
            ventaPayload.cantidad = c.cantidad_entradas;
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
