/* ============================================================================
   notas.js — bloc de notas rápidas con autoguardado en localStorage
============================================================================ */

function initNotasRapidas() {
  const textarea = document.getElementById('notas-rapidas-textarea');
  const statusText = document.getElementById('notes-status-text');
  const charCountEl = document.getElementById('notes-char-count');
  const wordCountEl = document.getElementById('notes-word-count');
  const btnCopy = document.getElementById('notes-btn-copy');
  const btnClear = document.getElementById('notes-btn-clear');

  if (!textarea) return;

  // Cargar notas desde localStorage
  const savedNotes = localStorage.getItem('parksales_quick_notes') || '';
  textarea.value = savedNotes;

  // Actualizar estadísticas iniciales
  updateNotesStats(savedNotes);
  updateNotesStatus('saved');

  // Debounce para cambiar el estado visual a "Guardado"
  const setSavedStatus = debounce(() => {
    updateNotesStatus('saved');
  }, 800);

  // Escuchar cambios de escritura
  textarea.addEventListener('input', (e) => {
    const text = e.target.value;
    updateNotesStatus('saving');
    
    // Guardar de inmediato para evitar cualquier pérdida
    localStorage.setItem('parksales_quick_notes', text);
    
    updateNotesStats(text);
    setSavedStatus();
  });

  // Botón Copiar al portapapeles
  btnCopy.addEventListener('click', async () => {
    const text = textarea.value;
    if (!text.trim()) {
      toast('No hay texto para copiar', 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiado al portapapeles', 'success');
    } catch (err) {
      toast('Error al copiar al portapapeles', 'error');
      console.error(err);
    }
  });

  // Botón Limpiar bloc
  btnClear.addEventListener('click', () => {
    const text = textarea.value;
    if (!text.trim()) return;

    confirmDialog({
      title: '¿Limpiar notas?',
      message: '¿Estás seguro de que quieres borrar de forma permanente todas tus notas rápidas? Esta acción no se puede deshacer.',
      confirmLabel: 'Limpiar bloc',
      danger: true,
      onConfirm: () => {
        textarea.value = '';
        localStorage.removeItem('parksales_quick_notes');
        updateNotesStats('');
        updateNotesStatus('saved');
        toast('Bloc de notas borrado', 'success');
        textarea.focus();
      }
    });
  });

  // Función para actualizar las estadísticas de palabras/caracteres
  function updateNotesStats(text) {
    const charCount = text.length;
    // Dividir por espacios y filtrar elementos vacíos para contar palabras reales
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    charCountEl.textContent = fmtNum(charCount);
    wordCountEl.textContent = fmtNum(wordCount);
  }

  // Función para actualizar visualmente la barra de estado
  function updateNotesStatus(state) {
    if (!statusText) return;
    if (state === 'saving') {
      statusText.innerHTML = `
        <svg class="notes-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px; animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>Guardando...</span>
      `;
      statusText.className = 'notes-status saving';
    } else {
      statusText.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px; height:13px;">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Guardado localmente</span>
      `;
      statusText.className = 'notes-status saved';
    }
  }
}
