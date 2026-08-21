/* ============================================================================
   chat-ia.js — Redactor local de correos para ParkSales
   ----------------------------------------------------------------------------
   Sin APIs externas. Funciona 100% en navegador estático (GitHub Pages).
   Usa una base de conocimiento embebida + plantillas + reglas para ayudarte
   a redactar correos rápidos a clientes.
============================================================================ */

const MAIL_ASSISTANT_STATE = {
  draft: '',
  lastContext: null,
};


/* ────────────────────────────────────────────────
   Utilidades de caducidad de apuntes
──────────────────────────────────────────────── */

/** Devuelve los días restantes hasta la fecha (positivo = quedan días, negativo = caducado) */
function diasHastaExpiracion(expiresStr) {
  if (!expiresStr) return Infinity;
  const ahora = new Date();
  const tope = new Date(expiresStr + 'T23:59:59');
  return Math.floor((tope - ahora) / (1000 * 60 * 60 * 24));
}

/** Devuelve la clase CSS del chip según los días restantes */
function chipClass(dias) {
  if (dias < 0)  return 'chip-expired';
  if (dias <= 3) return 'chip-danger';
  if (dias <= 10) return 'chip-warning';
  return '';
}

function initChatIA() {
  if (typeof HALLOWEEN_KNOWLEDGE !== 'undefined') {
    Object.assign(MAIL_KNOWLEDGE.parques, HALLOWEEN_KNOWLEDGE.parques);
    if (HALLOWEEN_KNOWLEDGE.notes) {
      MAIL_KNOWLEDGE.notes.push(...HALLOWEEN_KNOWLEDGE.notes);
    }
  }

  wireChatIATabs();
  wireEmailAssistant();
  wireFrasesBuscador();
  renderFrases('');
  populateParkSelect();
  renderKnowledgeChips();
  renderEmptyEmailDraft();
}

function wireChatIATabs() {
  document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#view-chat-ia .chat-ia-tab').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('#view-chat-ia .chat-ia-panel').forEach((p) => p.classList.toggle('active', p.id === `chat-ia-panel-${btn.dataset.tab}`));
    });
  });
}

function wireEmailAssistant() {
  const form = document.getElementById('chat-ia-form');
  const copyBtn = document.getElementById('chat-ia-copy-btn');
  const clearBtn = document.getElementById('chat-ia-clear-btn');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    buildEmailDraft('normal');
  });

  clearBtn?.addEventListener('click', resetEmailAssistant);
  copyBtn?.addEventListener('click', copyGeneratedEmail);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectParks(rawText) {
  const text = normalizeText(rawText);
  const matched = [];
  for (const [key, park] of Object.entries(MAIL_KNOWLEDGE.parques)) {
    if (park.aliases.some((alias) => text.includes(normalizeText(alias)))) {
      matched.push(key);
    }
  }
  return matched;
}

function getParkFacts(parkKey) {
  if (!parkKey || !MAIL_KNOWLEDGE.parques[parkKey]) return [];
  const park = MAIL_KNOWLEDGE.parques[parkKey];
  // Si el apunte está caducado, no lo usa para redactar
  if (park.expires && diasHastaExpiracion(park.expires) < 0) return [];
  return park.facts;
}

function collectRelevantNotes(questionText, parkKey) {
  const combined = normalizeText(`${questionText} ${parkKey}`);
  const matches = [];

  MAIL_KNOWLEDGE.notes.forEach((note) => {
    const normalizedNote = normalizeText(note);
    const score = [
      'pago', 'autocompletado', 'bono', 'warner', 'selwo', 'reserva', '2 dias', '2 días', 'faunia', 'zoo', 'consultaentrada', 'cumple', 'rapido', 'rápido'
    ].reduce((acc, token) => acc + (combined.includes(normalizeText(token)) && normalizedNote.includes(normalizeText(token)) ? 1 : 0), 0);
    if (score > 0) matches.push({ note, score });
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, 4).map((item) => item.note);
}

function inferTone(questionText) {
  const text = normalizeText(questionText);
  const complaintTokens = ['queja', 'reclam', 'hoja de reclamaciones', 'denuncia', 'fatal', 'vergonz', 'decepcion', 'decepción', 'indign', 'mal servicio', 'experiencia mala', 'muy mal', 'no me devolvieron', 'quiero reclamar'];
  const lostItemTokens = [
    'objeto perdido', 'perdido', 'perdida', 'pérdida', 'se me cayo', 'se me cayó',
    'me deje', 'me dejé', 'olvide', 'olvidé', 'se me olvido', 'se me olvidó',
    'lo han encontrado', 'le han encontrado', 'han encontrado', 'deje', 'dejé',
    'mochila', 'movil', 'móvil', 'cartera'
  ];
  if (complaintTokens.some((token) => text.includes(normalizeText(token)))) return 'queja';
  if (lostItemTokens.some((token) => text.includes(normalizeText(token)))) return 'derivacion';
  return 'informativo';
}

function isDirectQuestion(questionText) {
  const text = normalizeText(questionText);
  const directTokens = [
    'tiene', 'tienen', 'hay', 'se puede', 'puede', 'cuesta', 'precio', 'parking',
    'cargador', 'cargadores', 'comida', 'speedy', 'vip', 'devolucion', 'devolución',
    'carrito', 'paraguas', 'mascotas', 'taquilla', 'taquillas', 'safari', 'wifi'
  ];
  return directTokens.some((token) => text.includes(normalizeText(token)));
}

function buildDirectAnswer(questionText, facts, parkKey) {
  const q = normalizeText(questionText);
  const normalizedFacts = facts.map((fact) => ({ raw: fact, normalized: normalizeText(fact) }));

  const exactChecks = [
    {
      tokens: ['cargador', 'cargadores', 'coche'],
      formatter: (fact) => fact.includes('no tienen')
        ? `No, en ${formatParkName(parkKey)} no tienen cargadores de coche.`
        : `Sí, en ${formatParkName(parkKey)} tienen cargadores de coche.`
    },
    {
      tokens: ['paraguas'],
      formatter: (fact) => fact.includes('si se puede') || fact.includes('sí se puede')
        ? `Sí, en ${formatParkName(parkKey)} se puede entrar con paraguas.`
        : `No, en ${formatParkName(parkKey)} no se puede entrar con paraguas.`
    },
    {
      tokens: ['carrito'],
      formatter: (fact) => fact.includes('no tienen problema') || fact.includes('sin problema')
        ? `Sí, en ${formatParkName(parkKey)} pueden acceder con carrito sin problema.`
        : fact
    },
    {
      tokens: ['comida'],
      formatter: (fact) => fact
    },
    {
      tokens: ['parking'],
      formatter: (fact) => fact
    },
    {
      tokens: ['speedy'],
      formatter: (fact) => fact
    },
    {
      tokens: ['wifi'],
      formatter: (fact) => fact
    }
  ];

  for (const rule of exactChecks) {
    if (!rule.tokens.some((token) => q.includes(token))) continue;
    const match = normalizedFacts.find((fact) => rule.tokens.some((token) => fact.normalized.includes(token)));
    if (match) return rule.formatter(match.raw);
  }

  return facts[0] || '';
}

function buildEmailDraft(mode = 'normal') {
  const customerName = '';
  const park = document.getElementById('chat-ia-park')?.value.trim() || '';
  const subject = '';
  const question = document.getElementById('chat-ia-input')?.value.trim() || '';
  const extraContext = '';
  const allDetected = park && park !== '__auto__' ? [park] : detectParks(`${question}`);
  const detectedPark = allDetected.length > 0 ? allDetected[0] : '';
  const tone = inferTone(`${question}`);

  const parkFacts = allDetected.flatMap(p => getParkFacts(p));
  const noteFacts = collectRelevantNotes(`${question}`, detectedPark);
  const allRelevantFacts = selectRelevantFacts(normalizeText(question), parkFacts, noteFacts, extraContext);
  const directMode = mode === 'normal' && detectedPark && isDirectQuestion(`${question}`) && allRelevantFacts.length > 0;

  if (tone === 'derivacion') {
    const finalDerivationText = [
      'Hola, buenos días, soy Javier. Le comento sobre lo que me dice:',
      '',
      MAIL_KNOWLEDGE.templates.derivacion,
      '',
      MAIL_KNOWLEDGE.templates.cierre.formal,
    ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

    MAIL_ASSISTANT_STATE.draft = finalDerivationText;
    MAIL_ASSISTANT_STATE.lastContext = { detectedPark, parkFacts, noteFacts, question, extraContext, subject };
    renderEmailDraft(finalDerivationText, detectedPark, parkFacts, noteFacts);
    return;
  }

  if (directMode) {
    const directAnswer = buildDirectAnswer(`${subject} ${question}`, allRelevantFacts, detectedPark);
    const finalDirectText = [
      customerName ? `Hola ${customerName},` : 'Hola,',
      '',
      cleanParagraph(directAnswer),
      '',
      MAIL_KNOWLEDGE.templates.cierre.formal,
    ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

    MAIL_ASSISTANT_STATE.draft = finalDirectText;
    MAIL_ASSISTANT_STATE.lastContext = { detectedPark, parkFacts, noteFacts, question, extraContext, subject };
    renderEmailDraft(finalDirectText, detectedPark, parkFacts, noteFacts);
    return;
  }

  const intro = customerName
    ? `Hola${mode === 'refined' ? ` ${customerName}` : ''}, buenos días, soy Javier. Le comento sobre lo que me dice:`
    : MAIL_KNOWLEDGE.templates.saludo.formal;

  const bodyParts = [];

  if (tone === 'queja') {
    bodyParts.push(MAIL_KNOWLEDGE.templates.disculpa);
    bodyParts.push(MAIL_KNOWLEDGE.templates.quejaConsultaEntrada);
  }

  if (tone === 'derivacion') {
    bodyParts.push(MAIL_KNOWLEDGE.templates.derivacion);
  }

  if (!bodyParts.length) {
    bodyParts.push(buildMainAnswerBlock({ detectedPark, parkFacts, noteFacts, question, extraContext, mode }));
  } else {
    const factualBlock = buildMainAnswerBlock({ detectedPark, parkFacts, noteFacts, question, extraContext, mode });
    if (factualBlock) bodyParts.push(factualBlock);
  }

  if (normalizeText(question).includes('newsletter')) {
    bodyParts.push(MAIL_KNOWLEDGE.templates.newsletter);
  }

  const followUp = buildFollowUpLine(question, detectedPark, parkFacts);
  if (followUp) bodyParts.push(followUp);

  const closing = mode === 'refined'
    ? MAIL_KNOWLEDGE.templates.cierre.disponible
    : MAIL_KNOWLEDGE.templates.cierre.formal;

  const finalText = [intro, '', ...bodyParts.filter(Boolean).map(cleanParagraph), '', closing]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  MAIL_ASSISTANT_STATE.draft = finalText;
  MAIL_ASSISTANT_STATE.lastContext = { detectedPark, parkFacts, noteFacts, question, extraContext, subject };
  renderEmailDraft(finalText, detectedPark, parkFacts, noteFacts);
}

function buildMainAnswerBlock({ detectedPark, parkFacts, noteFacts, question, extraContext, mode }) {
  const q = normalizeText(question);
  const pieces = [];

  if (detectedPark) {
    pieces.push(`Sobre ${formatParkName(detectedPark)}, te facilito la información que tengo:`);
  } else if (question) {
    pieces.push('Te facilito la información que tengo sobre tu consulta:');
  }

  const relevantFacts = selectRelevantFacts(q, parkFacts, noteFacts, extraContext);
  if (!relevantFacts.length && question) {
    return 'Con la información que tengo ahora mismo no puedo confirmártelo al 100%, pero si me indicas el parque y la fecha exacta te lo preparo mejor.';
  }

  if (mode === 'refined') {
    pieces.push(...relevantFacts.map((fact) => `- ${fact}`));
  } else {
    pieces.push(...relevantFacts.slice(0, 4).map((fact) => `- ${fact}`));
  }

  return pieces.join('\n');
}

function selectRelevantFacts(question, parkFacts, noteFacts, extraContext) {
  const query = normalizeText(`${question} ${extraContext}`);
  const allFacts = [...parkFacts, ...noteFacts];
  if (!query) return allFacts.slice(0, 5);

  const keywords = query.split(/\s+/).filter((word) => word.length > 3);
  const scored = allFacts.map((fact) => {
    const normalizedFact = normalizeText(fact);
    const score = keywords.reduce((acc, word) => acc + (normalizedFact.includes(word) ? 1 : 0), 0);
    return { fact, score };
  });

  const withScore = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.fact);
  return withScore.length ? withScore : allFacts.slice(0, 5);
}

function buildFollowUpLine(question, detectedPark, parkFacts) {
  const q = normalizeText(question);
  const tone = inferTone(question);
  if (tone === 'derivacion' || tone === 'queja') {
    return '';
  }
  if (q.includes('precio') || q.includes('tarifa') || q.includes('cuanto') || q.includes('cuánto')) {
    return 'Si me indica la fecha exacta de visita, le puedo concretar mejor las opciones disponibles.';
  }
  if (q.includes('vip') || q.includes('speedy') || q.includes('all inclusive')) {
    return 'Si me especifica el día que quieren ir, le puedo orientar mejor con esa gestión.';
  }
  if (!detectedPark && !parkFacts.length) {
    return 'Si me indica el parque concreto, se lo dejo redactado de forma más precisa.';
  }
  return '';
}

function cleanParagraph(text) {
  return String(text || '').replace(/\n{3,}/g, '\n\n').trim();
}

function formatParkName(parkKey) {
  return parkKey
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function renderEmptyEmailDraft() {
  const out = document.getElementById('chat-ia-mensajes');
  if (!out) return;
  out.innerHTML = `
    <div class="chat-ia-empty-mail">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 6h16v12H4z"></path>
        <path d="M4 7l8 6 8-6"></path>
      </svg>
      <h3>Redactor local de correos</h3>
      <p>Escribe la consulta del cliente, selecciona el parque si quieres y genera un borrador usando tus apuntes guardados.</p>
    </div>
  `;
}

function renderEmailDraft(text, detectedPark, parkFacts, noteFacts) {
  const out = document.getElementById('chat-ia-mensajes');
  if (!out) return;

  const references = [...parkFacts.slice(0, 4), ...noteFacts.slice(0, 3)].slice(0, 6);
  out.innerHTML = `
    <div class="chat-ia-mail-output">
      <div class="chat-ia-mail-head">
        <div>
          <div class="chat-ia-mail-eyebrow">BORRADOR GENERADO</div>
          <h3>${detectedPark ? escapeHtml(formatParkName(detectedPark)) : 'Correo general'}</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="chat-ia-copy-inline-btn">Copiar texto</button>
      </div>
      <pre class="chat-ia-draft-pre">${escapeHtml(text)}</pre>
      <div class="chat-ia-reference-box">
        <div class="chat-ia-reference-title">Información usada</div>
        <ul>
          ${references.length ? references.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>Sin referencias específicas detectadas.</li>'}
        </ul>
      </div>
    </div>
  `;

  document.getElementById('chat-ia-copy-inline-btn')?.addEventListener('click', copyGeneratedEmail);
}

async function copyGeneratedEmail() {
  if (!MAIL_ASSISTANT_STATE.draft) {
    toast('No hay ningún correo generado todavía.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(MAIL_ASSISTANT_STATE.draft);
    toast('Correo copiado al portapapeles.', 'success');
  } catch (err) {
    toast('No se pudo copiar automáticamente.', 'error');
  }
}

function resetEmailAssistant() {
  document.getElementById('chat-ia-park').value = '__auto__';
  document.getElementById('chat-ia-input').value = '';
  MAIL_ASSISTANT_STATE.draft = '';
  MAIL_ASSISTANT_STATE.lastContext = null;
  renderEmptyEmailDraft();
}

function populateParkSelect() {
  const select = document.getElementById('chat-ia-park');
  if (!select) return;
  const keys = Object.keys(MAIL_KNOWLEDGE.parques).sort((a, b) => formatParkName(a).localeCompare(formatParkName(b), 'es'));
  select.innerHTML = [`<option value="__auto__">Detectar automáticamente</option>`]
    .concat(keys.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(formatParkName(key))}</option>`))
    .join('');
  select.value = '__auto__';
}

function renderKnowledgeChips() {
  const wrap = document.getElementById('chat-ia-knowledge-list');
  if (!wrap) return;

  const all = Object.keys(MAIL_KNOWLEDGE.parques).sort((a, b) => formatParkName(a).localeCompare(formatParkName(b), 'es'));
  const activos   = [];
  const caducados = [];

  all.forEach((key) => {
    const park = MAIL_KNOWLEDGE.parques[key];
    const dias = diasHastaExpiracion(park.expires);
    if (dias < 0) caducados.push({ key, dias });
    else          activos.push({ key, dias });
  });

  function chipHtml({ key, dias }) {
    const park = MAIL_KNOWLEDGE.parques[key];
    const cls  = chipClass(dias);
    const expired = dias < 0;
    let badge = '';
    if (park.expires && !expired && dias <= 10) {
      badge = `<span class="chip-days">${dias}d</span>`;
    }
    if (park.expires && expired) {
      badge = `<span class="chip-days">Caducado</span>`;
    }
    return `<button type="button" class="chat-ia-chip ${cls}" data-park-chip="${escapeHtml(key)}" ${expired ? 'disabled' : ''}>${escapeHtml(formatParkName(key))}${badge}</button>`;
  }

  let html = activos.map(chipHtml).join('');

  if (caducados.length) {
    html += `<span class="chip-obsoletos-title">⚠️ Obsoletos — para eliminar</span>`;
    html += caducados.map(chipHtml).join('');
  }

  wrap.innerHTML = html;

  wrap.querySelectorAll('[data-park-chip]:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-park-chip') || '';
      const parkInput = document.getElementById('chat-ia-park');
      if (parkInput) parkInput.value = value;
    });
  });
}

function wireFrasesBuscador() {
  const input = document.getElementById('chat-ia-frases-buscador');
  if (!input) return;
  input.addEventListener('input', (e) => renderFrases(e.target.value.trim().toLowerCase()));
}

function renderFrases(filter) {
  const cont = document.getElementById('chat-ia-frases-list');
  if (!cont) return;
  const entries = Object.entries(EMAIL_PHRASES);

  cont.innerHTML = entries.map(([category, items]) => {
    const filtered = items.filter((item) => !filter || item.toLowerCase().includes(filter) || category.toLowerCase().includes(filter));
    if (!filtered.length) return '';
    return `
      <div class="frase-cat-title">${escapeHtml(category)}</div>
      ${filtered.map((frase) => `
        <div class="frase-item">
          <span>${escapeHtml(frase)}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-copy-frase="${escapeHtml(frase)}">Copiar</button>
        </div>
      `).join('')}
    `;
  }).join('') || '<div class="empty-state"><span>No se han encontrado frases.</span></div>';

  cont.querySelectorAll('[data-copy-frase]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-copy-frase') || '';
      try {
        await navigator.clipboard.writeText(text);
        toast('Frase copiada.', 'success');
      } catch {
        toast('No se pudo copiar.', 'error');
      }
    });
  });
}
