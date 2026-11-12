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
    if (triggerEl && triggerEl.value !== undefined) {
      setNativeValue(triggerEl, triggerEl.value.replace(abrevRegex, ''));
    }

    // Usar el documento completo como contexto para abarcar todas las tarjetas/secciones
    const root = document;
    let totalRellenados = 0;

    // 1) Email del gestor y Repetir email (mismo correo en ambos)
    const emailVal = datos.email_gestor || datos.email_repetir || '';
    if (emailVal) {
      const emailInputs = findEmailInputs(root);
      if (emailInputs.length > 0) {
        setNativeValue(emailInputs[0], emailVal);
        totalRellenados++;
        if (emailInputs.length > 1) {
          setNativeValue(emailInputs[1], emailVal);
          totalRellenados++;
        }
      }
    }

    // 2) Datos personales: Nombre, Primer apellido y Segundo apellido
    const personalCount = findAndFillPersonalData(root, datos);
    totalRellenados += personalCount;

    // 3) Fecha de nacimiento: Día, Mes y Año
    const fechaCount = findAndFillFechaNacimiento(root, datos);
    totalRellenados += fechaCount;

    // 4) Documento (DNI/NIE/Pasaporte)
    const docEl = findDocumentInput(root);
    if (docEl && datos.numero_documento) {
      setNativeValue(docEl, datos.numero_documento);
      totalRellenados++;
    }

    // NOTA: La casilla de "Copiar información para detalles de facturación" se ignora completamente por petición del usuario.

    // Notificación flotante de confirmación
    mostrarBadgeExito(plantilla, totalRellenados);
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA Y ASIGNACIÓN INFALIBLE DE NOMBRE Y APELLIDOS
  // --------------------------------------------------------------------------
  function findAndFillPersonalData(root, datos) {
    const nombreVal = datos.nombre || '';
    const primerApellidoVal = datos.primer_apellido || '';
    const segundoApellidoVal = datos.segundo_apellido || '';

    // 1. Buscar primero por coincidencia de texto visible en etiquetas/labels
    let nombreEl = findInputByLabelPhrases(root, ['nombre*', 'nombre']);
    let primerApellidoEl = findInputByLabelPhrases(root, ['primer apellido*', 'primer apellido', '1er apellido', 'primer ap', 'apellido 1']);
    let segundoApellidoEl = findInputByLabelPhrases(root, ['segundo apellido*', 'segundo apellido', '2do apellido', 'segundo ap', 'apellido 2']);

    // 2. Si falta alguno, buscar por selectores directos de atributos (name, id, placeholder, aria-label)
    if (!nombreEl) {
      nombreEl = root.querySelector('input[name="nombre" i], input[id="nombre" i], input[name="firstname" i], input[id="firstname" i], input[name*="nombre" i], input[id*="nombre" i], input[placeholder*="nombre" i]');
    }

    if (!primerApellidoEl) {
      primerApellidoEl = root.querySelector(
        'input[name*="primerapellido" i], input[id*="primerapellido" i],' +
        'input[name*="primer_apellido" i], input[id*="primer_apellido" i],' +
        'input[name*="firstsurname" i], input[id*="firstsurname" i],' +
        'input[name*="first_surname" i], input[id*="first_surname" i],' +
        'input[placeholder*="primer apellido" i], input[aria-label*="primer apellido" i],' +
        'input[name*="apellido1" i], input[id*="apellido1" i],' +
        'input[name*="surname1" i], input[id*="surname1" i],' +
        'input[name="surname" i], input[id="surname" i],' +
        'input[name="lastname" i], input[id="lastname" i],' +
        'input[name="apellido" i], input[id="apellido" i]'
      );
    }

    if (!segundoApellidoEl) {
      segundoApellidoEl = root.querySelector(
        'input[name*="segundoapellido" i], input[id*="segundoapellido" i],' +
        'input[name*="segundo_apellido" i], input[id*="segundo_apellido" i],' +
        'input[name*="secondsurname" i], input[id*="secondsurname" i],' +
        'input[name*="second_surname" i], input[id*="second_surname" i],' +
        'input[placeholder*="segundo apellido" i], input[aria-label*="segundo apellido" i],' +
        'input[name*="apellido2" i], input[id*="apellido2" i],' +
        'input[name*="surname2" i], input[id*="surname2" i]'
      );
    }

    // 3. Fallback Posicional Consecutivo (Regla de oro de formularios de bonos)
    // En bonoparques.es, los campos son secuenciales: [ Nombre ] -> [ Primer apellido ] -> [ Segundo apellido ]
    const allTextInputs = Array.from(root.querySelectorAll(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"])'
    )).filter(isVisible);

    // Si tenemos nombre y segundo apellido pero falta el primer apellido, el campo entre ellos ES el primer apellido
    if (nombreEl && segundoApellidoEl && !primerApellidoEl) {
      const nIdx = allTextInputs.indexOf(nombreEl);
      const sIdx = allTextInputs.indexOf(segundoApellidoEl);
      if (nIdx !== -1 && sIdx === nIdx + 2) {
        primerApellidoEl = allTextInputs[nIdx + 1];
      }
    }

    // Si tenemos nombre pero falta el primer apellido, tomar el input inmediatamente posterior
    if (nombreEl) {
      const nIdx = allTextInputs.indexOf(nombreEl);
      if (nIdx !== -1) {
        if (!primerApellidoEl && nIdx + 1 < allTextInputs.length) {
          primerApellidoEl = allTextInputs[nIdx + 1];
        }
        if (!segundoApellidoEl && nIdx + 2 < allTextInputs.length) {
          segundoApellidoEl = allTextInputs[nIdx + 2];
        }
      }
    }

    // Protección anti-colisión: el primer y segundo apellido nunca pueden ser el mismo input
    if (segundoApellidoEl === primerApellidoEl) {
      const pIdx = allTextInputs.indexOf(primerApellidoEl);
      if (pIdx !== -1 && pIdx + 1 < allTextInputs.length) {
        segundoApellidoEl = allTextInputs[pIdx + 1];
      } else {
        segundoApellidoEl = null;
      }
    }

    let count = 0;
    if (nombreEl && nombreVal) {
      setNativeValue(nombreEl, nombreVal);
      count++;
    }
    if (primerApellidoEl && primerApellidoVal) {
      setNativeValue(primerApellidoEl, primerApellidoVal);
      count++;
    }
    if (segundoApellidoEl && segundoApellidoVal) {
      setNativeValue(segundoApellidoEl, segundoApellidoVal);
      count++;
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA POR TEXTO DE LABEL VISIBLE (TREEWALKER + LABELS)
  // --------------------------------------------------------------------------
  function findInputByLabelPhrases(root, phrases) {
    // A. Buscar en etiquetas <label>
    const labels = root.querySelectorAll('label');
    for (const lbl of labels) {
      const txt = (lbl.textContent || '').trim().toLowerCase();
      for (const phrase of phrases) {
        if (txt.includes(phrase)) {
          if (lbl.htmlFor) {
            const inp = document.getElementById(lbl.htmlFor);
            if (inp && isVisible(inp)) return inp;
          }
          const inner = lbl.querySelector('input');
          if (inner && isVisible(inner)) return inner;

          let cur = lbl;
          for (let i = 0; i < 3; i++) {
            if (!cur || cur === root) break;
            const pInp = cur.querySelector('input');
            if (pInp && isVisible(pInp) && pInp !== inner) return pInp;
            let next = cur.nextElementSibling;
            while (next) {
              const nInp = next.tagName === 'INPUT' ? next : next.querySelector('input');
              if (nInp && isVisible(nInp)) return nInp;
              next = next.nextElementSibling;
            }
            cur = cur.parentElement;
          }
        }
      }
    }

    // B. Buscar mediante TreeWalker nodos de texto en el DOM (para spans, divs, p que actúan como label)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue || '').trim().toLowerCase();
      if (!text || text.length > 50) continue;

      for (const phrase of phrases) {
        if (text.includes(phrase)) {
          let parent = node.parentElement;
          if (parent) {
            if (parent.tagName === 'LABEL' && parent.htmlFor) {
              const inp = document.getElementById(parent.htmlFor);
              if (inp && isVisible(inp)) return inp;
            }
            let cur = parent;
            for (let lvl = 0; lvl < 3; lvl++) {
              if (!cur || cur === document.body) break;
              const inp = cur.querySelector('input');
              if (inp && isVisible(inp)) return inp;
              let sibling = cur.nextElementSibling;
              while (sibling) {
                const sInp = sibling.tagName === 'INPUT' ? sibling : sibling.querySelector('input');
                if (sInp && isVisible(sInp)) return sInp;
                sibling = sibling.nextElementSibling;
              }
              cur = cur.parentElement;
            }
          }
        }
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA DE EMAILS (PRINCIPAL Y REPETIR)
  // --------------------------------------------------------------------------
  function findEmailInputs(root) {
    const found = [];
    const allInputs = Array.from(root.querySelectorAll('input')).filter(isVisible);

    // Prioridad 1: inputs con type="email"
    for (const inp of allInputs) {
      if ((inp.type || '').toLowerCase() === 'email') {
        found.push(inp);
      }
    }

    // Si encontramos menos de 2, buscar por name, id o label que contengan 'email' o 'correo'
    if (found.length < 2) {
      for (const inp of allInputs) {
        if (found.includes(inp)) continue;
        const name = (inp.name || '').toLowerCase();
        const id = (inp.id || '').toLowerCase();
        const ph = (inp.placeholder || '').toLowerCase();
        if (name.includes('email') || id.includes('email') || ph.includes('email') ||
            name.includes('correo') || id.includes('correo') || ph.includes('correo') ||
            name.includes('mail') || id.includes('mail')) {
          found.push(inp);
        }
      }
    }

    return found;
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA Y ASIGNACIÓN DE FECHA DE NACIMIENTO
  // --------------------------------------------------------------------------
  function findAndFillFechaNacimiento(root, datos) {
    let filled = 0;

    const diaEl = findBirthInput(root, ['dia', 'day', 'dd', 'fechanacimiento_dia', 'birthday_day', 'birthDay'], 'dia');
    const mesEl = findBirthInput(root, ['mes', 'month', 'mm', 'fechanacimiento_mes', 'birthday_month', 'birthMonth'], 'mes');
    const anioEl = findBirthInput(root, ['anio', 'ano', 'year', 'yyyy', 'aaaa', 'fechanacimiento_ano', 'birthday_year', 'birthYear'], 'anio');

    if (diaEl && datos.dia_nacimiento) {
      setBirthDayValue(diaEl, datos.dia_nacimiento);
      filled++;
    }

    if (mesEl && datos.mes_nacimiento) {
      setBirthMonthValue(mesEl, datos.mes_nacimiento);
      filled++;
    }

    if (anioEl && datos.anio_nacimiento) {
      setBirthYearValue(anioEl, datos.anio_nacimiento);
      filled++;
    }

    return filled;
  }

  function findBirthInput(root, tokens, tipo) {
    for (const t of tokens) {
      const el = root.querySelector(`select[id*="${t}" i], select[name*="${t}" i], input[id*="${t}" i], input[name*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    const allElements = Array.from(root.querySelectorAll('select, input')).filter(isVisible);
    for (const el of allElements) {
      const ph = (el.placeholder || '').toLowerCase().trim();
      if (tipo === 'dia' && (ph === 'dd' || ph === 'día' || ph === 'dia')) return el;
      if (tipo === 'mes' && (ph === 'mm' || ph === 'mes')) return el;
      if (tipo === 'anio' && (ph === 'aaaa' || ph === 'yyyy' || ph === 'año' || ph === 'ano')) return el;
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // BÚSQUEDA DE DOCUMENTO (DNI/NIE/PASAPORTE)
  // --------------------------------------------------------------------------
  function findDocumentInput(root) {
    const tokens = ['documento', 'num_documento', 'numero_documento', 'dni', 'nif', 'nie', 'passport', 'id_number', 'txtDni', 'txtDocumento', 'identificationNumber'];
    for (const t of tokens) {
      const el = root.querySelector(`input[name="${t}" i], input[id="${t}" i], input[name*="${t}" i], input[id*="${t}" i]`);
      if (el && isVisible(el)) return el;
    }

    const allInputs = Array.from(root.querySelectorAll('input')).filter(isVisible);
    for (const el of allInputs) {
      const ph = (el.placeholder || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      if (ph.includes('dni') || ph.includes('documento') || aria.includes('dni') || aria.includes('documento')) {
        return el;
      }
    }

    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  // --------------------------------------------------------------------------
  // ASIGNACIÓN DE VALORES DISPARANDO EVENTOS NATIVOS
  // --------------------------------------------------------------------------
  function setNativeValue(el, val) {
    if (!el || val === undefined || val === null) return;

    try {
      if (typeof el.focus === 'function') el.focus();

      // Compatibilidad con React Value Tracker
      const lastValue = el.value;
      el.value = val;
      const tracker = el._valueTracker;
      if (tracker) {
        tracker.setValue(lastValue);
      }

      // Setter del prototipo nativo
      const tag = el.tagName.toLowerCase();
      const proto = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(el, val);
      }
    } catch (e) {
      el.value = val;
    }

    // Disparar eventos con burbujeo completo
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
            ${titular}${d.numero_documento ? ' (' + d.numero_documento + ')' : ''} — ${totalCampos} campos rellenados.
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
