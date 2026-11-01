/* ============================================================================
   ParkSite Bonos Rápidos — Popup Script
   Control de plantillas, búsqueda, configuración y estado de autocompletado.
============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  let allTemplates = [];
  let currentFilter = '';

  const toggleEnabled = document.getElementById('toggle-enabled');
  const triggerKeySelect = document.getElementById('trigger-key-select');
  const searchInput = document.getElementById('search-input');
  const templateCount = document.getElementById('template-count');
  const templatesList = document.getElementById('templates-list');
  const btnSync = document.getElementById('btn-sync');
  const btnOpenParkSite = document.getElementById('btn-open-parksite');

  // 1. Cargar Configuración Inicial
  chrome.runtime.sendMessage({ action: 'GET_CONFIG' }, (response) => {
    if (response && response.success && response.config) {
      const cfg = response.config;
      toggleEnabled.checked = cfg.enabled !== false;
      if (cfg.triggerKey) {
        triggerKeySelect.value = cfg.triggerKey;
      }
    }
  });

  // Guardar cambio en toggle
  toggleEnabled.addEventListener('change', () => {
    const enabled = toggleEnabled.checked;
    chrome.runtime.sendMessage({
      action: 'SET_CONFIG',
      config: { enabled }
    });
  });

  // Guardar cambio en trigger key
  triggerKeySelect.addEventListener('change', () => {
    const triggerKey = triggerKeySelect.value;
    chrome.runtime.sendMessage({
      action: 'SET_CONFIG',
      config: { triggerKey }
    });
  });

  // 2. Cargar Plantillas
  function fetchTemplates() {
    chrome.runtime.sendMessage({ action: 'GET_TEMPLATES' }, (response) => {
      if (response && response.success) {
        allTemplates = response.plantillas || [];
        renderList();
      }
    });
  }

  fetchTemplates();

  // 3. Renderizar Lista
  function renderList() {
    let filtered = allTemplates;
    if (currentFilter) {
      const q = currentFilter.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const d = t.datos || {};
        const text = [
          t.abreviatura,
          t.descripcion,
          d.nombre,
          d.primer_apellido,
          d.segundo_apellido,
          d.numero_documento,
          d.email_gestor
        ].join(' ').toLowerCase();
        return text.includes(q);
      });
    }

    templateCount.textContent = filtered.length;

    if (filtered.length === 0) {
      templatesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚡</div>
          <div>${currentFilter ? 'No hay abreviaturas que coincidan.' : 'No tienes abreviaturas guardadas todavía.'}</div>
          <div style="font-size:11px; margin-top:4px; opacity:0.8;">
            ${currentFilter ? 'Prueba con otro término.' : 'Rellena un bono en ParkSite y pulsa «Pasar a extensión».'}
          </div>
        </div>
      `;
      return;
    }

    templatesList.innerHTML = filtered.map((t, idx) => {
      const d = t.datos || {};
      const titular = `${d.nombre || ''} ${d.primer_apellido || ''} ${d.segundo_apellido || ''}`.trim() || 'Titular sin nombre';
      const doc = d.numero_documento || '—';
      const email = d.email_gestor || '—';
      const fecha = `${d.dia_nacimiento || '--'}/${d.mes_nacimiento || '--'}/${d.anio_nacimiento || '----'}`;

      return `
        <div class="template-item" data-abrev="${escapeAttr(t.abreviatura)}">
          <div class="template-item-top">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="template-abrev-badge">${escapeHtml(t.abreviatura)}</span>
              <span class="template-desc" title="${escapeAttr(t.descripcion || titular)}">
                ${escapeHtml(t.descripcion || titular)}
              </span>
            </div>
            <div class="template-actions">
              <button class="btn-icon btn-copy" data-abrev="${escapeAttr(t.abreviatura)}" title="Copiar abreviatura">📋</button>
              <button class="btn-icon btn-toggle-detail" data-idx="${idx}" title="Ver todos los datos">👁️</button>
              <button class="btn-icon delete btn-delete" data-abrev="${escapeAttr(t.abreviatura)}" title="Eliminar">🗑️</button>
            </div>
          </div>

          <div class="template-details-preview">
            <div>👤 <strong>Titular:</strong> ${escapeHtml(titular)}</div>
            <div>🪪 <strong>Doc:</strong> ${escapeHtml(doc)}</div>
            <div>✉️ <strong>Email:</strong> ${escapeHtml(email)}</div>
          </div>

          <div class="template-details-full" id="detail-${idx}" style="display:none;">
            <div>🎂 <strong>Fecha nacimiento:</strong> ${fecha}</div>
            <div>✉️ <strong>Email gestor:</strong> ${escapeHtml(email)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Cablear acciones individuales
    templatesList.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const abrev = e.currentTarget.dataset.abrev;
        navigator.clipboard.writeText(abrev).then(() => {
          btn.textContent = '✅';
          setTimeout(() => btn.textContent = '📋', 1200);
        });
      });
    });

    templatesList.querySelectorAll('.btn-toggle-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.idx;
        const detailEl = document.getElementById(`detail-${idx}`);
        if (detailEl) {
          const isHidden = detailEl.style.display === 'none';
          detailEl.style.display = isHidden ? 'flex' : 'none';
          btn.textContent = isHidden ? '🔼' : '👁️';
        }
      });
    });

    templatesList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const abrev = e.currentTarget.dataset.abrev;
        if (confirm(`¿Eliminar la abreviatura ${abrev}?`)) {
          chrome.runtime.sendMessage({ action: 'DELETE_TEMPLATE', abreviatura: abrev }, () => {
            fetchTemplates();
          });
        }
      });
    });
  }

  // 4. Búsqueda en vivo
  searchInput.addEventListener('input', (e) => {
    currentFilter = e.target.value;
    renderList();
  });

  // 5. Botón sincronizar
  btnSync.addEventListener('click', () => {
    btnSync.textContent = '⏳ ...';
    fetchTemplates();
    setTimeout(() => {
      btnSync.textContent = '🔄 Sincronizar';
    }, 600);
  });

  // 6. Abrir ParkSite
  btnOpenParkSite.addEventListener('click', () => {
    chrome.tabs.query({}, (tabs) => {
      const existingTab = tabs.find(t => 
        t.url && (t.url.includes('Gesti-n-de-parques') || t.url.includes('localhost') || t.url.includes('park-sales-app'))
      );

      if (existingTab && existingTab.id) {
        chrome.tabs.update(existingTab.id, { active: true });
        if (existingTab.windowId) {
          chrome.windows.update(existingTab.windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url: 'https://javiiiii11.github.io/Gesti-n-de-parques/#bonos-rapidos' });
      }
    });
  });

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(text) {
    return escapeHtml(text);
  }
});
