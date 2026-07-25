/* ============================================================================
   chat-ia.js — "Chat IA" interno de ParkSales
   ----------------------------------------------------------------------------
   Esto NO llama a ninguna API de inteligencia artificial ni sale a internet.
   Es un buscador local: tú le das archivos y/o texto de páginas web, la app
   los trocea e indexa en el navegador, y cuando preguntas algo te devuelve
   los fragmentos de TUS documentos que mejor encajan con la pregunta.

   Además incluye una biblioteca de frases hechas para redactar correos.

   Estructura:
   1. CHAT_DB       → guardado de fuentes (Supabase si está configurado,
                       si no localStorage) — igual de simple que el resto de
                       la app.
   2. Extracción     → texto plano, PDF (pdf.js) y Word (mammoth.js).
   3. Motor de búsqueda → tokenizado + trocitos (chunks) + puntuación
                       tipo TF-IDF, 100% en el navegador.
   4. UI             → pestañas Fuentes / Preguntar / Frases de email.
============================================================================ */

/* ------------------------------------------------------------------------ */
/* 1. ALMACENAMIENTO DE FUENTES                                             */
/* ------------------------------------------------------------------------ */

const CHAT_LOCAL_KEY = 'parksales_chat_fuentes';

function getFuentesLocal() {
  try { return JSON.parse(localStorage.getItem(CHAT_LOCAL_KEY)) || []; }
  catch { return []; }
}
function saveFuentesLocal(list) {
  localStorage.setItem(CHAT_LOCAL_KEY, JSON.stringify(list));
}

const CHAT_DB = {
  async getFuentes() {
    if (SUPABASE_CONFIGURED) {
      const { data, error } = await supabaseClient
        .from('chat_fuentes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.error('chat_fuentes select:', error); return getFuentesLocal(); }
      return data || [];
    }
    return getFuentesLocal();
  },

  async addFuente(fuente) {
    if (SUPABASE_CONFIGURED) {
      const { data, error } = await supabaseClient
        .from('chat_fuentes')
        .insert([fuente])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const row = { id: uid(), created_at: new Date().toISOString(), ...fuente };
    const list = getFuentesLocal();
    list.unshift(row);
    saveFuentesLocal(list);
    return row;
  },

  async deleteFuente(id) {
    if (SUPABASE_CONFIGURED) {
      const { error } = await supabaseClient.from('chat_fuentes').delete().eq('id', id);
      if (error) throw error;
      return;
    }
    saveFuentesLocal(getFuentesLocal().filter((f) => f.id !== id));
  },
};

/* ------------------------------------------------------------------------ */
/* 2. EXTRACCIÓN DE TEXTO DE ARCHIVOS                                       */
/* ------------------------------------------------------------------------ */

const CHAT_EXT_TEXTO = ['txt', 'md', 'csv', 'json', 'log'];

function fileExt(name) {
  return (name.split('.').pop() || '').toLowerCase();
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsText(file, 'utf-8');
  });
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsArrayBuffer(file);
  });
}

async function extraerTextoPDF(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('El lector de PDF no se ha cargado (revisa tu conexión a internet la primera vez).');
  }
  const buffer = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => it.str).join(' ') + '\n\n';
  }
  return texto.trim();
}

async function extraerTextoDOCX(file) {
  if (typeof mammoth === 'undefined') {
    throw new Error('El lector de Word no se ha cargado (revisa tu conexión a internet la primera vez).');
  }
  const buffer = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return (result.value || '').trim();
}

async function extraerTextoArchivo(file) {
  const ext = fileExt(file.name);
  if (ext === 'pdf') return extraerTextoPDF(file);
  if (ext === 'docx') return extraerTextoDOCX(file);
  if (ext === 'doc') {
    throw new Error('Los .doc antiguos no se pueden leer, guarda el archivo como .docx o .pdf.');
  }
  if (CHAT_EXT_TEXTO.includes(ext)) return readAsText(file);
  throw new Error(`Formato .${ext} no soportado. Usa .txt, .md, .csv, .json, .pdf o .docx.`);
}

/* ------------------------------------------------------------------------ */
/* 3. MOTOR DE BÚSQUEDA LOCAL (tokenizado + chunks + TF-IDF simplificado)   */
/* ------------------------------------------------------------------------ */

const CHAT_STOPWORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por',
  'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero',
  'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando',
  'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien',
  'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra',
  'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos',
  'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos',
  'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas',
  'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus',
  'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos',
  'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
  'es', 'son', 'fue', 'ser', 'está', 'están', 'soy', 'eres', 'somos',
]);

function quitarAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text) {
  return quitarAcentos(String(text).toLowerCase())
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !CHAT_STOPWORDS.has(t));
}

// Trocea un texto largo en fragmentos solapados para no perder contexto
// en los saltos entre trozos.
function chunkText(text, chunkWords = 130, overlapWords = 35) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += chunkWords - overlapWords;
  }
  return chunks;
}

function buildChunkIndex(fuentes) {
  const chunks = [];
  fuentes.forEach((f) => {
    chunkText(f.contenido).forEach((texto, i) => {
      chunks.push({ fuenteId: f.id, fuenteNombre: f.nombre, tipo: f.tipo, origen: f.origen, chunkIndex: i, texto, tokens: tokenize(texto) });
    });
  });
  return chunks;
}

// Puntuación tipo TF-IDF muy simplificada: para cada término de la pregunta,
// suma su frecuencia en el chunk ponderada por lo raro que sea ese término
// en el conjunto de chunks (así "parque" pesa menos que un término concreto
// que solo aparece un par de veces). Sin librerías externas.
function scoreChunks(queryTokens, chunks) {
  if (queryTokens.length === 0 || chunks.length === 0) return [];
  const N = chunks.length;
  const df = {};
  queryTokens.forEach((term) => {
    df[term] = chunks.filter((c) => c.tokens.includes(term)).length;
  });

  const scored = chunks.map((chunk) => {
    let score = 0;
    const tf = {};
    chunk.tokens.forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
    queryTokens.forEach((term) => {
      if (!tf[term]) return;
      const idf = Math.log((N + 1) / (df[term] + 1)) + 1;
      score += tf[term] * idf;
    });
    // Pequeña normalización para no premiar solo a los chunks larguísimos
    score = score / Math.sqrt(chunk.tokens.length || 1);
    return { ...chunk, score };
  });

  return scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
}

function resaltarTerminos(texto, queryTokens) {
  let html = escapeHtml(texto);
  const vistos = new Set();
  queryTokens.forEach((term) => {
    if (vistos.has(term) || term.length < 3) return;
    vistos.add(term);
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*)`, 'gi');
    html = html.replace(re, '<mark>$1</mark>');
  });
  return html;
}

// Responde una pregunta: primero busca solo en archivos; si no hay nada con
// una puntuación mínima decente, amplía la búsqueda a las webs guardadas.
function responderPregunta(pregunta, fuentes) {
  const queryTokens = tokenize(pregunta);
  if (queryTokens.length === 0) return { resultados: [], fallback: false, sinTerminos: true };

  const chunksArchivo = buildChunkIndex(fuentes.filter((f) => f.tipo === 'archivo'));
  let resultados = scoreChunks(queryTokens, chunksArchivo).slice(0, 5);
  let fallback = false;

  const UMBRAL_MINIMO = 0.35;
  if (resultados.length === 0 || resultados[0].score < UMBRAL_MINIMO) {
    const chunksWeb = buildChunkIndex(fuentes.filter((f) => f.tipo === 'web'));
    const resultadosWeb = scoreChunks(queryTokens, chunksWeb).slice(0, 5);
    if (resultadosWeb.length > 0 && (resultados.length === 0 || resultadosWeb[0].score > resultados[0]?.score)) {
      resultados = resultadosWeb;
      fallback = true;
    }
  }

  return { resultados, fallback, queryTokens, sinTerminos: false };
}

/* ------------------------------------------------------------------------ */
/* 4. INTERFAZ — pestañas, fuentes, chat de preguntas                       */
/* ------------------------------------------------------------------------ */

const CHAT_STATE = { fuentes: [], tab: 'preguntar' };

function initChatIA() {
  wireChatTabs();
  wireFuentesForm();
  wireChatForm();
  wireFrasesBuscador();
  renderFrases('');
  cargarFuentes();
}

async function cargarFuentes() {
  try {
    CHAT_STATE.fuentes = await CHAT_DB.getFuentes();
  } catch (err) {
    console.error(err);
    toast('No se pudieron cargar las fuentes guardadas: ' + err.message, 'error');
    CHAT_STATE.fuentes = getFuentesLocal();
  }
  renderFuentesList();
  actualizarContadorFuentes();
}

function wireChatTabs() {
  document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      CHAT_STATE.tab = btn.dataset.tab;
      document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#view-chat-ia .chat-ia-panel').forEach((p) => p.classList.toggle('active', p.id === `chat-ia-panel-${btn.dataset.tab}`));
    });
  });
}

function actualizarContadorFuentes() {
  const nArchivos = CHAT_STATE.fuentes.filter((f) => f.tipo === 'archivo').length;
  const nWebs = CHAT_STATE.fuentes.filter((f) => f.tipo === 'web').length;
  const el = document.getElementById('chat-ia-fuentes-resumen');
  if (el) {
    el.textContent = CHAT_STATE.fuentes.length === 0
      ? 'Todavía no has añadido ninguna fuente.'
      : `${nArchivos} archivo${nArchivos === 1 ? '' : 's'} · ${nWebs} web${nWebs === 1 ? '' : 's'} guardadas`;
  }
}

/* ---- Alta de fuentes (archivo o web) ---- */

function wireFuentesForm() {
  const inputArchivo = document.getElementById('chat-ia-file-input');
  const btnArchivo = document.getElementById('chat-ia-file-btn');
  btnArchivo.addEventListener('click', () => inputArchivo.click());
  inputArchivo.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await subirArchivo(file);
    inputArchivo.value = '';
  });

  // drag & drop
  const dropZone = document.getElementById('chat-ia-dropzone');
  ['dragover', 'dragenter'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', async (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    for (const file of files) await subirArchivo(file);
  });

  document.getElementById('chat-ia-web-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await añadirWeb();
  });

  document.getElementById('chat-ia-web-autofetch-btn').addEventListener('click', intentarDescargarWeb);
}

async function subirArchivo(file) {
  const MAX_MB = 8;
  if (file.size > MAX_MB * 1024 * 1024) {
    toast(`"${file.name}" pesa demasiado (máx. ${MAX_MB} MB).`, 'error');
    return;
  }
  toast(`Leyendo "${file.name}"…`, 'info', 2000);
  try {
    const texto = await extraerTextoArchivo(file);
    if (!texto || texto.trim().length < 5) {
      toast(`No se ha encontrado texto legible en "${file.name}".`, 'error');
      return;
    }
    const fuente = await CHAT_DB.addFuente({
      tipo: 'archivo',
      nombre: file.name,
      origen: file.name,
      contenido: texto,
      tamano_bytes: file.size,
    });
    CHAT_STATE.fuentes.unshift(fuente);
    renderFuentesList();
    actualizarContadorFuentes();
    toast(`"${file.name}" añadido (${tokenize(texto).length} palabras clave indexadas).`, 'success');
  } catch (err) {
    console.error(err);
    toast(`Error con "${file.name}": ${err.message}`, 'error', 5000);
  }
}

async function intentarDescargarWeb() {
  const urlInput = document.getElementById('chat-ia-web-url');
  const textarea = document.getElementById('chat-ia-web-texto');
  const url = urlInput.value.trim();
  if (!url) { toast('Escribe primero la URL de la web.', 'error'); return; }
  toast('Intentando descargar la página… si falla, pega el texto a mano.', 'info', 3000);
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) throw new Error('Respuesta no válida (' + resp.status + ')');
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript, nav, footer').forEach((el) => el.remove());
    const texto = (doc.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    if (!texto) throw new Error('La página no devolvió texto legible.');
    textarea.value = texto;
    toast('Texto descargado. Revísalo y pulsa "Guardar web".', 'success');
  } catch (err) {
    toast('No se ha podido descargar automáticamente (bloqueo CORS del sitio). Pega el texto a mano abajo.', 'error', 6000);
  }
}

async function añadirWeb() {
  const urlInput = document.getElementById('chat-ia-web-url');
  const nombreInput = document.getElementById('chat-ia-web-nombre');
  const textarea = document.getElementById('chat-ia-web-texto');
  const url = urlInput.value.trim();
  const nombre = nombreInput.value.trim() || url || 'Web sin nombre';
  const texto = textarea.value.trim();

  if (!texto) {
    toast('Pega o descarga el contenido de la web antes de guardar.', 'error');
    return;
  }

  try {
    const fuente = await CHAT_DB.addFuente({
      tipo: 'web',
      nombre,
      origen: url || null,
      contenido: texto,
      tamano_bytes: new Blob([texto]).size,
    });
    CHAT_STATE.fuentes.unshift(fuente);
    renderFuentesList();
    actualizarContadorFuentes();
    urlInput.value = '';
    nombreInput.value = '';
    textarea.value = '';
    toast(`Web "${nombre}" guardada.`, 'success');
  } catch (err) {
    console.error(err);
    toast('Error al guardar la web: ' + err.message, 'error');
  }
}

function renderFuentesList() {
  const cont = document.getElementById('chat-ia-fuentes-list');
  if (!cont) return;
  if (CHAT_STATE.fuentes.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>
        <span>Todavía no has añadido archivos ni webs. Sube algo arriba para empezar a preguntar.</span>
      </div>`;
    return;
  }
  cont.innerHTML = CHAT_STATE.fuentes.map((f) => `
    <div class="fuente-item">
      <div class="fuente-item-icon ${f.tipo}">
        ${f.tipo === 'archivo'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'}
      </div>
      <div class="fuente-item-info">
        <strong>${escapeHtml(f.nombre)}</strong>
        <span>${f.tipo === 'web' ? (f.origen ? escapeHtml(f.origen) : 'Texto pegado') : fmtBytes(f.tamano_bytes)} · ${tokenize(f.contenido).length} palabras clave</span>
      </div>
      <button class="btn btn-ghost btn-sm fuente-item-del" data-id="${f.id}" title="Eliminar esta fuente">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');

  cont.querySelectorAll('.fuente-item-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = CHAT_STATE.fuentes.find((x) => x.id === btn.dataset.id);
      confirmDialog({
        title: 'Eliminar fuente',
        message: `Se eliminará "${f?.nombre || ''}" y dejará de usarse para responder preguntas.`,
        onConfirm: async () => {
          await CHAT_DB.deleteFuente(btn.dataset.id);
          CHAT_STATE.fuentes = CHAT_STATE.fuentes.filter((x) => x.id !== btn.dataset.id);
          renderFuentesList();
          actualizarContadorFuentes();
          toast('Fuente eliminada.', 'success');
        },
      });
    });
  });
}

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---- Chat de preguntas ---- */

function wireChatForm() {
  const form = document.getElementById('chat-ia-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-ia-input');
    const pregunta = input.value.trim();
    if (!pregunta) return;
    input.value = '';
    procesarPregunta(pregunta);
  });
}

function pintarMensaje(rol, html) {
  const cont = document.getElementById('chat-ia-mensajes');
  const empty = cont.querySelector('.empty-state');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = `chat-ia-msg ${rol}`;
  div.innerHTML = html;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}

function procesarPregunta(pregunta) {
  pintarMensaje('user', `<p>${escapeHtml(pregunta)}</p>`);

  if (CHAT_STATE.fuentes.length === 0) {
    pintarMensaje('bot', `<p>Todavía no tengo ninguna fuente añadida. Ve a la pestaña <strong>Fuentes</strong> y sube algún archivo o web primero.</p>`);
    return;
  }

  const { resultados, fallback, sinTerminos } = responderPregunta(pregunta, CHAT_STATE.fuentes);

  if (sinTerminos) {
    pintarMensaje('bot', `<p>No he podido sacar ninguna palabra clave de esa pregunta, intenta reformularla.</p>`);
    return;
  }

  if (resultados.length === 0) {
    pintarMensaje('bot', `<p>No he encontrado nada relacionado en tus archivos ni en tus webs guardadas.</p>`);
    return;
  }

  const queryTokens = tokenize(pregunta);
  const avisoFallback = fallback
    ? `<p class="chat-ia-aviso">No encontré nada claro en tus archivos, esto viene de tus webs guardadas:</p>`
    : '';

  const bloques = resultados.slice(0, 3).map((r) => `
    <div class="chat-ia-resultado">
      <div class="chat-ia-resultado-fuente">
        ${r.tipo === 'archivo' ? '📄' : '🌐'} <strong>${escapeHtml(r.fuenteNombre)}</strong>
      </div>
      <p>${resaltarTerminos(r.texto, queryTokens)}</p>
    </div>
  `).join('');

  pintarMensaje('bot', `${avisoFallback}${bloques}`);
}

/* ------------------------------------------------------------------------ */
/* 5. FRASES PARA EMAIL                                                     */
/* ------------------------------------------------------------------------ */

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
  input.addEventListener('input', debounce((e) => renderFrases(e.target.value.trim().toLowerCase()), 150));
}

function renderFrases(filtro) {
  const cont = document.getElementById('chat-ia-frases-list');
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
