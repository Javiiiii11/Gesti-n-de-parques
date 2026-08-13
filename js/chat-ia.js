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

const MAIL_KNOWLEDGE = {
  parques: {
    'aquopolis torrevieja': {
      aliases: ['torrevieja', 'aq torrevieja', 'aquopolis torrevieja'],
      facts: [
        'Si quiere volver otro día, en taquillas serían 17€.',
        'Los productos de interior se pagan con tarjeta.',
        'El parking se paga con tarjeta.',
        'Solo se vende online el Speedy Pass Premium.',
        'Las entradas no son nominativas.',
        'Si compra la entrada online se ahorra la cola de compra en taquilla.',
        'No se alquilan flotadores; van incluidos solo en atracciones específicas.',
        'Las tumbonas no están incluidas con la entrada.',
        'No puede acceder con tumbonas ni sillas de playa.',
        'No se puede hacer devolución, aunque en algunos casos sí se puede gestionar cambio.',
        'Las personas con discapacidad se valoran en el parque para posible Speedy Pass; el acompañante debe ser mayor de edad.',
        'Los manguitos están prohibidos en atracciones de despegue.',
        'Se fuma solo en las zonas habilitadas.'
      ]
    },
    'aquopolis cullera': {
      aliases: ['cullera', 'aq cullera', 'aquopolis cullera'],
      facts: [
        'Si quiere volver otro día, en taquillas serían 17€.',
        'El parking en Cullera cuesta 7€ y se paga con tarjeta.',
        'Los productos de interior se pagan con tarjeta.',
        'Solo se vende online el Speedy Pass Premium.',
        'Las entradas no son nominativas.',
        'Si compra la entrada online se ahorra la cola de compra en taquilla.',
        'No puede acceder con tumbonas ni sillas de playa.',
        'No se puede hacer devolución, aunque en algunos casos sí se puede gestionar cambio.',
        'Las personas con discapacidad se valoran en el parque para posible Speedy Pass.',
        'Los manguitos están prohibidos en atracciones de despegue.',
        'Se fuma solo en las zonas habilitadas.'
      ]
    },
    'aquopolis costa dorada': {
      aliases: ['costa dorada', 'aq costa dorada', 'aquopolis costa dorada'],
      facts: [
        'La persona con discapacidad debe pasar por atención al cliente para la entrada del acompañante gratuito.',
        'Lo mismo aplica a familia numerosa o monoparental, siempre con acreditación.',
        'La persona con discapacidad y su acompañante disponen de Speedy Pass de 8 usos.',
        'Solo hay entradas con fecha cerrada.',
        'El All Inclusive tiene un cooldown de 1 hora.',
        'Los viernes puede haber limitación de parking por mercadillo.',
        'Pueden salir y volver a entrar avisando en acceso para que les pongan pulsera.',
        'Se puede pasar comida salvo cuchillos, latas o cristal.',
        'Manguitos solo en zona infantil; en el resto se facilitan chalecos.',
        'No disponen de alquiler de carritos, pero sí pueden entrar con el suyo.',
        'No disponen de cajeros ni máquina de secado.',
        'No se devuelve el dinero si llueve.',
        'No se venden toallas.',
        'Disponen de zona de picnic.',
        'Las sombrillas no pueden acceder, pero las sillas de playa sí.',
        'Menores de 1 metro no pagan.',
        'Se puede pagar en metálico y tarjeta.'
      ]
    },
    'aquopolis cartaya': {
      aliases: ['cartaya', 'aquopolis cartaya'],
      facts: [
        'El parking cuesta 4€ y se puede pagar en efectivo o tarjeta.',
        'Los flotadores de alquiler cuestan 6€ el individual y 10€ el doble.',
        'El Speedy Pass cambia de precio según el día.',
        'Se puede meter comida y comer en las zonas señalizadas.',
        'El acompañante de una persona con discapacidad debe ser mayor de edad.',
        'Se puede conceder Speedy Pass a persona con discapacidad y acompañante si acredita 33% o más con movilidad reducida o discapacidad intelectual.',
        'Se puede meter mobiliario de playa menos sombrillas y solo en zonas indicadas.',
        'No tienen cajeros ni máquina de secado.',
        'Tienen sillas anfibias para adultos y pediátricas.',
        'Hay cargador de coches eléctricos en el parking del parque.',
        'No cierran el parque si llueve.',
        'No pueden entrar mascotas salvo perros guía o de apoyo emocional.',
        'Disponen de flotadores gratis para las atracciones que lo necesiten y también de alquiler.',
        'No se venden toallas.'
      ]
    },
    'aquopolis villanueva de la canada': {
      aliases: ['villanueva de la canada', 'villanueva de la cañada', 'aquopolis villanueva de la canada', 'aquopolis villanueva de la cañada', 'aquopolis vil', 'vil'],
      facts: [
        'En Aquópolis Villanueva de la Cañada no tienen cargadores de coche.',
        'Las taquillas cuestan 8€.',
        'Si tiene entrada reducida, pagando la diferencia en taquillas puede pasar.'
      ]
    },
    'selwo marina': {
      aliases: ['selwo marina', 'marina'],
      facts: [
        'Está cerca del castillo y del parque de la Paloma.',
        'No tiene delfines.',
        'No se puede tocar ningún animal.',
        'Dentro de la experiencia VIP está el encuentro con pingüinos.',
        'La visita suele durar entre 2:30 y 3:00.',
        'Las personas con carrito no tienen problema.',
        'Se puede meter comida, pero se debe comer en bancos o gradas; neveritas grandes no dejan.',
        'El todo incluido de Selwo Marina funciona cada 30 minutos.'
      ]
    },
    'teleferico benalmadena': {
      aliases: ['teleferico', 'teleférico', 'teleferico benalmadena', 'teleférico benalmádena'],
      facts: [
        'Los empadronados pueden solicitar invitación para últimos sábados y domingos de cada mes escribiendo una semana antes a diadelempadronado@innoben.es.',
        'Solo aplica para 4 personas.',
        'Tiene audioguía durante el recorrido.',
        'La actividad de aves no está incluida.',
        'No tienen datáfonos por cobertura.',
        'Solo hay entradas general niño y adulto.',
        'No se puede consumir dentro de las cabinas.'
      ]
    },
    'selwo aventura': {
      aliases: ['selwo aventura', 'aventura'],
      facts: [
        'Las actividades multiaventura se contratan en taquillas.',
        'Tiro con arco cuesta 3€ con 6 flechas.',
        'Jumping cuesta 5€.',
        'Tirolina cuesta 7€.',
        'Las personas con carrito no tienen problema.',
        'Se recomienda llegar 1:30 antes del inicio de la actividad.',
        'El safari lo pueden hacer menores de 3 años gratis.',
        'Aunque no contrates safari, puedes ver todos los animales igualmente, aunque algunos desde más distancia.',
        'La visita VIP empieza a las 10:00 y la reserva es solo online.',
        'La visita VIP incluye safari y almuerzo.',
        'Los empadronados en Estepona tienen entrada gratuita con su código del ayuntamiento.',
        'El safari suele empezar sobre las 11:00 o 12:00.',
        'No se permiten animales en el parque.'
      ]
    },
    'hotel selwo': {
      aliases: ['hotel selwo', 'poblado masai', 'poblado watu', 'poblado zulu', 'poblado zulú'],
      facts: [
        'Masai es la opción más económica, en la parte baja, con capacidad máxima 3 personas y un bebé, y sin wifi.',
        'Watu es la opción intermedia, en la parte alta, con capacidad máxima 4 personas y un bebé, con transfer 24h y sin wifi.',
        'Zulú es la opción más alta, con capacidad máxima 6 personas y 2 bebés, con wifi.',
        'Se puede cambiar cama supletoria por cuna.',
        'El precio incluye alojamiento, desayuno, entradas al parque para todos los días alojados, parking y safari.',
        'El safari se hace el día posterior a la llegada, aunque en algunos casos se podría cambiar en recepción por 5€ por persona.',
        'La cena es mejor contratarla online con la reserva y cuesta 15€ por persona.',
        'En autor de la reserva debéis marcaros vosotros, origen call center y confirmación autor de la reserva.',
        'Si fuese un bonista, en empresa hay que poner SELWO BONISTAS.',
        'Una vez hecha la reserva hay que llevar control y apuntarla en el Excel de venta hoteles.',
        'Si está pagada, hay que mandar la confirmación al correo del cliente y apuntarlo en el Excel.'
      ]
    },
    'parque warner': {
      aliases: ['parque warner', 'warner'],
      facts: [
        'Debe decirse Parque Warner, no solo Warner.',
        'Sí se puede entrar con paraguas.',
        'Se puede acceder con carrito de bebé o niño sin problema.',
        'No se puede meter comida, salvo comida de bebé como potitos, biberón con cereales o papilla de fruta.',
        'Con bonos en Parque Warner debe gestionarse en taquilla; no se puede hacer desde aquí.',
        'Los extras comprados para otro día se pueden usar pasando por información.',
        'Los objetos perdidos se gestionan por admisiones@parquewarner.com.',
        'Los temas de tiendas o merchandising se gestionan por MerchandisingPW@parquewarner.com.',
        'Si hay entradas de 2 días, hay que mandar correo a error entradas.'
      ]
    },
    'warner beach': {
      aliases: ['warner beach', 'wab'],
      facts: [
        'No se da pase rápido por el tema de las escaleras de las atracciones.',
        'En el bono verano plus se incluye hasta el 31/08/2026.'
      ]
    },
    'faunia': {
      aliases: ['faunia'],
      facts: [
        'Los veterinarios no tienen descuento en Faunia.'
      ]
    },
    'zoo': {
      aliases: ['zoo', 'zoo + faunia'],
      facts: [
        'En la entrada combinada Zoo + Faunia, el primer día es para Zoo y Faunia se puede usar cualquier otro día hasta final de temporada.'
      ]
    }
  },
  notes: [
    'Si las entradas están compradas en la web oficial, pueden ir otro día antes o después verificándolas y abonando la diferencia si corresponde.',
    'Si da fallo con el pago, mejor que no use el autocompletado.',
    'Todas las actividades de Selwo duran entre 30 y 40 minutos.',
    'Si son entradas de 2 días, mandar correo a error entradas.',
    'Para entradas de tarde de PAM con fecha equivocada, tienen que comprar una nueva y enviar ambas compras a consultaentrada@grpr.com para tramitar devolución de las erróneas; solo si compró en la web oficial.',
    'No se puede ampliar de bono verano a bono anual.',
    'Si tiene entrada reducida, pagando la diferencia en taquillas puede pasar.',
    'Todos los cumpleaños van siempre a reservas, aunque sean solo entradas.',
    'Los pases rápidos son de parque único.',
    'Las reservas deben hacerse con al menos 10 días de antelación.',
    'En Aquópolis Villanueva de la Cañada no tienen cargadores de coche.',
    'Las taquillas de Villanueva de la Cañada cuestan 8€.',
    'Con bonos en Parque Warner debe gestionarse en taquilla, no desde aquí.',
    'Los números de socio de bonos empiezan por 7 u 8.',
    'Con bono verano ultra + beach, Villanueva lleva 12% y Beach 18%.',
    'En Warner Beach no dan pase rápido por el tema de las escaleras de las atracciones.',
    'Los veterinarios no tienen descuento en Faunia.',
    'La entrada Zoo + Faunia se usa primer día Zoo y Faunia cualquier otro día hasta fin de temporada.',
    'proveedores@grpr.com es para temas de proveedores.'
  ],
  templates: {
    saludo: {
      formal: 'Hola, buenos días, soy Javier. Le comento sobre lo que me dice:',
      neutro: 'Hola, buenos días:',
      cercano: 'Hola, ¿qué tal? Te comento:'
    },
    cierre: {
      formal: 'Un saludo.',
      amable: 'Espero haberle ayudado. Un saludo.',
      disponible: 'Si necesita algo más, quedo a su disposición. Un saludo.'
    },
    disculpa: 'Perdona que su experiencia haya sido así durante la visita. Lo sentimos de verdad y trasladamos sus comentarios para seguir mejorando.',
    quejaConsultaEntrada: 'Te recomiendo pasarlo a consulta entrada, ya que las quejas y reclamaciones no las llevamos nosotros directamente. Si el caso viene de una compra web y corresponde, puedes indicarle que lo remita a consultaentrada@grpr.com con todos los datos y el máximo detalle posible.',
    derivacion: 'Hemos derivado su caso al departamento correspondiente. En caso de disponer de más información, se pondrán en contacto con usted.',
    newsletter: 'Desde aquí no podemos revisar directamente el estado de la newsletter. Le recomiendo revisar también promociones, spam o correo no deseado, ya que además el envío no suele ser instantáneo y puede tardar alrededor de un día.',
  },
  exampleReplies: [
    {
      topic: 'hotel selwo',
      text: 'La entrada al parque incluye todos los días alojados, además del desayuno, parking y safari. El safari se realiza normalmente el día posterior a la llegada. El check-in y la salida pueden depender de la reserva concreta, pero si me indica fecha y alojamiento le ayudo a revisarlo mejor.'
    },
    {
      topic: 'objetos perdidos parque warner',
      text: 'Para objetos perdidos de Parque Warner, puede escribir a admisiones@parquewarner.com indicando el máximo detalle posible sobre el objeto y la fecha de la visita.'
    }
  ]
};

const EMAIL_PHRASES = {
  saludos: [
    'Hola, buenos días, soy Javier. Le comento sobre lo que me dice:',
    'Hola, buenas tardes, soy Javier. Le comento sobre lo que me dice:',
    'Hola, buenos días:',
  ],
  cierres: [
    'Un saludo.',
    'Espero haberle ayudado. Un saludo.',
    'Si necesita algo más, quedo a su disposición. Un saludo.',
  ],
  seguimiento: [
    'Si me indica la fecha exacta de visita, se lo confirmo mejor.',
    'Si me especifica el día que quieren ir, le puedo facilitar mejor la gestión.',
    'Si quiere, le dejo la gestión preparada en cuanto me confirme esos datos.',
  ],
  disculpas: [
    'Sentimos mucho las molestias ocasionadas.',
    'Perdona que su experiencia haya sido de esa manera durante la visita.',
    'Lo siento de verdad y esperamos que no vuelva a ocurrir.',
  ],
  derivaciones: [
    'Hemos derivado su caso al departamento correspondiente.',
    'Este caso debe revisarlo el departamento correspondiente.',
    'En caso de disponer de más información, se pondrán en contacto con usted.',
  ]
};

function initChatIA() {
  wireChatIATabs();
  wireEmailAssistant();
  wireFrasesBuscador();
  renderFrases('');
  populateParkSelect();
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

function detectPark(rawText) {
  const text = normalizeText(rawText);
  for (const [key, park] of Object.entries(MAIL_KNOWLEDGE.parques)) {
    if (park.aliases.some((alias) => text.includes(normalizeText(alias)))) return key;
  }
  return '';
}

function getParkFacts(parkKey) {
  return parkKey && MAIL_KNOWLEDGE.parques[parkKey] ? MAIL_KNOWLEDGE.parques[parkKey].facts : [];
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
  return text.length <= 140 || directTokens.some((token) => text.includes(normalizeText(token)));
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
  const detectedPark = park && park !== '__auto__' ? park : detectPark(`${question}`);
  const tone = inferTone(`${question}`);

  const parkFacts = getParkFacts(detectedPark);
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
  const keys = Object.keys(MAIL_KNOWLEDGE.parques).sort((a, b) => formatParkName(a).localeCompare(formatParkName(b), 'es'));
  wrap.innerHTML = keys.map((key) => `
    <button type="button" class="chat-ia-chip" data-park-chip="${escapeHtml(key)}">${escapeHtml(formatParkName(key))}</button>
  `).join('');

  wrap.querySelectorAll('[data-park-chip]').forEach((btn) => {
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
