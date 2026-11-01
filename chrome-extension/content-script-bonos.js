/* ============================================================================
   ParkSite Bonos Rápidos — Content Script de Autocompletado (Estilo Text Blaze)
   Detecta abreviaturas (/1, /2...) y rellena automáticamente los campos del
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
    const trimmed = String(texto).trim();
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
    else if (triggerMode === 'auto') isTrigger = false;

    if (!isTrigger) return;

    const val = target.value || target.textContent || '';
    const plantilla = getAbreviaturaDesdeTexto(val);

    if (plantilla) {
      e.preventDefault();
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

    const context = triggerEl.form || triggerEl.closest('form') || document;
    let totalRellenados = 0;

    // 1) Email del gestor
    const emailGestorEl = findField(context, [
      'email', 'mail', 'gestor', 'email_gestor', 'manager_email', 'correo', 'txtEmail', 'user_email'
    ], ['email', 'text'], ['email', 'correo', 'e-mail']);

    const emailVal = datos.email_gestor || datos.email_repetir || '';
    if (emailGestorEl && emailVal) {
      setNativeValue(emailGestorEl, emailVal);
      totalRellenados++;
    }

    // 2) Repetir email (rellena automáticamente el mismo email)
    const emailRepetirEl = findRepeatEmailField(context, emailGestorEl);
    if (emailRepetirEl && emailVal) {
      setNativeValue(emailRepetirEl, emailVal);
      totalRellenados++;
    }

    // 3) Nombre
    const nombreEl = findNombreField(context);
    if (nombreEl && datos.nombre) {
      setNativeValue(nombreEl, datos.nombre);
      totalRellenados++;
    }

    // 4) Primer apellido y Segundo apellido
    const apellidosResult = findAndSetApellidos(context, nombreEl, datos.primer_apellido, datos.segundo_apellido);
    if (apellidosResult.primerApellidoOk) totalRellenados++;
    if (apellidosResult.segundoApellidoOk) totalRellenados++;

    // 5) Día de nacimiento (DD)
    const diaEl = findBirthField(context, ['dia', 'day', 'birth_day', 'dd', 'fechanacimiento_dia', 'birthday_day', 'birthDay'], 'dia');
    if (diaEl && datos.dia_nacimiento) {
      setBirthDayValue(diaEl, datos.dia_nacimiento);
      totalRellenados++;
    }

    // 6) Mes de nacimiento (MM)
    const mesEl = findBirthField(context, ['mes', 'month', 'birth_month', 'mm', 'fechanacimiento_mes', 'birthday_month', 'birthMonth'], 'mes');
    if (mesEl && datos.mes_nacimiento) {
      setBirthMonthValue(mesEl, datos.mes_nacimiento);
      totalRellenados++;
    }

    // 7) Año de nacimiento (AAAA)
    const anioEl = findBirthField(context, ['anio', 'ano', 'year', 'birth_year', 'yyyy', 'aaaa', 'fechanacimiento_ano', 'birthday_year', 'birthYear'], 'anio');
    if (anioEl && datos.anio_nacimiento) {
      setBirthYearValue(anioEl, datos.anio_nacimiento);
      totalRellenados++;
    }

    // Caso alternativo si la fecha está en un solo input[type="date"]
    if (!diaEl && !mesEl && !anioEl) {
      const fechaUnicaEl = findField(context, ['fecha_nacimiento', 'birthdate', 'birth_date', 'fecnac', 'fechaNacimiento'], ['date', 'text'], ['fecha de nacimiento', 'nacimiento']);
      if (fechaUnicaEl) {
        const d = String(datos.dia_nacimiento || '').padStart(2, '0');
        const m = String(datos.mes_nacimiento || '').padStart(2, '0');
        const y = datos.anio_nacimiento || '2000';
        setNativeValue(fechaUnicaEl, `${y}-${m}-${d}`);
        totalRellenados++;
      }
    }

    // 8) Número de documento (DNI/NIE/Pasaporte)
    const numDocEl = findDocumentField(context);
    if (numDocEl && datos.numero_documento) {
      setNativeValue(numDocEl, datos.numero_documento);
      totalRellenados++;
    }

    // Feedback visual flotante
    mostrarBadgeExito(plantilla, totalRellenados);
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA Y ASIGNACIÓN ESPECIALIZADA DE PRIMER Y SEGUNDO APELLIDO
  // --------------------------------------------------------------------------
  function findNombreField(root) {
    const tokens = ['nombre', 'firstname', 'first_name', 'name', 'txtName', 'txtNombre', 'first-name'];
    for (const t of tokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isTextualInput(el) && isVisible(el)) {
        // Asegurar que no sea 'primer_apellido' que contenga 'nombre'
        const nameAttr = (el.name || '').toLowerCase();
        const idAttr = (el.id || '').toLowerCase();
        if (!nameAttr.includes('apellido') && !idAttr.includes('apellido') && !nameAttr.includes('surname') && !idAttr.includes('surname')) {
          return el;
        }
      }
    }

    // Búsqueda por placeholder o labels
    const allInputs = Array.from(root.querySelectorAll('input')).filter(el => isTextualInput(el) && isVisible(el));
    for (const el of allInputs) {
      const ph = (el.placeholder || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      if ((ph === 'nombre' || ph.startsWith('nombre') || aria === 'nombre') && !ph.includes('apellido') && !ph.includes('usuario')) {
        return el;
      }
    }

    return null;
  }

  function findAndSetApellidos(root, nombreEl, primerApellido, segundoApellido) {
    let primerApellidoEl = null;
    let segundoApellidoEl = null;
    let singleApellidosEl = null;

    // Tokens específicos de Primer Apellido (ID / Name)
    const primerTokens = [
      'primer_apellido', 'primerapellido', 'primer-apellido', 'primer.apellido',
      'firstsurname', 'first_surname', 'first-surname',
      'firstlastname', 'first_lastname', 'first_last_name', 'first-lastname',
      'apellido1', 'apellido_1', 'apellido-1', 'apellido_primero',
      'surname1', 'surname_1', 'surname-1',
      'txtprimerapellido', 'txtapellido1', 'txt_apellido1', 'txt_primer_apellido',
      '1erapellido', '1_apellido', 'lastname1', 'last_name1'
    ];

    // Tokens específicos de Segundo Apellido (ID / Name)
    const segundoTokens = [
      'segundo_apellido', 'segundoapellido', 'segundo-apellido', 'segundo.apellido',
      'secondsurname', 'second_surname', 'second-surname',
      'secondlastname', 'second_lastname', 'second_last_name', 'second-lastname',
      'apellido2', 'apellido_2', 'apellido-2', 'apellido_segundo',
      'surname2', 'surname_2', 'surname-2',
      'txtsegundoapellido', 'txtapellido2', 'txt_apellido2', 'txt_segundo_apellido',
      '2doapellido', '2_apellido', 'lastname2', 'last_name2'
    ];

    // 1. Intentar localizar por atributos directos (name, id)
    for (const t of primerTokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isTextualInput(el) && isVisible(el)) {
        primerApellidoEl = el;
        break;
      }
    }

    for (const t of segundoTokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isTextualInput(el) && isVisible(el) && el !== primerApellidoEl) {
        segundoApellidoEl = el;
        break;
      }
    }

    // 2. Si no se encontró por ID/name, buscar por placeholder, aria-label o label cercano
    if (!primerApellidoEl || !segundoApellidoEl) {
      const allInputs = Array.from(root.querySelectorAll('input')).filter(el => isTextualInput(el) && isVisible(el) && el !== nombreEl);

      for (const el of allInputs) {
        const ph = (el.placeholder || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const labelText = getAssociatedLabelText(el).toLowerCase();

        const isPrimer = ph.includes('primer apellido') || ph.includes('1er apellido') || ph.includes('apellido 1') || ph.includes('1º apellido') ||
                         aria.includes('primer apellido') || labelText.includes('primer apellido') || labelText.includes('1er apellido') || labelText.includes('apellido 1');

        const isSegundo = ph.includes('segundo apellido') || ph.includes('2do apellido') || ph.includes('apellido 2') || ph.includes('2º apellido') ||
                          aria.includes('segundo apellido') || labelText.includes('segundo apellido') || labelText.includes('2do apellido') || labelText.includes('apellido 2');

        if (isPrimer && !primerApellidoEl) {
          primerApellidoEl = el;
        } else if (isSegundo && !segundoApellidoEl && el !== primerApellidoEl) {
          segundoApellidoEl = el;
        } else if (!singleApellidosEl && (ph === 'apellidos' || ph === 'apellido' || labelText.includes('apellidos') || labelText === 'apellido')) {
          singleApellidosEl = el;
        }
      }
    }

    // 3. Fallback Posicional Infalible:
    // En formularios españoles (como bonoparques.es), inmediatamente después de 'Nombre' vienen 'Primer apellido' y 'Segundo apellido'
    if (!primerApellidoEl && nombreEl) {
      const allInputs = Array.from(root.querySelectorAll('input')).filter(el => isTextualInput(el) && isVisible(el));
      const nombreIdx = allInputs.indexOf(nombreEl);

      if (nombreIdx !== -1 && nombreIdx + 1 < allInputs.length) {
        const candidate1 = allInputs[nombreIdx + 1];
        // Comprobar que no sea email ni fecha ni documento
        if (!isEmailInput(candidate1) && !isDocumentInput(candidate1)) {
          primerApellidoEl = candidate1;

          if (nombreIdx + 2 < allInputs.length && !segundoApellidoEl) {
            const candidate2 = allInputs[nombreIdx + 2];
            if (!isEmailInput(candidate2) && !isDocumentInput(candidate2)) {
              segundoApellidoEl = candidate2;
            }
          }
        }
      }
    }

    // 4. Fallback si solo existe un único campo para todos los apellidos (ej. "Apellidos")
    if (!primerApellidoEl && singleApellidosEl) {
      const fullApellidos = [primerApellido, segundoApellido].filter(Boolean).join(' ');
      setNativeValue(singleApellidosEl, fullApellidos);
      return { primerApellidoOk: true, segundoApellidoOk: true };
    }

    let primerOk = false;
    let segundoOk = false;

    if (primerApellidoEl && primerApellido) {
      setNativeValue(primerApellidoEl, primerApellido);
      primerOk = true;
    }

    if (segundoApellidoEl && segundoApellido) {
      setNativeValue(segundoApellidoEl, segundoApellido);
      segundoOk = true;
    }

    return { primerApellidoOk: primerOk, segundoApellidoOk: segundoOk };
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA DE CAMPO DE DOCUMENTO (DNI/NIE/PASAPORTE)
  // --------------------------------------------------------------------------
  function findDocumentField(root) {
    const tokens = ['documento', 'num_documento', 'numero_documento', 'dni', 'nif', 'nie', 'passport', 'id_number', 'txtDni', 'txtDocumento', 'identificationNumber'];
    for (const t of tokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isTextualInput(el) && isVisible(el)) return el;
    }

    // Búsqueda por placeholder o label
    const allInputs = Array.from(root.querySelectorAll('input')).filter(el => isTextualInput(el) && isVisible(el));
    for (const el of allInputs) {
      const ph = (el.placeholder || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const labelText = getAssociatedLabelText(el).toLowerCase();

      if (ph.includes('dni') || ph.includes('documento') || ph.includes('nif') || ph.includes('nie') ||
          aria.includes('dni') || aria.includes('documento') ||
          labelText.includes('documento') || labelText.includes('dni') || labelText.includes('nif') || labelText.includes('nie')) {
        return el;
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA DE CAMPOS GENERAL Y REPETIR EMAIL
  // --------------------------------------------------------------------------
  function findField(root, tokens, types = ['text'], labelTexts = []) {
    for (const t of tokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    for (const t of tokens) {
      const el = root.querySelector(`input[placeholder*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    if (labelTexts && labelTexts.length > 0) {
      const allInputs = Array.from(root.querySelectorAll('input')).filter(isVisible);
      for (const el of allInputs) {
        const lbl = getAssociatedLabelText(el).toLowerCase();
        for (const lt of labelTexts) {
          if (lbl.includes(lt.toLowerCase())) return el;
        }
      }
    }

    return null;
  }

  function findRepeatEmailField(root, firstEmailEl) {
    const tokens = ['repetir', 'repeat', 'confirm', 'email2', 'email_confirm', 'email_repeat', 'repite', 'confirmacion'];
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
    for (const t of tokens) {
      const el = root.querySelector(`select[id*="${t}" i], select[name*="${t}" i], input[id*="${t}" i], input[name*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    const allElements = Array.from(root.querySelectorAll('select, input')).filter(isVisible);
    for (const el of allElements) {
      const lbl = getAssociatedLabelText(el).toLowerCase().trim();
      const ph = (el.placeholder || '').toLowerCase().trim();
      if ((tipo === 'dia' && (lbl.includes('día') || lbl.includes('dia') || ph === 'dd' || ph === 'día')) ||
          (tipo === 'mes' && (lbl.includes('mes') || ph === 'mm' || ph === 'mes')) ||
          (tipo === 'anio' && (lbl.includes('año') || lbl.includes('ano') || ph === 'aaaa' || ph === 'yyyy' || ph === 'año'))) {
        return el;
      }
    }

    return null;
  }

  function getAssociatedLabelText(input) {
    if (!input) return '';
    // 1. Label con atributo for
    if (input.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (lbl) return lbl.textContent || '';
    }
    // 2. Label padre contenedor
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent || '';

    // 3. Contenedor padre de campo (.form-group, .field, div)
    const container = input.closest('.form-group, .form-field, .field, .input-wrap, div');
    if (container) {
      const labelLike = container.querySelector('label, .label, span.title, p.label, span.field-label');
      if (labelLike) return labelLike.textContent || '';
    }

    return '';
  }

  function isTextualInput(el) {
    if (!el || el.tagName.toLowerCase() !== 'input') return false;
    const type = (el.type || 'text').toLowerCase();
    return type === 'text' || type === 'search' || type === '' || type === 'tel';
  }

  function isEmailInput(el) {
    if (!el) return false;
    const type = (el.type || '').toLowerCase();
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    return type === 'email' || name.includes('email') || id.includes('email') || name.includes('mail') || id.includes('mail');
  }

  function isDocumentInput(el) {
    if (!el) return false;
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    return name.includes('dni') || id.includes('dni') || name.includes('doc') || id.includes('doc') || name.includes('nif') || id.includes('nif');
  }

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  // --------------------------------------------------------------------------
  // ASIGNACIÓN DE VALORES CON DISPARO COMPLETO DE EVENTOS
  // --------------------------------------------------------------------------
  function setNativeValue(el, val) {
    if (!el || val === undefined || val === null) return;

    try {
      if (typeof el.focus === 'function') el.focus();

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

    // Disparar secuencia completa de eventos para React / Angular / Vue / Vanilla
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
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

  function escapeRegExp(string) {
    return (string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --------------------------------------------------------------------------
  // FEEDBACK VISUAL: BADGE FLOTANTE
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

    requestAnimationFrame(() => {
      badge.style.transform = 'translateY(0)';
      badge.style.opacity = '1';
    });

    setTimeout(() => {
      badge.style.transform = 'translateY(-10px)';
      badge.style.opacity = '0';
      setTimeout(() => badge.remove(), 350);
    }, 3800);
  }
})();
