/* ============================================================================
   bonos-rapidos.js — Formulario de Bonos y enlace con Extensión Chrome
   Permite guardar formularios de bonos completos con abreviaturas (/1, /2...)
   para rellenarlos automáticamente en bonoparques.es y compatibles.
============================================================================ */

let BONOS_RAPIDOS_STATE = {
  plantillas: [],
  extensionConectada: false,
  extensionVersion: null,
  filtroBusqueda: ''
};

// ----------------------------------------------------------------------------
// INICIALIZACIÓN DE LA VISTA
// ----------------------------------------------------------------------------
async function initBonosRapidosView() {
  cargarDiasMesesAnios();
  cablearFormularioBonosRapidos();
  cablearComunicacionExtension();
  await cargarPlantillasBonos();
  renderPlantillasBonosList();
  verificarExtensionPing();
}

// ----------------------------------------------------------------------------
// CARGA DE SELECTORES DE FECHA
// ----------------------------------------------------------------------------
function cargarDiasMesesAnios() {
  const selectDia = document.getElementById('br-dia');
  const selectMes = document.getElementById('br-mes');
  const selectAnio = document.getElementById('br-anio');

  if (selectDia && selectDia.children.length <= 1) {
    selectDia.innerHTML = '<option value="">Día</option>';
    for (let d = 1; d <= 31; d++) {
      const val = String(d).padStart(2, '0');
      selectDia.innerHTML += `<option value="${val}">${val}</option>`;
    }
  }

  if (selectMes && selectMes.children.length <= 1) {
    const meses = [
      '01 - Enero', '02 - Febrero', '03 - Marzo', '04 - Abril',
      '05 - Mayo', '06 - Junio', '07 - Julio', '08 - Agosto',
      '09 - Septiembre', '10 - Octubre', '11 - Noviembre', '12 - Diciembre'
    ];
    selectMes.innerHTML = '<option value="">Mes</option>';
    meses.forEach((m, idx) => {
      const val = String(idx + 1).padStart(2, '0');
      selectMes.innerHTML += `<option value="${val}">${m}</option>`;
    });
  }

  if (selectAnio && selectAnio.children.length <= 1) {
    const anioActual = new Date().getFullYear();
    selectAnio.innerHTML = '<option value="">Año</option>';
    for (let y = anioActual; y >= 1920; y--) {
      selectAnio.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }
}

// ----------------------------------------------------------------------------
// RECOPILAR Y VALIDAR DATOS DEL FORMULARIO
// ----------------------------------------------------------------------------
function getDatosFormularioBono() {
  const emailGestor = (document.getElementById('br-email-gestor')?.value || '').trim();
  const emailRepetir = (document.getElementById('br-email-repetir')?.value || '').trim();
  const nombre = (document.getElementById('br-nombre')?.value || '').trim();
  const primerApellido = (document.getElementById('br-primer-apellido')?.value || '').trim();
  const segundoApellido = (document.getElementById('br-segundo-apellido')?.value || '').trim();
  const dia = document.getElementById('br-dia')?.value || '';
  const mes = document.getElementById('br-mes')?.value || '';
  const anio = document.getElementById('br-anio')?.value || '';
  const tipoDoc = document.getElementById('br-tipo-documento')?.value || 'DNI';
  const numDoc = (document.getElementById('br-num-documento')?.value || '').trim().toUpperCase();
  const copiarFacturacion = Boolean(document.getElementById('br-copiar-facturacion')?.checked);

  return {
    emailGestor,
    emailRepetir,
    nombre,
    primerApellido,
    segundoApellido,
    dia,
    mes,
    anio,
    tipoDoc,
    numDoc,
    copiarFacturacion
  };
}

function validarDatosFormularioBono(datos) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!datos.emailGestor) {
    return { ok: false, msg: 'Introduce el email del gestor' };
  }
  if (!emailRegex.test(datos.emailGestor)) {
    return { ok: false, msg: 'El email del gestor no tiene un formato válido' };
  }
  if (!datos.emailRepetir) {
    return { ok: false, msg: 'Repite el email del gestor' };
  }
  if (datos.emailGestor.toLowerCase() !== datos.emailRepetir.toLowerCase()) {
    return { ok: false, msg: 'Los dos correos electrónicos no coinciden' };
  }
  if (!datos.nombre) {
    return { ok: false, msg: 'Introduce el nombre del titular' };
  }
  if (!datos.primerApellido) {
    return { ok: false, msg: 'Introduce el primer apellido del titular' };
  }
  if (!datos.dia || !datos.mes || !datos.anio) {
    return { ok: false, msg: 'Completa la fecha de nacimiento (día, mes y año)' };
  }
  if (!datos.numDoc) {
    return { ok: false, msg: 'Introduce el número de documento (' + datos.tipoDoc + ')' };
  }

  return { ok: true };
}

// ----------------------------------------------------------------------------
// SUGERIR SIGUIENTE ABREVIATURA LIBRE (/1, /2, /3...)
// ----------------------------------------------------------------------------
function sugerirSiguienteAbreviatura() {
  const plantillas = BONOS_RAPIDOS_STATE.plantillas || [];
  const usadas = new Set(plantillas.map(p => (p.abreviatura || '').toLowerCase().trim()));
  for (let i = 1; i <= 99; i++) {
    const candidate = `/${i}`;
    if (!usadas.has(candidate)) {
      return candidate;
    }
  }
  return `/${plantillas.length + 1}`;
}

// ----------------------------------------------------------------------------
// CABLEADO DEL FORMULARIO Y BOTONES
// ----------------------------------------------------------------------------
function cablearFormularioBonosRapidos() {
  const btnPasarExtension = document.getElementById('br-btn-pasar-extension');
  const btnLimpiar = document.getElementById('br-btn-limpiar');
  const btnEjemplo = document.getElementById('br-btn-ejemplo');
  const inputBuscar = document.getElementById('br-buscar-plantillas');

  if (btnPasarExtension && !btnPasarExtension.dataset.wired) {
    btnPasarExtension.dataset.wired = 'true';
    btnPasarExtension.addEventListener('click', onClicPasarAExtension);
  }

  if (btnLimpiar && !btnLimpiar.dataset.wired) {
    btnLimpiar.dataset.wired = 'true';
    btnLimpiar.addEventListener('click', limpiarFormularioBono);
  }

  if (btnEjemplo && !btnEjemplo.dataset.wired) {
    btnEjemplo.dataset.wired = 'true';
    btnEjemplo.addEventListener('click', rellenarConDatosEjemplo);
  }

  if (inputBuscar && !inputBuscar.dataset.wired) {
    inputBuscar.dataset.wired = 'true';
    inputBuscar.addEventListener('input', (e) => {
      BONOS_RAPIDOS_STATE.filtroBusqueda = (e.target.value || '').toLowerCase().trim();
      renderPlantillasBonosList();
    });
  }
}

// ----------------------------------------------------------------------------
// ACCIÓN: PASAR A EXTENSIÓN
// ----------------------------------------------------------------------------
function onClicPasarAExtension() {
  const datos = getDatosFormularioBono();
  const validacion = validarDatosFormularioBono(datos);

  if (!validacion.ok) {
    toast(validacion.msg, 'error');
    return;
  }

  const abrevSugerida = sugerirSiguienteAbreviatura();
  const descSugerida = `Bono ${datos.nombre} ${datos.primerApellido}`;

  openModal({
    title: '⚡ Pasar formulario a la extensión',
    width: '540px',
    bodyHtml: `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:rgba(0,198,255,0.08); border:1px solid rgba(0,198,255,0.25); border-radius:var(--radius-m); padding:12px 14px;">
          <p style="margin:0; font-size:13px; color:var(--text-secondary); line-height:1.5;">
            Asigna una abreviatura única para este formulario. Cuando estés en <strong style="color:var(--text-primary);">bonoparques.es</strong>, bastará con escribir esta abreviatura (ej. <code style="color:var(--accent);">${abrevSugerida}</code>) y pulsar espacio para rellenar todos los campos al instante.
          </p>
        </div>

        <div class="form-grid" style="grid-template-columns: 140px 1fr; gap:12px;">
          <div class="form-field">
            <label for="br-modal-abrev" style="font-weight:700;">Abreviatura *</label>
            <input type="text" id="br-modal-abrev" value="${abrevSugerida}" placeholder="/1" style="font-weight:700; font-size:15px; color:var(--accent); text-align:center;">
          </div>
          <div class="form-field">
            <label for="br-modal-desc">Descripción (opcional)</label>
            <input type="text" id="br-modal-desc" value="${escapeHtml(descSugerida)}" placeholder="Ej. Bono Javier familiar">
          </div>
        </div>

        <div id="br-modal-warning" style="display:none; background:rgba(255,170,0,0.12); border:1px solid rgba(255,170,0,0.35); border-radius:var(--radius-m); padding:10px 12px; font-size:12px; color:#ffb84d;">
          ⚠️ Ya existe una plantilla con esta abreviatura. Al guardar se sobrescribirá con estos nuevos datos.
        </div>

        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-m); padding:12px; font-size:12px; display:flex; flex-direction:column; gap:6px;">
          <div style="font-weight:600; color:var(--text-muted); text-transform:uppercase; font-size:11px; margin-bottom:4px;">Resumen del formulario a guardar:</div>
          <div>👤 <strong>Titular:</strong> ${escapeHtml(datos.nombre)} ${escapeHtml(datos.primerApellido)} ${escapeHtml(datos.segundoApellido)}</div>
          <div>✉️ <strong>Email gestor:</strong> ${escapeHtml(datos.emailGestor)}</div>
          <div>🎂 <strong>Fecha nacimiento:</strong> ${datos.dia}/${datos.mes}/${datos.anio}</div>
          <div>🪪 <strong>Documento:</strong> ${datos.tipoDoc} - ${escapeHtml(datos.numDoc)}</div>
          <div>🧾 <strong>Copiar facturación:</strong> ${datos.copiarFacturacion ? 'Sí (marcado)' : 'No'}</div>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="br-modal-btn-confirm" style="gap:6px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px; height:15px;">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        Guardar en extensión
      </button>
    `
  });

  const inputAbrev = document.getElementById('br-modal-abrev');
  const warningEl = document.getElementById('br-modal-warning');
  const btnConfirm = document.getElementById('br-modal-btn-confirm');

  const checkAbrevDuplicada = () => {
    let val = (inputAbrev?.value || '').trim();
    if (val && !val.startsWith('/')) {
      val = '/' + val;
    }
    const existe = (BONOS_RAPIDOS_STATE.plantillas || []).some(
      p => (p.abreviatura || '').toLowerCase() === val.toLowerCase()
    );
    if (warningEl) warningEl.style.display = existe ? 'block' : 'none';
  };

  inputAbrev?.addEventListener('input', checkAbrevDuplicada);
  checkAbrevDuplicada();

  btnConfirm?.addEventListener('click', async () => {
    let abrev = (inputAbrev?.value || '').trim();
    if (!abrev) {
      toast('Debes indicar una abreviatura (ej: /1)', 'error');
      return;
    }
    if (!abrev.startsWith('/')) {
      abrev = '/' + abrev;
    }

    const desc = (document.getElementById('br-modal-desc')?.value || '').trim();

    const plantilla = {
      abreviatura: abrev,
      descripcion: desc,
      datos: {
        email_gestor: datos.emailGestor,
        email_repetir: datos.emailRepetir,
        nombre: datos.nombre,
        primer_apellido: datos.primerApellido,
        segundo_apellido: datos.segundoApellido,
        dia_nacimiento: datos.dia,
        mes_nacimiento: datos.mes,
        anio_nacimiento: datos.anio,
        tipo_documento: datos.tipoDoc,
        numero_documento: datos.numDoc,
        copiar_facturacion: datos.copiarFacturacion
      },
      updated_at: new Date().toISOString()
    };

    // 1. Guardar en Base de Datos / LocalStorage de ParkSite
    try {
      await DB.savePlantillaBono(plantilla);
    } catch (e) {
      console.warn('Error guardando plantilla en DB:', e);
    }

    // 2. Enviar a la extensión Chrome mediante evento seguro de ventana
    window.postMessage({
      type: 'PARKSITE_SAVE_TEMPLATE',
      payload: plantilla
    }, '*');

    closeModal();
    toast(`⚡ Plantilla ${abrev} guardada y enviada a la extensión`, 'success', 4000);

    await cargarPlantillasBonos();
    renderPlantillasBonosList();
  });
}

// ----------------------------------------------------------------------------
// LIMPIAR FORMULARIO
// ----------------------------------------------------------------------------
function limpiarFormularioBono() {
  const ids = [
    'br-email-gestor', 'br-email-repetir', 'br-nombre',
    'br-primer-apellido', 'br-segundo-apellido', 'br-dia',
    'br-mes', 'br-anio', 'br-num-documento'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const tipoDoc = document.getElementById('br-tipo-documento');
  if (tipoDoc) tipoDoc.value = 'DNI';

  const checkFacturacion = document.getElementById('br-copiar-facturacion');
  if (checkFacturacion) checkFacturacion.checked = true;

  toast('Formulario limpio', 'info');
}

// ----------------------------------------------------------------------------
// RELLENAR CON DATOS DE EJEMPLO
// ----------------------------------------------------------------------------
function rellenarConDatosEjemplo() {
  document.getElementById('br-email-gestor').value = 'gestor.ventas@parques.es';
  document.getElementById('br-email-repetir').value = 'gestor.ventas@parques.es';
  document.getElementById('br-nombre').value = 'Javier';
  document.getElementById('br-primer-apellido').value = 'Rodríguez';
  document.getElementById('br-segundo-apellido').value = 'Jiménez';
  document.getElementById('br-dia').value = '15';
  document.getElementById('br-mes').value = '05';
  document.getElementById('br-anio').value = '1995';
  document.getElementById('br-tipo-documento').value = 'DNI';
  document.getElementById('br-num-documento').value = '12345678Z';
  document.getElementById('br-copiar-facturacion').checked = true;

  toast('Datos de ejemplo cargados en el formulario', 'info');
}

// ----------------------------------------------------------------------------
// GESTIÓN DE PLANTILLAS GUARDADAS (CARGA Y RENDER)
// ----------------------------------------------------------------------------
async function cargarPlantillasBonos() {
  try {
    const plantillas = await DB.getPlantillasBonos();
    BONOS_RAPIDOS_STATE.plantillas = plantillas || [];
  } catch (err) {
    console.error('Error cargando plantillas de bonos:', err);
    BONOS_RAPIDOS_STATE.plantillas = [];
  }
}

function renderPlantillasBonosList() {
  const container = document.getElementById('br-plantillas-container');
  const countEl = document.getElementById('br-plantillas-count');
  if (!container) return;

  let list = BONOS_RAPIDOS_STATE.plantillas || [];
  const query = BONOS_RAPIDOS_STATE.filtroBusqueda;

  if (query) {
    list = list.filter(p => {
      const d = p.datos || {};
      const txt = [
        p.abreviatura,
        p.descripcion,
        d.nombre,
        d.primer_apellido,
        d.segundo_apellido,
        d.numero_documento,
        d.email_gestor
      ].join(' ').toLowerCase();
      return txt.includes(query);
    });
  }

  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--text-muted); background:var(--bg-card); border:1px dashed var(--border); border-radius:var(--radius-m);">
        <div style="font-size:28px; margin-bottom:8px;">⚡</div>
        <div style="font-weight:600; font-size:14px; color:var(--text-primary); margin-bottom:4px;">
          ${query ? 'No hay plantillas que coincidan con la búsqueda' : 'No hay plantillas guardadas todavía'}
        </div>
        <div style="font-size:12px;">
          ${query ? 'Prueba con otra palabra o borra el buscador.' : 'Rellena el formulario arriba y pulsa «⚡ Pasar a extensión» para crear la primera (ej. /1).'}
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:14px;">
      ${list.map(p => {
        const d = p.datos || {};
        return `
          <div class="card" style="margin:0; padding:16px; border:1px solid var(--border); border-left:4px solid var(--accent); display:flex; flex-direction:column; justify-content:space-between; gap:12px; transition:transform 0.15s ease, box-shadow 0.15s ease;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="display:inline-block; font-weight:800; font-size:15px; color:var(--accent); background:rgba(0,198,255,0.12); padding:3px 10px; border-radius:6px; border:1px solid rgba(0,198,255,0.3);">
                    ${escapeHtml(p.abreviatura)}
                  </span>
                  <span style="font-weight:600; font-size:13px; color:var(--text-primary);">
                    ${escapeHtml(p.descripcion || `${d.nombre || ''} ${d.primer_apellido || ''}`)}
                  </span>
                </div>
                <button class="btn btn-ghost btn-sm danger" onclick="eliminarPlantillaBono('${escapeHtml(p.abreviatura)}')" title="Eliminar plantilla" style="padding:4px 8px;">
                  🗑️
                </button>
              </div>

              <div style="font-size:12px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
                <div>👤 <strong>Titular:</strong> ${escapeHtml(d.nombre || '')} ${escapeHtml(d.primer_apellido || '')} ${escapeHtml(d.segundo_apellido || '')}</div>
                <div>🪪 <strong>Doc:</strong> ${escapeHtml(d.tipo_documento || 'DNI')}: ${escapeHtml(d.numero_documento || '—')}</div>
                <div>✉️ <strong>Email:</strong> ${escapeHtml(d.email_gestor || '—')}</div>
                <div>🎂 <strong>Nacimiento:</strong> ${d.dia_nacimiento || '--'}/${d.mes_nacimiento || '--'}/${d.anio_nacimiento || '----'}</div>
                <div>🧾 <strong>Facturación:</strong> ${d.copiar_facturacion ? 'Copia activada' : 'No'}</div>
              </div>
            </div>

            <div style="display:flex; gap:8px; border-top:1px solid var(--border); padding-top:10px; margin-top:2px;">
              <button class="btn btn-secondary btn-sm" onclick="cargarPlantillaEnFormulario('${escapeHtml(p.abreviatura)}')" style="flex:1; font-size:12px; gap:4px;">
                ✏️ Cargar en formulario
              </button>
              <button class="btn btn-ghost btn-sm" onclick="copiarAbreviatura('${escapeHtml(p.abreviatura)}')" title="Copiar abreviatura" style="font-size:12px;">
                📋 Copiar
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ----------------------------------------------------------------------------
// ACCIONES INDIVIDUALES DE PLANTILLA
// ----------------------------------------------------------------------------
function cargarPlantillaEnFormulario(abreviatura) {
  const p = (BONOS_RAPIDOS_STATE.plantillas || []).find(item => item.abreviatura === abreviatura);
  if (!p || !p.datos) return;

  const d = p.datos;
  document.getElementById('br-email-gestor').value = d.email_gestor || '';
  document.getElementById('br-email-repetir').value = d.email_repetir || d.email_gestor || '';
  document.getElementById('br-nombre').value = d.nombre || '';
  document.getElementById('br-primer-apellido').value = d.primer_apellido || '';
  document.getElementById('br-segundo-apellido').value = d.segundo_apellido || '';
  document.getElementById('br-dia').value = d.dia_nacimiento || '';
  document.getElementById('br-mes').value = d.mes_nacimiento || '';
  document.getElementById('br-anio').value = d.anio_nacimiento || '';
  document.getElementById('br-tipo-documento').value = d.tipo_documento || 'DNI';
  document.getElementById('br-num-documento').value = d.numero_documento || '';
  document.getElementById('br-copiar-facturacion').checked = Boolean(d.copiar_facturacion);

  toast(`Plantilla ${abreviatura} cargada en el formulario`, 'info');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function copiarAbreviatura(abreviatura) {
  navigator.clipboard.writeText(abreviatura).then(() => {
    toast(`Abreviatura ${abreviatura} copiada al portapapeles`, 'success');
  }).catch(() => {
    toast(`No se pudo copiar ${abreviatura}`, 'error');
  });
}

async function eliminarPlantillaBono(abreviatura) {
  if (!confirm(`¿Seguro que quieres eliminar la plantilla ${abreviatura}?`)) {
    return;
  }

  try {
    await DB.deletePlantillaBono(abreviatura);
    
    // Notificar a la extensión
    window.postMessage({
      type: 'PARKSITE_DELETE_TEMPLATE',
      payload: { abreviatura }
    }, '*');

    toast(`Plantilla ${abreviatura} eliminada`, 'info');
    await cargarPlantillasBonos();
    renderPlantillasBonosList();
  } catch (err) {
    toast('Error eliminando plantilla: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// COMUNICACIÓN CON LA EXTENSIÓN CHROME
// ----------------------------------------------------------------------------
function cablearComunicacionExtension() {
  if (window._PARKSITE_EXT_WIRED) return;
  window._PARKSITE_EXT_WIRED = true;

  window.addEventListener('message', async (event) => {
    // Escuchar mensajes provenientes de la ventana (inyectados por content script)
    if (!event.data || typeof event.data !== 'object') return;

    const { type, version, payload } = event.data;

    // 1. Extensión detectada / handshake
    if (type === 'PARKSITE_EXTENSION_READY' || type === 'PARKSITE_PONG') {
      BONOS_RAPIDOS_STATE.extensionConectada = true;
      BONOS_RAPIDOS_STATE.extensionVersion = version || '1.0.0';
      actualizarBadgeEstadoExtension();
    }

    // 2. Extensión solicita las plantillas actuales para sincronizarse
    if (type === 'PARKSITE_REQUEST_SYNC') {
      const plantillas = await DB.getPlantillasBonos();
      window.postMessage({
        type: 'PARKSITE_SYNC_RESPONSE',
        payload: plantillas
      }, '*');
    }

    // 3. Confirmación de plantilla guardada por el background de la extensión
    if (type === 'PARKSITE_SAVE_SUCCESS') {
      BONOS_RAPIDOS_STATE.extensionConectada = true;
      actualizarBadgeEstadoExtension();
    }
  });
}

function verificarExtensionPing() {
  // Emitir un ping para que el content script responda si está inyectado
  window.postMessage({ type: 'PARKSITE_PING' }, '*');
  setTimeout(() => {
    actualizarBadgeEstadoExtension();
  }, 400);
}

function actualizarBadgeEstadoExtension() {
  const badge = document.getElementById('br-extension-status-badge');
  if (!badge) return;

  if (BONOS_RAPIDOS_STATE.extensionConectada) {
    badge.className = 'br-status-badge connected';
    badge.innerHTML = `
      <span class="br-status-dot"></span>
      <span>Extensión Chrome conectada (v${BONOS_RAPIDOS_STATE.extensionVersion || '1.0'})</span>
    `;
    badge.title = 'La extensión está activa y sincronizada con ParkSite';
  } else {
    badge.className = 'br-status-badge disconnected';
    badge.innerHTML = `
      <span class="br-status-dot"></span>
      <span>Esperando extensión Chrome</span>
    `;
    badge.title = 'Asegúrate de tener instalada la extensión en chrome://extensions';
  }
}

// Exportar globalmente para que utils y app puedan invocar
window.initBonosRapidosView = initBonosRapidosView;
window.cargarPlantillaEnFormulario = cargarPlantillaEnFormulario;
window.copiarAbreviatura = copiarAbreviatura;
window.eliminarPlantillaBono = eliminarPlantillaBono;
window.limpiarFormularioBono = limpiarFormularioBono;

