/* ============================================================================
   chat-ia.js — Asistente IA local con Ollama
   ----------------------------------------------------------------------------
   Se conecta a Ollama corriendo en localhost:11434 para ofrecer un asistente
   de IA real dentro de ParkSales. Requiere que el PC esté encendido y Ollama
   activo con al menos un modelo descargado.

   Estructura:
   1. CONFIGURACIÓN   → URL de Ollama, system prompt, estado.
   2. CONEXIÓN        → ping a Ollama, obtener modelos disponibles.
   3. CHAT            → envío de mensajes, streaming de respuestas.
   4. RENDERIZADO     → burbujas de chat, markdown básico, animaciones.
   5. FRASES DE EMAIL → se mantienen del sistema anterior.
============================================================================ */

/* -------------------------------------------------------------------------- */
/* 1. CONFIGURACIÓN                                                           */
/* -------------------------------------------------------------------------- */

const OLLAMA = {
  baseUrl: 'http://localhost:11434',
  model: localStorage.getItem('parksales_ollama_model') || '',
  connected: false,
  models: [],
  messages: [],
  generating: false,
  systemPrompt: `Eres el asistente de IA de ParkSales, una aplicación de gestión de ventas de entradas a parques de ocio. Responde siempre en español.

Reglas:
- Sé amable, natural y conciso.
- Si el usuario te saluda ("Hola", "Buenos días", etc.), responde con un saludo cordial y ofrécele tu ayuda.
- Si te preguntan sobre algo específico, responde con tu mejor conocimiento.
- Si no sabes algo, dilo con honestidad. No inventes datos.
- Puedes usar formato: **negrita**, *cursiva*, listas con - o números, y \`código\`.
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

/* -------------------------------------------------------------------------- */
/* 3. CHAT CON OLLAMA (streaming)                                             */
/* -------------------------------------------------------------------------- */

async function sendToOllama(userMessage) {
  if (OLLAMA.generating) return;
  if (!OLLAMA.connected) {
    pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ Ollama no está conectado. Asegúrate de que está ejecutándose en tu PC.</p>');
    return;
  }
  if (!OLLAMA.model) {
    pintarMensajeIA('bot', '<p class="chat-ia-error">⚠️ No hay ningún modelo seleccionado. Descarga uno en Ollama (ej: <code>ollama pull llama3.2</code>).</p>');
    return;
  }

  // Añadir mensaje del usuario al historial
  OLLAMA.messages.push({ role: 'user', content: userMessage });
  pintarMensajeIA('user', `<p>${escapeHtml(userMessage)}</p>`);

  // Crear burbuja del bot con indicador de escritura
  const botBubble = crearBurbujaBot();
  OLLAMA.generating = true;
  actualizarBtnEnviar();

  try {
    const body = {
      model: OLLAMA.model,
      messages: [
        { role: 'system', content: OLLAMA.systemPrompt },
        ...OLLAMA.messages,
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
    OLLAMA.messages.push({ role: 'assistant', content: fullResponse });

  } catch (err) {
    console.error('Error Ollama:', err);
    actualizarBurbujaBot(botBubble, `⚠️ Error al comunicarse con Ollama: ${err.message}`);
    // Quitar el mensaje del usuario del historial si falló
    OLLAMA.messages.pop();
  } finally {
    OLLAMA.generating = false;
    actualizarBtnEnviar();
  }
}

/* -------------------------------------------------------------------------- */
/* 4. RENDERIZADO — UI del chat                                               */
/* -------------------------------------------------------------------------- */

function initChatIA() {
  wireChatIATabs();
  wireChatIAForm();
  wireModelSelect();
  wireClearChat();
  wireFrasesBuscador();
  renderFrases('');

  // Comprobar conexión con Ollama al arrancar
  checkOllamaStatus();
  // Recomprobar cada 15 segundos
  setInterval(checkOllamaStatus, 15000);
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
    if (!msg || OLLAMA.generating) return;
    input.value = '';
    sendToOllama(msg);
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
    OLLAMA.messages = [];
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
  btn.disabled = OLLAMA.generating;
  if (OLLAMA.generating) {
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
/* 5. FRASES PARA EMAIL (se mantienen intactas)                               */
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
