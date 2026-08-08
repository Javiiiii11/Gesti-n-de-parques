/* ============================================================================
   chat-ia.js — Asistente IA con doble backend: Ollama (local/túnel) o Gemini (nube)
   ----------------------------------------------------------------------------
   El usuario elige el proveedor desde la toolbar. Ollama se conecta a
   localhost:11434 o a una URL remota (túnel ngrok/Cloudflare). Gemini usa la
   API pública de Google (gratuita) directamente desde el navegador con una
   API key guardada en localStorage.

   ⚠️ AVISO DE SEGURIDAD: la API key de Gemini queda visible en el JS del
   cliente (localStorage + petición fetch). Válido para uso personal; si la
   app se abre a varios usuarios, cualquiera con acceso a devtools podría ver
   la key. Para eso haría falta un backend/proxy que la oculte.

   Estructura:
   1. CONFIGURACIÓN   → estado de Ollama y Gemini, proveedor activo, system prompt.
   2. CONEXIÓN        → ping a Ollama / validación de Gemini.
   3. CHAT            → envío de mensajes (Ollama streaming, Gemini respuesta única).
   4. CONFIG UI       → modal para configurar Ollama y la API key de Gemini.
   5. RENDERIZADO     → burbujas de chat, markdown básico, animaciones.
   6. FRASES DE EMAIL → se mantienen del sistema anterior.
============================================================================ */

/* -------------------------------------------------------------------------- */
/* 1. CONFIGURACIÓN                                                           */
/* -------------------------------------------------------------------------- */

const OLLAMA = {
  // Si hay URL personalizada guardada, usarla; si no, localhost
  baseUrl: localStorage.getItem('parksales_ollama_url') || 'http://localhost:11434',
  model: localStorage.getItem('parksales_ollama_model') || '',
  connected: false,
  models: [],
  generating: false,
};

const GEMINI = {
  apiKey: localStorage.getItem('parksales_gemini_key') || '',
  model: 'gemini-2.0-flash-lite',
  connected: false,
  generating: false,
};

// Historial de conversación compartido entre proveedores
const IA_STATE = {
  messages: [],
  // 'ollama' | 'gemini'
  provider: localStorage.getItem('parksales_ia_provider') || 'ollama',
  systemPrompt: `Eres el asistente de IA de ParkSales, una aplicación de gestión de ventas de entradas a parques de ocio. Responde siempre en español.

Reglas:
- Sé amable, natural y conciso.
- Si el usuario te saluda ("Hola", "Buenos días", etc.), responde con un saludo cordial y ofrécele tu ayuda.
- Si te preguntan sobre algo específico, responde con tu mejor conocimiento.
- Si no sabes algo, dilo con honestidad. No inventes datos.
- Puedes usar formato: **negrita**, *cursiva*, listas con - o números, y \`código\`.
- Busca informacion en https://www.parquewarner.com/ si necesitas información sobre el parque.
- Si el usuario te pide información sobre un tema concreto (un parque, una empresa, etc.), da la información que tengas y si no la tienes, indícalo amablemente.`,
};

/* -------------------------------------------------------------------------- */
/* 2. CONEXIÓN CON OLLAMA                                                     */
/* -------------------------------------------------------------------------- */

async function checkOllamaStatus() {
  const statusEl = document.getElementById('ollama-status');
  const statusDot = document.getElementById('ollama-status-dot');
  const statusText = document.getElementById('ollama-status-text');
  const selectEl = document.getElementById('ollama-model-select');

  try {
    const resp = await fetch(`${OLLAMA.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error('Respuesta no válida');
    const data = await resp.json();

    OLLAMA.connected = true;
    OLLAMA.models = (data.models || []).map((m) => m.name);

    if (statusDot) statusDot.className = 'ollama-dot connected';
    if (statusText) {
      const isRemote = OLLAMA.baseUrl !== 'http://localhost:11434';
      statusText.textContent = isRemote ? 'Conectado (remoto)' : 'Conectado (local)';
    }
    if (statusEl) statusEl.className = 'ollama-status connected';

    // Llenar selector de modelos
    if (selectEl && OLLAMA.models.length > 0) {
      selectEl.innerHTML = OLLAMA.models.map((m) => {
        const short = m.split(':')[0];
        return `<option value="${m}" ${m === OLLAMA.model ? 'selected' : ''}>${short}</option>`;
      }).join('');

      // Si no hay modelo guardado o el guardado ya no existe, usar el primero
      if (!OLLAMA.model || !OLLAMA.models.includes(OLLAMA.model)) {
        OLLAMA.model = OLLAMA.models[0];
        selectEl.value = OLLAMA.model;
        localStorage.setItem('parksales_ollama_model', OLLAMA.model);
      }
      selectEl.disabled = false;
    } else if (selectEl) {
      selectEl.innerHTML = '<option>Sin modelos</option>';
      selectEl.disabled = true;
    }

    return true;
  } catch (err) {
    OLLAMA.connected = false;
    OLLAMA.models = [];

    if (statusDot) statusDot.className = 'ollama-dot disconnected';
    if (statusText) statusText.textContent = 'Desconectado';
    if (statusEl) statusEl.className = 'ollama-status disconnected';
    if (selectEl) {
      selectEl.innerHTML = '<option>—</option>';
      selectEl.disabled = true;
    }

    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* 3. CHAT — despacha al proveedor activo (Ollama o Gemini)                   */
/* -------------------------------------------------------------------------- */

/** true si el proveedor activo está generando una respuesta ahora mismo */
function isGenerating() {
  return IA_STATE.provider === 'gemini' ? GEMINI.generating : OLLAMA.generating;
}

/** Punto de entrada único desde el formulario del chat */
async function enviarMensajeIA(userMessage) {
  if (IA_STATE.provider === 'gemini') {
    await sendToGemini(userMessage);
  } else {
    await sendToOllama(userMessage);
  }
}

async function sendToOllama(userMessage) {
  if (OLLAMA.generating) return;
  if (!OLLAMA.connected) {
    const isRemote = OLLAMA.baseUrl !== 'http://localhost:11434';
    pintarMensajeIA('bot', `<p class="chat-ia-error">⚠️ Ollama no está conectado. ${
      isRemote
        ? 'Comprueba que tu PC está encendido, Ollama activo, y el túnel funcionando.'
        : 'Asegúrate de que está ejecutándose en tu PC. Si estás fuera, configura la URL remota con ⚙️.'
    }</p>`);
    return;
  }
  if (!OLLAMA.model) {
    pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ No hay ningún modelo seleccionado. Descarga uno en Ollama (ej: <code>ollama pull llama3.2</code>).</p>');
    return;
  }

  // Añadir mensaje del usuario al historial
  IA_STATE.messages.push({ role: 'user', content: userMessage });
  pintarMensajeIA('user', `<p>${escapeHtml(userMessage)}</p>`);

  // Crear burbuja del bot con indicador de escritura
  const botBubble = crearBurbujaBot();
  OLLAMA.generating = true;
  actualizarBtnEnviar();

  try {
    const body = {
      model: OLLAMA.model,
      messages: [
        { role: 'system', content: IA_STATE.systemPrompt },
        ...IA_STATE.messages,
      ],
      stream: true,
    };

    const resp = await fetch(`${OLLAMA.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Error ${resp.status}: ${errText}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Ollama envía JSON separados por newline
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message && chunk.message.content) {
            fullResponse += chunk.message.content;
            actualizarBurbujaBot(botBubble, fullResponse);
          }
        } catch (e) {
          // línea JSON inválida, ignorar
        }
      }
    }

    // Procesar lo que quede en el buffer
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        if (chunk.message && chunk.message.content) {
          fullResponse += chunk.message.content;
          actualizarBurbujaBot(botBubble, fullResponse);
        }
      } catch (e) { /* ignorar */ }
    }

    // Si no hubo respuesta
    if (!fullResponse) {
      actualizarBurbujaBot(botBubble, '_El modelo no devolvió ninguna respuesta._');
    }

    // Guardar respuesta en historial
    IA_STATE.messages.push({ role: 'assistant', content: fullResponse });

  } catch (err) {
    console.error('Error Ollama:', err);
    actualizarBurbujaBot(botBubble, `⚠️ Error al comunicarse con Ollama: ${err.message}`);
    // Quitar el mensaje del usuario del historial si falló
    IA_STATE.messages.pop();
  } finally {
    OLLAMA.generating = false;
    actualizarBtnEnviar();
  }
}

/* -------------------------------------------------------------------------- */
/* 3b. CHAT CON GEMINI (respuesta única, con reintentos automáticos)          */
/* -------------------------------------------------------------------------- */

async function sendToGemini(userMessage) {
  if (GEMINI.generating) return;
  if (!GEMINI.apiKey) {
    pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ No has configurado tu API key de Gemini. Consíguela gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> y pégala en ⚙️.</p>');
    return;
  }

  IA_STATE.messages.push({ role: 'user', content: userMessage });
  pintarMensajeIA('user', `<p>${escapeHtml(userMessage)}</p>`);

  const botBubble = crearBurbujaBot();
  GEMINI.generating = true;
  actualizarBtnEnviar();

  try {
    const contents = IA_STATE.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI.model}:generateContent?key=${GEMINI.apiKey}`;
    const fetchBody = JSON.stringify({
      system_instruction: { parts: [{ text: IA_STATE.systemPrompt }] },
      contents,
    });

    // Intenta con reintento automático en caso de cuota por minuto (429)
    const MAX_RETRIES = 3;
    let resp = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fetchBody,
      });

      if (resp.status !== 429) break;

      let errJson = null;
      try { errJson = await resp.clone().json(); } catch { /* ignorar */ }

      // Si la cuota diaria está agotada, no tiene sentido reintentar
      const isDailyExhausted = errJson?.error?.details?.some(
        (d) => d.violations?.some((v) => v.quotaId?.includes('PerDay'))
      );
      if (isDailyExhausted) {
        throw new Error('Cuota diaria agotada. Inténtalo mañana o genera una nueva API key en aistudio.google.com/apikey.');
      }

      if (attempt === MAX_RETRIES) {
        throw new Error('Límite de peticiones por minuto superado tras varios intentos. Espera un momento e intenta de nuevo.');
      }

      // Extraer segundos de espera del campo retryDelay (ej: "9s" → 9)
      let waitSecs = 15;
      try {
        const retryInfo = errJson?.error?.details?.find((d) => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          const parsed = parseInt(retryInfo.retryDelay, 10);
          if (!isNaN(parsed)) waitSecs = parsed + 1;
        }
      } catch { /* usar default */ }

      await geminiCountdown(botBubble, waitSecs, attempt + 1, MAX_RETRIES);
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const fullResponse = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

    if (!fullResponse) {
      actualizarBurbujaBot(botBubble, '_Gemini no devolvió ninguna respuesta._');
    } else {
      actualizarBurbujaBot(botBubble, fullResponse);
    }

    IA_STATE.messages.push({ role: 'assistant', content: fullResponse });
    GEMINI.connected = true;

  } catch (err) {
    console.error('Error Gemini:', err);
    actualizarBurbujaBot(botBubble, `<p class="chat-ia-error">⚠️ ${escapeHtml(err.message)}</p>`);
    IA_STATE.messages.pop();
    GEMINI.connected = false;
  } finally {
    GEMINI.generating = false;
    actualizarBtnEnviar();
  }
}

/**
 * Muestra una cuenta atrás en la burbuja del bot mientras espera el reintento.
 */
function geminiCountdown(bubble, seconds, attempt, maxAttempts) {
  return new Promise((resolve) => {
    let remaining = seconds;
    const render = () => {
      if (!bubble) return;
      bubble.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;padding:4px 0;">
          <span>⏳ Límite de peticiones alcanzado. Reintentando en <strong>${remaining}s</strong>…</span>
          <span style="font-size:11px;opacity:0.6;">Intento ${attempt} de ${maxAttempts}</span>
        </div>`;
      const cont = document.getElementById('chat-ia-mensajes');
      if (cont) cont.scrollTop = cont.scrollHeight;
    };
    render();
    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        if (bubble) {
          bubble.innerHTML = `<div class="chat-ia-typing"><span></span><span></span><span></span></div>`;
          const cont = document.getElementById('chat-ia-mensajes');
          if (cont) cont.scrollTop = cont.scrollHeight;
        }
        resolve();
      } else {
        render();
      }
    }, 1000);
  });
}

/* -------------------------------------------------------------------------- */
/* 4. CONFIG UI — Modal para configurar URL remota de Ollama                  */
/* -------------------------------------------------------------------------- */

function openOllamaConfigModal() {
  const currentUrl = OLLAMA.baseUrl;
  const isDefault = currentUrl === 'http://localhost:11434';

  openModal({
    title: '⚙️ Configurar conexión de Ollama',
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin:0;">
          Configura la URL de tu Ollama para usar el asistente desde cualquier dispositivo.
          Si estás en tu PC, usa <code style="color:var(--accent);">http://localhost:11434</code>.
          Si estás fuera, usa la URL de tu túnel.
        </p>

        <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-m);padding:14px 16px;">
          <p style="color:var(--accent);font-weight:700;font-size:12.5px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.03em;">
            📡 Cómo acceder desde fuera (Docker / Windows)
          </p>
          <ol style="color:var(--text-secondary);font-size:12.5px;line-height:1.7;margin:0;padding-left:18px;">
            <li>Inicia Ollama permitiendo CORS (peticiones externas):<br>
              <strong style="font-size:11.5px;">En Docker:</strong> añade <code style="color:var(--accent);font-size:11px;">-e OLLAMA_ORIGINS="*"</code> al comando run.<br>
              <strong style="font-size:11.5px;">En Windows:</strong> añade <code style="color:var(--accent);font-size:11px;">OLLAMA_ORIGINS=*</code> a tus Variables de Entorno.
            </li>
            <li>Usa un túnel HTTPS como <a href="https://ngrok.com/download" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;">ngrok</a> para evitar bloqueos en el móvil:<br>
              Ejecuta <code style="color:var(--accent);font-size:11.5px;">ngrok http 11434</code> en tu terminal (o en docker).
            </li>
            <li>Copia la URL segura que te da ngrok (ej: <code style="color:var(--accent);font-size:11.5px;">https://abc123.ngrok.app</code>).</li>
            <li>Pégala aquí abajo y guarda.</li>
          </ol>
        </div>

        <div>
          <label style="display:block;color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
            URL de Ollama
          </label>
          <input type="text" id="ollama-url-input"
            placeholder="http://localhost:11434"
            value="${escapeHtml(currentUrl)}"
            style="width:100%;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);color:var(--text-primary);font-size:13px;font-family:'Fira Code','Consolas',monospace;outline:none;">
        </div>

        ${!isDefault ? `
        <p style="color:var(--text-muted);font-size:11.5px;margin:0;line-height:1.5;">
          ℹ️ La URL se guarda solo en este navegador. Cada dispositivo puede tener su propia configuración.
        </p>` : ''}

        <hr style="border:none;border-top:1px solid var(--border);margin:4px 0;">

        <div>
          <p style="color:var(--accent);font-weight:700;font-size:12.5px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.03em;">
            ✨ Gemini (nube, gratis)
          </p>
          <p style="color:var(--text-secondary);font-size:12.5px;line-height:1.6;margin:0 0 10px;">
            Alternativa sin instalar nada. Consigue tu API key gratis en
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;">aistudio.google.com/apikey</a>.
          </p>
          <label style="display:block;color:var(--text-muted);font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
            API key de Gemini
          </label>
          <input type="password" id="gemini-key-input"
            placeholder="AIza…"
            value="${escapeHtml(GEMINI.apiKey)}"
            style="width:100%;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);color:var(--text-primary);font-size:13px;font-family:'Fira Code','Consolas',monospace;outline:none;">
          <p style="color:var(--text-muted);font-size:11px;margin:8px 0 0;line-height:1.5;">
            ⚠️ Se guarda solo en este navegador (localStorage). Cualquiera con acceso a las devtools de este dispositivo podría verla.
          </p>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="ollama-config-cancel">Cancelar</button>
      ${!isDefault ? '<button class="btn btn-danger btn-sm" id="ollama-config-reset">Restaurar local</button>' : ''}
      <button class="btn btn-secondary" id="gemini-key-save">Guardar clave Gemini</button>
      <button class="btn btn-primary" id="ollama-config-save">Guardar y probar Ollama</button>
    `,
    width: '520px',
  });

  document.getElementById('gemini-key-save').addEventListener('click', () => {
    const keyInput = document.getElementById('gemini-key-input');
    const key = keyInput.value.trim();
    if (!key) {
      toast('Introduce una API key de Gemini.', 'error');
      return;
    }
    GEMINI.apiKey = key;
    localStorage.setItem('parksales_gemini_key', key);
    if (IA_STATE.provider === 'gemini') actualizarUIProveedor();
    toast('✅ API key de Gemini guardada.', 'success');
  });

  document.getElementById('ollama-config-cancel').addEventListener('click', closeModal);

  const resetBtn = document.getElementById('ollama-config-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      OLLAMA.baseUrl = 'http://localhost:11434';
      localStorage.removeItem('parksales_ollama_url');
      await checkOllamaStatus();
      updateConnectionLabel();
      closeModal();
      toast('URL restaurada a localhost.', 'success', 2000);
    });
  }

  document.getElementById('ollama-config-save').addEventListener('click', async () => {
    const input = document.getElementById('ollama-url-input');
    let url = input.value.trim();

    if (!url) {
      toast('Introduce una URL válida.', 'error');
      return;
    }

    // Limpiar trailing slash
    url = url.replace(/\/+$/, '');

    // Validar formato básico
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast('La URL debe empezar por http:// o https://', 'error');
      return;
    }

    // Probar conexión
    const oldUrl = OLLAMA.baseUrl;
    OLLAMA.baseUrl = url;

    const saveBtn = document.getElementById('ollama-config-save');
    saveBtn.textContent = 'Probando…';
    saveBtn.disabled = true;

    const ok = await checkOllamaStatus();

    saveBtn.textContent = 'Guardar y probar';
    saveBtn.disabled = false;

    if (ok) {
      localStorage.setItem('parksales_ollama_url', url);
      updateConnectionLabel();
      closeModal();
      toast('✅ Conexión establecida con Ollama.', 'success');
    } else {
      OLLAMA.baseUrl = oldUrl;
      await checkOllamaStatus();
      toast('❌ No se pudo conectar a esa URL. ¿Está Ollama activo y el túnel funcionando?', 'error');
    }
  });
}

/** Actualiza la etiqueta de la URL en la toolbar */
function updateConnectionLabel() {
  const label = document.getElementById('ollama-url-label');
  if (!label) return;
  const isRemote = OLLAMA.baseUrl !== 'http://localhost:11434';
  if (isRemote) {
    try {
      const u = new URL(OLLAMA.baseUrl);
      label.textContent = u.hostname.length > 25 ? u.hostname.slice(0, 22) + '…' : u.hostname;
    } catch {
      label.textContent = 'remoto';
    }
    label.style.display = '';
  } else {
    label.textContent = '';
    label.style.display = 'none';
  }
}

/* -------------------------------------------------------------------------- */
/* 5. RENDERIZADO — UI del chat                                               */
/* -------------------------------------------------------------------------- */

function initChatIA() {
  wireChatIATabs();
  wireChatIAForm();
  wireProviderSelect();
  wireModelSelect();
  wireOllamaConfig();
  wireClearChat();
  wireFrasesBuscador();
  renderFrases('');

  actualizarUIProveedor();
  // Recomprobar cada 15 segundos (solo aplica al proveedor Ollama)
  setInterval(() => {
    if (IA_STATE.provider === 'ollama') checkOllamaStatus();
  }, 15000);
}

/** Cambia el proveedor activo y refresca la UI de estado/modelo */
function actualizarUIProveedor() {
  const select = document.getElementById('ia-provider-select');
  if (select) select.value = IA_STATE.provider;

  const modelSelect = document.getElementById('ollama-model-select');

  if (IA_STATE.provider === 'gemini') {
    if (modelSelect) {
      modelSelect.innerHTML = '<option>gemini-2.0-flash-lite</option>';
      modelSelect.disabled = true;
    }
    updateStatusPill(!!GEMINI.apiKey, GEMINI.apiKey ? 'Gemini (clave configurada)' : 'Falta API key de Gemini');
    updateConnectionLabel();
  } else {
    checkOllamaStatus();
    updateConnectionLabel();
  }
}

/** Actualiza el punto/texto de estado de la toolbar de forma genérica */
function updateStatusPill(connected, text) {
  const statusEl = document.getElementById('ollama-status');
  const statusDot = document.getElementById('ollama-status-dot');
  const statusText = document.getElementById('ollama-status-text');
  if (statusDot) statusDot.className = `ollama-dot ${connected ? 'connected' : 'disconnected'}`;
  if (statusText) statusText.textContent = text;
  if (statusEl) statusEl.className = `ollama-status ${connected ? 'connected' : 'disconnected'}`;
}

function wireChatIATabs() {
  document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#view-chat-ia .chat-ia-panel').forEach((p) => p.classList.toggle('active', p.id === `chat-ia-panel-${btn.dataset.tab}`));
    });
  });
}

function wireChatIAForm() {
  const form = document.getElementById('chat-ia-form');
  const input = document.getElementById('chat-ia-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || isGenerating()) return;
    input.value = '';
    enviarMensajeIA(msg);
  });

  // Enter para enviar (shift+enter para nueva línea si fuera textarea)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
}

/** Selector de proveedor (Ollama / Gemini) en la toolbar */
function wireProviderSelect() {
  const select = document.getElementById('ia-provider-select');
  if (!select) return;
  select.value = IA_STATE.provider;
  select.addEventListener('change', () => {
    IA_STATE.provider = select.value;
    localStorage.setItem('parksales_ia_provider', IA_STATE.provider);
    actualizarUIProveedor();
    toast(`Proveedor cambiado a ${IA_STATE.provider === 'gemini' ? 'Gemini' : 'Ollama'}`, 'success', 2000);
  });
}

function wireModelSelect() {
  const select = document.getElementById('ollama-model-select');
  if (!select) return;
  select.addEventListener('change', () => {
    if (IA_STATE.provider !== 'ollama') return; // en Gemini el modelo es fijo
    OLLAMA.model = select.value;
    localStorage.setItem('parksales_ollama_model', OLLAMA.model);
    toast(`Modelo cambiado a ${OLLAMA.model.split(':')[0]}`, 'success', 2000);
  });
}

function wireOllamaConfig() {
  const btn = document.getElementById('ollama-config-btn');
  if (!btn) return;
  btn.addEventListener('click', openOllamaConfigModal);
}

function wireClearChat() {
  const btn = document.getElementById('chat-ia-clear-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    IA_STATE.messages = [];
    const cont = document.getElementById('chat-ia-mensajes');
    if (cont) {
      cont.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 3.03 1.6 5.7 4 7.2V21l3.3-1.8a8.6 8.6 0 0 0 1.2.1 8.5 8.5 0 0 0 0-17z"/>
            <path d="M8 10h.01M12 10h.01M16 10h.01"/>
          </svg>
          <span>Escribe lo que necesites. Puedo ayudarte con cualquier pregunta.</span>
        </div>`;
    }
    toast('Conversación limpiada', 'success', 1500);
  });
}

function actualizarBtnEnviar() {
  const btn = document.querySelector('#chat-ia-form button[type="submit"]');
  if (!btn) return;
  const generating = isGenerating();
  btn.disabled = generating;
  if (generating) {
    btn.classList.add('generating');
  } else {
    btn.classList.remove('generating');
  }
}

function pintarMensajeIA(rol, html) {
  const cont = document.getElementById('chat-ia-mensajes');
  if (!cont) return;
  const empty = cont.querySelector('.empty-state');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = `chat-ia-msg ${rol}`;
  div.innerHTML = html;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

function crearBurbujaBot() {
  const cont = document.getElementById('chat-ia-mensajes');
  if (!cont) return null;
  const empty = cont.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'chat-ia-msg bot';
  div.innerHTML = `
    <div class="chat-ia-typing">
      <span></span><span></span><span></span>
    </div>`;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
  return div;
}

function actualizarBurbujaBot(bubble, rawText) {
  if (!bubble) return;
  bubble.innerHTML = `<div class="chat-ia-markdown">${renderMarkdownBasico(rawText)}</div>`;
  const cont = document.getElementById('chat-ia-mensajes');
  if (cont) cont.scrollTop = cont.scrollHeight;
}

/* --- Renderizado de markdown básico --- */

function renderMarkdownBasico(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Bloques de código (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Código inline (`...`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Negritas (**...**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Cursivas (*...*)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Listas con guión
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Listas numeradas
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');

  // Párrafos (doble newline)
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  return `<p>${html}</p>`;
}

/* -------------------------------------------------------------------------- */
/* 6. FRASES PARA EMAIL (se mantienen intactas)                               */
/* -------------------------------------------------------------------------- */

const FRASES_EMAIL = [
  { cat: 'Saludo inicial', texto: 'Espero que este correo le encuentre bien.' },
  { cat: 'Saludo inicial', texto: 'Gracias por ponerse en contacto con nosotros.' },
  { cat: 'Saludo inicial', texto: 'En respuesta a su consulta, le facilito la siguiente información.' },
  { cat: 'Agradecimiento', texto: 'Muchas gracias por su paciencia mientras resolvíamos esta incidencia.' },
  { cat: 'Agradecimiento', texto: 'Le agradecemos que haya confiado en nosotros para su visita.' },
  { cat: 'Agradecimiento', texto: 'Gracias por avisarnos, lo revisamos enseguida.' },
  { cat: 'Confirmación', texto: 'Le confirmo que su reserva ha quedado registrada correctamente.' },
  { cat: 'Confirmación', texto: 'Adjunto encontrará el justificante de su compra.' },
  { cat: 'Confirmación', texto: 'Todo queda confirmado tal y como lo hemos hablado.' },
  { cat: 'Pedir información', texto: '¿Podría confirmarme la fecha y el número de personas para poder ayudarle mejor?' },
  { cat: 'Pedir información', texto: 'Para poder tramitarlo, necesitaría que me facilite los siguientes datos.' },
  { cat: 'Pedir información', texto: 'Quedo a la espera de su respuesta para continuar con la gestión.' },
  { cat: 'Seguimiento', texto: 'Le escribo para hacer seguimiento de nuestra conversación anterior.' },
  { cat: 'Seguimiento', texto: '¿Ha tenido oportunidad de revisar la información que le enviamos?' },
  { cat: 'Seguimiento', texto: 'Si necesita cualquier aclaración adicional, no dude en escribirme.' },
  { cat: 'Disculpa / incidencia', texto: 'Lamentamos las molestias ocasionadas y ya estamos trabajando en solucionarlo.' },
  { cat: 'Disculpa / incidencia', texto: 'Sentimos mucho el retraso en nuestra respuesta.' },
  { cat: 'Disculpa / incidencia', texto: 'Entendemos su malestar y vamos a solucionarlo lo antes posible.' },
  { cat: 'Adjuntos', texto: 'Le adjunto el documento solicitado en formato PDF.' },
  { cat: 'Adjuntos', texto: 'Encontrará toda la información detallada en el archivo adjunto.' },
  { cat: 'Cierre', texto: 'Quedo a su disposición para cualquier duda adicional.' },
  { cat: 'Cierre', texto: 'Un cordial saludo y feliz visita.' },
  { cat: 'Cierre', texto: 'Gracias de nuevo por su confianza, un saludo.' },
  { cat: 'Cierre', texto: 'No dude en contactarnos si necesita cualquier otra cosa.' },
  { cat: 'Recordatorio', texto: 'Le recordamos que la promoción está disponible hasta fin de mes.' },
  { cat: 'Recordatorio', texto: 'Este es un recordatorio de que su cita está programada para mañana.' },
  { cat: 'Urgente', texto: 'Le escribo con carácter urgente para tratar el siguiente asunto.' },
  { cat: 'Urgente', texto: 'Agradecería una respuesta a la mayor brevedad posible.' },
];

function wireFrasesBuscador() {
  const input = document.getElementById('chat-ia-frases-buscador');
  if (!input) return;
  input.addEventListener('input', debounce((e) => renderFrases(e.target.value.trim().toLowerCase()), 150));
}

function renderFrases(filtro) {
  const cont = document.getElementById('chat-ia-frases-list');
  if (!cont) return;
  const items = FRASES_EMAIL.filter((f) =>
    !filtro || f.texto.toLowerCase().includes(filtro) || f.cat.toLowerCase().includes(filtro)
  );

  if (items.length === 0) {
    cont.innerHTML = `<div class="empty-state"><span>No hay frases que coincidan con "${escapeHtml(filtro)}".</span></div>`;
    return;
  }

  const categorias = [...new Set(items.map((f) => f.cat))];
  cont.innerHTML = categorias.map((cat) => `
    <div class="frase-cat-title">${escapeHtml(cat)}</div>
    ${items.filter((f) => f.cat === cat).map((f) => `
      <div class="frase-item">
        <span>${escapeHtml(f.texto)}</span>
        <button class="btn btn-secondary btn-sm frase-copy-btn" data-texto="${escapeHtml(f.texto)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar
        </button>
      </div>
    `).join('')}
  `).join('');

  cont.querySelectorAll('.frase-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.texto);
        toast('Frase copiada al portapapeles.', 'success', 1800);
      } catch {
        toast('No se ha podido copiar automáticamente, selecciónala a mano.', 'error');
      }
    });
  });
}
