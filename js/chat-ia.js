/* ============================================================================
   chat-ia.js — Asistente IA con doble backend: Ollama (local) + Gemini (nube)
   ----------------------------------------------------------------------------
   Permite usar el asistente de IA tanto desde localhost (Ollama) como desde
   GitHub Pages o cualquier otro dispositivo (Google Gemini API).

   Estructura:
   1. CONFIGURACIÓN   → URLs, API keys, system prompt, estado.
   2. BACKEND          → selector de backend, auto-detección.
   3. OLLAMA           → conexión y chat con Ollama local.
   4. GEMINI           → conexión y chat con Google Gemini API.
   5. CHAT COMÚN       → envío de mensajes según backend activo.
   6. RENDERIZADO      → burbujas de chat, markdown básico, animaciones.
   7. FRASES DE EMAIL  → se mantienen del sistema anterior.
============================================================================ */

/* -------------------------------------------------------------------------- */
/* 1. CONFIGURACIÓN                                                           */
/* -------------------------------------------------------------------------- */

const OLLAMA = {
  baseUrl: 'http://localhost:11434',
  model: localStorage.getItem('parksales_ollama_model') || '',
  connected: false,
  models: [],
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

const GEMINI = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: localStorage.getItem('parksales_gemini_apikey') || '',
  model: localStorage.getItem('parksales_gemini_model') || 'gemini-2.0-flash',
  connected: false,
  availableModels: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
};

const CHAT_STATE = {
  messages: [],
  generating: false,
  // 'ollama' | 'gemini'
  activeBackend: localStorage.getItem('parksales_chat_backend') || 'gemini',
};

/* -------------------------------------------------------------------------- */
/* 2. BACKEND — selector y auto-detección                                     */
/* -------------------------------------------------------------------------- */

function getActiveBackend() {
  return CHAT_STATE.activeBackend;
}

function setActiveBackend(backend) {
  CHAT_STATE.activeBackend = backend;
  localStorage.setItem('parksales_chat_backend', backend);
  updateBackendUI();
}

/** Actualiza toda la UI de la toolbar según el backend activo */
function updateBackendUI() {
  const backend = getActiveBackend();
  const ollamaStatusEl = document.getElementById('ollama-status');
  const ollamaSelectEl = document.getElementById('ollama-model-select');
  const geminiStatusEl = document.getElementById('gemini-status');
  const geminiSelectEl = document.getElementById('gemini-model-select');
  const geminiConfigBtn = document.getElementById('gemini-config-btn');
  const backendSelect = document.getElementById('chat-ia-backend-select');

  if (backendSelect) backendSelect.value = backend;

  // Mostrar/ocultar elementos según backend
  const ollamaEls = [ollamaStatusEl, ollamaSelectEl];
  const geminiEls = [geminiStatusEl, geminiSelectEl, geminiConfigBtn];

  ollamaEls.forEach((el) => { if (el) el.style.display = backend === 'ollama' ? '' : 'none'; });
  geminiEls.forEach((el) => { if (el) el.style.display = backend === 'gemini' ? '' : 'none'; });
}

function wireBackendSelector() {
  const select = document.getElementById('chat-ia-backend-select');
  if (!select) return;
  select.addEventListener('change', () => {
    const newBackend = select.value;
    if (newBackend === 'ollama' && !OLLAMA.connected) {
      toast('Ollama no está conectado. Comprueba que está ejecutándose en tu PC.', 'error');
    }
    if (newBackend === 'gemini' && !GEMINI.apiKey) {
      toast('Configura tu API Key de Gemini para usar este backend.', 'info');
      openGeminiConfigModal();
    }
    setActiveBackend(newBackend);
  });
}

/** Auto-detect: si Ollama conecta, sugerir Ollama; si no, usar Gemini */
async function autoDetectBackend() {
  const ollamaOk = await checkOllamaStatus();
  if (ollamaOk && getActiveBackend() === 'gemini' && !GEMINI.apiKey) {
    // Ollama está disponible y no hay key de Gemini → usar Ollama
    setActiveBackend('ollama');
  } else if (!ollamaOk && getActiveBackend() === 'ollama') {
    // Ollama cayó → cambiar a Gemini
    setActiveBackend('gemini');
    if (!GEMINI.apiKey) {
      toast('Ollama no disponible. Configura la API Key de Gemini para usar el asistente.', 'info');
    }
  }
  await checkGeminiStatus();
  updateBackendUI();
}

/* -------------------------------------------------------------------------- */
/* 3. CONEXIÓN CON OLLAMA                                                     */
/* -------------------------------------------------------------------------- */

async function checkOllamaStatus() {
  const statusEl = document.getElementById('ollama-status');
  const statusDot = document.getElementById('ollama-status-dot');
  const statusText = document.getElementById('ollama-status-text');
  const selectEl = document.getElementById('ollama-model-select');

  try {
    const resp = await fetch(`${OLLAMA.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) throw new Error('Respuesta no válida');
    const data = await resp.json();

    OLLAMA.connected = true;
    OLLAMA.models = (data.models || []).map((m) => m.name);

    if (statusDot) statusDot.className = 'ollama-dot connected';
    if (statusText) statusText.textContent = 'Conectado';
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

/* ---- Chat con Ollama (streaming) ---- */

async function sendToOllama(userMessage, botBubble) {
  try {
    const body = {
      model: OLLAMA.model,
      messages: [
        { role: 'system', content: OLLAMA.systemPrompt },
        ...CHAT_STATE.messages,
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

    return fullResponse;
  } catch (err) {
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* 4. CONEXIÓN CON GEMINI                                                     */
/* -------------------------------------------------------------------------- */

async function checkGeminiStatus() {
  const statusEl = document.getElementById('gemini-status');
  const statusDot = document.getElementById('gemini-status-dot');
  const statusText = document.getElementById('gemini-status-text');

  if (!GEMINI.apiKey) {
    GEMINI.connected = false;
    if (statusDot) statusDot.className = 'ollama-dot disconnected';
    if (statusText) statusText.textContent = 'Sin API Key';
    if (statusEl) statusEl.className = 'ollama-status disconnected';
    return false;
  }

  try {
    const resp = await fetch(
      `${GEMINI.baseUrl}/models?key=${GEMINI.apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Error ${resp.status}`);
    }

    GEMINI.connected = true;
    if (statusDot) statusDot.className = 'ollama-dot connected';
    if (statusText) statusText.textContent = 'Conectado';
    if (statusEl) statusEl.className = 'ollama-status connected';
    return true;
  } catch (err) {
    GEMINI.connected = false;
    if (statusDot) statusDot.className = 'ollama-dot disconnected';
    if (statusText) statusText.textContent = 'Error';
    if (statusEl) statusEl.className = 'ollama-status disconnected';
    return false;
  }
}

function wireGeminiModelSelect() {
  const select = document.getElementById('gemini-model-select');
  if (!select) return;

  // Llenar opciones
  select.innerHTML = GEMINI.availableModels.map((m) =>
    `<option value="${m.id}" ${m.id === GEMINI.model ? 'selected' : ''}>${m.name}</option>`
  ).join('');

  select.addEventListener('change', () => {
    GEMINI.model = select.value;
    localStorage.setItem('parksales_gemini_model', GEMINI.model);
    const modelName = GEMINI.availableModels.find((m) => m.id === GEMINI.model)?.name || GEMINI.model;
    toast(`Modelo cambiado a ${modelName}`, 'success', 2000);
  });
}

function wireGeminiConfig() {
  const btn = document.getElementById('gemini-config-btn');
  if (!btn) return;
  btn.addEventListener('click', openGeminiConfigModal);
}

function openGeminiConfigModal() {
  const currentKey = GEMINI.apiKey;
  const masked = currentKey ? currentKey.slice(0, 8) + '••••••••' + currentKey.slice(-4) : '';

  openModal({
    title: '🔑 Configurar API Key de Gemini',
    bodyHtml: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <p style="color:var(--text-secondary);font-size:13px;line-height:1.6;margin:0;">
          Para usar el asistente IA desde la nube, necesitas una API Key gratuita de Google AI.
        </p>
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
           style="display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-size:13px;font-weight:600;text-decoration:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Obtener API Key en Google AI Studio (gratis)
        </a>
        ${masked ? `<p style="color:var(--text-muted);font-size:12px;margin:0;">Key actual: <code style="color:var(--accent);">${escapeHtml(masked)}</code></p>` : ''}
        <input type="text" id="gemini-apikey-input"
          placeholder="Pega aquí tu API Key (ej: AIzaSy...)"
          value="${escapeHtml(currentKey)}"
          style="width:100%;padding:10px 14px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);color:var(--text-primary);font-size:13px;outline:none;">
        <p style="color:var(--text-muted);font-size:11.5px;margin:0;line-height:1.5;">
          ℹ️ La API Key se guarda solo en este navegador (localStorage). Nunca se sube a GitHub ni se comparte.
        </p>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="gemini-config-cancel">Cancelar</button>
      ${currentKey ? '<button class="btn btn-danger btn-sm" id="gemini-config-remove">Eliminar Key</button>' : ''}
      <button class="btn btn-primary" id="gemini-config-save">Guardar</button>
    `,
    width: '480px',
  });

  document.getElementById('gemini-config-cancel').addEventListener('click', closeModal);

  const removeBtn = document.getElementById('gemini-config-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      GEMINI.apiKey = '';
      localStorage.removeItem('parksales_gemini_apikey');
      GEMINI.connected = false;
      checkGeminiStatus();
      updateBackendUI();
      closeModal();
      toast('API Key de Gemini eliminada.', 'success', 2000);
    });
  }

  document.getElementById('gemini-config-save').addEventListener('click', async () => {
    const input = document.getElementById('gemini-apikey-input');
    const key = input.value.trim();
    if (!key) {
      toast('Introduce una API Key válida.', 'error');
      return;
    }
    // Validar probando la API
    GEMINI.apiKey = key;
    localStorage.setItem('parksales_gemini_apikey', key);

    const ok = await checkGeminiStatus();
    if (ok) {
      toast('✅ API Key de Gemini configurada correctamente.', 'success');
      updateBackendUI();
      closeModal();
    } else {
      toast('❌ La API Key no es válida o hay un error de conexión. Revísala.', 'error');
      GEMINI.apiKey = currentKey; // Revertir
      localStorage.setItem('parksales_gemini_apikey', currentKey);
    }
  });
}

/* ---- Chat con Gemini (streaming) ---- */

async function sendToGemini(userMessage, botBubble) {
  if (!GEMINI.apiKey) {
    throw new Error('No hay API Key de Gemini configurada.');
  }

  try {
    // Construir historial en formato Gemini
    const contents = [];

    // System instruction se envía aparte en Gemini
    const geminiMessages = CHAT_STATE.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    contents.push(...geminiMessages);

    const body = {
      contents,
      systemInstruction: {
        parts: [{ text: OLLAMA.systemPrompt }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    const url = `${GEMINI.baseUrl}/models/${GEMINI.model}:streamGenerateContent?alt=sse&key=${GEMINI.apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `Error ${resp.status}`;
      throw new Error(errMsg);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Gemini SSE: cada evento empieza con "data: " seguido de JSON
      const lines = buffer.split('\n');
      buffer = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);
            if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                  fullResponse += part.text;
                  actualizarBurbujaBot(botBubble, fullResponse);
                }
              }
            }
          } catch (e) {
            // JSON incompleto, guardar para la siguiente iteración
            // Solo si es la última línea (puede estar cortada)
            if (i === lines.length - 1) {
              buffer = line;
            }
          }
        } else if (line.trim() === '' || line.startsWith(':')) {
          // Línea vacía o comentario SSE, ignorar
        } else {
          // Puede ser continuación de una línea cortada
          if (i === lines.length - 1) {
            buffer = line;
          }
        }
      }
    }

    return fullResponse;
  } catch (err) {
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* 5. CHAT COMÚN — envío según backend activo                                 */
/* -------------------------------------------------------------------------- */

async function sendChatMessage(userMessage) {
  if (CHAT_STATE.generating) return;

  const backend = getActiveBackend();

  // Validaciones
  if (backend === 'ollama') {
    if (!OLLAMA.connected) {
      pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ Ollama no está conectado. Asegúrate de que está ejecutándose en tu PC, o cambia al backend Gemini.</p>');
      return;
    }
    if (!OLLAMA.model) {
      pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ No hay ningún modelo seleccionado. Descarga uno en Ollama (ej: <code>ollama pull llama3.2</code>).</p>');
      return;
    }
  } else if (backend === 'gemini') {
    if (!GEMINI.apiKey) {
      pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ No hay API Key de Gemini configurada. Haz clic en ⚙️ para configurarla.</p>');
      openGeminiConfigModal();
      return;
    }
  }

  // Añadir mensaje del usuario al historial
  CHAT_STATE.messages.push({ role: 'user', content: userMessage });
  pintarMensajeIA('user', `<p>${escapeHtml(userMessage)}</p>`);

  // Crear burbuja del bot con indicador de escritura
  const botBubble = crearBurbujaBot();
  CHAT_STATE.generating = true;
  actualizarBtnEnviar();

  try {
    let fullResponse = '';

    if (backend === 'ollama') {
      fullResponse = await sendToOllama(userMessage, botBubble);
    } else {
      fullResponse = await sendToGemini(userMessage, botBubble);
    }

    // Si no hubo respuesta
    if (!fullResponse) {
      actualizarBurbujaBot(botBubble, '_El modelo no devolvió ninguna respuesta._');
    }

    // Guardar respuesta en historial
    CHAT_STATE.messages.push({ role: 'assistant', content: fullResponse || '' });

  } catch (err) {
    console.error(`Error ${backend}:`, err);
    actualizarBurbujaBot(botBubble, `⚠️ Error al comunicarse con ${backend === 'ollama' ? 'Ollama' : 'Gemini'}: ${err.message}`);
    // Quitar el mensaje del usuario del historial si falló
    CHAT_STATE.messages.pop();
  } finally {
    CHAT_STATE.generating = false;
    actualizarBtnEnviar();
  }
}

/* -------------------------------------------------------------------------- */
/* 6. RENDERIZADO — UI del chat                                               */
/* -------------------------------------------------------------------------- */

function initChatIA() {
  wireChatIATabs();
  wireChatIAForm();
  wireModelSelect();
  wireBackendSelector();
  wireGeminiModelSelect();
  wireGeminiConfig();
  wireClearChat();
  wireFrasesBuscador();
  renderFrases('');

  // Detección y comprobación inicial
  autoDetectBackend();
  // Recomprobar cada 15 segundos
  setInterval(async () => {
    await checkOllamaStatus();
    await checkGeminiStatus();
  }, 15000);
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
    if (!msg || CHAT_STATE.generating) return;
    input.value = '';
    sendChatMessage(msg);
  });

  // Enter para enviar (shift+enter para nueva línea si fuera textarea)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
}

function wireModelSelect() {
  const select = document.getElementById('ollama-model-select');
  if (!select) return;
  select.addEventListener('change', () => {
    OLLAMA.model = select.value;
    localStorage.setItem('parksales_ollama_model', OLLAMA.model);
    toast(`Modelo cambiado a ${OLLAMA.model.split(':')[0]}`, 'success', 2000);
  });
}

function wireClearChat() {
  const btn = document.getElementById('chat-ia-clear-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    CHAT_STATE.messages = [];
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
  btn.disabled = CHAT_STATE.generating;
  if (CHAT_STATE.generating) {
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
/* 7. FRASES PARA EMAIL (se mantienen intactas)                               */
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
