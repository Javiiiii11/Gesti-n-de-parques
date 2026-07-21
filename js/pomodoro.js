/* ============================================================================
   pomodoro.js — Temporizador compacto en la sidebar con persistencia
   - Input editable en formato MM:SS solo acepta números
   - Al pulsar ▶ se bloquea y empieza la cuenta atrás
   - Sonido + notificación al terminar
   - Persistencia de nota y temporizador en localStorage al recargar la página
============================================================================ */

function initPomodoro() {
  const display = document.getElementById('pomo-display');
  const descInput = document.getElementById('pomo-desc');
  const btnStart = document.getElementById('pomo-start');
  const btnPause = document.getElementById('pomo-pause');
  const btnReset = document.getElementById('pomo-reset');
  const progressBar = document.getElementById('pomo-progress');
  const progressText = document.getElementById('pomo-progress-text');
  const stateLabel = document.getElementById('pomo-state');
  const sidebarBadge = document.getElementById('sidebar-pomo-badge');

  const presetButtons = document.querySelectorAll('.sp-preset-pill');

  let timerState = 'idle';
  let totalSeconds = 0;
  let remainingSeconds = 0;
  let intervalId = null;
  let audioCtx = null;
  let originalTitle = document.title || 'ParkSales';

  const svgPlay = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
  const svgPause = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  // ─── Format/Parse Helpers ───────────────────────────────────────────
  function formatSecondsToMMSS(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function parseInputToSeconds(val) {
    val = val.trim();
    if (!val) return 0;
    
    if (val.includes(':')) {
      const parts = val.split(':');
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      return m * 60 + s;
    }
    
    const digits = val.replace(/\D/g, '');
    if (!digits) return 0;
    
    if (digits.length <= 2) {
      return parseInt(digits, 10) * 60;
    } else {
      const s = parseInt(digits.slice(-2), 10) || 0;
      const m = parseInt(digits.slice(0, -2), 10) || 0;
      return m * 60 + s;
    }
  }

  function getSeconds() {
    return parseInputToSeconds(display.value);
  }

  function setSeconds(secs) {
    display.value = formatSecondsToMMSS(secs);
  }

  // Formatear el input al perder el foco (blur) o presionar Enter
  display.addEventListener('blur', function() {
    if (timerState === 'idle') {
      const secs = getSeconds();
      setSeconds(secs > 0 ? secs : 300);
    }
  });

  display.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      display.blur();
      if (timerState === 'idle') startTimer();
    }
  });

  // Guardar nota en localStorage al escribir
  descInput.addEventListener('input', () => {
    localStorage.setItem('parksales_pomo_desc', descInput.value);
  });

  // ─── Persistencia (localStorage) ──────────────────────────────────
  function saveStateToStorage() {
    localStorage.setItem('parksales_pomo_state', timerState);
    localStorage.setItem('parksales_pomo_desc', descInput.value);
    localStorage.setItem('parksales_pomo_total', totalSeconds);
    if (timerState === 'running') {
      const endTime = Date.now() + remainingSeconds * 1000;
      localStorage.setItem('parksales_pomo_endtime', endTime);
    } else if (timerState === 'paused') {
      localStorage.setItem('parksales_pomo_paused_rem', remainingSeconds);
    }
  }

  function clearStorageState() {
    localStorage.removeItem('parksales_pomo_state');
    localStorage.removeItem('parksales_pomo_endtime');
    localStorage.removeItem('parksales_pomo_paused_rem');
    localStorage.removeItem('parksales_pomo_total');
  }

  function restoreSavedState() {
    const savedDesc = localStorage.getItem('parksales_pomo_desc');
    if (savedDesc !== null) {
      descInput.value = savedDesc;
    }

    const savedState = localStorage.getItem('parksales_pomo_state');
    const savedTotal = parseInt(localStorage.getItem('parksales_pomo_total'), 10) || 0;

    if (savedState === 'running') {
      const endTime = parseInt(localStorage.getItem('parksales_pomo_endtime'), 10) || 0;
      const secsLeft = Math.round((endTime - Date.now()) / 1000);

      if (secsLeft > 0) {
        totalSeconds = savedTotal > 0 ? savedTotal : secsLeft;
        remainingSeconds = secsLeft;
        timerState = 'running';

        setSeconds(remainingSeconds);
        updateProgress();
        updateBadge(remainingSeconds);
        updateTabTitle();
        setState('▶ En curso...', 'running');

        btnStart.style.display = 'none';
        btnPause.style.display = 'inline-flex';
        btnPause.innerHTML = svgPause;
        btnReset.style.display = 'inline-flex';

        display.disabled = true;
        descInput.disabled = true;

        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(tick, 1000);
      } else {
        // El tiempo terminó mientras la ventana estaba cerrada/recargando
        onTimerFinish();
      }
    } else if (savedState === 'paused') {
      const secsLeft = parseInt(localStorage.getItem('parksales_pomo_paused_rem'), 10) || 0;
      if (secsLeft > 0) {
        totalSeconds = savedTotal > 0 ? savedTotal : secsLeft;
        remainingSeconds = secsLeft;
        timerState = 'paused';

        setSeconds(remainingSeconds);
        updateProgress();
        updateBadge(remainingSeconds);
        updateTabTitle();
        setState('⏸ Pausado', 'paused');

        btnStart.style.display = 'none';
        btnPause.style.display = 'inline-flex';
        btnPause.innerHTML = svgPlay;
        btnReset.style.display = 'inline-flex';

        display.disabled = true;
        descInput.disabled = true;
      }
    }
  }

  // ─── Badge y Título de pestaña ──────────────────────────────────────────
  function updateBadge(secs) {
    if (sidebarBadge) {
      if (timerState === 'running' || timerState === 'paused') {
        sidebarBadge.textContent = formatSecondsToMMSS(secs);
        sidebarBadge.style.display = '';
        sidebarBadge.className = 'sp-badge' + (timerState === 'paused' ? ' paused' : '');
      } else {
        sidebarBadge.style.display = 'none';
      }
    }
  }

  function updateTabTitle() {
    if (timerState === 'running') {
      document.title = `(${formatSecondsToMMSS(remainingSeconds)}) ${originalTitle}`;
    } else if (timerState === 'paused') {
      document.title = `[⏸ ${formatSecondsToMMSS(remainingSeconds)}] ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }
  }

  function updateProgress() {
    if (totalSeconds === 0) {
      progressBar.style.width = '0%';
      if (progressText) progressText.textContent = '0%';
      return;
    }
    const pct = Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);
    progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = pct + '%';
  }

  function setState(text, cls) {
    stateLabel.textContent = text;
    stateLabel.className = 'sp-state' + (cls ? ' ' + cls : '');
  }

  // ─── Sonido ─────────────────────────────────────────────────────────────
  function playAlarm() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [523.25, 659.25].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.5);
        gain.gain.setValueAtTime(0.15, now + i * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.5 + 0.6);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + i * 0.5);
        osc.stop(now + i * 0.5 + 0.6);
      });
    } catch (e) { console.warn('No se pudo reproducir el sonido:', e); }
  }

  function showNotification(titulo, mensaje) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(titulo, { body: mensaje });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (e) { console.warn('Notificación no disponible:', e); }
  }

  function onTimerFinish() {
    timerState = 'finished';
    clearInterval(intervalId);
    intervalId = null;
    clearStorageState();
    setSeconds(0);
    updateBadge(0);
    updateProgress();
    updateTabTitle();
    setState('⏰ ¡Tiempo!', 'finished');
    btnStart.style.display = 'none';
    btnPause.style.display = 'none';
    btnReset.style.display = 'inline-flex';

    playAlarm();
    const desc = descInput.value.trim() || 'Temporizador';
    showNotification('ParkSales — ⏰ ¡Tiempo cumplido!', '"' + desc + '" — ¡Es hora de actuar!');
    toast('⏰ ¡Tiempo cumplido! "' + desc + '"', 'success', 6000);
    setTimeout(playAlarm, 2000);
    setTimeout(playAlarm, 4000);
  }

  function tick() {
    if (remainingSeconds <= 0) { onTimerFinish(); return; }
    remainingSeconds--;
    setSeconds(remainingSeconds);
    updateProgress();
    updateBadge(remainingSeconds);
    updateTabTitle();
  }

  function startTimer() {
    const secs = getSeconds();
    if (secs < 1) {
      toast('Pon al menos 1 minuto', 'error');
      setSeconds(60);
      return;
    }
    if (secs > 10800) {
      toast('Máximo 180 minutos', 'error');
      return;
    }

    totalSeconds = secs;
    remainingSeconds = secs;
    timerState = 'running';
    saveStateToStorage();

    setSeconds(remainingSeconds);
    updateProgress();
    updateBadge(remainingSeconds);
    updateTabTitle();
    setState('▶ En curso...', 'running');

    btnStart.style.display = 'none';
    btnPause.style.display = 'inline-flex';
    btnPause.innerHTML = svgPause;
    btnReset.style.display = 'inline-flex';

    display.disabled = true;
    descInput.disabled = true;

    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
  }

  function pauseTimer() {
    if (timerState === 'running') {
      timerState = 'paused';
      clearInterval(intervalId);
      intervalId = null;
      saveStateToStorage();
      setState('⏸ Pausado', 'paused');
      btnPause.innerHTML = svgPlay;
      updateBadge(remainingSeconds);
      updateTabTitle();
    } else if (timerState === 'paused') {
      timerState = 'running';
      saveStateToStorage();
      setState('▶ En curso...', 'running');
      btnPause.innerHTML = svgPause;
      updateBadge(remainingSeconds);
      updateTabTitle();
      intervalId = setInterval(tick, 1000);
    }
  }

  function resetTimer() {
    clearInterval(intervalId);
    intervalId = null;
    timerState = 'idle';
    clearStorageState();
    remainingSeconds = 0;
    totalSeconds = 0;
    setSeconds(0);
    progressBar.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    setState('⏳ Listo');

    display.disabled = false;
    descInput.disabled = false;

    btnStart.style.display = 'inline-flex';
    btnPause.style.display = 'none';
    btnPause.innerHTML = svgPause;
    btnReset.style.display = 'none';

    updateBadge(0);
    updateTabTitle();
    display.value = '05:00';
  }

  // ─── Preset Pills ─────────────────────────────────────────
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      resetTimer();
      const mins = parseInt(btn.dataset.minutes, 10) || 5;
      setSeconds(mins * 60);
      startTimer();
    });
  });

  btnStart.addEventListener('click', startTimer);
  btnPause.addEventListener('click', pauseTimer);
  btnReset.addEventListener('click', resetTimer);
  descInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startTimer();
  });

  // ─── Restaurar Estado al Inicializar ──────────────────────
  restoreSavedState();

  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => Notification.requestPermission(), 3000);
  }
}
