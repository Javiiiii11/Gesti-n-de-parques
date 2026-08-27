/* ============================================================================
   cuadrante.js — calendario de turnos del equipo
   El Excel se parsea aquí; el resultado se guarda en BD para todo el mundo.
   No se mezcla con los horarios de parques (vista Horarios).
============================================================================ */

const CUAD_PASS = 'cuadrante2026';
const CUAD_ALIAS_KEY = 'parksales_cuadrante_alias';
const CUAD_ADMIN_KEY = 'parksales_cuadrante_admin';
const CUAD_FORCE_PICK_KEY = 'parksales_cuadrante_force_pick';

const CUAD_MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const CUAD_SHIFTS = {
  TM1: { work: true, kind: 'work', label: 'Mañana', hours: '9:00–17:00', start: '09:00', end: '17:00', hoursNum: 8 },
  TM2: { work: true, kind: 'work', label: 'Media mañana', hours: '10:00–18:00', start: '10:00', end: '18:00', hoursNum: 8 },
  TT1: { work: true, kind: 'work', label: 'Tarde', hours: '12:00–20:00', start: '12:00', end: '20:00', hoursNum: 8 },
  TFS: { work: true, kind: 'weekend-work', label: 'Finde', hours: '10:00–18:00', start: '10:00', end: '18:00', hoursNum: 8 },
  L: { work: false, kind: 'off', label: 'Libre', hours: '', start: null, end: null, hoursNum: 0 },
  V: { work: false, kind: 'vac', label: 'Vacaciones', hours: '', start: null, end: null, hoursNum: 0 },
  0: { work: false, kind: 'weekend-off', label: 'Finde libre', hours: '', start: null, end: null, hoursNum: 0 },
};

const CUAD_SKIP_NAME = /personas|sitios|total|libra|año|meses/i;

let cuadMonth = startOfMonth(new Date());
let cuadBundle = { users: {}, holidays: [], sources: [] };
let cuadList = [];
let cuadSelectedIso = null;
let cuadBound = false;
let cuadAdmin = false;
let cuadRemoteOk = true;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function ymKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function isoLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYm(mesKey) {
  const [y, m] = String(mesKey || '').split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMes(mesKeyOrDate) {
  const d = mesKeyOrDate instanceof Date ? mesKeyOrDate : parseYm(mesKeyOrDate);
  if (!d || isNaN(d)) return String(mesKeyOrDate || '');
  const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function weekdayMon0(date) {
  return (date.getDay() + 6) % 7;
}

function daysInMonth(a, b) {
  // Compatible con dashboard.js que llama daysInMonth(year, monthIndex)
  if (typeof a === 'number' && typeof b === 'number') {
    return new Date(a, b + 1, 0).getDate();
  }
  const date = a;
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isWeekendDate(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function shiftMeta(code, dateOrIso) {
  if (!code) return null;
  const base = CUAD_SHIFTS[code] || {
    work: true,
    kind: 'work',
    label: code,
    hours: '',
    start: null,
    end: null,
    hoursNum: 8,
  };
  // Viernes: una hora menos (TM1 9-16, TM2 10-17, TT1 13-20)
  let d = null;
  if (dateOrIso) {
    if (dateOrIso instanceof Date) d = dateOrIso;
    else if (typeof dateOrIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateOrIso)) d = new Date(dateOrIso + 'T12:00:00');
  }
  if (d && d.getDay() === 5 && (code === 'TM1' || code === 'TM2' || code === 'TT1')) {
    if (code === 'TM1') return { ...base, hours: '9:00–16:00', start: '09:00', end: '16:00', hoursNum: 7 };
    if (code === 'TM2') return { ...base, hours: '10:00–17:00', start: '10:00', end: '17:00', hoursNum: 7 };
    if (code === 'TT1') return { ...base, hours: '13:00–20:00', start: '13:00', end: '20:00', hoursNum: 7 };
  }
  return base;
}

function shiftTitle(code, dateOrIso) {
  const meta = shiftMeta(code, dateOrIso);
  if (!meta) return 'Sin asignar';
  return meta.hours ? `${meta.label} · ${meta.hours}` : meta.label;
}

function normalizePerson(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function emailPrefix(user) {
  return String(user?.email || '').split('@')[0] || '';
}

function readAliases() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUAD_ALIAS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch (err) {
    return {};
  }
}

function saveAlias(email, origName) {
  if (!email) return;
  const aliases = readAliases();
  if (origName) aliases[email] = origName;
  else delete aliases[email];
  localStorage.setItem(CUAD_ALIAS_KEY, JSON.stringify(aliases));
}

function scoreName(query, origName) {
  const q = normalizePerson(String(query || '').replace(/[._-]+/g, ' '));
  const n = normalizePerson(origName);
  if (!q || !n) return 0;

  const qCompact = q.replace(/\s+/g, '');
  const nCompact = n.replace(/\s+/g, '');
  const qTokens = q.split(' ').filter((t) => t.length >= 2);
  const nTokens = n.split(' ').filter(Boolean);
  const first = nTokens[0] || '';
  const last = nTokens[nTokens.length - 1] || '';

  if (qCompact === nCompact) return 100;
  if (qCompact.length >= 4 && nCompact === qCompact) return 100;
  if (qCompact.length >= 5 && (nCompact.startsWith(qCompact) || qCompact.startsWith(nCompact))) return 92;
  if (qCompact.length >= 4 && nCompact.includes(qCompact)) return 86;

  if (qTokens.length >= 2 && qTokens.every((t) => nTokens.some((nt) => nt === t || nt.startsWith(t) || t.startsWith(nt)))) {
    return 84;
  }
  if (qTokens.length === 2 && first.startsWith(qTokens[0]) && last.startsWith(qTokens[1])) return 88;

  if (last.length >= 4 && (qCompact.includes(last) || last.startsWith(qCompact))) return 70;
  if (first.length >= 3 && (qCompact === first || first.startsWith(qCompact) || qCompact.startsWith(first))) return 55;

  return 0;
}

function uniqueFirstNameHits(users, firstName) {
  const want = normalizePerson(firstName);
  if (!want) return [];
  return Object.values(users).filter((u) => normalizePerson(u.orig).split(' ')[0] === want);
}

function findUserMatch(user, users) {
  const list = Object.values(users || {});
  if (!list.length) return null;

  const email = String(user?.email || '').toLowerCase();
  // Si el usuario pulsó "No soy yo", forzamos el picker sin auto-match
  if (email && sessionStorage.getItem(CUAD_FORCE_PICK_KEY) === email) return null;
  const aliases = readAliases();
  if (email && aliases[email]) {
    const wanted = normalizePerson(aliases[email]);
    const hit = list.find((u) => normalizePerson(u.orig) === wanted);
    if (hit) return hit;
  }

  const queries = [
    emailPrefix(user),
    typeof getUserDisplayName === 'function' ? getUserDisplayName(user) : '',
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.name,
  ].filter(Boolean);

  let best = null;
  let bestScore = 0;
  let ties = 0;
  for (const person of list) {
    let score = 0;
    for (const q of queries) score = Math.max(score, scoreName(q, person.orig));
    if (score > bestScore) {
      best = person;
      bestScore = score;
      ties = 1;
    } else if (score === bestScore && score > 0) {
      ties += 1;
    }
  }

  if (best && bestScore >= 70 && (ties === 1 || bestScore >= 84)) return best;

  const prefix = normalizePerson(emailPrefix(user).replace(/[._-]+/g, ' '));
  const prefixFirst = prefix.split(' ')[0];
  if (prefixFirst && prefixFirst.length >= 3) {
    const hits = uniqueFirstNameHits(users, prefixFirst);
    if (hits.length === 1) return hits[0];
  }

  if (best && bestScore >= 55 && ties === 1) return best;
  return null;
}

function excelCellToISO(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // XLSX con cellDates:true puede devolver la fecha en UTC o local según el archivo;
    // usamos el componente local si la fecha tiene hora local coherente, si no UTC.
    // Para evitar el desfase de 1 día visto en 11/08, normalizamos a mediodía.
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    // Si la fecha es inválida por timezone (ej 10/08 UTC 22:00 -> local 11/08), usamos UTC
    // Detectamos desfase comparando UTC vs local: si difieren, preferimos la que da día 1-31 coherente con el texto formateado
    // Fallback simple: si UTC y local difieren más de 12h, usa UTC
    const yUtc = value.getUTCFullYear();
    const mUtc = value.getUTCMonth() + 1;
    const dUtc = value.getUTCDate();
    // Si local es 11 y UTC es 10, la fecha Excel probablemente es 11 -> usa local (Spain +2)
    // Solo usa UTC si local está a medianoche UTC (caso puro UTC)
    const isUtcMidnight = value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getHours() !== 0;
    if (isUtcMidnight) return `${yUtc}-${pad2(mUtc)}-${pad2(dUtc)}`;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + Math.round(value) * 86400000);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }
  let text = String(value || '').trim();
  // corrige typo del CSV "11/082026" -> "11/08/2026"
  const typo = text.match(/^(\d{1,2})\/(\d{2})(\d{4})$/);
  if (typo) text = `${typo[1]}/${typo[2]}/${typo[3]}`;
  // acepta también "10/08/2026 00:00" o con espacios
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${pad2(+dmy[2])}-${pad2(+dmy[1])}`;
  const ymd = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${pad2(+ymd[2])}-${pad2(+ymd[3])}`;
  return null;
}

function isStopHeader(value) {
  const s = String(value || '').toLowerCase();
  return s.includes('días') || s.includes('dias') || s.includes('total') || s.includes('fines');
}

function cleanShiftCode(value) {
  if (value === 0 || value === '0') return '0';
  if (value == null) return '';
  let code = String(value).trim();
  if (!code || code.startsWith('=') || code.includes('#REF') || code.includes('#N/A')) return '';
  if (/^libra/i.test(code)) return '';
  if (/^\d+$/.test(code) && code !== '0') return '';
  return code.toUpperCase();
}

function detectMesKeyFromName(filename, dates) {
  const fname = String(filename || '').toLowerCase();
  const monthIdx = CUAD_MONTH_NAMES.findIndex((n) => fname.includes(n) || fname.includes(n.replace('septiembre', 'setiembre')));
  const yearMatch = fname.match(/(20\d{2})/);
  if (monthIdx > -1) {
    const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
    return `${year}-${pad2(monthIdx + 1)}`;
  }
  if (!dates.length) return ymKey(new Date());
  const counts = {};
  for (const iso of dates) {
    const key = iso.slice(0, 7);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseHolidays(wb, year) {
  const sheetName = (wb.SheetNames || []).find((n) => /calendario/i.test(n));
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true, blankrows: false });
  const holidays = [];
  // Busca la fila de días 1..31 (cabecera del calendario anual)
  let dayByCol = {};
  let headerFound = false;
  for (const row of rows) {
    let count = 0;
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] === 'number' && row[c] >= 1 && row[c] <= 31) count++;
    }
    if (count >= 10) {
      dayByCol = {};
      for (let c = 0; c < row.length; c++) {
        if (typeof row[c] === 'number' && row[c] >= 1 && row[c] <= 31) dayByCol[c] = row[c];
      }
      headerFound = true;
      break;
    }
  }
  if (!headerFound) return [];
  for (const row of rows) {
    const monthLabel = normalizePerson(row[0]);
    const monthIdx = CUAD_MONTH_NAMES.findIndex((n) => monthLabel.startsWith(n));
    if (monthIdx < 0) continue;
    for (let c = 1; c < row.length; c++) {
      const v = String(row[c] || '').trim().toUpperCase();
      if (v !== 'F') continue;
      const day = dayByCol[c];
      if (!day || day < 1 || day > 31) continue;
      holidays.push(`${year}-${pad2(monthIdx + 1)}-${pad2(day)}`);
    }
  }
  return holidays;
}

function parseCuadranteCsv(text, filename) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = raw.includes(';') ? ';' : ',';
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '' || l.includes(delimiter));
  const rows = lines.map((line) => {
    // split respetando campos vacíos y comillas simples
    const cells = line.split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
    return cells;
  });
  if (!rows.length) throw new Error('El CSV está vacío.');
  let best = { dates: [], dateCols: [] };
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const header = rows[r] || [];
    const dates = [];
    const dateCols = [];
    for (let c = 1; c < header.length; c++) {
      if (isStopHeader(header[c])) break;
      const iso = excelCellToISO(header[c]);
      if (!iso) continue;
      if (dates.includes(iso)) continue;
      dates.push(iso);
      dateCols.push(c);
    }
    if (dates.length > best.dates.length) best = { dates, dateCols, headerRow: r };
  }
  let dates = best.dates;
  let dateCols = best.dateCols;
  let headerRow = best.headerRow || 0;
  if (!dates.length) throw new Error('No he encontrado fechas en la cabecera del CSV (fila 1 con fechas dd/mm/aaaa).');
  const users = {};
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[0] || '').replace(/\s+/g, ' ').trim();
    if (!name || /^\d+$/.test(name) || CUAD_SKIP_NAME.test(name) || name === '2026') continue;
    // ignora filas totalmente vacías de separador
    if (row.slice(1).every((v) => !String(v || '').trim())) continue;
    const days = {};
    for (let i = 0; i < dateCols.length; i++) {
      const rawCode = row[dateCols[i]] ?? '';
      const code = cleanShiftCode(rawCode);
      if (code) days[dates[i]] = code;
    }
    if (!Object.keys(days).length) continue;
    users[normalizePerson(name)] = { orig: name, days };
  }
  const people = Object.keys(users).length;
  if (!people) throw new Error('No he encontrado nombres de personas en el CSV.');
  const mesKey = detectMesKeyFromName(filename, dates);
  return {
    mesKey,
    filename: filename || '',
    data: {
      users,
      holidays: [],
      range: { from: dates[0], to: dates[dates.length - 1] },
    },
  };
}

function parseCuadranteWorkbook(buf, filename) {
  if (typeof XLSX === 'undefined') throw new Error('No se ha cargado la librería de Excel. Recarga la página.');
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellFormula: false });
  if (!wb.SheetNames?.length) throw new Error('El Excel no tiene hojas.');

  const preferred = wb.SheetNames.find((n) =>
    CUAD_MONTH_NAMES.some((m) => n.toLowerCase().includes(m))
  );
  const sheetName = preferred || wb.SheetNames.find((n) => !/calendario/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true, blankrows: false });
  if (!rows.length) throw new Error('La hoja del cuadrante está vacía.');

  // Busca la fila de cabecera con más fechas (el Excel tiene fila "Año/2026" encima)
  const sheet = wb.Sheets[sheetName];
  let best = { dates: [], dateCols: [] };
  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const header = rows[r] || [];
    const dates = [];
    const dateCols = [];
    for (let c = 1; c < header.length; c++) {
      if (isStopHeader(header[c])) break;
      let iso = excelCellToISO(header[c]);
      // Fallback: lee el texto formateado de la celda (por si es fecha numérica sin parsear)
      if (!iso && sheet) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell) {
          iso = excelCellToISO(cell.w) || excelCellToISO(cell.v);
        }
      }
      if (!iso) {
        // columna vacía/separador: no rompas, sigue escaneando (evita desfase si hay huecos)
        continue;
      }
      // evita fechas duplicadas por huecos
      if (dates.includes(iso)) continue;
      dates.push(iso);
      dateCols.push(c);
    }
    if (dates.length > best.dates.length) best = { dates, dateCols, headerRow: r };
  }
  let dates = best.dates;
  let dateCols = best.dateCols;
  let headerRow = best.headerRow || 0;
  if (!dates.length) throw new Error('No he encontrado fechas en la primera fila del Excel.');
  // Si faltan días consecutivos (ej. salta del 10 al 12), reconstruye por continuidad de columnas
  // Detecta hueco de 1 día y avisa: si hay salto >1 día, intenta rellenar con interpolación secuencial
  if (dates.length > 2) {
    const sorted = [...dates].sort();
    const start = new Date(sorted[0] + 'T12:00:00');
    const end = new Date(sorted[sorted.length - 1] + 'T12:00:00');
    const expectedDays = Math.round((end - start) / 86400000) + 1;
    if (expectedDays !== dates.length && expectedDays < 35) {
      // Hay columnas vacías que eran fechas no parseadas: reconstruye por orden de columnas
      // Usa la secuencia esperada y mapea columnas consecutivas
      const rebuilt = [];
      for (let i = 0; i < expectedDays; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        rebuilt.push(isoLocal(d));
      }
      // Si la cantidad de columnas con datos coincide con expectedDays, reasigna
      if (rebuilt.length === dateCols.length || rebuilt.length === dates.length + 1) {
        // Si falta un día (como el 11), lo más probable es que una columna no se parseó: reusa rebuilt si tiene mismo largo que dateCols
        if (rebuilt.length === dateCols.length) {
          dates = rebuilt;
        }
      }
    }
  }

  const users = {};
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[0] || '').replace(/\s+/g, ' ').trim();
    if (!name || /^\d+$/.test(name) || CUAD_SKIP_NAME.test(name)) continue;
    const days = {};
    for (let i = 0; i < dateCols.length; i++) {
      const code = cleanShiftCode(row[dateCols[i]]);
      if (code) days[dates[i]] = code;
    }
    if (!Object.keys(days).length) continue;
    users[normalizePerson(name)] = { orig: name, days };
  }

  const people = Object.keys(users).length;
  if (!people) throw new Error('No he encontrado nombres de personas en el Excel.');

  const year = Number(dates[0].slice(0, 4));
  const holidays = parseHolidays(wb, year);
  const mesKey = detectMesKeyFromName(filename, dates);

  return {
    mesKey,
    filename: filename || '',
    data: {
      users,
      holidays,
      range: { from: dates[0], to: dates[dates.length - 1] },
    },
  };
}

function mergeCuadrantes(parts) {
  const users = {};
  const holidays = new Set();
  const sources = [];
  let rangeMin = null;
  let rangeMax = null;
  for (const part of parts) {
    if (!part?.users) continue;
    sources.push(part);
    (part.holidays || []).forEach((h) => holidays.add(h));
    if (part.range?.from && (!rangeMin || part.range.from < rangeMin)) rangeMin = part.range.from;
    if (part.range?.to && (!rangeMax || part.range.to > rangeMax)) rangeMax = part.range.to;
    // fallback: deduce from days keys if range missing (old data)
    for (const person of Object.values(part.users)) {
      for (const iso of Object.keys(person.days || {})) {
        if (!rangeMin || iso < rangeMin) rangeMin = iso;
        if (!rangeMax || iso > rangeMax) rangeMax = iso;
      }
    }
    for (const [key, person] of Object.entries(part.users)) {
      if (!users[key]) users[key] = { orig: person.orig, days: { ...person.days } };
      else Object.assign(users[key].days, person.days);
    }
  }
  return { users, holidays: [...holidays], sources, range: rangeMin && rangeMax ? { from: rangeMin, to: rangeMax } : null };
}

function bundleDateRange() {
  return cuadBundle?.range || null;
}

function userDays(person) {
  return person?.days || {};
}

function codeOn(person, iso) {
  return userDays(person)[iso] || '';
}

function monthStats(person, monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const total = daysInMonth(monthDate);
  let work = 0;
  let free = 0;
  let vac = 0;
  let weekendWork = 0;
  let hours = 0;
  const byCode = {};
  const range = bundleDateRange();
  for (let d = 1; d <= total; d++) {
    const date = new Date(y, m, d);
    const iso = isoLocal(date);
    let code = codeOn(person, iso);
    // Mismo criterio que el calendario: finde vacío dentro del CSV = Libre
    if (!code && isWeekendDate(date) && range && iso >= range.from && iso <= range.to) code = '0';
    if (!code) continue;
    const meta = shiftMeta(code, date);
    byCode[code] = (byCode[code] || 0) + 1;
    if (meta.work) {
      work += 1;
      hours += meta.hoursNum || 0;
      if (code === 'TFS' || isWeekendDate(date)) weekendWork += 1;
    } else if (code === 'V') vac += 1;
    else free += 1;
  }
  const weekendFines = Math.floor(weekendWork / 2);
  const weekendHalf = weekendWork % 2;
  return { work, free, vac, weekendWork, weekendFines, weekendHalf, hours, byCode, total };
}

// --- Intercambio de finde (máx 10 días seguidos) ---
const CUAD_MAX_CONSECUTIVE = 10;
function getWeekendIsos(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay(); // 0 dom, 6 sab
  let sat, sun;
  if (day === 6) { // sábado
    sat = iso;
    const sunDate = new Date(d); sunDate.setDate(d.getDate() + 1);
    sun = isoLocal(sunDate);
  } else if (day === 0) { // domingo
    sun = iso;
    const satDate = new Date(d); satDate.setDate(d.getDate() - 1);
    sat = isoLocal(satDate);
  } else {
    return null;
  }
  return [sat, sun];
}
function getCompensatoryIsos(weekend) {
  // Las libranzas por trabajar finde suelen ser L el lunes+martes posterior o jueves+viernes anterior
  // Detectamos cuál es el bloque real para ese finde mirando a la mayoría de los que trabajaron
  const [sat] = weekend;
  const satDate = new Date(sat + 'T12:00:00');
  const thuIso = isoLocal(new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate() - 2));
  const friIso = isoLocal(new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate() - 1));
  const monIso = isoLocal(new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate() + 2));
  const tueIso = isoLocal(new Date(satDate.getFullYear(), satDate.getMonth(), satDate.getDate() + 3));
  const range = bundleDateRange();
  // Solo consideramos isos dentro del rango del CSV
  const inRange = (iso) => !range || (iso >= range.from && iso <= range.to);
  let countBefore = 0, countAfter = 0, totalWorkers = 0;
  for (const p of allPeople()) {
    if (!isWorkIso(p, weekend[0]) && !isWorkIso(p, weekend[1])) continue;
    totalWorkers++;
    const beforeL = [thuIso, friIso].filter(iso => inRange(iso) && codeOn(p, iso) === 'L').length;
    const afterL = [monIso, tueIso].filter(iso => inRange(iso) && codeOn(p, iso) === 'L').length;
    if (afterL > 0) countAfter++;
    if (beforeL > 0) countBefore++;
  }
  if (totalWorkers === 0) return [];
  // El bloque con más L entre los que trabajaron es el compensatorio oficial
  if (countAfter > countBefore) return [monIso, tueIso].filter(inRange);
  if (countBefore > countAfter) return [thuIso, friIso].filter(inRange);
  // Empate: por defecto lunes+martes (más común)
  // Si ninguno tiene L, devolvemos el bloque que esté dentro del rango para poder intercambiarlo igualmente
  if (countAfter === 0 && countBefore === 0) {
    // Si el finde está al inicio del rango, el bloque anterior queda fuera -> usa el posterior
    const afterInRange = [monIso, tueIso].filter(inRange);
    const beforeInRange = [thuIso, friIso].filter(inRange);
    if (afterInRange.length) return afterInRange;
    return beforeInRange;
  }
  return [monIso, tueIso].filter(inRange);
}
function isWorkIso(person, iso) {
  const code = codeOn(person, iso);
  // finde vacío dentro del rango se considera Libre (0) -> no trabajo
  const range = bundleDateRange();
  let effCode = code;
  if (!effCode && isWeekendDate(new Date(iso + 'T12:00:00')) && range && iso >= range.from && iso <= range.to) effCode = '0';
  if (!effCode) return false;
  const meta = shiftMeta(effCode, iso);
  return !!meta?.work;
}
function longestStreakWithOverrides(person, overrides) {
  const range = bundleDateRange();
  if (!range) return 0;
  let cur = 0, max = 0;
  let start = new Date(range.from + 'T12:00:00');
  let end = new Date(range.to + 'T12:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoLocal(d);
    let code = overrides && iso in overrides ? overrides[iso] : codeOn(person, iso);
    if (!code && isWeekendDate(d) && iso >= range.from && iso <= range.to) code = '0';
    const meta = code ? shiftMeta(code, iso) : null;
    const isWork = !!meta?.work;
    if (isWork) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}
function findSwapCandidates(selectedIso) {
  const me = currentPerson();
  if (!me) return [];
  const weekend = getWeekendIsos(selectedIso);
  if (!weekend) return [];
  const [sat, sun] = weekend;
  const candidates = [];
  // Encargados con los que no se puede cambiar
  const CUAD_SWAP_BLOCKED = [/olga/, /encarn/, /ricardo/, /adrian.*garrido/];
  for (const other of allPeople()) {
    if (normalizePerson(other.orig) === normalizePerson(me.orig)) continue;
    if (CUAD_SWAP_BLOCKED.some(rx => rx.test(normalizePerson(other.orig)))) continue;
    // Solo fines donde uno trabaja y el otro libra (intercambio con sentido)
    const mySatWork = isWorkIso(me, sat);
    const mySunWork = isWorkIso(me, sun);
    const otherSatWork = isWorkIso(other, sat);
    const otherSunWork = isWorkIso(other, sun);
    const myWorksWeekend = mySatWork || mySunWork;
    const otherWorksWeekend = otherSatWork || otherSunWork;
    if (myWorksWeekend === otherWorksWeekend) continue; // ambos igual, no hay intercambio útil

    const compIsos = getCompensatoryIsos(weekend);
    const myOverrides = {};
    const otherOverrides = {};
    // intercambio del finde (sábado+domingo)
    const mySatCode = codeOn(me, sat) || (mySatWork ? 'TFS' : '0');
    const mySunCode = codeOn(me, sun) || (mySunWork ? 'TFS' : '0');
    const otherSatCode = codeOn(other, sat) || (otherSatWork ? 'TFS' : '0');
    const otherSunCode = codeOn(other, sun) || (otherSunWork ? 'TFS' : '0');
    myOverrides[sat] = otherSatCode;
    myOverrides[sun] = otherSunCode;
    otherOverrides[sat] = mySatCode;
    otherOverrides[sun] = mySunCode;
    // + libranzas compensatorias (L) asociadas a ese finde — se mueven con el finde
    for (const iso of compIsos) {
      myOverrides[iso] = codeOn(other, iso) || '';
      otherOverrides[iso] = codeOn(me, iso) || '';
    }

    const myStreak = longestStreakWithOverrides(me, myOverrides);
    const otherStreak = longestStreakWithOverrides(other, otherOverrides);
    const ok = myStreak < CUAD_MAX_CONSECUTIVE && otherStreak < CUAD_MAX_CONSECUTIVE;
    candidates.push({
      person: other,
      myWorksWeekend, otherWorksWeekend,
      myStreak, otherStreak, ok,
      weekend,
      compIsos
    });
  }
  candidates.sort((a,b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1));
  return candidates;
}

function nextShift(person, fromDate) {
  if (!person) return null;
  const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let i = 0; i < 60; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = isoLocal(date);
    const code = codeOn(person, iso);
    const meta = shiftMeta(code, date);
    if (meta?.work) return { date, iso, code, meta };
  }
  return null;
}

function upcomingWorkDays(person, monthDate, limit = 12) {
  if (!person) return [];
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const today = isoLocal(new Date());
  const out = [];
  for (let d = 1; d <= daysInMonth(monthDate); d++) {
    const date = new Date(y, m, d);
    const iso = isoLocal(date);
    const code = codeOn(person, iso);
    const meta = shiftMeta(code, date);
    if (!meta?.work) continue;
    out.push({ date, iso, code, meta, past: iso < today });
  }
  const upcoming = out.filter((x) => !x.past);
  return (upcoming.length ? upcoming : out).slice(0, limit);
}

async function cuadCheckPass(input) {
  return String(input || '') === CUAD_PASS;
}

function isAdminUnlocked() {
  return sessionStorage.getItem(CUAD_ADMIN_KEY) === '1';
}

function setAdminUnlocked(on) {
  cuadAdmin = Boolean(on);
  if (on) sessionStorage.setItem(CUAD_ADMIN_KEY, '1');
  else sessionStorage.removeItem(CUAD_ADMIN_KEY);
}

function currentPerson() {
  return findUserMatch(STATE.currentUser, cuadBundle.users);
}

function allPeople() {
  return Object.values(cuadBundle.users || {}).sort((a, b) =>
    a.orig.localeCompare(b.orig, 'es', { sensitivity: 'base' })
  );
}

function relativeDayLabel(date) {
  const today = new Date();
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function weekdayLong(date) {
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ---------------------------------- render --------------------------------- */

function renderCuad() {
  const mesLabel = document.getElementById('cuad-mes-label');
  if (mesLabel) mesLabel.textContent = formatMes(cuadMonth);
  const midLabel = document.getElementById('cuad-mid-mes-label');
  if (midLabel) midLabel.textContent = formatMes(cuadMonth);

  const person = currentPerson();
  const hasData = Object.keys(cuadBundle.users || {}).length > 0;
  renderHero(person, hasData);
  renderStats(person, hasData);
  renderWeekStrip(person);
  renderLegend(person);
  renderCalendar(person, hasData);
  renderAgenda(person);
  renderAdmin();
}

function renderHero(person, hasData) {
  const el = document.getElementById('cuad-hero');
  if (!el) return;

  const email = STATE.currentUser?.email || '';
  const prefix = emailPrefix(STATE.currentUser);
  const people = allPeople();

  if (!hasData) {
    el.innerHTML = `
      <div class="cuad-hero-main">
        <p class="cuad-kicker">Sin cuadrante este mes</p>
        <h3>Todavía no hay turnos de ${escapeHtml(formatMes(cuadMonth))}</h3>
        <p class="desc">Cuando suban el Excel (hacia el día 15 del mes anterior) aparecerá aquí tu calendario, con cada horario en un color.</p>
      </div>
      <div class="cuad-hero-side">
        <button class="btn btn-secondary" type="button" id="cuad-hero-admin">Subir cuadrante</button>
      </div>`;
    document.getElementById('cuad-hero-admin')?.addEventListener('click', () => {
      document.getElementById('cuad-admin-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      openUploadModal();
    });
    return;
  }

  if (!person) {
    const options = people.map((p) =>
      `<option value="${escapeHtml(p.orig)}">${escapeHtml(p.orig)}</option>`
    ).join('');
    const isForced = sessionStorage.getItem(CUAD_FORCE_PICK_KEY) === email.toLowerCase();
    el.innerHTML = `
      <div class="cuad-hero-main">
        <p class="cuad-kicker">${isForced ? 'Cambiar persona' : 'No te he encontrado automáticamente'}</p>
        <h3>${isForced ? 'Elige tu nombre correcto' : 'Busca tu nombre en el cuadrante'}</h3>
        <p class="desc">He mirado <strong>${escapeHtml(prefix || email || 'tu usuario')}</strong> (lo que va delante de la @), sin distinguir mayúsculas. Elige tu nombre si no coincide.</p>
        <div class="cuad-name-pick">
          <input type="search" id="cuad-name-filter" placeholder="Escribe tu nombre…" autocomplete="off">
          <select id="cuad-name-select" size="6">${options}</select>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" type="button" id="cuad-name-apply">Usar este nombre</button>
            ${isForced ? `<button class="btn btn-ghost" type="button" id="cuad-name-reset">Volver a detección automática</button>` : ''}
          </div>
        </div>
      </div>`;
    const filter = document.getElementById('cuad-name-filter');
    const select = document.getElementById('cuad-name-select');
    filter?.addEventListener('input', () => {
      const q = normalizePerson(filter.value);
      const filtered = people.filter((p) => normalizePerson(p.orig).includes(q));
      select.innerHTML = filtered.map((p) =>
        `<option value="${escapeHtml(p.orig)}">${escapeHtml(p.orig)}</option>`
      ).join('');
    });
    document.getElementById('cuad-name-apply')?.addEventListener('click', () => {
      const name = select?.value;
      if (!name) {
        toast('Elige tu nombre de la lista', 'error');
        return;
      }
      saveAlias(email.toLowerCase(), name);
      sessionStorage.removeItem(CUAD_FORCE_PICK_KEY);
      toast('Cuadrante vinculado a ' + name, 'success');
      renderCuad();
    });
    document.getElementById('cuad-name-reset')?.addEventListener('click', () => {
      saveAlias(email.toLowerCase(), '');
      sessionStorage.removeItem(CUAD_FORCE_PICK_KEY);
      toast('Detección automática restablecida', 'info');
      renderCuad();
    });
    // auto-focus filtro y seleccionar primer resultado
    setTimeout(() => filter?.focus(), 30);
    return;
  }

  const todayIso = isoLocal(new Date());
  const todayCode = codeOn(person, todayIso);
  const todayMeta = shiftMeta(todayCode, todayIso);
  const nxt = nextShift(person, new Date());
  const inThisMonth = ymKey(new Date()) === ymKey(cuadMonth);
  let nextHtml = 'No hay más turnos de trabajo en los próximos días.';
  if (inThisMonth && todayMeta?.work) {
    nextHtml = `Hoy trabajas · <strong>${escapeHtml(todayMeta.label)}</strong>${todayMeta.hours ? ' · ' + escapeHtml(todayMeta.hours) : ''}`;
  } else if (inThisMonth && todayCode && !todayMeta?.work) {
    nextHtml = `Hoy ${escapeHtml(todayMeta.label).toLowerCase()}` + (nxt
      ? ` · siguiente turno ${escapeHtml(relativeDayLabel(nxt.date))} · ${escapeHtml(nxt.meta.label)}${nxt.meta.hours ? ' ' + escapeHtml(nxt.meta.hours) : ''}`
      : '');
  } else if (nxt) {
    nextHtml = `Próximo turno: <strong>${escapeHtml(relativeDayLabel(nxt.date))}</strong> · ${escapeHtml(nxt.meta.label)}${nxt.meta.hours ? ' · ' + escapeHtml(nxt.meta.hours) : ''}`;
  }

  el.innerHTML = `
    <div class="cuad-hero-main">
      <p class="cuad-kicker">Tu cuadrante</p>
      <h3>${escapeHtml(person.orig)}</h3>
      <p class="cuad-next">${nextHtml}</p>
      <p class="cuad-match">Detectado desde <span>${escapeHtml(prefix || email)}</span>
        <button type="button" class="cuad-link" id="cuad-change-name">No soy yo</button>
      </p>
    </div>
    <div class="cuad-hero-side">
      <button class="btn btn-secondary" type="button" id="cuad-ics-btn" ${person ? '' : 'disabled'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        Exportar a calendario
      </button>
    </div>`;
  document.getElementById('cuad-change-name')?.addEventListener('click', () => {
    saveAlias(email.toLowerCase(), '');
    sessionStorage.setItem(CUAD_FORCE_PICK_KEY, email.toLowerCase());
    toast('Ahora elige tu nombre correcto en el buscador', 'info');
    renderCuad();
    // lleva el foco al buscador
    setTimeout(() => document.getElementById('cuad-name-filter')?.focus(), 100);
  });
  document.getElementById('cuad-ics-btn')?.addEventListener('click', () => exportCuadIcs(person));
}

function renderStats(person, hasData) {
  const el = document.getElementById('cuad-stats');
  if (!el) return;
  if (!hasData || !person) {
    el.innerHTML = '';
    return;
  }
  const s = monthStats(person, cuadMonth);
  el.innerHTML = `
    <article class="stat-card cuad-stat">
      <div class="stat-label">Trabajo</div>
      <div class="stat-value">${s.work}</div>
      <div class="stat-sub">${s.hours} h estimadas</div>
    </article>
    <article class="stat-card cuad-stat">
      <div class="stat-label">Libres</div>
      <div class="stat-value">${s.free}</div>
      <div class="stat-sub">${s.vac ? s.vac + ' de vacaciones' : 'días de descanso'}</div>
    </article>
    <article class="stat-card cuad-stat">
      <div class="stat-label">Fines que trabajas</div>
      <div class="stat-value">${s.weekendHalf ? `${s.weekendFines},5` : s.weekendFines}<span style="font-size:13px;font-weight:600;color:var(--text-muted);margin-left:4px;">${s.weekendFines === 1 && !s.weekendHalf ? 'finde' : 'findes'}</span></div>
      <div class="stat-sub">${s.weekendWork ? `${s.weekendWork} días · ${s.weekendHalf ? 'incluye finde y medio' : s.weekendFines ? 'sábado+domingo juntos' : ''}` : 'ningún finde'}${s.weekendWork ? '' : ''}</div>
    </article>
    <article class="stat-card cuad-stat">
      <div class="stat-label">Vacaciones</div>
      <div class="stat-value">${s.vac}</div>
      <div class="stat-sub">${s.byCode.TM1 ? s.byCode.TM1 + ' TM1' : '—'}${s.byCode.TM2 ? ' · ' + s.byCode.TM2 + ' TM2' : ''}${s.byCode.TT1 ? ' · ' + s.byCode.TT1 + ' TT1' : ''}</div>
    </article>`;
}

function renderWeekStrip(person) {
  const el = document.getElementById('cuad-week');
  if (!el) return;
  if (!person) {
    el.innerHTML = '';
    return;
  }
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - weekdayMon0(today));
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const iso = isoLocal(date);
    let code = codeOn(person, iso);
    const range = bundleDateRange();
    if (!code && isWeekendDate(date) && person && range && iso >= range.from && iso <= range.to) code = '0';
    const meta = shiftMeta(code, date);
    const isToday = iso === isoLocal(today);
    cells.push(`
      <button type="button" class="cuad-week-day${isToday ? ' is-today' : ''}${code ? ` code-${code}` : ''}" data-iso="${iso}" data-code="${escapeHtml(code)}">
        <span class="cuad-week-dow">${date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
        <span class="cuad-week-num">${date.getDate()}</span>
        <span class="cuad-week-code">${code ? escapeHtml(code === '0' ? 'Libre' : code) : '—'}</span>
        <span class="cuad-week-hours">${meta?.hours ? escapeHtml(meta.hours) : (meta ? escapeHtml(meta.label) : '')}</span>
      </button>`);
  }
  el.innerHTML = `<div class="cuad-week-head">Esta semana</div><div class="cuad-week-grid">${cells.join('')}</div>`;
  el.querySelectorAll('.cuad-week-day').forEach((btn) => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-iso');
      const [y, m] = iso.split('-').map(Number);
      cuadMonth = new Date(y, m - 1, 1);
      cuadSelectedIso = iso;
      loadMonth();
    });
  });
}

function renderLegend(person) {
  const el = document.getElementById('cuad-leyenda');
  if (!el) return;
  const present = new Set();
  if (person) Object.values(person.days || {}).forEach((c) => present.add(c));
  const codes = Object.keys(CUAD_SHIFTS);
  const shown = codes.filter((c) => present.has(c) || !person);
  const items = (shown.length ? shown : codes).map((code) => {
    const meta = CUAD_SHIFTS[code];
    return `<span class="cuad-chip code-${code}"><i></i>${escapeHtml(code === '0' ? '0' : code)} · ${escapeHtml(meta.label)}${meta.hours ? ' ' + escapeHtml(meta.hours) : ''}</span>`;
  });
  el.innerHTML = items.join('');
}

function renderCalendar(person, hasData) {
  const cal = document.getElementById('cuad-calendario');
  if (!cal) return;

  const y = cuadMonth.getFullYear();
  const m = cuadMonth.getMonth();
  const pad = weekdayMon0(new Date(y, m, 1));
  const total = daysInMonth(cuadMonth);
  const todayIso = isoLocal(new Date());
  const holidaySet = new Set(cuadBundle.holidays || []);

  const head = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    .map((d, i) => `<div class="cuad-dow${i >= 5 ? ' is-weekend' : ''}">${d}</div>`)
    .join('');

  const cells = [];
  for (let i = 0; i < pad; i++) cells.push('<div class="cuad-day is-empty"></div>');

  for (let d = 1; d <= total; d++) {
    const date = new Date(y, m, d);
    const iso = isoLocal(date);
    const code = person ? codeOn(person, iso) : '';
    const weekend = isWeekendDate(date);
    // Solo hasta el último día detectado del CSV: si el finde está dentro del rango subido y no tiene código, es finde libre
    const range = bundleDateRange();
    const inUploadedRange = range && iso >= range.from && iso <= range.to;
    const isWeekendOff = !code && weekend && person && inUploadedRange;
    const displayCode = isWeekendOff ? '0' : code;
    const meta = shiftMeta(displayCode, date);
    const holiday = holidaySet.has(iso);
    const classes = [
      'cuad-day',
      weekend ? 'is-weekend' : '',
      iso === todayIso ? 'is-today' : '',
      iso < todayIso ? 'is-past' : '',
      iso === cuadSelectedIso ? 'is-selected' : '',
      holiday ? 'is-holiday' : '',
      displayCode ? `code-${displayCode}` : 'is-unset',
    ].filter(Boolean).join(' ');

    const hours = meta?.hours ? `<span class="cuad-day-hours">${escapeHtml(meta.hours)}</span>` : '';
    const label = displayCode
      ? `<span class="cuad-day-code">${escapeHtml(displayCode === '0' ? 'Libre' : displayCode)}</span>`
      : '<span class="cuad-day-code is-muted">—</span>';
    const hol = holiday ? '<span class="cuad-day-hol">Festivo</span>' : '';

    cells.push(`
      <button type="button" class="${classes}" data-iso="${iso}" data-code="${escapeHtml(displayCode)}" title="${escapeHtml(weekdayLong(date) + ' · ' + shiftTitle(displayCode, date))}">
        <span class="cuad-day-top">
          <span class="cuad-day-num">${d}</span>
          ${iso === todayIso ? '<span class="cuad-day-today">Hoy</span>' : ''}
        </span>
        ${label}
        ${hours}
        ${hol}
      </button>`);
  }

  if (!hasData) {
    cal.innerHTML = `${head}${cells.join('')}
      <div class="cuad-cal-empty">No hay un Excel cargado para ${escapeHtml(formatMes(cuadMonth))}.</div>`;
    return;
  }

  cal.innerHTML = head + cells.join('');
  cal.querySelectorAll('.cuad-day[data-iso]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cuadSelectedIso = btn.getAttribute('data-iso');
      renderCuad();
      document.getElementById('cuad-day-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function renderAgenda(person) {
  const el = document.getElementById('cuad-agenda');
  const detail = document.getElementById('cuad-day-detail');
  if (!el) return;

  if (!person) {
    el.innerHTML = '<p class="desc">Cuando te identifiquemos, aquí verás los próximos días que trabajas.</p>';
    if (detail) detail.innerHTML = '';
    return;
  }

  if (detail) {
    const iso = cuadSelectedIso || isoLocal(new Date());
    const [ys, ms, ds] = iso.split('-').map(Number);
    const date = new Date(ys, ms - 1, ds);
    let code = codeOn(person, iso);
    const range = bundleDateRange();
    if (!code && isWeekendDate(date) && person && range && iso >= range.from && iso <= range.to) code = '0';
    const holiday = (cuadBundle.holidays || []).includes(iso);
    const isWeekend = isWeekendDate(date);
    const swapBtn = isWeekend && person ? `<button class="btn btn-secondary btn-sm" type="button" id="cuad-swap-btn" style="margin-top:10px;width:100%;justify-content:center;gap:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Buscar intercambio para este finde</button><p class="desc" style="font-size:11px;margin-top:6px;opacity:.7">Máx. 10 días seguidos — se comprueba para los dos</p>` : '';
    detail.innerHTML = `
      <div class="cuad-detail ${code ? `code-${code}` : ''}">
        <p class="cuad-kicker">${escapeHtml(relativeDayLabel(date))}</p>
        <h4>${escapeHtml(weekdayLong(date))}</h4>
        <p class="cuad-detail-shift">${escapeHtml(shiftTitle(code, date))}${holiday ? ' · festivo' : ''}</p>
      </div>
      ${swapBtn}`;
    document.getElementById('cuad-swap-btn')?.addEventListener('click', () => openSwapModal(iso));
  }

  const items = upcomingWorkDays(person, cuadMonth, 14);
  if (!items.length) {
    el.innerHTML = '<p class="desc">No hay turnos de trabajo en este mes.</p>';
    return;
  }
  el.innerHTML = items.map((item) => `
    <button type="button" class="cuad-agenda-item code-${item.code}${item.iso === cuadSelectedIso ? ' is-active' : ''}${item.past ? ' is-past' : ''}" data-iso="${item.iso}">
      <span class="cuad-agenda-date">
        <strong>${item.date.getDate()}</strong>
        <em>${item.date.toLocaleDateString('es-ES', { weekday: 'short' })}</em>
      </span>
      <span class="cuad-agenda-body">
        <strong>${escapeHtml(item.code)} · ${escapeHtml(item.meta.label)}</strong>
        <em>${item.meta.hours ? escapeHtml(item.meta.hours) : 'Turno de fin de semana'}</em>
      </span>
    </button>`).join('');

  el.querySelectorAll('.cuad-agenda-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      cuadSelectedIso = btn.getAttribute('data-iso');
      renderCuad();
    });
  });
}

function renderAdmin() {
  const listEl = document.getElementById('cuad-lista');
  const hint = document.getElementById('cuad-admin-hint');
  if (!listEl) return;

  // Ya no hay estado "desbloqueado" persistente: cada subida/borrado pide contraseña
  cuadAdmin = false;
  sessionStorage.removeItem(CUAD_ADMIN_KEY);
  if (hint) {
    hint.textContent = 'Solo quien tenga la contraseña puede subir o borrar un Excel. El resto del equipo solo lo consulta.';
  }

  if (!cuadList.length) {
    listEl.innerHTML = '<p class="desc" style="margin:0;">Aún no hay cuadrantes subidos.</p>';
    return;
  }

  const currentKey = ymKey(cuadMonth);
  listEl.innerHTML = cuadList.map((item) => {
    const active = item.mes === currentKey;
    const when = item.updated ? fmtDateTime(item.updated) : '';
    return `
      <div class="cuad-list-row${active ? ' is-active' : ''}">
        <div>
          <strong>${escapeHtml(formatMes(item.mes))}</strong>
          <span>${item.totalUsers || 0} personas${item.nombreArchivo ? ' · ' + escapeHtml(item.nombreArchivo) : ''}${when ? ' · ' + escapeHtml(when) : ''}</span>
        </div>
        <div class="cuad-list-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-cuad-open="${escapeHtml(item.mes)}">Ver</button>
          <button class="btn btn-danger btn-sm" type="button" data-cuad-del="${escapeHtml(item.mes)}">Borrar</button>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-cuad-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = parseYm(btn.getAttribute('data-cuad-open'));
      if (d) {
        cuadMonth = d;
        loadMonth();
      }
    });
  });
  listEl.querySelectorAll('[data-cuad-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCuadranteMes(btn.getAttribute('data-cuad-del')));
  });
}

function exportCuadIcs(person) {
  if (!person) return;
  const y = cuadMonth.getFullYear();
  const m = cuadMonth.getMonth();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ParkSales//Cuadrante//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (let d = 1; d <= daysInMonth(cuadMonth); d++) {
    const date = new Date(y, m, d);
    const iso = isoLocal(date);
    const code = codeOn(person, iso);
    const meta = shiftMeta(code, date);
    if (!meta?.work) continue;
    const stamp = iso.replace(/-/g, '');
    const uid = `cuad-${iso}-${code}@parksales`;
    const summary = meta.hours ? `Turno ${code} (${meta.hours})` : `Turno ${code} · ${meta.label}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    if (meta.start && meta.end) {
      const start = meta.start.replace(':', '');
      const end = meta.end.replace(':', '');
      lines.push(`DTSTART:${stamp}T${start}00`);
      lines.push(`DTEND:${stamp}T${end}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${stamp}`);
    }
    lines.push(`SUMMARY:${summary}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cuadrante-${ymKey(cuadMonth)}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Calendario exportado. Ábrelo en Google Calendar o Outlook.', 'success');
}

function openSwapModal(iso) {
  const me = currentPerson();
  if (!me) { toast('No te he identificado en el cuadrante', 'error'); return; }
  const weekend = getWeekendIsos(iso);
  if (!weekend) { toast('Selecciona un sábado o domingo', 'error'); return; }
  const [sat, sun] = weekend;
  const satDate = new Date(sat + 'T12:00:00');
  const sunDate = new Date(sun + 'T12:00:00');
  const weekendLabel = `${satDate.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'short'})} y ${sunDate.toLocaleDateString('es-ES',{weekday:'long', day:'numeric'})}`;
  const mySatWork = isWorkIso(me, sat);
  const mySunWork = isWorkIso(me, sun);
  const myLabel = mySatWork || mySunWork ? 'Trabajas' : 'Libras';
  const candidates = findSwapCandidates(iso);
  const compatibles = candidates.filter(c => c.ok);
  const noCompatibles = candidates.filter(c => !c.ok);

  const rowHtml = (c) => {
    const otherSatWork = isWorkIso(c.person, sat);
    const otherSunWork = isWorkIso(c.person, sun);
    const otherLabel = otherSatWork || otherSunWork ? 'Trabaja' : 'Libra';
    const status = c.ok
      ? `<span class="cuad-swap-badge ok">✓ Compatible</span><span class="cuad-swap-streak">Tú ${c.myStreak} días máx · ${escapeHtml(c.person.orig)} ${c.otherStreak} días</span>`
      : `<span class="cuad-swap-badge no">✗ ${c.myStreak >= 10 ? `Tú harías ${c.myStreak} días seguidos` : `${escapeHtml(c.person.orig)} haría ${c.otherStreak} días`}</span><span class="cuad-swap-streak">Límite 10</span>`;
    return `
      <div class="cuad-swap-row ${c.ok ? 'is-ok' : 'is-no'}">
        <div class="cuad-swap-person">
          <strong>${escapeHtml(c.person.orig)}</strong>
          <span>${otherLabel} ese finde · ${myLabel} tú</span>
        </div>
        <div class="cuad-swap-status">${status}</div>
      </div>`;
  };

  const compIsos = getCompensatoryIsos(weekend);
  const compLabel = compIsos.length ? compIsos.map(iso => new Date(iso+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short', day:'numeric'})).join(' y ') : '—';
  const html = `
    <p class="desc" style="margin-bottom:10px;">Fin de semana del <strong>${escapeHtml(weekendLabel)}</strong> — tú <strong>${escapeHtml(myLabel)}</strong>. Si cambiáis, se mueven también las <strong>libranzas (L) del ${escapeHtml(compLabel)}</strong> asociadas a ese finde. Solo muestro compis donde el finde es opuesto y <strong>ninguno supera 10 días seguidos</strong> en todo el rango del CSV, no solo en el mismo mes.</p>
    <div class="cuad-swap-summary">
      <span class="cuad-chip">Tú: ${escapeHtml(myLabel)}</span>
      <span class="cuad-chip">Libranzas: ${escapeHtml(compLabel)}</span>
      <span class="cuad-chip">Rango: ${escapeHtml(bundleDateRange()?.from || '—')} → ${escapeHtml(bundleDateRange()?.to || '—')}</span>
    </div>
    ${compatibles.length ? `<h4 class="cuad-swap-title ok">✓ Con quién sí puedes cambiar (${compatibles.length})</h4><div class="cuad-swap-list">${compatibles.map(rowHtml).join('')}</div>` : '<p class="desc" style="margin:8px 0;color:var(--success)">No hay compatibles para ese finde.</p>'}
    ${noCompatibles.length ? `<h4 class="cuad-swap-title no">✗ No compatibles (${noCompatibles.length})</h4><div class="cuad-swap-list is-muted">${noCompatibles.map(rowHtml).join('')}</div>` : ''}
    <p class="desc" style="margin-top:12px;font-size:11px;opacity:.7">Intercambio = <strong>sábado + domingo + libranzas</strong>. Avisad y que el responsable actualice el Excel/CSV.</p>
  `;

  openModal({
    title: `Intercambio de finde · ${satDate.toLocaleDateString('es-ES',{day:'numeric', month:'short'})}–${sunDate.getDate()}`,
    width: '560px',
    bodyHtml: html,
    footHtml: `<button class="btn btn-ghost" type="button" id="cuad-swap-close">Cerrar</button>`
  });
  document.getElementById('cuad-swap-close')?.addEventListener('click', closeModal);
}

/* ---------------------------------- data ----------------------------------- */

async function loadCuadranteList() {
  try {
    cuadList = await DB.getCuadranteList();
  } catch (err) {
    cuadList = [];
  }
}

function pickInitialMonth() {
  const nowKey = ymKey(new Date());
  const nextKey = ymKey(addMonths(new Date(), 1));
  if (cuadList.some((x) => x.mes === nowKey)) return parseYm(nowKey);
  if (cuadList.some((x) => x.mes === nextKey)) return parseYm(nextKey);
  if (cuadList[0]?.mes) return parseYm(cuadList[0].mes);
  return startOfMonth(new Date());
}

async function loadMonth() {
  const key = ymKey(cuadMonth);
  const prevKey = ymKey(addMonths(cuadMonth, -1));
  try {
    const [current, prev] = await Promise.all([
      DB.getCuadrante(key),
      DB.getCuadrante(prevKey),
    ]);
    cuadBundle = mergeCuadrantes([prev, current]);
    cuadRemoteOk = true;
  } catch (err) {
    cuadBundle = { users: {}, holidays: [], sources: [] };
  }
  if (!cuadSelectedIso || cuadSelectedIso.slice(0, 7) !== key) {
    const today = isoLocal(new Date());
    cuadSelectedIso = today.slice(0, 7) === key ? today : `${key}-01`;
  }
  renderCuad();
}

async function deleteCuadranteMes(mesKey) {
  openUnlockModal({
    title: 'Contraseña para borrar',
    description: `Introduce la contraseña para borrar el cuadrante de ${formatMes(mesKey)}.`,
    confirmLabel: 'Borrar',
    onSuccess: () => {
      confirmDialog({
        title: 'Borrar cuadrante',
        message: `Se eliminará el cuadrante de ${formatMes(mesKey)} para todo el equipo.`,
        confirmLabel: 'Borrar',
        danger: true,
        onConfirm: async () => {
          try {
            await DB.deleteCuadrante(mesKey);
            toast('Cuadrante eliminado', 'success');
            await loadCuadranteList();
            await loadMonth();
          } catch (err) {
            toast(err.message || 'No se pudo borrar', 'error');
          }
        },
      });
    },
  });
}

function openUnlockModal({ title: _title = 'Desbloquear subida', description: _desc = 'Introduce la contraseña para subir o borrar cuadrantes. El resto del equipo podrá verlos, pero no modificarlos.', confirmLabel: _confirmLabel = 'Desbloquear', onSuccess: _onSuccess = null } = {}) {
  const modalTitle = _title;
  const modalDesc = _desc;
  const modalConfirmLabel = _confirmLabel;
  const modalOnSuccess = _onSuccess;
  openModal({
    title: modalTitle,
    width: '420px',
    bodyHtml: `
      <p class="desc" style="margin-bottom:14px;">${escapeHtml(modalDesc)}</p>
      <div class="form-field" data-form-type="other">
        <label for="cuad-unlock-pass">Contraseña</label>
        <!-- anti-autofill decoys: Chrome ignora el siguiente input type=password si ve estos -->
        <input type="text" autocomplete="username" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
        <input type="password" autocomplete="new-password" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
        <input type="password" id="cuad-unlock-pass" name="cuad-unlock-pass-not-login" autocomplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" readonly onfocus="this.removeAttribute('readonly')" placeholder="Contraseña de subida">
      </div>
      <div id="cuad-unlock-status" class="cuad-modal-status"></div>
    `,
    footHtml: `
      <button class="btn btn-ghost" type="button" id="cuad-unlock-cancel">Cancelar</button>
      <button class="btn btn-primary" type="button" id="cuad-unlock-ok">${escapeHtml(modalConfirmLabel)}</button>
    `,
  });
  const input = document.getElementById('cuad-unlock-pass');
  const status = document.getElementById('cuad-unlock-status');
  const submit = async () => {
    if (!(await cuadCheckPass(input.value))) {
      status.textContent = 'Contraseña incorrecta';
      status.className = 'cuad-modal-status is-error';
      return;
    }
    closeModal();
    if (typeof modalOnSuccess === 'function') {
      modalOnSuccess();
    } else {
      openUploadModalActual();
    }
  };
  document.getElementById('cuad-unlock-cancel').addEventListener('click', closeModal);
  document.getElementById('cuad-unlock-ok').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();
}

function openUploadModal() {
  openUnlockModal({
    title: 'Subir cuadrante',
    description: 'Introduce la contraseña para subir el Excel. Se publicará para todo el equipo.',
    confirmLabel: 'Continuar',
    onSuccess: () => openUploadModalActual(),
  });
}

function openUploadModalActual() {
  openModal({
    title: 'Subir cuadrante',
    width: '520px',
    bodyHtml: `
      <p class="desc" style="margin-bottom:14px;">Arrastra el <strong>CSV</strong> (recomendado) o el Excel del mes. Acepta .csv y .xlsx ; el CSV es más fiable porque no depende de fechas de Excel.</p>
      <label class="file-drop cuad-drop" id="cuad-drop">
        <input type="file" id="cuad-modal-file" accept=".csv,.xlsx,.xls" hidden>
        <strong>Elige o suelta el .csv / .xlsx</strong>
        <span>Recomendado: CSV con ; y fechas dd/mm/aaaa</span>
        <em id="cuad-drop-name">Ningún archivo todavía</em>
      </label>
      <div class="form-field" style="margin-top:14px;">
        <label for="cuad-modal-mes">Mes que se va a guardar</label>
        <input type="month" id="cuad-modal-mes" value="${ymKey(cuadMonth)}">
      </div>
      <div id="cuad-modal-preview" class="cuad-preview"></div>
      <div id="cuad-modal-status" class="cuad-modal-status"></div>
    `,
    footHtml: `
      <button class="btn btn-ghost" type="button" id="cuad-modal-cancel">Cancelar</button>
      <button class="btn btn-primary" type="button" id="cuad-modal-submit">Subir y publicar</button>
    `,
  });

  const fileInput = document.getElementById('cuad-modal-file');
  const drop = document.getElementById('cuad-drop');
  const mesInput = document.getElementById('cuad-modal-mes');
  const preview = document.getElementById('cuad-modal-preview');
  const status = document.getElementById('cuad-modal-status');
  let parsed = null;

  const showPreview = (result, file) => {
    parsed = result;
    document.getElementById('cuad-drop-name').textContent = file.name;
    mesInput.value = result.mesKey;
    const n = Object.keys(result.data.users).length;
    const from = result.data.range?.from || '';
    const to = result.data.range?.to || '';
    preview.innerHTML = `<strong>${n} personas</strong> · ${escapeHtml(formatMes(result.mesKey))} · del ${escapeHtml(from)} al ${escapeHtml(to)}`;
    status.textContent = '';
  };

  const readFile = async (file) => {
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    status.textContent = isCsv ? 'Leyendo CSV…' : 'Leyendo Excel…';
    status.className = 'cuad-modal-status';
    try {
      let result;
      if (isCsv) {
        const buf = await file.arrayBuffer();
        let text;
        try {
          // Intenta UTF-8 estricto; si falla (Excel guarda en Windows-1252/ISO-8859-1) cae a windows-1252
          text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
          // Si UTF-8 decodifica pero mete �, también es señal de ANSI
          if (text.includes('�')) throw new Error('replacement');
        } catch (_) {
          try {
            text = new TextDecoder('windows-1252').decode(buf);
          } catch {
            text = new TextDecoder().decode(buf);
          }
        }
        result = parseCuadranteCsv(text, file.name);
      } else {
        const buf = await file.arrayBuffer();
        result = parseCuadranteWorkbook(buf, file.name);
      }
      showPreview(result, file);
    } catch (err) {
      parsed = null;
      preview.innerHTML = '';
      status.textContent = err.message || 'No se pudo leer el archivo';
      status.className = 'cuad-modal-status is-error';
    }
  };

  drop.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      readFile(file);
    }
  });
  fileInput.addEventListener('change', () => readFile(fileInput.files[0]));
  document.getElementById('cuad-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('cuad-modal-submit').addEventListener('click', async () => {
    if (!parsed) {
      status.textContent = 'Elige primero el Excel';
      status.className = 'cuad-modal-status is-error';
      return;
    }
    const mesKey = mesInput.value || parsed.mesKey;
    const snapshot = parsed;
    const exists = cuadList.some((x) => x.mes === mesKey);
    const doSave = async () => {
      const liveStatus = document.getElementById('cuad-modal-status');
      if (liveStatus) {
        liveStatus.textContent = 'Publicando…';
        liveStatus.className = 'cuad-modal-status';
      }
      try {
        const saved = await DB.saveCuadrante(mesKey, snapshot.data, { nombreArchivo: snapshot.filename });
        closeModal();
        if (saved?.missingTable) {
          toast('Guardado en este navegador. Ejecuta sql/cuadrantes.sql en Supabase para compartirlo con el equipo.', 'info', 7000);
          cuadRemoteOk = false;
        } else if (saved?.localOnly) {
          toast('Cuadrante guardado en este navegador', 'success');
        } else {
          toast('Cuadrante de ' + formatMes(mesKey) + ' publicado para todo el equipo', 'success');
        }
        cuadMonth = parseYm(mesKey) || cuadMonth;
        await loadCuadranteList();
        await loadMonth();
      } catch (err) {
        const errBox = document.getElementById('cuad-modal-status');
        if (errBox) {
          errBox.textContent = err.message || 'No se pudo guardar';
          errBox.className = 'cuad-modal-status is-error';
        } else {
          toast(err.message || 'No se pudo guardar', 'error');
        }
      }
    };
    if (exists) {
      confirmDialog({
        title: 'Sustituir cuadrante',
        message: `Ya hay un cuadrante de ${formatMes(mesKey)}. Se reemplazará para todo el equipo.`,
        confirmLabel: 'Sustituir',
        danger: false,
        onConfirm: doSave,
      });
      return;
    }
    await doSave();
  });
}

/* ---------------------------------- init ----------------------------------- */

function cuadBind() {
  if (cuadBound) return;
  cuadBound = true;
  document.getElementById('cuad-prev')?.addEventListener('click', () => {
    cuadMonth = addMonths(cuadMonth, -1);
    loadMonth();
  });
  document.getElementById('cuad-next')?.addEventListener('click', () => {
    cuadMonth = addMonths(cuadMonth, 1);
    loadMonth();
  });
  document.getElementById('cuad-mid-prev')?.addEventListener('click', () => {
    cuadMonth = addMonths(cuadMonth, -1);
    loadMonth();
  });
  document.getElementById('cuad-mid-next')?.addEventListener('click', () => {
    cuadMonth = addMonths(cuadMonth, 1);
    loadMonth();
  });
  document.getElementById('cuad-today')?.addEventListener('click', () => {
    cuadMonth = startOfMonth(new Date());
    cuadSelectedIso = isoLocal(new Date());
    loadMonth();
  });
  document.getElementById('cuad-mid-today')?.addEventListener('click', () => {
    cuadMonth = startOfMonth(new Date());
    cuadSelectedIso = isoLocal(new Date());
    loadMonth();
  });
  document.getElementById('cuad-btn-upload')?.addEventListener('click', openUploadModal);
  document.addEventListener('keydown', (e) => {
    const view = document.getElementById('view-cuadrante');
    if (!view?.classList.contains('active')) return;
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') {
      cuadMonth = addMonths(cuadMonth, -1);
      loadMonth();
    }
    if (e.key === 'ArrowRight') {
      cuadMonth = addMonths(cuadMonth, 1);
      loadMonth();
    }
  });
}

async function cuadOnView() {
  cuadBind();
  cuadAdmin = isAdminUnlocked();
  await loadCuadranteList();
  if (!Object.keys(cuadBundle.users || {}).length) {
    cuadMonth = pickInitialMonth() || startOfMonth(new Date());
  }
  await loadMonth();
}

document.addEventListener('DOMContentLoaded', cuadBind);

window.cuadOnView = cuadOnView;
window.loadCuadranteMes = (mesKey) => {
  const d = parseYm(mesKey);
  if (d) {
    cuadMonth = d;
    loadMonth();
  }
};
window.deleteCuadranteMes = deleteCuadranteMes;
