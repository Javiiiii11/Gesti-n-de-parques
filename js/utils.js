/* ============================================================================
   utils.js — helpers compartidos por toda la aplicación
============================================================================ */

const fmtEUR = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fmtNum = (n) => (Number(n) || 0).toLocaleString('es-ES');
const fmtDateShort = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getUserDisplayName(user) {
  const meta = user?.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (user?.email ? user.email.split('@')[0].replace(/[._-]+/g, ' ') : '') ||
    'Usuario'
  );
}

function getUserInitials(user) {
  const raw = getUserDisplayName(user).trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return raw.slice(0, 2).toUpperCase() || '?';
}

/** Foto del proveedor (Google) si el usuario entró con OAuth */
function getProviderAvatarUrl(user) {
  const meta = user?.user_metadata || {};
  return meta.avatar_url || meta.picture || meta.avatar || null;
}

/**
 * Foto asociada al correo (Gravatar / proveedores públicos vía Unavatar).
 * Sin subida manual: si no hay foto, el UI cae a iniciales.
 */
function getEmailAvatarUrl(email) {
  if (!email) return null;
  return `https://unavatar.io/${encodeURIComponent(String(email).trim().toLowerCase())}?fallback=false`;
}

function getUserAvatarCandidates(user) {
  return [getProviderAvatarUrl(user), getEmailAvatarUrl(user?.email)].filter(Boolean);
}

function renderUserAvatarHtml(user, { size = '' } = {}) {
  const initials = escapeHtml(getUserInitials(user));
  const candidates = getUserAvatarCandidates(user);
  const primary = candidates[0] || '';
  const rest = escapeHtml(JSON.stringify(candidates.slice(1)));
  const sizeClass = size ? ` ps-avatar--${size}` : '';

  return `
    <div class="ps-avatar${sizeClass}" title="${escapeHtml(getUserDisplayName(user))}">
      ${primary ? `<img class="ps-avatar-img" src="${escapeHtml(primary)}" alt="" decoding="async" referrerpolicy="no-referrer" data-fallbacks="${rest}" onerror="window.__psAvatarFallback && window.__psAvatarFallback(this)">` : ''}
      <span class="ps-avatar-initials"${primary ? ' hidden' : ''}>${initials}</span>
    </div>
  `;
}

window.__psAvatarFallback = function psAvatarFallback(img) {
  if (!img) return;
  let next = [];
  try { next = JSON.parse(img.getAttribute('data-fallbacks') || '[]'); } catch (err) { next = []; }
  if (next.length) {
    img.setAttribute('data-fallbacks', JSON.stringify(next.slice(1)));
    img.src = next[0];
    return;
  }
  const wrap = img.parentElement;
  img.remove();
  const initials = wrap?.querySelector('.ps-avatar-initials');
  if (initials) initials.hidden = false;
};

function debounce(fn, wait = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function toLocalDatetimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* ---------------------------------- TOASTS ---------------------------------- */
const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
};

function toast(message, type = 'info', timeout = 3400) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHtml(message)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease, transform 200ms ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
    setTimeout(() => el.remove(), 220);
  }, timeout);
}

/* ---------------------------------- MODAL ------------------------------------ */
const modalBackdrop = () => document.getElementById('modal-backdrop');

function openModal({ title, bodyHtml, footHtml = '', width = null, sizeClass = null }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-foot').innerHTML = footHtml;
  const modalEl = document.getElementById('modal');
  if (modalEl) {
    modalEl.className = 'modal' + (sizeClass ? ' ' + sizeClass : '');
    if (width) {
      modalEl.style.maxWidth = `min(${width}, 95vw)`;
    } else {
      modalEl.style.maxWidth = '';
    }
  }
  modalBackdrop().classList.add('active');
}

function closeModal() {
  modalBackdrop().classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  // Do not close on backdrop click per user setting
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
});

function confirmDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  danger = true,
  width = '500px',
  isHtmlMessage = false,
  onConfirm
}) {

  openModal({
    title,
    width,

    bodyHtml: `<p style="color:var(--text-secondary); font-size:13.5px; line-height:1.6;">${isHtmlMessage ? message : escapeHtml(message)}</p>`,

    footHtml: `
      <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">
        ${escapeHtml(confirmLabel)}
      </button>
    `,
  });

  document.getElementById('confirm-cancel').addEventListener('click', closeModal);

  document.getElementById('confirm-ok').addEventListener('click', async () => {
    await onConfirm();
    closeModal();
  });
}

/* ------------------------------- CSV HELPERS --------------------------------- */
function toCSV(rows, headers) {
  const escapeCell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headers.map((h) => escapeCell(h.label)).join(';');
  const lines = rows.map((row) => headers.map((h) => escapeCell(h.value(row))).join(';'));
  return [headerLine, ...lines].join('\n');
}

function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------- ESTADO GLOBAL -------------------------------- */
const STATE = {
  ventas: [],
  parques: [],
  tipos_bono: [],
  contactos: [],
  objetivosMensuales: [],
  currentUser: null,
};

function parqueNombre(parqueId) {
  if (!parqueId) return '—';
  const p = STATE.parques.find((x) => x.id === parqueId);
  return p ? p.nombre : '—';
}

function bonoNombre(bonoId) {
  if (!bonoId) return 'Bono Parques';
  const b = STATE.tipos_bono.find((x) => x.id === bonoId);
  return b ? b.nombre : 'Bono Parques';
}

function getVentaItemNombre(venta) {
  if (!venta) return '—';

  // Si es tipo bono o tiene bono_id
  if (venta.tipo === 'bono' || (!venta.parque_id && venta.bono_id)) {
    if (venta.bono_id) {
      const b = STATE.tipos_bono.find((x) => x.id === venta.bono_id);
      if (b && b.nombre && b.nombre !== '—') return b.nombre;
    }
    if (venta.bono_nombre && venta.bono_nombre !== '—') return venta.bono_nombre;
    if (venta.parque_nombre && venta.parque_nombre !== '—') return venta.parque_nombre;
    if (venta.item_nombre && venta.item_nombre !== '—') return venta.item_nombre;
    return 'Bono Parques';
  }

  // Si tiene parque_id
  if (venta.parque_id) {
    const p = STATE.parques.find((x) => x.id === venta.parque_id);
    if (p && p.nombre && p.nombre !== '—') return p.nombre;
  }

  // Nombres directos en propiedades
  if (venta.parque_nombre && venta.parque_nombre !== '—') return venta.parque_nombre;
  if (venta.bono_nombre && venta.bono_nombre !== '—') return venta.bono_nombre;
  if (venta.item_nombre && venta.item_nombre !== '—') return venta.item_nombre;

  if (venta.tipo === 'bono') return 'Bono Parques';
  return 'Otros / Sin especificar';
}

function isMismoDia(iso, ref) {
  const d = new Date(iso), r = new Date(ref);
  return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth() && d.getDate() === r.getDate();
}
function isMismaSemana(iso, ref) {
  const d = new Date(iso), r = new Date(ref);
  const getMonday = (date) => { const dt = new Date(date); const day = (dt.getDay() + 6) % 7; dt.setHours(0, 0, 0, 0); dt.setDate(dt.getDate() - day); return dt; };
  return getMonday(d).getTime() === getMonday(r).getTime();
}
function isMismoMes(iso, ref) {
  const d = new Date(iso), r = new Date(ref);
  return d.getFullYear() === r.getFullYear() && d.getMonth() === r.getMonth();
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    accent: styles.getPropertyValue('--accent').trim() || '#F5A623',
    accent2: styles.getPropertyValue('--info').trim() || '#60A5FA',
    success: styles.getPropertyValue('--success').trim() || '#34D399',
    danger: styles.getPropertyValue('--danger').trim() || '#F87171',
    text: styles.getPropertyValue('--text-secondary').trim() || '#8B95AC',
    grid: styles.getPropertyValue('--border-soft').trim() || '#1C2740',
    palette: ['#F5A623', '#60A5FA', '#34D399', '#F87171', '#A78BFA', '#F472B6', '#38BDF8', '#FBBF24'],
  };
}

/* -------------------------- ESTADOS DE VENTA --------------------------- */
const ESTADOS_VENTA = {
  completado: {
    id: 'completado',
    label: 'Completado',
    color: '#2EB872',
    colorBg: 'rgba(46, 184, 114, 0.10)',
    colorBorder: 'rgba(46, 184, 114, 0.28)',
    textColor: '#34D399',
    icon: '✅',
    esEfectivo: true,
  },
  enviado: {
    id: 'enviado',
    label: 'Enviado',
    color: '#5B9EF5',
    colorBg: 'rgba(91, 158, 245, 0.09)',
    colorBorder: 'rgba(91, 158, 245, 0.25)',
    textColor: '#7FB0F5',
    icon: '📤',
    esEfectivo: false,
  },
  pendiente: {
    id: 'pendiente',
    label: 'Pendiente de pago',
    color: '#F5A623',
    colorBg: 'rgba(245, 166, 35, 0.09)',
    colorBorder: 'rgba(245, 166, 35, 0.28)',
    textColor: '#F5A623',
    icon: '⏳',
    esEfectivo: false,
  },
  incompleto: {
    id: 'incompleto',
    label: 'Incompleto',
    color: '#E85D75',
    colorBg: 'rgba(232, 93, 117, 0.09)',
    colorBorder: 'rgba(232, 93, 117, 0.25)',
    textColor: '#E88A9A',
    icon: '❌',
    esEfectivo: false,
  },
  no_enviado: {
    id: 'no_enviado',
    label: 'No enviado',
    color: '#7A869A',
    colorBg: 'rgba(122, 134, 154, 0.09)',
    colorBorder: 'rgba(122, 134, 154, 0.25)',
    textColor: '#94A3B8',
    icon: '⏸️',
    esEfectivo: false,
  },
};

function normalizeEstadoVenta(val) {
  if (!val) return 'completado';
  const str = String(val).trim().toLowerCase();
  if (str === 'completado' || str === 'pagado' || str === 'completada' || str === 'completed') return 'completado';
  if (str === 'enviado' || str === 'enviada' || str === 'sent') return 'enviado';
  if (str === 'incompleto' || str === 'incompleta' || str === 'fallido' || str === 'error' || str === 'incomplete') return 'incompleto';
  if (str === 'no enviado' || str === 'no_enviado' || str === 'no-enviado' || str === 'sin enviar') return 'no_enviado';
  if (str === 'pago accesible' || str === 'pago_accesible' || str === 'pendiente' || str === 'pendiente de pago' || str === 'pendiente_pago' || str === 'pending') return 'pendiente';
  return 'completado';
}

function getEstadoBadgeInfo(val) {
  const norm = normalizeEstadoVenta(val);
  return ESTADOS_VENTA[norm] || ESTADOS_VENTA.completado;
}

function isVentaEfectiva(venta) {
  if (!venta) return false;
  // Solo se suman a ventas los que estén como completados
  const norm = normalizeEstadoVenta(venta.estado);
  return norm === 'completado';
}

