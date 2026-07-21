/* ============================================================================
   music.js — Lo-Fi Beats para trabajar (Web Audio API)
============================================================================ */

let musicCtx = null;
let musicPlaying = false;
let musicTimer = null;
let gainMaster = null;

// Progresión de acordes cálida y relajada — Cmaj7 - Am7 - Fmaj7 - G7
const CHORDS = [
  [261.63, 329.63, 392.00, 493.88],   // Cmaj7
  [220.00, 261.63, 329.63, 392.00],   // Am7
  [174.61, 220.00, 261.63, 349.23],   // Fmaj7
  [196.00, 246.94, 293.66, 349.23],   // G7
];

const BPM = 88;
const STEP = 60 / BPM / 2; // corchea (8 pasos = 1 compás por acorde)

let step = 0;
let chordIndex = 0;

/* ---------- Percusión suave, tipo lo-fi ---------- */

function playKick(time) {
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.15);
  gain.gain.setValueAtTime(0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  osc.connect(gain);
  gain.connect(gainMaster);
  osc.start(time);
  osc.stop(time + 0.25);
}

// "Rimshot" suave en vez de caja/hi-hat brillante — mucho más discreto
function playRim(time) {
  const bufferSize = musicCtx.sampleRate * 0.04;
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = musicCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, time);
  filter.Q.setValueAtTime(1.2, time);

  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.06, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.06);
}

// Textura tipo "vinilo" muy sutil de fondo, típica del lo-fi
function playVinylTick(time) {
  const bufferSize = musicCtx.sampleRate * 0.02;
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = musicCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(4000, time);

  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.015, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.04);
}

/* ---------- Bajo cálido y acordes ---------- */

function playBassNote(freq, time, dur) {
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  osc.type = 'sine';

  const filter = musicCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(350, time);

  osc.frequency.setValueAtTime(freq / 2, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.16, time + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function playChord(chord, time, dur) {
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, time);

  const chordGain = musicCtx.createGain();
  chordGain.gain.setValueAtTime(0, time);
  chordGain.gain.linearRampToValueAtTime(0.06, time + 0.6);
  chordGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  chordGain.connect(filter);
  filter.connect(gainMaster);

  chord.forEach((freq) => {
    const osc = musicCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 6, time);
    osc.connect(chordGain);
    osc.start(time);
    osc.stop(time + dur + 0.1);
  });
}

/* ---------- Secuenciador (patrón boom-bap suave) ---------- */

function playStep() {
  if (!musicPlaying || !musicCtx) return;

  try {
    const now = musicCtx.currentTime;
    const beat = step % 8;

    // Acorde nuevo al empezar cada compás (8 pasos)
    if (beat === 0) {
      const chord = CHORDS[chordIndex];
      playChord(chord, now, STEP * 8);
      playBassNote(chord[0], now, STEP * 4);
      chordIndex = (chordIndex + 1) % CHORDS.length;
    }

    // Kick suave en tiempos 1 y 3 (estilo boom-bap relajado)
    if (beat === 0 || beat === 4) {
      playKick(now);
    }

    // Rimshot discreto en el "and" del tiempo 2 y en el 4 (groove, no distrae)
    if (beat === 3 || beat === 6) {
      playRim(now);
    }

    // Textura de vinilo muy de fondo, casi imperceptible
    if (beat % 2 === 1) {
      playVinylTick(now);
    }

    step = (step + 1) % 8;
  } catch (e) {
    console.warn('Error en reproductor de música:', e);
  }
}

/* ---------- Control de reproducción ---------- */

function startMusic() {
  if (musicPlaying) return;
  try {
    if (!musicCtx) {
      musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (musicCtx.state === 'suspended') {
      musicCtx.resume();
    }

    if (!gainMaster) {
      gainMaster = musicCtx.createGain();
      gainMaster.gain.setValueAtTime(0.3, musicCtx.currentTime);
      gainMaster.connect(musicCtx.destination);
    }

    musicPlaying = true;
    step = 0;
    chordIndex = 0;
    playStep();
    musicTimer = setInterval(playStep, STEP * 1000);
    updateMusicUI(true);
    localStorage.setItem('parksales_music', 'on');
  } catch (e) {
    console.error('No se pudo iniciar la música:', e);
  }
}

function stopMusic() {
  musicPlaying = false;
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  updateMusicUI(false);
  localStorage.setItem('parksales_music', 'off');
}

function toggleMusic() {
  if (musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
}

function updateMusicUI(active) {
  const btn = document.getElementById('music-toggle');
  const iconOn = document.getElementById('music-icon-on');
  const iconOff = document.getElementById('music-icon-off');

  if (!btn) return;

  if (active) {
    btn.classList.add('active');
    btn.title = 'Música de fondo: Activada (Clic para pausar)';
    if (iconOn) iconOn.style.display = 'block';
    if (iconOff) iconOff.style.display = 'none';
  } else {
    btn.classList.remove('active');
    btn.title = 'Música de fondo: Desactivada (Clic para activar)';
    if (iconOn) iconOn.style.display = 'none';
    if (iconOff) iconOff.style.display = 'block';
  }
}

function wireMusicToggle() {
  const btn = document.getElementById('music-toggle');
  if (!btn) return;

  btn.addEventListener('click', toggleMusic);
}