/* ============================================================================
   novedades.js — Sistema de Novedades, Mejoras y Registro de Versiones
   Estilo Opera GX / Discord / Raycast
============================================================================ */

/**
 * 📦 HISTORIAL DE NOVEDADES Y VERSIONES DE PARKSALES
 * Cuando quieras publicar una nueva versión, añade un nuevo objeto al inicio
 * de este array con una versión superior (ej: '2.6.0') y automáticamente
 * le volverá a saltar a todos los usuarios la primera vez que se conecten.
 */
const NOVEDADES_DATA = [
  {
    version: '1.5.5',
    date: 'Octubre 2026',
    badge: 'ACTUAL',
    title: 'Normas de Protección y Privacidad de Datos de Clientes (Nuevas normas DPO-02-ES)',
    subtitle: 'Cumplimiento con el reglamento DPO-02-ES en cuanto a la privacidad y protección de datos de los clientes.',
    changes: [
      {
        icon: '🔒',
        title: 'Protección y Privacidad de Datos de Clientes',
        desc: 'Al igual que los campos de nombre, apellidos, correo electrónico y teléfono, los localizadores tambien se omiten automáticamente y no se almacenan en ningún lugar.',
        tag: 'Normativa',
        tagBg: 'rgba(245, 166, 35, 0.18)',
        tagColor: '#FF9A44'
      },
      {
        icon: '🔒',
        title: 'Protección y Privacidad de Datos de Clientes',
        desc: 'Solo se guardan los precios para que los agentes tengan un control del porcentaje que llevan de ventas en el mes. Ningún otro dato de los clientes se guarda en la base de datos.',
        tag: 'Normativa',
        tagBg: 'rgba(245, 166, 35, 0.18)',
        tagColor: '#FF9A44'
      }
    ]
  },
  {
    version: '1.4.0',
    date: 'Octubre 2026',
    title: 'Se añade tematicas dependiendo de la fecha del año',
    subtitle: 'Se han añadido tematicas basadas en la festividad actual para mejorar la experiencia del usuario.',
    changes: [
      {
        icon: '🎃',
        title: 'Tematica de Halloween',
        desc: 'Se han añadido tematicas basadas en la festividad actual para mejorar la experiencia del usuario.',
        tag: 'Tematica',
        tagBg: 'rgba(245, 166, 35, 0.18)',
        tagColor: '#FF9A44'
      },
      {
        icon: '📊',
        title: 'Plantilla Excel Ejecutiva con Gráficos mejorada',
        desc: 'Nueva plantilla descargable prediseñada, con panel de control y gráficos por estado.',
        tag: 'Novedad',
        tagBg: 'rgba(0, 230, 118, 0.18)',
        tagColor: '#00E676'
      }
    ]
  },
  {
    version: '1.1.0',
    date: 'Septiembre 2026',
    title: 'Mejoras en la Experiencia de Usuario y Rendimiento',
    subtitle: 'Ajustes para mejorar el rendimiento de la aplicación.',
    changes: [
      {
        icon: '⚡',
        title: 'Pegado Rápido Inteligente y Silencioso',
        desc: 'Pega cualquier fila desde tu tabla de pedidos y el sistema autocompletará importes y estados automáticamente sin exponer información confidencial en pantalla.',
        tag: 'Optimización',
        tagBg: 'rgba(0, 198, 255, 0.18)',
        tagColor: '#00C6FF'
      },
    ]
  },
  {
    version: '1.0.0',
    date: 'Agosto 2026',
    title: 'Optimización Móvil y Temporizador Pomodoro',
    subtitle: 'Mejoras para trabajar con mayor comodidad y concentración.',
    changes: [
      {
        icon: '📅',
        title: 'Visualizador de Cuadrantes Mensuales',
        desc: 'Consulta tus turnos asignados por día y mes con visualización adaptativa y cálculo de horas estimadas.',
        tag: 'Turnos',
        tagBg: 'rgba(96, 165, 250, 0.18)',
        tagColor: '#60A5FA'
      }
    ]
  },
  {
    version: '0.9.0 BETA',
    date: 'Julio 2026',
    title: 'Gestor de Llamadas y Notas Rápidas',
    subtitle: 'Herramientas ágiles para el día a día en atención a clientes.',
    changes: [
      {
        icon: '📞',
        title: 'Registro de Llamadas y Contactos',
        desc: 'Apunta llamadas entrantes, dudas de clientes y estados de seguimiento en segundos.',
        tag: 'Atención',
        tagBg: 'rgba(52, 211, 153, 0.18)',
        tagColor: '#34D399'
      },
      {
        icon: '📝',
        title: 'Bloc de Notas Rápidas',
        desc: 'Espacio libre con guardado automático al vuelo para cualquier apunte temporal.',
        tag: 'Utilidad',
        tagBg: 'rgba(255, 107, 107, 0.18)',
        tagColor: '#FF6B6B'
      }
    ]
  },
  {
    version: '0.8.1 BETA',
    date: 'Junio 2026',
    title: 'Lanzamiento Nueva Interfaz ParkSales',
    subtitle: 'Renovación completa de la plataforma de ventas y métricas.',
    changes: [
      {
        icon: '🚀',
        title: 'Nueva Arquitectura y Diseño Dark Mode',
        desc: 'Experiencia ultra rápida con paleta ejecutiva, métricas en vivo y cálculo automático de objetivos mensuales.',
        tag: 'Lanzamiento',
        tagBg: 'rgba(245, 166, 35, 0.18)',
        tagColor: '#F5A623'
      }
    ]
  }
];

const STORAGE_KEY_LAST_SEEN_CHANGELOG = 'parksales_last_seen_changelog_version';
const STORAGE_KEY_LAST_SEEN_RAW = 'parksales_last_seen_raw_version';

let novedadesActiveTab = 'actual'; // 'actual' | 'historial'
let autoNovedadesCheckedThisSession = false;

/**
 * Obtiene una firma única del elemento más reciente (versión + título)
 * para detectar si el usuario ha visto esta versión o si es algo diferente.
 */
function getLatestNovedadesSignature() {
  const latest = NOVEDADES_DATA[0];
  if (!latest) return '1.0.0';
  return `${latest.version || '1.0.0'}__${(latest.title || '').trim()}`;
}

function getLatestVersionNumber() {
  return NOVEDADES_DATA[0]?.version || '1.0.0';
}

/**
 * Comprueba si el usuario ya vio las novedades actuales
 */
function hasUserSeenLatestNovedades() {
  try {
    const savedSig = localStorage.getItem(STORAGE_KEY_LAST_SEEN_CHANGELOG) || '';
    const savedVer = localStorage.getItem(STORAGE_KEY_LAST_SEEN_RAW) || '';
    const currentSig = getLatestNovedadesSignature();
    const currentVer = getLatestVersionNumber();

    // Si coincide la firma exacta o la versión exacta, ya se ha visto
    if (savedSig === currentSig || savedVer === currentVer) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Guarda en localStorage que el usuario ya leyó esta versión/contenido
 */
function markNovedadesAsSeen() {
  const currentSig = getLatestNovedadesSignature();
  const currentVer = getLatestVersionNumber();
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SEEN_CHANGELOG, currentSig);
    localStorage.setItem(STORAGE_KEY_LAST_SEEN_RAW, currentVer);
  } catch (e) {
    console.warn('[ParkSales] No se pudo guardar en localStorage:', e);
  }
  updateNovedadesIndicators();
}

/**
 * Renderiza el contenido de la pestaña activa dentro del modal
 */
function renderNovedadesTabContent() {
  const container = document.getElementById('novedades-tab-content');
  if (!container) return;

  const latest = NOVEDADES_DATA[0] || {};

  // Sincronizar dinámicamente las etiquetas de la cabecera del modal
  const versionPill = document.querySelector('.novedades-version-pill');
  if (versionPill) versionPill.textContent = `v${latest.version || '1.0'} Actual`;

  const actualTabBtn = document.querySelector('.novedades-tab[data-tab="actual"] span:first-child');
  if (actualTabBtn) actualTabBtn.textContent = `🌟 Novedades v${latest.version || '1.0'}`;

  const actualTabCount = document.querySelector('.novedades-tab[data-tab="actual"] .tab-count');
  if (actualTabCount) actualTabCount.textContent = latest.changes ? latest.changes.length : '';

  if (novedadesActiveTab === 'actual') {
    container.innerHTML = `
      <div style="margin-bottom: 14px;">
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
          ${escapeHtml(latest.title || 'Novedades')}
        </div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.45;">
          ${escapeHtml(latest.subtitle || '')}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${(latest.changes || []).map(item => `
          <div class="novedad-card">
            <div class="novedad-icon-box">${item.icon || '✨'}</div>
            <div class="novedad-info">
              <div class="novedad-title-row">
                <span class="novedad-title">${escapeHtml(item.title || '')}</span>
                ${item.tag ? `<span class="novedad-tag" style="background:${item.tagBg || 'var(--accent-soft)'}; color:${item.tagColor || 'var(--accent)'};">${escapeHtml(item.tag)}</span>` : ''}
              </div>
              <p class="novedad-desc">${escapeHtml(item.desc || '')}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Pestaña Historial de versiones anteriores
    const historyList = NOVEDADES_DATA.slice(1);
    container.innerHTML = `
      <div class="version-history-group">
        ${historyList.map(v => `
          <div class="version-item">
            <div class="version-header">
              <span class="version-badge-tag">v${escapeHtml(v.version)}</span>
              <span class="version-date">${escapeHtml(v.date || '')}</span>
            </div>
            <div class="version-title">${escapeHtml(v.title || '')}</div>
            ${v.subtitle ? `<p class="version-summary">${escapeHtml(v.subtitle)}</p>` : ''}
            <ul class="version-list">
              ${(v.changes || []).map(ch => `
                <li>
                  <span class="bullet">${ch.icon || '•'}</span>
                  <div>
                    <strong style="color:var(--text-primary);">${escapeHtml(ch.title || '')}:</strong>
                    <span style="color:var(--text-secondary);"> ${escapeHtml(ch.desc || '')}</span>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  }
}

/**
 * Abre el modal de novedades
 */
function openNovedadesModal({ isFirstTime = false } = {}) {
  const backdrop = document.getElementById('novedades-modal-backdrop');
  if (!backdrop) return;

  novedadesActiveTab = 'actual';
  updateNovedadesTabsUI();
  renderNovedadesTabContent();

  backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';

  const confirmBtn = document.getElementById('novedades-confirm-btn');
  if (confirmBtn) confirmBtn.focus();
}

/**
 * Cierra el modal de novedades y marca SIEMPRE la versión actual como leída en localStorage
 */
function closeNovedadesModal() {
  const backdrop = document.getElementById('novedades-modal-backdrop');
  if (backdrop) {
    backdrop.classList.remove('active');
  }
  document.body.style.overflow = '';

  // Inmediatamente guardar en localStorage para que no vuelva a saltar al refrescar
  markNovedadesAsSeen();
}

// Exportar globalmente para eventos inline
window.openNovedadesModal = openNovedadesModal;
window.closeNovedadesModal = closeNovedadesModal;

/**
 * Actualiza los indicadores visuales (puntos rojos / badges de no leído)
 */
function updateNovedadesIndicators() {
  const hasUnread = !hasUserSeenLatestNovedades();
  const currentVer = getLatestVersionNumber();

  // Punto rojo en el botón de la barra superior
  const dot = document.getElementById('changelog-badge-dot');
  if (dot) dot.style.display = hasUnread ? 'block' : 'none';

  // Badge en el menú de perfil
  const pill = document.getElementById('tbm-novedades-pill');
  if (pill) {
    pill.textContent = hasUnread ? 'NUEVO' : `v${currentVer}`;
    pill.style.background = hasUnread ? 'linear-gradient(135deg, #FF9A44, #FC6076)' : 'var(--bg-elevated)';
    pill.style.color = hasUnread ? '#fff' : 'var(--text-muted)';
  }

  // Tag en el pie de la barra lateral
  const sideTag = document.querySelector('.sidebar-version-tag');
  if (sideTag) {
    sideTag.textContent = `v${currentVer}`;
  }
}

/**
 * Cambia de pestaña dentro del modal
 */
function setNovedadesTab(tabKey) {
  novedadesActiveTab = tabKey;
  updateNovedadesTabsUI();
  renderNovedadesTabContent();
}

function updateNovedadesTabsUI() {
  document.querySelectorAll('.novedades-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === novedadesActiveTab);
  });
}

/**
 * Comprueba si es la primera vez que el usuario se conecta a esta versión
 * y, de ser así, abre automáticamente el modal.
 */
function checkAndShowNovedadesAuto() {
  if (autoNovedadesCheckedThisSession) return;
  autoNovedadesCheckedThisSession = true;

  try {
    updateNovedadesIndicators();

    // Solo se muestra si NO se ha visto aún esta versión o firma
    if (!hasUserSeenLatestNovedades()) {
      setTimeout(() => {
        openNovedadesModal({ isFirstTime: true });
      }, 600);
    }
  } catch (err) {
    console.warn('[ParkSales] Error al verificar versión de novedades:', err);
  }
}

/**
 * Inicialización y cableado de listeners del sistema de novedades
 */
function initNovedades() {
  // Botón superior en topbar
  const topbarBtn = document.getElementById('btn-open-novedades');
  if (topbarBtn && topbarBtn.dataset.wired !== '1') {
    topbarBtn.dataset.wired = '1';
    topbarBtn.addEventListener('click', () => openNovedadesModal());
  }

  // Enlace en el menú del perfil
  const profileItem = document.getElementById('tbm-novedades-btn');
  if (profileItem && profileItem.dataset.wired !== '1') {
    profileItem.dataset.wired = '1';
    profileItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof toggleTopbarUserMenu === 'function') toggleTopbarUserMenu(false);
      openNovedadesModal();
    });
  }

  // Chip de versión en el pie de la barra lateral
  const sidebarChip = document.getElementById('sidebar-version-btn');
  if (sidebarChip && sidebarChip.dataset.wired !== '1') {
    sidebarChip.dataset.wired = '1';
    sidebarChip.addEventListener('click', () => openNovedadesModal());
  }

  // Botón de cerrar (aspa)
  const closeBtn = document.getElementById('novedades-close-btn');
  if (closeBtn && closeBtn.dataset.wired !== '1') {
    closeBtn.dataset.wired = '1';
    closeBtn.addEventListener('click', closeNovedadesModal);
  }

  // Botón de confirmación / Entendido
  const confirmBtn = document.getElementById('novedades-confirm-btn');
  if (confirmBtn && confirmBtn.dataset.wired !== '1') {
    confirmBtn.dataset.wired = '1';
    confirmBtn.addEventListener('click', closeNovedadesModal);
  }

  // Clic en el fondo oscuro para cerrar y marcar leído
  const backdrop = document.getElementById('novedades-modal-backdrop');
  if (backdrop && backdrop.dataset.wired !== '1') {
    backdrop.dataset.wired = '1';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeNovedadesModal();
      }
    });
  }

  // Pestañas
  document.querySelectorAll('.novedades-tab').forEach(tabBtn => {
    if (tabBtn.dataset.wired !== '1') {
      tabBtn.dataset.wired = '1';
      tabBtn.addEventListener('click', () => {
        setNovedadesTab(tabBtn.dataset.tab);
      });
    }
  });

  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const b = document.getElementById('novedades-modal-backdrop');
      if (b && b.classList.contains('active')) {
        closeNovedadesModal();
      }
    }
  });

  updateNovedadesIndicators();
}

// Arranque seguro compatible con cualquier momento de carga del script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNovedades);
} else {
  initNovedades();
}
