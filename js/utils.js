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
  currentUser: null,
};

function parqueNombre(parqueId) {
  const p = STATE.parques.find((x) => x.id === parqueId);
  return p ? p.nombre : '—';
}

function bonoNombre(bonoId) {
  const b = STATE.tipos_bono.find((x) => x.id === bonoId);
  return b ? b.nombre : '—';
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
