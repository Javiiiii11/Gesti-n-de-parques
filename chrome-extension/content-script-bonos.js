/* ============================================================================
   ParkSite Bonos Rápidos — Content Script de Autocompletado (Estilo Text Blaze)
   Detecta abreviaturas (/1, /2...) y rellena automáticamente los 11 campos del
   formulario de bonos en bonoparques.es y plataformas compatibles.
============================================================================ */

(function () {
  let CACHED_TEMPLATES = {};
  let EXTENSION_CONFIG = {
    enabled: true,
    triggerKey: 'space' // 'space', 'tab', 'enter', 'auto'
  };

  // --------------------------------------------------------------------------
  // CARGA DE PLANTILLAS Y ESCUCHA DE CAMBIOS EN STORAGE
  // --------------------------------------------------------------------------
  function cargarDatosStorage() {
    if (!chrome.runtime || !chrome.runtime.id) return;

    chrome.storage.local.get(['plantillas_bonos', 'config'], (res) => {
      if (res.plantillas_bonos) {
        CACHED_TEMPLATES = res.plantillas_bonos;
      }
      if (res.config) {
        EXTENSION_CONFIG = { ...EXTENSION_CONFIG, ...res.config };
      }
    });
  }

  cargarDatosStorage();

  // Escuchar si se añade/modifica una plantilla en tiempo real desde ParkSite
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.plantillas_bonos) {
          CACHED_TEMPLATES = changes.plantillas_bonos.newValue || {};
        }
        if (changes.config) {
          EXTENSION_CONFIG = { ...EXTENSION_CONFIG, ...(changes.config.newValue || {}) };
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // DETECCIÓN DE ABREVIATURAS AL ESCRIBIR EN CUALQUIER CAMPO
  // --------------------------------------------------------------------------
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('input', handleInput, true);

  function getAbreviaturaDesdeTexto(texto) {
    if (!texto) return null;
    const trimmed = texto.trim();
    // Coincidencia con /1, /2, /bono1, etc.
    const match = trimmed.match(/\/([a-zA-Z0-9_-]+)$/);
    if (!match) return null;

    const abrev = '/' + match[1].toLowerCase();
    if (CACHED_TEMPLATES[abrev]) {
      return CACHED_TEMPLATES[abrev];
    }
    return null;
  }

  function handleKeyDown(e) {
    if (!EXTENSION_CONFIG.enabled) return;

    const target = e.target;
    if (!isEditableElement(target)) return;

    const key = e.key;
    const triggerMode = EXTENSION_CONFIG.triggerKey;

    let isTrigger = false;
    if (triggerMode === 'space' && key === ' ') isTrigger = true;
    else if (triggerMode === 'tab' && key === 'Tab') isTrigger = true;
    else if (triggerMode === 'enter' && key === 'Enter') isTrigger = true;
    else if (triggerMode === 'auto') isTrigger = false; // Se maneja en handleInput

    if (!isTrigger) return;

    const val = target.value || target.textContent || '';
    const plantilla = getAbreviaturaDesdeTexto(val);

    if (plantilla) {
      e.preventDefault(); // Evitar espacio o salto de tabulador indeseado
      ejecutarAutocompletado(target, plantilla);
    }
  }

  function handleInput(e) {
    if (!EXTENSION_CONFIG.enabled) return;
    if (EXTENSION_CONFIG.triggerKey !== 'auto') return;

    const target = e.target;
    if (!isEditableElement(target)) return;

    const val = target.value || target.textContent || '';
    const plantilla = getAbreviaturaDesdeTexto(val);

    if (plantilla) {
      ejecutarAutocompletado(target, plantilla);
    }
  }

  function isEditableElement(el) {
    if (!el) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // --------------------------------------------------------------------------
  // EJECUCIÓN DEL AUTOCOMPLETADO
  // --------------------------------------------------------------------------
  function ejecutarAutocompletado(triggerEl, plantilla) {
    if (!plantilla || !plantilla.datos) return;

    const datos = plantilla.datos;

    // 1. Limpiar la abreviatura del campo en el que se escribió
    const abrevRegex = new RegExp(`\\s*${escapeRegExp(plantilla.abreviatura)}\\s*$`, 'i');
    if (triggerEl.value !== undefined) {
      setNativeValue(triggerEl, triggerEl.value.replace(abrevRegex, ''));
    }

    // 2. Localizar y rellenar los 11 campos en el orden especificado
    const context = triggerEl.form || triggerEl.closest('form') || document;

    let totalRellenados = 0;

    // 1) Email del gestor
    const emailGestorEl = findField(context, [
      'email', 'mail', 'gestor', 'email_gestor', 'manager_email', 'correo', 'txtEmail'
    ], ['email', 'text'], ['email', 'correo']);
    if (emailGestorEl && datos.email_gestor) {
      setNativeValue(emailGestorEl, datos.email_gestor);
      totalRellenados++;
    }

    // 2) Repetir email
    const emailRepetirEl = findRepeatEmailField(context, emailGestorEl);
    if (emailRepetirEl && (datos.email_repetir || datos.email_gestor)) {
      setNativeValue(emailRepetirEl, datos.email_repetir || datos.email_gestor);
      totalRellenados++;
    }

    // 3) Nombre
    const nombreEl = findField(context, [
      'nombre', 'firstname', 'first_name', 'name', 'txtName', 'txtNombre'
    ], ['text'], ['nombre', 'first name']);
    if (nombreEl && datos.nombre) {
      setNativeValue(nombreEl, datos.nombre);
      totalRellenados++;
    }

    // 4) Primer apellido
    const primerApellidoEl = findField(context, [
      'primer_apellido', 'primerapellido', 'apellido1', 'lastname', 'last_name', 'surname', 'txtApellido1', 'primer-apellido'
    ], ['text'], ['primer apellido', 'primer apellido *', 'apellido', 'last name']);
    if (primerApellidoEl && datos.primer_apellido) {
      setNativeValue(primerApellidoEl, datos.primer_apellido);
      totalRellenados++;
    }

    // 5) Segundo apellido
    const segundoApellidoEl = findField(context, [
      'segundo_apellido', 'segundoapellido', 'apellido2', 'second_lastname', 'txtApellido2', 'segundo-apellido'
    ], ['text'], ['segundo apellido']);
    if (segundoApellidoEl && datos.segundo_apellido) {
      setNativeValue(segundoApellidoEl, datos.segundo_apellido);
      totalRellenados++;
    }

    // 6) Día de nacimiento (DD)
    const diaEl = findBirthField(context, ['dia', 'day', 'birth_day', 'dd', 'fechanacimiento_dia', 'birthday_day'], 'dia');
    if (diaEl && datos.dia_nacimiento) {
      setBirthDayValue(diaEl, datos.dia_nacimiento);
      totalRellenados++;
    }

    // 7) Mes de nacimiento (MM)
    const mesEl = findBirthField(context, ['mes', 'month', 'birth_month', 'mm', 'fechanacimiento_mes', 'birthday_month'], 'mes');
    if (mesEl && datos.mes_nacimiento) {
      setBirthMonthValue(mesEl, datos.mes_nacimiento);
      totalRellenados++;
    }

    // 8) Año de nacimiento (AAAA)
    const anioEl = findBirthField(context, ['anio', 'ano', 'year', 'birth_year', 'yyyy', 'aaaa', 'fechanacimiento_ano', 'birthday_year'], 'anio');
    if (anioEl && datos.anio_nacimiento) {
      setBirthYearValue(anioEl, datos.anio_nacimiento);
      totalRellenados++;
    }

    // Caso alternativo: si la fecha está en un único campo input[type="date"]
    if (!diaEl && !mesEl && !anioEl) {
      const fechaUnicaEl = findField(context, ['fecha_nacimiento', 'birthdate', 'birth_date', 'fecnac'], ['date', 'text'], ['fecha de nacimiento', 'nacimiento']);
      if (fechaUnicaEl) {
        const d = String(datos.dia_nacimiento || '').padStart(2, '0');
        const m = String(datos.mes_nacimiento || '').padStart(2, '0');
        const y = datos.anio_nacimiento || '2000';
        setNativeValue(fechaUnicaEl, `${y}-${m}-${d}`);
        totalRellenados++;
      }
    }

    // 9) Tipo de documento
    const tipoDocSet = setTipoDocumento(context, datos.tipo_documento);
    if (tipoDocSet) totalRellenados++;

    // 10) Número de documento
    const numDocEl = findField(context, [
      'documento', 'num_documento', 'numero_documento', 'dni', 'nif', 'nie', 'passport', 'id_number', 'txtDni', 'txtDocumento'
    ], ['text'], ['documento', 'nº documento', 'número de documento', 'dni', 'nif', 'nie']);
    if (numDocEl && datos.numero_documento) {
      setNativeValue(numDocEl, datos.numero_documento);
      totalRellenados++;
    }

    // 11) Checkbox "Copiar información para detalles de facturación"
    const checkboxFacturacion = findBillingCheckbox(context);
    if (checkboxFacturacion) {
      setCheckboxValue(checkboxFacturacion, Boolean(datos.copiar_facturacion));
      totalRellenados++;
    }

    // 3. Notificación flotante de éxito en la web
    mostrarBadgeExito(plantilla, totalRellenados);
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA DE CAMPOS ROBUSTA (CASCADA DE SELECTORES Y LABELS)
  // --------------------------------------------------------------------------
  function findField(root, tokens, types = ['text'], labelTexts = []) {
    // 1. Búsqueda por selectores de ID o NAME directos
    for (const t of tokens) {
      const el = root.querySelector(`input#${t}, input[name="${t}"], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    // 2. Búsqueda por placeholder
    for (const t of tokens) {
      const el = root.querySelector(`input[placeholder*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    // 3. Búsqueda por texto en <label>
    if (labelTexts && labelTexts.length > 0) {
      const labels = root.querySelectorAll('label');
      for (const lbl of labels) {
        const text = (lbl.textContent || '').toLowerCase();
        for (const lt of labelTexts) {
          if (text.includes(lt.toLowerCase())) {
            // Check for label[for]
            const forId = lbl.getAttribute('for');
            if (forId) {
              const el = document.getElementById(forId);
              if (el && isVisible(el)) return el;
            }
            // Check for input inside label
            const inner = lbl.querySelector('input');
            if (inner && isVisible(inner)) return inner;

            // Check next sibling
            let next = lbl.nextElementSibling;
            while (next) {
              if (next.tagName.toLowerCase() === 'input' && isVisible(next)) return next;
              const sub = next.querySelector('input');
              if (sub && isVisible(sub)) return sub;
              next = next.nextElementSibling;
            }
          }
        }
      }
    }

    return null;
  }

  function findRepeatEmailField(root, firstEmailEl) {
    // Buscar inputs con palabras como repetir, repeat, confirm
    const tokens = ['repetir', 'repeat', 'confirm', 'email2', 'email_confirm', 'email_repeat', 'repite'];
    for (const t of tokens) {
      const el = root.querySelector(`input[id*="${t}" i], input[name*="${t}" i], input[placeholder*="${t}" i]`);
      if (el && el !== firstEmailEl && isVisible(el)) return el;
    }

    // Si no tiene nombre explícito, buscar el segundo input de tipo email en el formulario
    const allEmails = Array.from(root.querySelectorAll('input[type="email"], input[name*="email" i]')).filter(isVisible);
    if (allEmails.length >= 2) {
      if (firstEmailEl && allEmails[0] === firstEmailEl) {
        return allEmails[1];
      }
      return allEmails[1];
    }

    return null;
  }

  function findBirthField(root, tokens, tipo) {
    // Buscar select o input
    for (const t of tokens) {
      const el = root.querySelector(`select[id*="${t}" i], select[name*="${t}" i], input[id*="${t}" i], input[name*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    // Buscar por label
    const labels = root.querySelectorAll('label');
    for (const lbl of labels) {
      const text = (lbl.textContent || '').toLowerCase().trim();
      if ((tipo === 'dia' && (text === 'día' || text === 'dia' || text.startsWith('día') || text.startsWith('dia'))) ||
          (tipo === 'mes' && (text === 'mes' || text.startsWith('mes'))) ||
          (tipo === 'anio' && (text === 'año' || text === 'ano' || text.startsWith('año') || text.startsWith('ano')))) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el && isVisible(el)) return el;
        }
        const inner = lbl.querySelector('select, input');
        if (inner && isVisible(inner)) return inner;
        let next = lbl.nextElementSibling;
        if (next && (next.tagName === 'SELECT' || next.tagName === 'INPUT')) return next;
      }
    }

    return null;
  }

  function findBillingCheckbox(root) {
    const tokens = ['factura', 'facturacion', 'billing', 'copiar', 'mismos_datos', 'same_address'];
    for (const t of tokens) {
      const el = root.querySelector(`input[type="checkbox"][id*="${t}" i], input[type="checkbox"][name*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    const labels = root.querySelectorAll('label');
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').toLowerCase();
      if (txt.includes('facturación') || txt.includes('facturacion') || txt.includes('detalles de facturación') || txt.includes('billing')) {
        const inner = lbl.querySelector('input[type="checkbox"]');
        if (inner && isVisible(inner)) return inner;
        const forId = lbl.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el && isVisible(el)) return el;
        }
      }
    }

    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  // --------------------------------------------------------------------------
  // ASIGNACIÓN INTELIGENTE DE VALORES DISPARANDO EVENTOS NATIVOS
  // --------------------------------------------------------------------------
  function setNativeValue(el, val) {
    if (!el || val === undefined || val === null) return;

    try {
      // Usar el setter del prototipo nativo para que React / Angular / Vue detecten el cambio
      const tag = el.tagName.toLowerCase();
      const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(el, val);
      } else {
        el.value = val;
      }
    } catch (e) {
      el.value = val;
    }

    // Disparar eventos con burbujeo completo
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setBirthDayValue(el, dia) {
    const dNum = parseInt(dia, 10);
    const dStr2 = String(dNum).padStart(2, '0');
    const dStr1 = String(dNum);

    if (el.tagName.toLowerCase() === 'select') {
      let found = false;
      for (const opt of el.options) {
        const v = (opt.value || '').trim();
        const t = (opt.text || '').trim();
        if (v === dStr2 || v === dStr1 || t === dStr2 || t === dStr1) {
          el.value = opt.value;
          found = true;
          break;
        }
      }
      if (!found) el.value = dStr2;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setNativeValue(el, dStr2);
    }
  }

  function setBirthMonthValue(el, mes) {
    const mNum = parseInt(mes, 10);
    const mStr2 = String(mNum).padStart(2, '0');
    const mStr1 = String(mNum);
    const mesesNombres = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const nombreMes = (mesesNombres[mNum - 1] || '').toLowerCase();

    if (el.tagName.toLowerCase() === 'select') {
      let found = false;
      for (const opt of el.options) {
        const v = (opt.value || '').trim().toLowerCase();
        const t = (opt.text || '').trim().toLowerCase();
        if (v === mStr2 || v === mStr1 || t.includes(nombreMes) || v.includes(nombreMes)) {
          el.value = opt.value;
          found = true;
          break;
        }
      }
      if (!found) el.value = mStr2;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setNativeValue(el, mStr2);
    }
  }

  function setBirthYearValue(el, anio) {
    const yStr = String(anio).trim();
    if (el.tagName.toLowerCase() === 'select') {
      for (const opt of el.options) {
        if (opt.value.trim() === yStr || opt.text.trim() === yStr) {
          el.value = opt.value;
          break;
        }
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      setNativeValue(el, yStr);
    }
  }

  function setTipoDocumento(root, tipoDeseado = 'DNI') {
    const norm = (tipoDeseado || 'DNI').toUpperCase();

    // 1. Si es un <select>
    const selects = root.querySelectorAll('select[id*="doc" i], select[name*="doc" i], select[id*="tipo" i], select[name*="tipo" i]');
    for (const sel of selects) {
      if (isVisible(sel)) {
        for (const opt of sel.options) {
          const txt = (opt.text || '').toUpperCase();
          const val = (opt.value || '').toUpperCase();
          if (txt.includes(norm) || val.includes(norm)) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
    }

    // 2. Si son radios
    const radios = root.querySelectorAll('input[type="radio"]');
    for (const rad of radios) {
      const parentTxt = (rad.closest('label') || rad.parentElement || {}).textContent || '';
      const val = (rad.value || '').toUpperCase();
      if (val.includes(norm) || parentTxt.toUpperCase().includes(norm)) {
        rad.checked = true;
        rad.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  function setCheckboxValue(el, checked) {
    if (!el) return;
    el.checked = checked;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function escapeRegExp(string) {
    return (string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --------------------------------------------------------------------------
  // FEEDBACK VISUAL: TOAST FLOTANTE NO INTRUSIVO
  // --------------------------------------------------------------------------
  function mostrarBadgeExito(plantilla, totalCampos) {
    const id = 'parksite-quick-badge';
    let badge = document.getElementById(id);
    if (badge) badge.remove();

    badge = document.createElement('div');
    badge.id = id;
    const d = plantilla.datos || {};
    const titular = `${d.nombre || ''} ${d.primer_apellido || ''}`.trim() || 'Titular';

    badge.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px; line-height:1;">⚡</span>
        <div>
          <div style="font-weight:700; font-size:13.5px; color:#ffffff; display:flex; align-items:center; gap:6px;">
            <span>ParkSite: Formulario completado</span>
            <span style="background:rgba(0,198,255,0.25); color:#00e5ff; font-size:11px; padding:1px 6px; border-radius:4px; font-weight:800;">${plantilla.abreviatura}</span>
          </div>
          <div style="font-size:12px; color:rgba(255,255,255,0.85); margin-top:2px;">
            ${titular} (${d.numero_documento || 'Doc'}) — ${totalCampos} campos rellenados.
          </div>
        </div>
      </div>
    `;

    Object.assign(badge.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '2147483647',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
      color: '#ffffff',
      padding: '12px 18px',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.45), 0 0 1px 1px rgba(0,198,255,0.5)',
      border: '1px solid rgba(0,198,255,0.4)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      transform: 'translateY(-10px)',
      opacity: '0',
      pointerEvents: 'none'
    });

    document.body.appendChild(badge);

    // Animación de entrada
    requestAnimationFrame(() => {
      badge.style.transform = 'translateY(0)';
      badge.style.opacity = '1';
    });

    // Desvanecer tras 3.8s
    setTimeout(() => {
      badge.style.transform = 'translateY(-10px)';
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 350);
    }, 3800);
  }
})();

