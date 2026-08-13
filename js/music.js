/* ============================================================================
   music.js — Reproductor multi-género con shuffle automático (Web Audio API)
   Varios estilos con más ritmo, cambio aleatorio automático y crossfade suave.
============================================================================ */

let musicCtx = null;
let musicPlaying = false;
let musicTimer = null;
let gainMaster = null;

/* ----------------- COLECCIÓN DE PISTAS (6 estilos con ritmo) ----------------- */
/* Cada pista define su propio BPM, progresión de acordes, batería y "vibe".
   Las duraciones son aproximadas (en compases) para que salte a la siguiente canción. */
const TRACKS = [
  {
    id: 'synthpop',
    nombre: 'Midnight Drive',
    genero: 'Synth Pop',
    bpm: 116,
    duracionCompases: 48,
    chordProgression: [
      [261.63, 329.63, 392.00, 523.25],   // Cmaj
      [220.00, 261.63, 329.63, 440.00],   // Am
      [174.61, 220.00, 261.63, 349.23],   // Fmaj
      [196.00, 246.94, 293.66, 392.00],   // Gmaj
    ],
    bateria: 'fourOnTheFloor',
    estilo: { synth: 'pluck', bass: 'acido', arpegio: true, pads: false }
  },
  {
    id: 'house',
    nombre: 'Summer House',
    genero: 'Deep House',
    bpm: 124,
    duracionCompases: 52,
    chordProgression: [
      [293.66, 349.23, 440.00, 587.33],   // Dmin9
      [261.63, 329.63, 392.00, 523.25],   // Cmaj7
      [220.00, 277.18, 329.63, 440.00],   // Am7
      [174.61, 220.00, 261.63, 349.23],   // Fmaj7
    ],
    bateria: 'house',
    estilo: { synth: 'pads', bass: 'sub', arpegio: false, pads: true }
  },
  {
    id: 'edm',
    nombre: 'Festival Lights',
    genero: 'EDM',
    bpm: 138,
    duracionCompases: 44,
    chordProgression: [
      [261.63, 329.63, 392.00, 523.25],   // Cmaj
      [293.66, 349.23, 440.00, 587.33],   // Dmin
      [349.23, 440.00, 523.25, 698.46],   // Fmaj
      [329.63, 392.00, 493.88, 659.25],   // Em
    ],
    bateria: 'edm',
    estilo: { synth: 'supersaw', bass: 'heavy', arpegio: true, pads: true }
  },
  {
    id: 'nudisco',
    nombre: 'Golden Hour',
    genero: 'Nu-Disco',
    bpm: 120,
    duracionCompases: 50,
    chordProgression: [
      [261.63, 329.63, 392.00, 493.88],   // Cmaj7
      [349.23, 440.00, 523.25, 659.25],   // Fmaj7
      [196.00, 246.94, 293.66, 392.00],   // G7
      [293.66, 349.23, 440.00, 523.25],   // Dm7
    ],
    bateria: 'disco',
    estilo: { synth: 'chordStab', bass: 'walking', arpegio: false, pads: false }
  },
  {
    id: 'funk',
    nombre: 'Coffee Groove',
    genero: 'Funk',
    bpm: 106,
    duracionCompases: 56,
    chordProgression: [
      [261.63, 329.63, 392.00, 466.16],   // C7
      [196.00, 246.94, 293.66, 369.99],   // G7
      [220.00, 277.18, 329.63, 415.30],   // A7
      [174.61, 220.00, 261.63, 329.63],   // Fmaj7
    ],
    bateria: 'funk',
    estilo: { synth: 'clavi', bass: 'slap', arpegio: false, pads: false }
  },
  {
    id: 'tropical',
    nombre: 'Beach Vibes',
    genero: 'Tropical',
    bpm: 98,
    duracionCompases: 50,
    chordProgression: [
      [261.63, 329.63, 392.00, 523.25],   // Cmaj
      [196.00, 246.94, 293.66, 392.00],   // Gmaj
      [220.00, 261.63, 329.63, 440.00],   // Am
      [174.61, 220.00, 261.63, 349.23],   // Fmaj
    ],
    bateria: 'reggaeton',
    estilo: { synth: 'pluck', bass: 'sub', arpegio: true, pads: true }
  },
];

/* =========================================================
   ESTADO ACTUAL
========================================================= */
let currentTrack = null;
let currentBPM = 100;
let currentSTEP = 0.25;
let step = 0;
let chordIndex = 0;
let compasActual = 0;
let stepsPerCompas = 8; // 8 corcheas = 1 compás de 4/4
let recientes = []; // Para no repetir canciones

/* =========================================================
   MOTOR DE RUIDO / PERCUSIÓN
========================================================= */
function crearBufferRuido(duracionSegundos) {
  const bufferSize = Math.floor(musicCtx.sampleRate * duracionSegundos);
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/* Kick */
function playKick(time, fuerza = 1) {
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.18);
  gain.gain.setValueAtTime(0.45 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
  osc.connect(gain);
  gain.connect(gainMaster);
  osc.start(time);
  osc.stop(time + 0.30);
}

/* Clap / Caja brillante */
function playClap(time, fuerza = 1) {
  const bufferSize = musicCtx.sampleRate * 0.22;
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1600, time);
  filter.Q.setValueAtTime(1.0, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.22 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.20);
}

/* Hi-hat cerrado */
function playHat(time, fuerza = 0.7, pitch = 'mid') {
  const buffer = crearBufferRuido(0.05);
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(pitch === 'high' ? 9000 : 6000, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.08 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.055);
}

/* Hi-hat abierto */
function playOpenHat(time, fuerza = 0.6) {
  const buffer = crearBufferRuido(0.22);
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(7500, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.1 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.22);
}

/* Snare / Trap */
function playSnare(time, fuerza = 1) {
  const bufferSize = musicCtx.sampleRate * 0.18;
  const buffer = musicCtx.createBuffer(1, bufferSize, musicCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(200, time);
  filter.frequency.exponentialRampToValueAtTime(1800, time + 0.06);
  filter.Q.setValueAtTime(0.8, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.3 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.14);
}

/* Percusión tropical (shaker) */
function playShaker(time, fuerza = 0.5) {
  const buffer = crearBufferRuido(0.06);
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(5500, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.06 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 0.06);
}

/* Crash / Transición */
function playCrash(time, fuerza = 0.4) {
  const buffer = crearBufferRuido(1.2);
  const noise = musicCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(5000, time);
  const gain = musicCtx.createGain();
  gain.gain.setValueAtTime(0.12 * fuerza, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 1.1);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  noise.start(time);
  noise.stop(time + 1.2);
}

/* =========================================================
   BAJOS
========================================================= */
function playBass(freq, time, dur, estilo = 'sub') {
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'lowpass';

  if (estilo === 'sub') {
    osc.type = 'sine';
    filter.frequency.setValueAtTime(280, time);
  } else if (estilo === 'acido') {
    osc.type = 'sawtooth';
    filter.frequency.setValueAtTime(900, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + dur);
    filter.Q.setValueAtTime(3, time);
  } else if (estilo === 'heavy') {
    osc.type = 'square';
    filter.frequency.setValueAtTime(500, time);
    filter.Q.setValueAtTime(2, time);
  } else if (estilo === 'walking' || estilo === 'slap') {
    osc.type = 'triangle';
    filter.frequency.setValueAtTime(650, time);
  } else {
    osc.type = 'sine';
    filter.frequency.setValueAtTime(350, time);
  }

  osc.frequency.setValueAtTime(freq / 2, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.18, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

/* =========================================================
   SINTEIZADORES / ARPEGIOS / PADS
========================================================= */
function playSynthNote(freq, time, dur, tipo = 'pluck', fuerza = 0.8) {
  const osc = musicCtx.createOscillator();
  const gain = musicCtx.createGain();
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'lowpass';

  if (tipo === 'pluck') {
    osc.type = 'triangle';
    filter.frequency.setValueAtTime(3000, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + dur);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1 * fuerza, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  } else if (tipo === 'supersaw') {
    osc.type = 'sawtooth';
    osc.detune.setValueAtTime(12, time);
    filter.frequency.setValueAtTime(2400, time);
    filter.Q.setValueAtTime(1.5, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.08 * fuerza, time + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  } else if (tipo === 'chordStab') {
    osc.type = 'sawtooth';
    filter.frequency.setValueAtTime(3800, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11 * fuerza, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  } else if (tipo === 'clavi') {
    osc.type = 'square';
    filter.frequency.setValueAtTime(2800, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.09 * fuerza, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  } else {
    osc.type = 'triangle';
    filter.frequency.setValueAtTime(2000, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1 * fuerza, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  }

  osc.frequency.setValueAtTime(freq, time);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(gainMaster);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

/* Pad (acorde largo, suave) */
function playPad(chord, time, dur, fuerza = 0.6) {
  const filter = musicCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, time);
  const chordGain = musicCtx.createGain();
  chordGain.gain.setValueAtTime(0, time);
  chordGain.gain.linearRampToValueAtTime(0.04 * fuerza, time + 0.9);
  chordGain.gain.linearRampToValueAtTime(0.04 * fuerza, time + dur - 0.9);
  chordGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  chordGain.connect(filter);
  filter.connect(gainMaster);
  chord.forEach((freq, i) => {
    const osc = musicCtx.createOscillator();
    osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 10, time);
    osc.connect(chordGain);
    osc.start(time);
    osc.stop(time + dur + 0.1);
  });
}

/* Arpegio sobre un acorde */
function playArpegio(chord, time, tiempoEntreNotas, veces, tipo = 'pluck') {
  const patron = [0, 2, 4, 2, 1, 3, 2, 0]; // Clásico
  for (let i = 0; i < veces; i++) {
    const notaIndex = patron[i % patron.length] % chord.length;
    const octavaSalto = Math.floor(i / chord.length) > 0 && i % chord.length === 0 ? 2 : 1;
    const freq = chord[notaIndex] * octavaSalto;
    const t = time + i * tiempoEntreNotas;
    playSynthNote(freq, t, tiempoEntreNotas * 1.4, tipo, 0.55);
  }
}

/* =========================================================
   SECUENCIADOR POR GÉNERO / BATERÍA
========================================================= */
function tocarBateria(estilo, beat, now) {
  const mitadCompas = beat % 4;
  switch (estilo) {
    case 'fourOnTheFloor':
      if (beat % 2 === 0) playKick(now);
      if (beat === 3 || beat === 7) playClap(now);
      if (beat % 2 === 1) playHat(now, 0.8, 'high');
      if (beat === 6) playOpenHat(now);
      break;
    case 'house':
      if (beat % 2 === 0) playKick(now, 1.05);
      if (beat === 3 || beat === 7) playClap(now);
      if (beat % 1 === 0) playHat(now, 0.6);
      if (beat === 5 || beat === 6) playOpenHat(now);
      break;
    case 'edm':
      if (beat === 0 || beat === 4) playKick(now, 1.1);
      if (beat === 2 || beat === 6) playKick(now, 0.6);
      if (beat === 3 || beat === 7) playSnare(now, 1.1);
      if (beat % 1 === 0) playHat(now, 0.9, 'high');
      if (beat === 7 && compasActual % 8 === 7) playCrash(now);
      break;
    case 'disco':
      if (beat === 0 || beat === 2 || beat === 4 || beat === 6) playKick(now, 0.95);
      if (beat === 2 || beat === 6) playClap(now, 0.85);
      if (beat === 1 || beat === 3 || beat === 5 || beat === 7) playHat(now, 0.85);
      if (beat === 5) playOpenHat(now, 0.7);
      break;
    case 'funk':
      if (beat === 0) playKick(now);
      if (beat === 5) playKick(now, 0.7);
      if (beat === 2 || beat === 6) playSnare(now);
      if (beat === 1 || beat === 3 || beat === 5 || beat === 7) playHat(now, 0.9);
      if (beat === 7) playShaker(now);
      break;
    case 'reggaeton':
      // Dem Bow: kick en 0, 3.5, 4.5 / snare en 2 y 6 (corcheas)
      if (beat === 0) playKick(now, 1);
      if (beat === 3) playKick(now, 0.7);
      if (beat === 5) playKick(now, 0.8);
      if (beat === 2 || beat === 6) playSnare(now);
      if (beat % 1 === 0) playHat(now, 0.6);
      if (beat === 1 || beat === 4 || beat === 7) playShaker(now, 0.5);
      break;
  }
}

/* =========================================================
   LOOP PRINCIPAL
========================================================= */
function playStep() {
  if (!musicPlaying || !musicCtx || !currentTrack) return;

  try {
    const now = musicCtx.currentTime;
    const beat = step % stepsPerCompas;
    const compasInicial = compasActual;

    // Cambiar acorde al inicio del compás
    if (beat === 0) {
      const chord = currentTrack.chordProgression[chordIndex];

      // PAD / Chord stab
      if (currentTrack.estilo.pads && compasActual % 2 === 0) {
        playPad(chord, now, currentSTEP * stepsPerCompas * 2);
      } else if (currentTrack.estilo.synth === 'chordStab' && (compasActual % 2 === 0 || compasActual % 4 === 3)) {
        chord.forEach(f => playSynthNote(f, now, currentSTEP * 2.2, 'chordStab', 0.75));
      }

      // Bajo
      const bassEstilo = currentTrack.estilo.bass;
      if (bassEstilo === 'walking') {
        playBass(chord[0], now, currentSTEP * 2, bassEstilo);
        playBass(chord[1], now + currentSTEP * 2, currentSTEP * 2, bassEstilo);
        playBass(chord[2], now + currentSTEP * 4, currentSTEP * 2, bassEstilo);
        playBass(chord[0] * 1.5, now + currentSTEP * 6, currentSTEP * 2, bassEstilo);
      } else if (bassEstilo === 'slap') {
        playBass(chord[0], now, currentSTEP * 1.4, bassEstilo);
        playBass(chord[0], now + currentSTEP * 3, currentSTEP * 1.1, bassEstilo);
        playBass(chord[2], now + currentSTEP * 5, currentSTEP * 1.6, bassEstilo);
      } else {
        // Bass estándar en 1 y 3+
        playBass(chord[0], now, currentSTEP * 3, bassEstilo);
        playBass(chord[0] * 1.25, now + currentSTEP * 4, currentSTEP * 2, bassEstilo);
        playBass(chord[2], now + currentSTEP * 6, currentSTEP * 2, bassEstilo);
      }

      // Arpegio (más rápido en EDM/House)
      if (currentTrack.estilo.arpegio) {
        const tipoArp = currentTrack.estilo.synth === 'supersaw' ? 'supersaw' : 'pluck';
        const pasos = currentTrack.id === 'edm' ? 16 : 12;
        playArpegio(chord, now, currentSTEP * 0.5, pasos, tipoArp);
      }

      chordIndex = (chordIndex + 1) % currentTrack.chordProgression.length;
      compasActual++;
    }

    // Batería en cada corchea
    tocarBateria(currentTrack.bateria, beat, now);

    // Añadir melodía pequeña (nota alta) en tiempos alternos según género
    if (currentTrack.estilo.synth !== 'chordStab' && (beat === 1 || beat === 5)) {
      const chord = currentTrack.chordProgression[(chordIndex + currentTrack.chordProgression.length - 1) % currentTrack.chordProgression.length];
      const melodiaIndex = (step * 3) % chord.length;
      playSynthNote(chord[melodiaIndex] * 2, now, currentSTEP * 1.8, currentTrack.estilo.synth || 'pluck', 0.3);
    }

    // FINAL DE PISTA: ¿Terminó la duración? → saltar a otra ALEATORIA
    if (compasActual >= currentTrack.duracionCompases && compasInicial !== compasActual) {
      cambiarAPistaAleatoria();
    }

    step = (step + 1) % stepsPerCompas;
  } catch (e) {
    console.warn('Error en reproductor de música:', e);
  }
}

/* =========================================================
   SHUFFLE Y CROSSFADE ENTRE PISTAS
========================================================= */
function elegirPistaAleatoria() {
  const noRecientes = TRACKS.filter(t => !recientes.includes(t.id));
  const pool = noRecientes.length > 0 ? noRecientes : TRACKS;
  const seleccionada = pool[Math.floor(Math.random() * pool.length)];
  // Mantener buffer de 3 recientes para no repetir
  recientes.push(seleccionada.id);
  if (recientes.length > 3) recientes.shift();
  return seleccionada;
}

function cargarPista(track, aplicarFadeIn = false) {
  currentTrack = track;
  currentBPM = track.bpm;
  currentSTEP = 60 / currentBPM / 2; // corchea
  stepsPerCompas = 8;
  step = 0;
  chordIndex = 0;
  compasActual = 0;

  // Fade in suave
  if (aplicarFadeIn && gainMaster) {
    const t = musicCtx.currentTime;
    gainMaster.gain.cancelScheduledValues(t);
    gainMaster.gain.setValueAtTime(0.001, t);
    gainMaster.gain.linearRampToValueAtTime(0.28, t + 0.9);
  }
  actualizarUIConPistaActual();
}

function cambiarAPistaAleatoria() {
  if (!musicCtx) return;

  // Fade out de la actual
  if (gainMaster) {
    const t = musicCtx.currentTime;
    gainMaster.gain.cancelScheduledValues(t);
    const volActual = gainMaster.gain.value || 0.28;
    gainMaster.gain.setValueAtTime(volActual, t);
    gainMaster.gain.linearRampToValueAtTime(0.001, t + 0.8);
  }

  // Cambiar de pista y hacer fade in justo después
  setTimeout(() => {
    if (!musicPlaying) return;
    const nueva = elegirPistaAleatoria();
    cargarPista(nueva, true);
  }, 750);
}

/* Función pública para saltar a la siguiente pista */
function siguientePista() {
  if (!musicPlaying) {
    startMusic();
    return;
  }
  cambiarAPistaAleatoria();
}

/* =========================================================
   CONTROL DE REPRODUCCIÓN
========================================================= */
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
      gainMaster.gain.setValueAtTime(0.28, musicCtx.currentTime);
      gainMaster.connect(musicCtx.destination);
    }

    // Si no hay pista cargada, elegir una aleatoria para empezar
    if (!currentTrack) {
      cargarPista(elegirPistaAleatoria(), true);
    }

    musicPlaying = true;
    playStep();
    musicTimer = setInterval(playStep, currentSTEP * 1000);
    updateMusicUI(true);
    actualizarUIConPistaActual();
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
  // Fade out corto antes de parar
  if (gainMaster && musicCtx) {
    const t = musicCtx.currentTime;
    gainMaster.gain.cancelScheduledValues(t);
    gainMaster.gain.setValueAtTime(gainMaster.gain.value || 0.28, t);
    gainMaster.gain.linearRampToValueAtTime(0.001, t + 0.3);
  }
  updateMusicUI(false);
  localStorage.setItem('parksales_music', 'off');
}

function toggleMusic() {
  if (musicPlaying) stopMusic();
  else startMusic();
}

/* =========================================================
   UI
========================================================= */
function updateMusicUI(active) {
  const btn = document.getElementById('music-toggle');
  const iconOn = document.getElementById('music-icon-on');
  const iconOff = document.getElementById('music-icon-off');
  if (!btn) return;

  if (active) {
    btn.classList.add('active');
    if (iconOn) iconOn.style.display = 'block';
    if (iconOff) iconOff.style.display = 'none';
  } else {
    btn.classList.remove('active');
    if (iconOn) iconOn.style.display = 'none';
    if (iconOff) iconOn.style.display = 'none'; // por si acaso
    if (iconOff) iconOff.style.display = 'block';
  }
  actualizarUIConPistaActual();
}

function actualizarUIConPistaActual() {
  const btn = document.getElementById('music-toggle');
  if (!btn) return;

  if (musicPlaying && currentTrack) {
    btn.title = `🔊 Reproduciendo: ${currentTrack.nombre} (${currentTrack.genero} · ${currentTrack.bpm} BPM) — Clic para pausar`;
  } else {
    btn.title = `🎵 Música de fondo: Desactivada (Clic para activar) — Cambio aleatorio entre ${TRACKS.length} estilos`;
  }

  // Añadir texto visual cerca del botón (si existe el contenedor)
  const badge = document.getElementById('music-track-badge');
  if (badge) {
    if (musicPlaying && currentTrack) {
      badge.innerHTML = `<span class="mtb-dot"></span> ${currentTrack.nombre} · <i style="opacity:.7">${currentTrack.genero}</i>`;
      badge.style.display = 'inline-flex';
      // Marcar como cancion nueva un instante para animar
      badge.classList.add('is-new');
      setTimeout(() => badge.classList.remove('is-new'), 1400);
    } else {
      badge.style.display = 'none';
    }
  }
}

function wireMusicToggle() {
  const btn = document.getElementById('music-toggle');
  const btnNext = document.getElementById('music-next');
  if (!btn) return;

  // Asegurar que empieza apagada
  musicPlaying = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  localStorage.setItem('parksales_music', 'off');
  updateMusicUI(false);

  btn.addEventListener('click', toggleMusic);

  // Botón "siguiente pista" (shuffle manual)
  if (btnNext) {
    btnNext.addEventListener('click', siguientePista);
  }
}
