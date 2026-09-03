/* ============================================================================
   dashboard.js — vista "Dashboard"
============================================================================ */

let chartPeriodo = null;
let chartParques = null;
let chartObjetivo = null;
let chartEstados = null;
let dashboardControlsWired = false;

const MONTHLY_GOAL_LEGACY_KEY = 'parksales_objetivo_mensual';
const DASHBOARD_FILTERS_KEY = 'parksales_dashboard_filters';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toMonthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return '—';
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function getMonthSales(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return 0;
  const ref = new Date(year, month - 1, 1);
  return STATE.ventas
    .filter((venta) => isMismoMes(venta.fecha, ref) && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(venta) : true))
    .reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0);
}

function getMonthlyGoalForMonth(monthKey) {
  const entry = (STATE.objetivosMensuales || []).find((row) => row.mes === monthKey);
  return Math.max(0, Number(entry?.importe) || 0);
}

function getCustomWorkdaysForMonth(monthKey) {
  const entry = (STATE.objetivosMensuales || []).find((row) => row.mes === monthKey);
  const val = Number(entry?.dias_laborables);
  return (val > 0 && val <= 31) ? val : null;
}

function getEffectiveWorkdaysCount(monthKey) {
  const custom = getCustomWorkdaysForMonth(monthKey);
  if (custom !== null) return custom;
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return 22;
  return countWorkdaysInMonth(year, month - 1);
}

async function saveMonthlyGoalForMonth(monthKey, amount, customWorkdays = null) {
  const parsed = Math.max(0, Number(amount) || 0);
  const parsedDays = (customWorkdays !== null && customWorkdays !== undefined && String(customWorkdays).trim() !== '')
    ? Math.max(1, Math.min(31, Number(customWorkdays) || 0))
    : null;
  const saved = await DB.setObjetivoMensual(monthKey, parsed, parsedDays);
  const list = STATE.objetivosMensuales || [];
  const idx = list.findIndex((row) => row.mes === monthKey);
  const rowObj = saved || { mes: monthKey, importe: parsed, dias_laborables: parsedDays };
  if (idx >= 0) list[idx] = rowObj;
  else list.push(rowObj);
  STATE.objetivosMensuales = list.sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  return rowObj;
}

async function migrateLegacyMonthlyGoal() {
  const legacy = localStorage.getItem(MONTHLY_GOAL_LEGACY_KEY);
  if (!legacy) return;
  const amount = Number(legacy);
  localStorage.removeItem(MONTHLY_GOAL_LEGACY_KEY);
  if (!amount) return;

  const mes = toMonthInputValue(new Date());
  if (getMonthlyGoalForMonth(mes) > 0) return;

  await saveMonthlyGoalForMonth(mes, amount);
}

function getGoalMonthKeyFromFilters(filters, referenceDate) {
  if (filters.period === 'month' && isValidMonthValue(filters.value)) return filters.value;
  if (filters.period === 'day' && isValidDateValue(filters.value)) return filters.value.slice(0, 7);
  return toMonthInputValue(referenceDate);
}

function getDefaultDashboardFilters() {
  const now = new Date();
  return {
    period: 'all',
    value: toMonthInputValue(now),
    year: String(now.getFullYear()),
    parqueId: 'all',
  };
}

function normalizeDashboardFilters(raw = {}) {
  const defaults = getDefaultDashboardFilters();
  const period = ['day', 'month', 'year', 'all'].includes(raw.period) ? raw.period : defaults.period;
  let value = typeof raw.value === 'string' && raw.value ? raw.value : defaults.value;
  const year = /^\d{4}$/.test(String(raw.year || '')) ? String(raw.year) : defaults.year;
  const parqueId = typeof raw.parqueId === 'string' && raw.parqueId ? raw.parqueId : defaults.parqueId;

  if (period === 'day' && !isValidDateValue(value)) value = toDateInputValue();
  if (period === 'month' && !isValidMonthValue(value)) value = toMonthInputValue();

  return { period, value, year, parqueId };
}

function loadDashboardFilters() {
  try {
    const saved = localStorage.getItem(DASHBOARD_FILTERS_KEY);
    if (saved) return normalizeDashboardFilters(JSON.parse(saved));
  } catch (err) {
    console.error('Error loading dashboard filters:', err);
  }
  return getDefaultDashboardFilters();
}

function saveDashboardFilters(filters) {
  localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(normalizeDashboardFilters(filters)));
}

function updateDashboardFilters(patch = {}) {
  const current = loadDashboardFilters();
  const next = normalizeDashboardFilters({ ...current, ...patch });
  saveDashboardFilters(next);
  syncDashboardFilterControls(next);
  renderDashboard();
}

function getDashboardPeriodPatch(period) {
  const current = loadDashboardFilters();
  const patch = { period };

  if (period === 'day' && !isValidDateValue(current.value)) patch.value = toDateInputValue();
  if (period === 'month' && !isValidMonthValue(current.value)) patch.value = toMonthInputValue();

  return patch;
}

function isSameLocalDay(iso, dayValue) {
  const date = new Date(iso);
  const [year, month, day] = String(dayValue || '').split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function isSameLocalMonth(iso, monthValue) {
  const date = new Date(iso);
  const [year, month] = String(monthValue || '').split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

function isSameLocalYear(iso, yearValue) {
  return new Date(iso).getFullYear() === Number(yearValue);
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysInMonth(year, monthIndexZeroBased) {
  return new Date(year, monthIndexZeroBased + 1, 0).getDate();
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function countWorkdaysInMonth(year, monthIndexZeroBased) {
  const totalDays = daysInMonth(year, monthIndexZeroBased);
  let count = 0;
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, monthIndexZeroBased, day);
    if (!isWeekend(date)) count++;
  }
  return count;
}

function countWorkdaysElapsed(year, monthIndexZeroBased, currentDay) {
  let count = 0;
  for (let day = 1; day <= currentDay; day++) {
    const date = new Date(year, monthIndexZeroBased, day);
    if (!isWeekend(date)) count++;
  }
  return count;
}

function countWorkdaysRemaining(year, monthIndexZeroBased, currentDay) {
  const totalDays = daysInMonth(year, monthIndexZeroBased);
  let count = 0;
  // Incluye el día de hoy si es laborable (aún puedes trabajar hoy)
  for (let day = currentDay; day <= totalDays; day++) {
    const date = new Date(year, monthIndexZeroBased, day);
    if (!isWeekend(date)) count++;
  }
  return count;
}

function daysBetweenInclusive(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end - start) / 86400000);
  return Math.max(1, diff + 1);
}

function getSalesByPark() {
  const grouped = {};
  STATE.ventas.forEach((venta) => {
    if (typeof isVentaEfectiva === 'function' && !isVentaEfectiva(venta)) return;
    const name = getVentaItemNombre(venta);
    if (!grouped[name]) grouped[name] = { ventas: 0, total: 0 };
    grouped[name].ventas += 1;
    grouped[name].total += Number(venta.importe_total) || 0;
  });
  return grouped;
}

function getFilteredVentas(filters) {
  return STATE.ventas.filter((venta) => {
    if (filters.parqueId !== 'all' && venta.parque_id !== filters.parqueId) return false;
    if (filters.period === 'day') return isSameLocalDay(venta.fecha, filters.value);
    if (filters.period === 'month') return isSameLocalMonth(venta.fecha, filters.value);
    if (filters.period === 'year') return isSameLocalYear(venta.fecha, filters.year);
    return true;
  });
}

function getDashboardReferenceDate(filters) {
  if (filters.period === 'day' && isValidDateValue(filters.value)) {
    const [year, month, day] = filters.value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (filters.period === 'month' && isValidMonthValue(filters.value)) {
    const [year, month] = filters.value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  if (filters.period === 'year' && /^\d{4}$/.test(String(filters.year || ''))) {
    return new Date(Number(filters.year), 0, 1);
  }
  return new Date();
}

function renderDashboard() {
  if (!document.getElementById('dashboard-stats')) return;

  ensureDashboardControlsWired();
  ensureDashboardParkOptions();

  const filters = normalizeDashboardFilters(loadDashboardFilters());
  syncDashboardFilterControls(filters);

  const now = new Date();
  const referenceDate = getDashboardReferenceDate(filters);
  const filtradas = getFilteredVentas(filters);
  const filtradasEfectivas = filtradas.filter(v => (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(v) : true));
  const goalMonthKey = getGoalMonthKeyFromFilters(filters, referenceDate);
  const goal = getMonthlyGoalForMonth(goalMonthKey);
  const goalMonthLabel = formatMonthLabel(goalMonthKey);

  const sum = (arr, key) => arr.reduce((acc, venta) => acc + Number(venta[key] || 0), 0);

  // Calculate stats from filtered data (solo efectivas para facturación)
  const filteredTotal = sum(filtradasEfectivas, 'importe_total');
  const filteredCount = filtradasEfectivas.length;

  // Get sales by park from filtered effective data
  const filteredSalesByPark = {};
  filtradasEfectivas.forEach((venta) => {
    const name = getVentaItemNombre(venta);
    if (!filteredSalesByPark[name]) filteredSalesByPark[name] = { ventas: 0, total: 0 };
    filteredSalesByPark[name].ventas += 1;
    filteredSalesByPark[name].total += Number(venta.importe_total) || 0;
  });

  const topParkEntry = Object.entries(filteredSalesByPark).sort((a, b) => b[1].ventas - a[1].ventas)[0];
  const topParkName = topParkEntry ? topParkEntry[0] : '—';
  const topParkEntries = topParkEntry ? topParkEntry[1].ventas : 0;
  const topParkRevenue = topParkEntry ? topParkEntry[1].total : 0;

  // Ventas del día de referencia dentro del periodo seleccionado (solo efectivas)
  const referenceDay = toDateInputValue(referenceDate);
  const ventasHoy = STATE.ventas.filter((venta) => isSameLocalDay(venta.fecha, referenceDay) && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(venta) : true));
  const totalHoy = sum(ventasHoy, 'importe_total');
  const countHoy = ventasHoy.length;

  const filteredSummary = buildDashboardFilterSummary(filters, filtradas.length, filtradasEfectivas.length);

  // Meta y métricas calculadas sobre el mes del periodo seleccionado (solo efectivas)
  const mesReferencia = STATE.ventas.filter((venta) => isMismoMes(venta.fecha, referenceDate) && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(venta) : true));
  const currentMonthSales = sum(mesReferencia, 'importe_total');
  const goalRemaining = Math.max(0, goal - currentMonthSales);
  const goalProgress = goal > 0 ? Math.min(100, (currentMonthSales / goal) * 100) : 0;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();
  const isCurrentReferenceMonth = referenceYear === now.getFullYear() && referenceMonth === now.getMonth();
  const referenceDayNumber = isCurrentReferenceMonth ? now.getDate() : daysInMonth(referenceYear, referenceMonth);

  const customWorkdays = getCustomWorkdaysForMonth(goalMonthKey);
  const defaultTotal = countWorkdaysInMonth(referenceYear, referenceMonth);
  const defaultElapsed = isCurrentReferenceMonth
    ? countWorkdaysElapsed(referenceYear, referenceMonth, referenceDayNumber)
    : defaultTotal;
  const defaultRemaining = isCurrentReferenceMonth
    ? countWorkdaysRemaining(referenceYear, referenceMonth, referenceDayNumber)
    : 0;

  let totalWorkdays = defaultTotal;
  let workdaysElapsed = defaultElapsed;
  let workdaysRemaining = defaultRemaining;

  if (customWorkdays !== null) {
    totalWorkdays = customWorkdays;
    if (isCurrentReferenceMonth) {
      const ratio = defaultTotal > 0 ? customWorkdays / defaultTotal : 1;
      workdaysElapsed = Math.min(customWorkdays, Math.max(1, Math.round(defaultElapsed * ratio)));
      workdaysRemaining = Math.max(0, customWorkdays - workdaysElapsed + 1);
    } else {
      workdaysElapsed = customWorkdays;
      workdaysRemaining = 0;
    }
  }

  const actualMonthWorkdays = Math.max(1, totalWorkdays);

  // Meta base: objetivo / días laborables del mes
  const expectedDailyGoal = goal / actualMonthWorkdays;
  // Ritmo actual / media diaria del mes seleccionado
  const currentPace = workdaysElapsed > 0 ? currentMonthSales / workdaysElapsed : 0;
  const averageDailyMonthSales = currentPace;
  // Cálculo dinámico: lo que falta repartido entre los días pendientes
  const missingPerWorkingDay = workdaysRemaining > 0 ? goalRemaining / workdaysRemaining : goalRemaining;
  const dailyGoalRemaining = missingPerWorkingDay;
  const workdaysLeft = workdaysRemaining;
  const workdaysTotal = actualMonthWorkdays;

  // Ventas de la semana de la fecha de referencia (solo efectivas)
  const inicioSemana = new Date(referenceDate);
  inicioSemana.setDate(referenceDate.getDate() - (referenceDate.getDay() || 7) + 1);
  inicioSemana.setHours(0, 0, 0, 0);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 7);
  const ventasSemana = STATE.ventas.filter((venta) => {
    const fechaVenta = new Date(venta.fecha);
    return fechaVenta >= inicioSemana && fechaVenta < finSemana && (typeof isVentaEfectiva === 'function' ? isVentaEfectiva(venta) : true);
  });
  const totalSemana = sum(ventasSemana, 'importe_total');
  const countSemana = ventasSemana.length;

  document.getElementById('dashboard-filter-summary').textContent = filteredSummary;

  const stats = [
    { label: 'Total en filtro', value: fmtEUR(filteredTotal), sub: `${fmtNum(filteredCount)} completadas de ${fmtNum(filtradas.length)} totales`, icon: 'M12 8v8M8 12h8' },
    { label: 'Parque más vendido', value: topParkName, sub: topParkEntry ? `${fmtNum(topParkEntries)} entradas · ${fmtEUR(topParkRevenue)}` : 'Sin ventas en el filtro', icon: 'M3 21l7-14 4 8 3-5 4 11H3z' },
    { label: 'Media diaria del mes', value: fmtEUR(averageDailyMonthSales), sub: workdaysElapsed ? `${fmtNum(workdaysElapsed)} días laborables calculados` : 'Sin días laborables en el periodo', icon: 'M3 13h4l3 7 4-14 3 7h4' },
    { label: 'Cuota / día restante', value: goal > 0 ? fmtEUR(dailyGoalRemaining) : '—', sub: goal > 0 ? (isCurrentReferenceMonth ? `Te quedan ${fmtNum(workdaysRemaining)} días laborables de ${fmtNum(actualMonthWorkdays)} este mes` : `Mes cerrado · ${fmtNum(actualMonthWorkdays)} días laborables`) : `Sin meta para ${goalMonthLabel}`, icon: 'M4 19h16M6 16V9M12 16V5M18 16v-4' },
    { label: 'Ventas totales del día', value: fmtEUR(totalHoy), sub: countHoy ? `${fmtNum(countHoy)} entradas en la fecha seleccionada` : 'Sin ventas en la fecha seleccionada', icon: 'M3 3v18h18' },
    { label: 'Ventas de la semana', value: fmtEUR(totalSemana), sub: countSemana ? `${fmtNum(countSemana)} entradas` : 'Sin ventas esta semana', icon: 'M16 2v4M8 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M12 14v4M10 16h4' },
  ];

  document.getElementById('dashboard-stats').innerHTML = stats.map((stat) => `
    <div class="stat-card dashboard-stat-card">
      <div class="stat-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${stat.icon}"/></svg>${escapeHtml(stat.label)}</div>
      <div class="stat-value ${stat.value.length > 14 ? 'stat-value-long' : ''}">${escapeHtml(stat.value)}</div>
      <div class="stat-sub">${escapeHtml(stat.sub)}</div>
    </div>
  `).join('');

  renderGoalChart(currentMonthSales, goal);
  renderGoalWidget({
    goalMonthKey,
    goalMonthLabel,
    currentMonthSales,
    goal,
    goalRemaining,
    goalProgress,
    expectedDailyGoal,
    currentPace,
    missingPerWorkingDay,
    workdaysTotal,
    workdaysLeft,
    totalSemana,
    countSemana,
  });
  renderGoalPanelTitle(goalMonthKey, goalMonthLabel, goal);
  renderEstadoRingChart(filtradas);
  renderRankingParques(filtradasEfectivas);
}

function buildDashboardFilterSummary(filters, totalFiltered, totalEffective) {
  const periodLabel = filters.period === 'day' ? `Día ${filters.value}` : filters.period === 'month' ? `Mes ${filters.value}` : filters.period === 'year' ? `Año ${filters.year}` : 'Todo el histórico';
  const parkLabel = filters.parqueId === 'all' ? 'Todos los parques' : parqueNombre(filters.parqueId);
  return `${periodLabel} · ${parkLabel} · ${fmtNum(totalFiltered)} registros (${fmtNum(totalEffective ?? totalFiltered)} efectivas)`;
}

function ensureDashboardControlsWired() {
  if (dashboardControlsWired) return;
  dashboardControlsWired = true;

  const periodSelect = document.getElementById('dashboard-period');
  const valueInput = document.getElementById('dashboard-filter-value');
  const yearInput = document.getElementById('dashboard-year');
  const parqueSelect = document.getElementById('dashboard-parque');
  const resetButton = document.getElementById('dashboard-reset-filters');

  periodSelect?.addEventListener('change', (e) => updateDashboardFilters(getDashboardPeriodPatch(e.target.value)));
  valueInput?.addEventListener('change', (e) => {
    const period = periodSelect?.value;
    if (period === 'year') {
      updateDashboardFilters({ year: e.target.value });
    } else {
      updateDashboardFilters({ value: e.target.value });
    }
  });
  yearInput?.addEventListener('change', (e) => updateDashboardFilters({ year: e.target.value }));
  parqueSelect?.addEventListener('change', (e) => updateDashboardFilters({ parqueId: e.target.value }));

  resetButton?.addEventListener('click', () => {
    saveDashboardFilters(getDefaultDashboardFilters());
    syncDashboardFilterControls(loadDashboardFilters());
    renderDashboard();
  });
}

function ensureDashboardParkOptions() {
  const select = document.getElementById('dashboard-parque');
  if (!select) return;
  const current = select.value || loadDashboardFilters().parqueId || 'all';
  const options = ['<option value="all">Todos los parques</option>']
    .concat(STATE.parques.map((parque) => `<option value="${escapeHtml(parque.id)}">${escapeHtml(parque.nombre)}</option>`));
  select.innerHTML = options.join('');
  select.value = STATE.parques.some((parque) => parque.id === current) ? current : 'all';
}

function syncDashboardFilterControls(filters) {
  const period = filters.period || 'month';
  const periodSelect = document.getElementById('dashboard-period');
  const yearInput = document.getElementById('dashboard-year');
  const parqueSelect = document.getElementById('dashboard-parque');
  const valueInput = document.getElementById('dashboard-filter-value');
  const valueLabel = document.getElementById('dashboard-filter-value-label');

  if (periodSelect) periodSelect.value = period;
  if (yearInput) yearInput.value = filters.year;
  if (parqueSelect && Array.from(parqueSelect.options).some((option) => option.value === filters.parqueId)) {
    parqueSelect.value = filters.parqueId;
  }

  if (valueInput && valueLabel) {
    if (period === 'day') {
      valueInput.type = 'date';
      valueInput.value = isValidDateValue(filters.value) ? filters.value : toDateInputValue();
      valueInput.removeAttribute('min');
      valueInput.removeAttribute('max');
      valueInput.removeAttribute('step');
      valueLabel.textContent = 'Día';
    } else if (period === 'year') {
      valueInput.type = 'number';
      valueInput.value = filters.year;
      valueInput.min = '2000';
      valueInput.max = '2100';
      valueInput.step = '1';
      valueLabel.textContent = 'Año';
    } else if (period === 'all') {
      valueInput.type = 'month';
      valueInput.value = toMonthInputValue();
      valueInput.removeAttribute('min');
      valueInput.removeAttribute('max');
      valueInput.removeAttribute('step');
      valueLabel.textContent = 'Filtro';
    } else {
      valueInput.type = 'month';
      valueInput.value = isValidMonthValue(filters.value) ? filters.value : toMonthInputValue();
      valueInput.removeAttribute('min');
      valueInput.removeAttribute('max');
      valueInput.removeAttribute('step');
      valueLabel.textContent = 'Mes';
    }
    valueInput.disabled = period === 'all';
    valueInput.placeholder = period === 'all' ? 'Sin filtro de periodo' : '';
  }
}

function isValidDateValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidMonthValue(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function chartPalette() {
  return chartColors();
}

function renderGoalChart(currentMonthSales, goal) {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById('chart-objetivo').getContext('2d');
  if (chartObjetivo) chartObjetivo.destroy();

  const palette = chartPalette();
  const rawPct = goal > 0 ? (currentMonthSales / goal) * 100 : 0;

  // Orden de colores solicitado:
  // 1. #F5A623 (Principal web: 0% - 100%)
  // 2. #00E676 (Verde: 100% - 120%)
  // 3. #00C6FF (Azul: 120% - 140%)
  // 4. #B27BFF (Morado: 140% - 160%)
  // 5. #FFD600 (Legendario amarillo: > 160%)

  let currentColor = '#F5A623';
  let previousColor = palette.grid;
  let progressInLap = 0;
  let maxInLap = 1;
  let currentTierColor = '#F5A623';
  let tierEmoji = '';

  if (rawPct < 100) {
    currentColor = '#F5A623';
    previousColor = palette.grid;
    progressInLap = currentMonthSales;
    maxInLap = goal > 0 ? goal : 1;
    currentTierColor = '#F5A623';
    tierEmoji = '';
  } else if (rawPct < 120) {
    currentColor = '#00E676';
    previousColor = '#F5A623';
    progressInLap = currentMonthSales - goal;
    maxInLap = goal * 0.2; // 20% del objetivo base
    currentTierColor = '#00E676';
    tierEmoji = '🎯';
  } else if (rawPct < 140) {
    currentColor = '#00C6FF';
    previousColor = '#00E676';
    progressInLap = currentMonthSales - (goal * 1.2);
    maxInLap = goal * 0.2;
    currentTierColor = '#00C6FF';
    tierEmoji = '🚀';
  } else if (rawPct < 160) {
    currentColor = '#B27BFF';
    previousColor = '#00C6FF';
    progressInLap = currentMonthSales - (goal * 1.4);
    maxInLap = goal * 0.2;
    currentTierColor = '#B27BFF';
    tierEmoji = '⚡';
  } else {
    currentColor = '#FFD600';
    previousColor = '#B27BFF';
    progressInLap = Math.min(goal * 0.2, currentMonthSales - (goal * 1.6));
    maxInLap = goal * 0.2;
    currentTierColor = '#FFD600';
    tierEmoji = '👑';
  }

  // Título y cálculo simplificado para el tooltip según el rango actual
  let tierTargetPct = 100;
  let targetAmount = goal;
  let tierTitle = '';

  if (rawPct < 100) {
    tierTargetPct = 100;
    targetAmount = goal;
    tierTitle = `🎯 Del 100% llevas ${rawPct.toFixed(1)}%`;
  } else if (rawPct < 120) {
    tierTargetPct = 120;
    targetAmount = goal * 1.2;
    tierTitle = `🚀 Del 120% llevas ${rawPct.toFixed(1)}%`;
  } else if (rawPct < 140) {
    tierTargetPct = 140;
    targetAmount = goal * 1.4;
    tierTitle = `⚡ Del 140% llevas ${rawPct.toFixed(1)}%`;
  } else if (rawPct < 160) {
    tierTargetPct = 160;
    targetAmount = goal * 1.6;
    tierTitle = `👑 Del 160% llevas ${rawPct.toFixed(1)}%`;
  } else {
    tierTargetPct = 160;
    targetAmount = goal * 1.6;
    tierTitle = `👑 ¡Superado el 160%! (Llevas ${rawPct.toFixed(1)}%)`;
  }

  const filled = Math.max(0, Math.min(maxInLap, progressInLap));
  const remaining = Math.max(0, maxInLap - filled);

  const datasetsData = remaining > 0 ? [filled, remaining] : [filled];
  const bgColors = remaining > 0 ? [currentColor, previousColor] : [currentColor];

  // Texto central: % real y emoji del tier
  const pctText = rawPct.toFixed(1) + '%';
  const overlay = document.getElementById('goal-ring-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <span class="goal-ring-pct" style="color:${currentTierColor}">${pctText}</span>
      <span class="goal-ring-tier">${tierEmoji}</span>
    `;
  }

  chartObjetivo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: remaining > 0 ? ['Progreso', 'Restante'] : ['Progreso'],
      datasets: [{
        data: datasetsData,
        backgroundColor: bgColors,
        borderWidth: 0,
        borderRadius: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 8,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            title: () => '',
            label: (item) => {
              if (rawPct >= 160) {
                const extra = Math.max(0, currentMonthSales - targetAmount);
                return ` Vendido: ${fmtEUR(currentMonthSales)} (+${fmtEUR(extra)})`;
              }
              if (item.dataIndex === 0 && filled > 0) {
                return ` Llevas: ${fmtEUR(currentMonthSales)} (${rawPct.toFixed(1)}%)`;
              }
              const faltaEUR = Math.max(0, targetAmount - currentMonthSales);
              const faltaPct = Math.max(0, tierTargetPct - rawPct).toFixed(1);
              return ` Falta: ${fmtEUR(faltaEUR)} (${faltaPct}%)`;
            },
          },
        },
      },
    },
  });
}


function renderGoalPanelTitle(goalMonthKey, goalMonthLabel, goal) {
  const titleEl = document.getElementById('dashboard-goal-title');
  const subEl = document.getElementById('dashboard-goal-sub');
  if (!titleEl) return;
  titleEl.textContent = `Meta mensual · ${goalMonthLabel}`;
  if (subEl) {
    subEl.textContent = goal > 0
      ? `Objetivo de ${goalMonthLabel}: cuánto llevas, cuánto falta y ritmo diario estimado.`
      : `No hay meta guardada para ${goalMonthLabel}. Configúrala desde tu perfil.`;
  }
}

function renderGoalWidget({
  goalMonthKey,
  goalMonthLabel,
  currentMonthSales,
  goal,
  goalRemaining,
  goalProgress,
  expectedDailyGoal,
  currentPace,
  missingPerWorkingDay,
  workdaysTotal,
  workdaysLeft,
}) {
  const percentage = goal ? Math.min(100, goalProgress) : 0;

  if (!goal) {
    document.getElementById('goal-widget').innerHTML = `
      <div class="goal-summary">
        <div class="goal-summary-row">
          <span>Ventas de ${escapeHtml(goalMonthLabel)}</span>
          <b>${fmtEUR(currentMonthSales)}</b>
        </div>
        <div style="color:var(--text-muted); font-size:12.5px; margin-top:10px; text-align:center; padding:8px 0;">
          Sin objetivo para ${escapeHtml(goalMonthLabel)}.<br>
          <span style="color:var(--accent); cursor:pointer; font-weight:600;" onclick="openProfileSettings('${goalMonthKey}')">Configura la meta de este mes →</span>
        </div>
      </div>
    `;
    return;
  }

  // ── HITOS: 100 % · 120 % · 140 % · 160 % ──────────────────────────────
  const rawPct = goal > 0 ? (currentMonthSales / goal) * 100 : 0; // sin cap
  const MILESTONES = [
    { pct: 100, label: '100%', color: '#00E676', emoji: '🎯', tier: 1 },
    { pct: 120, label: '120%', color: '#00C6FF', emoji: '🚀', tier: 2 },
    { pct: 140, label: '140%', color: '#B27BFF', emoji: '⚡', tier: 3 },
    { pct: 160, label: '160%', color: '#FFD600', emoji: '👑', tier: 4 },
  ];

  // Tier actual alcanzado (0 = por debajo del 100%)
  const currentTier = MILESTONES.filter((m) => rawPct >= m.pct).length;

  // Siguiente hito al que aspirar
  const nextMilestone = MILESTONES.find((m) => rawPct < m.pct) || null;

  // Mensajes motivadores por estado (estilo corto y directo)
  const MOTIVATION = {
    below: [
      { max: 25, msg: '🚀 Has vendido menos de lo previsto, ¡sube la cuota!' },
      { max: 50, msg: '🚀 Vas a mitad de camino, ¡mantén el ritmo!' },
      { max: 75, msg: '🔥 ¡Vas bien! La recta final es tuya 💪🏻' },
      { max: 100, msg: '🎯 ¡A un paso del objetivo! ¡Último empujón!' },
    ],
    tier1: [
      '🎯 ¡Objetivo cumplido! Ahora a por el 120% 💪🏻',
      '🎯 ¡Meta base conseguida! ¿Te quedas aquí o vas al 120%?',
      '🎯 ¡100% cerrado! El siguiente nivel está a tu alcance.',
    ],
    tier2: [
      '🚀 ¡120%! Estás en otra liga. ¡Vas por delante! 💪🏻',
      '🚀 ¡20% extra sobre el objetivo! Sigue así, el 140% cae solo.',
      '🚀 ¡Máquina! 120% y subiendo. El 140% te espera.',
    ],
    tier3: [
      '⚡ ¡140%! Eres una bestia. ¿Puedes con el 160% también?',
      '⚡ ¡Élite total! 140% superado. Muy pocos llegan aquí 🔥',
      '⚡ ¡140% y contando! El 160% es tu siguiente obra maestra.',
    ],
    tier4: [
      '👑 ¡160%! Leyenda absoluta. Estás rompiendo todos los récords.',
      '👑 ¡160%! A estas alturas ya no hay hitos, solo historia.',
      '👑 ¡Mes épico! 160% superado. ¡Imparable! 🔥',
    ],
  };

  // Cuánto falta en euros para el siguiente hito
  const nextAmount = nextMilestone
    ? Math.max(0, (goal * nextMilestone.pct / 100) - currentMonthSales)
    : 0;
  const nextAmountStr = nextMilestone ? ` · Faltan <b>${fmtEUR(nextAmount)}</b> para el ${nextMilestone.label}` : '';

  function getMotivMsg() {
    if (currentTier === 4) {
      const pool = MOTIVATION.tier4;
      return pool[Math.floor(rawPct / 10) % pool.length];
    }
    if (currentTier === 3) {
      const pool = MOTIVATION.tier3;
      return `${pool[Math.floor(rawPct / 5) % pool.length]}${nextAmountStr}`;
    }
    if (currentTier === 2) {
      const pool = MOTIVATION.tier2;
      return `${pool[Math.floor(rawPct / 5) % pool.length]}${nextAmountStr}`;
    }
    if (currentTier === 1) {
      const pool = MOTIVATION.tier1;
      return `${pool[Math.floor(rawPct / 5) % pool.length]}${nextAmountStr}`;
    }
    // below 100%
    const slot = MOTIVATION.below.find((s) => rawPct < s.max) || MOTIVATION.below[MOTIVATION.below.length - 1];
    const faltaBase = Math.max(0, goal - currentMonthSales);
    return `${slot.msg} · Faltan <b>${fmtEUR(faltaBase)}</b> para el 100%`;
  }

  // ── BARRA DE PROGRESO POR TRAMOS (0-160%) ──────────────────────────────
  const SCALE_MAX = 160;
  const barFillPct = Math.min(100, (rawPct / SCALE_MAX) * 100);

  let fillGradient = '#F5A623';
  if (rawPct > 160) {
    fillGradient = `linear-gradient(90deg, #F5A623 0%, #F5A623 62.5%, #00E676 62.5%, #00E676 75%, #00C6FF 75%, #00C6FF 87.5%, #B27BFF 87.5%, #B27BFF 100%)`;
  } else if (rawPct > 140) {
    const s1 = ((100 / rawPct) * 100).toFixed(2);
    const s2 = ((120 / rawPct) * 100).toFixed(2);
    const s3 = ((140 / rawPct) * 100).toFixed(2);
    fillGradient = `linear-gradient(90deg, #F5A623 0%, #F5A623 ${s1}%, #00E676 ${s1}%, #00E676 ${s2}%, #00C6FF ${s2}%, #00C6FF ${s3}%, #B27BFF ${s3}%, #B27BFF 100%)`;
  } else if (rawPct > 120) {
    const s1 = ((100 / rawPct) * 100).toFixed(2);
    const s2 = ((120 / rawPct) * 100).toFixed(2);
    fillGradient = `linear-gradient(90deg, #F5A623 0%, #F5A623 ${s1}%, #00E676 ${s1}%, #00E676 ${s2}%, #00C6FF ${s2}%, #00C6FF 100%)`;
  } else if (rawPct > 100) {
    const s1 = ((100 / rawPct) * 100).toFixed(2);
    fillGradient = `linear-gradient(90deg, #F5A623 0%, #F5A623 ${s1}%, #00E676 ${s1}%, #00E676 100%)`;
  } else {
    fillGradient = '#F5A623';
  }

  const milestonesHtml = MILESTONES.map((m) => {
    const pos = (m.pct / SCALE_MAX) * 100;
    const reached = rawPct >= m.pct;
    return `<div class="goal-milestone-marker ${reached ? 'reached' : ''}" style="left:${pos}%; --mc:${m.color};" title="${m.label}">
      <div class="goal-milestone-label">${m.emoji} ${m.label}</div>
      <div class="goal-milestone-dot"></div>
    </div>`;
  }).join('');

  const motivMsg = getMotivMsg();
  const motivColor = currentTier > 0 ? MILESTONES[currentTier - 1].color : '#F5A623';

  const row3Label = nextMilestone
    ? `Falta para el ${nextMilestone.label}`
    : `✅ Superado 160% en`;

  const row3Value = nextMilestone
    ? fmtEUR(Math.max(0, (goal * nextMilestone.pct / 100) - currentMonthSales))
    : '+' + fmtEUR(currentMonthSales - (goal * 1.6));

  const row3Color = nextMilestone ? nextMilestone.color : '#FFD600';

  const nextHintHtml = nextMilestone
    ? `<div class="goal-next-hint" style="--nc:${nextMilestone.color};">
         <span class="goal-next-emoji">${nextMilestone.emoji}</span>
         <span>Próximo hito: <b>${nextMilestone.label}</b> · faltan <b>${fmtEUR(Math.max(0, (goal * nextMilestone.pct / 100) - currentMonthSales))}</b></span>
       </div>`
    : `<div class="goal-next-hint" style="--nc:#FFD600;">👑 ¡Has superado todos los hitos! Eres una leyenda.</div>`;

  document.getElementById('goal-widget').innerHTML = `
    <div class="goal-summary">
      <div class="goal-summary-row">
        <span>Objetivo · ${escapeHtml(goalMonthLabel)}</span>
        <b>${fmtEUR(goal)}</b>
      </div>
      <div class="goal-summary-row">
        <span>Ventas del mes</span>
        <b>${fmtEUR(currentMonthSales)}</b>
      </div>
      <div class="goal-summary-row">
        <span>${row3Label}</span>
        <b class="goal-remaining" style="color:${row3Color} !important;">${row3Value}</b>
      </div>

      <!-- Barra de hitos tramo por tramo -->
      <div class="goal-milestone-track-wrap">
        <div class="goal-milestone-track">
          <div class="goal-milestone-fill" style="width:${barFillPct}%; background:${fillGradient};"></div>
          ${milestonesHtml}
        </div>
      </div>
      <div class="goal-progress-meta" style="color:${motivColor}; font-weight: 600;">${rawPct.toFixed(1)}% del objetivo base ${currentTier > 0 ? '· ' + MILESTONES[currentTier - 1].emoji + ' Hito ' + currentTier + ' alcanzado' : ''}</div>

      <!-- Píldoras de hitos -->
      <div class="goal-milestone-pills">
        ${MILESTONES.map((m) => `
          <div class="goal-milestone-pill ${rawPct >= m.pct ? 'pill-active' : ''}" style="--mc:${m.color};">
            ${m.emoji} ${m.label}
          </div>
        `).join('')}
      </div>

      <!-- Siguiente hito -->
      ${nextHintHtml}

      <div class="goal-mini-grid">
        <div class="goal-mini-card goal-mini-card-primary" style="${currentTier > 0 ? `background:${motivColor}12; border-color:${motivColor}44;` : ''}">
          <span>Cuota / día restante</span>
          <b style="${currentTier > 0 ? `color:${motivColor};` : ''}">${fmtEUR(missingPerWorkingDay)}</b>
        </div>
        <div class="goal-mini-card">
          <span>Días que faltan</span>
          <b>${fmtNum(workdaysLeft)} de ${fmtNum(workdaysTotal)}</b>
        </div>
        <div class="goal-mini-card">
          <span>Meta original / día</span>
          <b class="goal-mini-warn">${fmtEUR(expectedDailyGoal)}</b>
        </div>
        <div class="goal-mini-card">
          <span>Ritmo actual</span>
          <b class="goal-mini-info">${fmtEUR(currentPace)}</b>
        </div>
      </div>

      <!-- Mensaje motivador -->
      <div class="goal-status-note goal-motiv-note" style="background:${motivColor}14; color:${motivColor}; border-color:${motivColor}44;">
        ${motivMsg}
      </div>
    </div>
  `;
}

function renderPeriodChart(ventas, filters) {
  if (typeof Chart === 'undefined') return;
  const palette = chartPalette();
  const ctx = document.getElementById('chart-periodo').getContext('2d');
  if (chartPeriodo) chartPeriodo.destroy();

  let labels = [];
  let data = [];
  let tooltipLabel = 'Ingresos';

  if (filters.period === 'day') {
    const [year, month, day] = filters.value.split('-').map(Number);
    labels = Array.from({ length: 24 }, (_, hour) => `${pad2(hour)}:00`);
    data = labels.map((_, hour) => ventas.filter((venta) => {
      const date = new Date(venta.fecha);
      return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day && date.getHours() === hour;
    }).reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0));
    tooltipLabel = 'Ingresos hora';
  } else if (filters.period === 'year') {
    const year = Number(filters.year);
    labels = MONTH_NAMES.map((name) => name.slice(0, 3));
    data = labels.map((_, monthIndex) => ventas.filter((venta) => {
      const date = new Date(venta.fecha);
      return date.getFullYear() === year && date.getMonth() === monthIndex;
    }).reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0));
    tooltipLabel = 'Ingresos mes';
  } else if (filters.period === 'month') {
    const [year, month] = filters.value.split('-').map(Number);
    const days = daysInMonth(year, month - 1);
    labels = Array.from({ length: days }, (_, dayIndex) => `${dayIndex + 1}`);
    data = labels.map((_, dayIndex) => ventas.filter((venta) => {
      const date = new Date(venta.fecha);
      return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === dayIndex + 1;
    }).reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0));
    tooltipLabel = 'Ingresos día';
  } else {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }
    labels = months.map((d) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(-2)}`);
    data = months.map((d) => ventas.filter((venta) => {
      const date = new Date(venta.fecha);
      return date.getFullYear() === d.getFullYear() && date.getMonth() === d.getMonth();
    }).reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0));
    tooltipLabel = 'Ingresos mes';
  }

  chartPeriodo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: tooltipLabel,
        data,
        borderRadius: 10,
        backgroundColor: palette.accent,
        hoverBackgroundColor: palette.accent2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx2) => fmtEUR(ctx2.parsed.y) } },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: palette.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } },
        },
        y: {
          grid: { color: palette.grid },
          ticks: { color: palette.text, callback: (v) => fmtEUR(v), font: { size: 11 } },
        },
      },
    },
  });
}

function renderParqueChart(ventas) {
  if (typeof Chart === 'undefined') return;
  const palette = chartPalette();
  const ctx = document.getElementById('chart-parques').getContext('2d');
  if (chartParques) chartParques.destroy();

  // Group sales by month
  const grouped = {};
  ventas.forEach((venta) => {
    const date = new Date(venta.fecha);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`; // YYYY-MM
    if (!grouped[key]) grouped[key] = 0;
    grouped[key] += Number(venta.importe_total) || 0;
  });

  // Sort by date
  const sortedKeys = Object.keys(grouped).sort();
  const labels = sortedKeys.map((key) => {
    const [year, month] = key.split('-');
    return `${MONTH_NAMES[Number(month) - 1].slice(0, 3)} ${year.slice(-2)}`;
  });
  const values = sortedKeys.map((key) => grouped[key]);

  if (!labels.length) {
    chartParques = null;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  chartParques = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos',
        data: values,
        borderRadius: 10,
        backgroundColor: palette.palette,
        hoverBackgroundColor: palette.accent2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx2) => fmtEUR(ctx2.parsed.y) } },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: palette.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } },
        },
        y: {
          grid: { color: palette.grid },
          ticks: { color: palette.text, callback: (v) => fmtEUR(v), font: { size: 11 } },
        },
      },
    },
  });
}

function goToHistorialWithEstado(estadoKey) {
  if (typeof HIST_STATE !== 'undefined') {
    HIST_STATE.estado = estadoKey || '';
    HIST_STATE.page = 1;
    const sel = document.getElementById('hist-filtro-estado');
    if (sel) sel.value = estadoKey || '';
  }
  if (typeof switchView === 'function') {
    switchView('historial');
  }
  if (typeof renderHistorial === 'function') {
    renderHistorial();
  }
}
window.goToHistorialWithEstado = goToHistorialWithEstado;

function renderEstadoRingChart(ventas) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('chart-estados-anillo');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartEstados) chartEstados.destroy();

  // Contar registros e importes por cada estado
  const counts = {
    completado: 0,
    enviado: 0,
    pendiente: 0,
    incompleto: 0,
    no_enviado: 0,
  };
  const totals = {
    completado: 0,
    enviado: 0,
    pendiente: 0,
    incompleto: 0,
    no_enviado: 0,
  };

  ventas.forEach((v) => {
    const estado = typeof normalizeEstadoVenta === 'function' ? normalizeEstadoVenta(v.estado) : 'completado';
    if (counts[estado] !== undefined) {
      counts[estado]++;
      totals[estado] += Number(v.importe_total || 0);
    } else {
      counts.completado++;
      totals.completado += Number(v.importe_total || 0);
    }
  });

  const totalVentas = ventas.length;

  // Paleta ParkSales desaturada (encaja con navy)
  const estadoOrder = ['completado', 'enviado', 'pendiente', 'incompleto', 'no_enviado'];
  const activeKeys = [];
  const labels = [];
  const data = [];
  const bgColors = [];

  estadoOrder.forEach((key) => {
    const info = (typeof ESTADOS_VENTA !== 'undefined' && ESTADOS_VENTA[key]) ? ESTADOS_VENTA[key] : {
      completado: { label: 'Completado', color: '#2EB872' },
      enviado: { label: 'Enviado', color: '#5B9EF5' },
      pendiente: { label: 'Pendiente de pago', color: '#F5A623' },
      incompleto: { label: 'Incompleto', color: '#E85D75' },
      no_enviado: { label: 'No enviado', color: '#7A869A' },
    }[key];
    const count = counts[key];
    if (count > 0 || totalVentas === 0) {
      activeKeys.push(key);
      labels.push(info.label);
      data.push(count);
      bgColors.push(info.color);
    }
  });

  // Si no hay ventas en absoluto, mostrar placeholder
  const emptyPlaceholder = totalVentas === 0;
  const chartData = emptyPlaceholder ? [1] : data;
  const chartColors = emptyPlaceholder ? ['rgba(100, 116, 139, 0.2)'] : bgColors;
  const chartLabels = emptyPlaceholder ? ['Sin ventas en el filtro'] : labels;

  const pctCompletadas = totalVentas > 0 ? ((counts.completado / totalVentas) * 100).toFixed(1) : '0.0';
  const totalEfectivo = totals.completado;
  const noEfectivoCount = totalVentas - counts.completado;

  // Centro del anillo: número total de registros y porcentaje de completadas
  const overlay = document.getElementById('estado-ring-overlay');
  if (overlay) {
    if (totalVentas === 0) {
      overlay.innerHTML = `
        <span class="goal-ring-pct" style="color:var(--text-muted); font-size:26px;">0</span>
        <span class="goal-ring-tier" style="font-size:12px; color:var(--text-muted); font-weight:700;">Sin ventas</span>
      `;
    } else {
      overlay.innerHTML = `
        <span class="goal-ring-pct" style="color:#00E676; font-size:26px;">${fmtNum(totalVentas)}</span>
        <span class="goal-ring-tier" style="font-size:12px; color:var(--text-muted); font-weight:700;">${pctCompletadas}% completadas</span>
      `;
    }
  }

  // Chart sin tooltip molesto encima del aro y con clic interactivo para filtrar
  chartEstados = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        backgroundColor: chartColors,
        borderWidth: 0,
        borderRadius: totalVentas <= 1 ? 0 : 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }, // Desactivado para que no tape el centro del aro
      },
      onClick: (evt, activeEls) => {
        if (activeEls && activeEls.length > 0) {
          const idx = activeEls[0].index;
          const key = activeKeys[idx];
          if (key) goToHistorialWithEstado(key);
        }
      },
    },
  });

  // Barra segmentada — paleta ParkSales desaturada (encaja con navy + acento)
  let trackGradient = '#2EB872';
  if (totalVentas > 0) {
    let pComp = ((counts.completado / totalVentas) * 100).toFixed(2);
    let pEnv = (((counts.completado + counts.enviado) / totalVentas) * 100).toFixed(2);
    let pPend = (((counts.completado + counts.enviado + counts.pendiente) / totalVentas) * 100).toFixed(2);
    let pInc = (((counts.completado + counts.enviado + counts.pendiente + counts.incompleto) / totalVentas) * 100).toFixed(2);
    trackGradient = `linear-gradient(90deg, #2EB872 0%, #2EB872 ${pComp}%, #5B9EF5 ${pComp}%, #5B9EF5 ${pEnv}%, #F5A623 ${pEnv}%, #F5A623 ${pPend}%, #E85D75 ${pPend}%, #E85D75 ${pInc}%, #7A869A ${pInc}%, #7A869A 100%)`;
  }

  // Renderizar el widget simétrico a goal-widget
  const widgetContainer = document.getElementById('estado-widget');
  if (widgetContainer) {
    widgetContainer.innerHTML = `
      <div class="goal-summary">
        <div class="goal-summary-row">
          <span>Ventas totales en filtro</span>
          <b>${fmtNum(totalVentas)} registros</b>
        </div>
        <div class="goal-summary-row">
          <span>Facturación efectiva (Completadas)</span>
          <b style="color:var(--success) !important;">${fmtEUR(totalEfectivo)}</b>
        </div>
        <div class="goal-summary-row">
          <span>Tasa de ventas completadas</span>
          <b class="goal-remaining" style="color:var(--success) !important;">${pctCompletadas}%</b>
        </div>

        <!-- Barra de distribución segmentada -->
        <div class="goal-milestone-track-wrap">
          <div class="goal-milestone-track">
            <div class="goal-milestone-fill" style="width:100%; background:${trackGradient};"></div>
          </div>
        </div>
        <div class="goal-progress-meta" style="color:var(--success); font-weight: 600;">
          ${fmtNum(counts.completado)} completadas (${pctCompletadas}%) · ${fmtNum(noEfectivoCount)} en otros estados
        </div>

        <!-- Píldoras de filtro interactivo que van al Historial -->
        <div class="goal-milestone-pills estado-interactive-pills">
          <div class="goal-milestone-pill pill-active" onclick="goToHistorialWithEstado('')" style="--mc:var(--accent); cursor:pointer;" title="Ver todas en Historial">
            📋 Todas (${fmtNum(totalVentas)})
          </div>
          <div class="goal-milestone-pill ${counts.completado > 0 ? 'pill-active' : ''}" onclick="goToHistorialWithEstado('completado')" style="--mc:#2EB872; cursor:pointer;" title="Filtrar completadas en Historial">
            ✅ ${fmtNum(counts.completado)}
          </div>
          <div class="goal-milestone-pill ${counts.enviado > 0 ? 'pill-active' : ''}" onclick="goToHistorialWithEstado('enviado')" style="--mc:#5B9EF5; cursor:pointer;" title="Filtrar enviadas en Historial">
            📤 ${fmtNum(counts.enviado)}
          </div>
          <div class="goal-milestone-pill ${counts.pendiente > 0 ? 'pill-active' : ''}" onclick="goToHistorialWithEstado('pendiente')" style="--mc:#F5A623; cursor:pointer;" title="Filtrar pendientes en Historial">
            ⏳ ${fmtNum(counts.pendiente)}
          </div>
          <div class="goal-milestone-pill ${counts.incompleto > 0 ? 'pill-active' : ''}" onclick="goToHistorialWithEstado('incompleto')" style="--mc:#E85D75; cursor:pointer;" title="Filtrar incompletas en Historial">
            ❌ ${fmtNum(counts.incompleto)}
          </div>
          <div class="goal-milestone-pill ${counts.no_enviado > 0 ? 'pill-active' : ''}" onclick="goToHistorialWithEstado('no_enviado')" style="--mc:#7A869A; cursor:pointer;" title="Filtrar no enviadas en Historial">
            ⏸️ ${fmtNum(counts.no_enviado)}
          </div>
        </div>

        <!-- Hint Banner interactivo -->
        <div class="goal-next-hint" onclick="goToHistorialWithEstado('')" style="--nc:var(--success); cursor:pointer;" title="Haz clic para abrir el Historial">
          <span class="goal-next-emoji">🔍</span>
          <span>Haz clic en cualquier tarjeta o píldora para <b>abrir el Historial filtrado →</b></span>
        </div>

        <!-- Mini Grid de 4 tarjetas simétricas al panel de metas -->
        <div class="goal-mini-grid">
          <div class="goal-mini-card goal-mini-card-primary" onclick="goToHistorialWithEstado('completado')" style="background:rgba(46,184,114,0.10); border-color:rgba(46,184,114,0.28); cursor:pointer;" title="Ver completadas en Historial">
            <span>✅ Completadas · ${pctCompletadas}%</span>
            <b style="color:var(--success);">${fmtNum(counts.completado)} (${fmtEUR(totals.completado)})</b>
          </div>
          <div class="goal-mini-card" onclick="goToHistorialWithEstado('enviado')" style="background:rgba(91,158,245,0.08); border-color:rgba(91,158,245,0.25); cursor:pointer;" title="Ver enviadas en Historial">
            <span>📤 Enviadas</span>
            <b style="color:#7FB0F5;">${fmtNum(counts.enviado)} (${fmtEUR(totals.enviado)})</b>
          </div>
          <div class="goal-mini-card" onclick="goToHistorialWithEstado('pendiente')" style="background:rgba(245,166,35,0.08); border-color:rgba(245,166,35,0.28); cursor:pointer;" title="Ver pendientes en Historial">
            <span>⏳ Pendientes de pago</span>
            <b style="color:var(--accent);">${fmtNum(counts.pendiente)} (${fmtEUR(totals.pendiente)})</b>
          </div>
          <div class="goal-mini-card" onclick="goToHistorialWithEstado('incompleto')" style="background:rgba(232,93,117,0.08); border-color:rgba(232,93,117,0.25); cursor:pointer;" title="Ver incompletas y no enviadas en Historial">
            <span>❌ Incompletas / ⏸️ No env.</span>
            <b style="color:#E88A9A;">${fmtNum(counts.incompleto + counts.no_enviado)} (${fmtEUR(totals.incompleto + totals.no_enviado)})</b>
          </div>
        </div>

        <!-- Mensaje / regla en el pie del widget -->
        <div class="goal-next-hint" style="--nc:var(--success); font-size:11.5px; opacity:0.9;">
          💡 <b>Regla de ventas:</b> Solo las ventas completadas suman para llegar a los objetivos.
        </div>
      </div>
    `;
  }
}

function renderRankingParques(ventas) {
  const container = document.getElementById('ranking-parques');
  if (!container) return;

  const grouped = {};
  ventas.forEach((venta) => {
    const name = getVentaItemNombre(venta);
    if (!grouped[name]) grouped[name] = { ventas: 0, total: 0 };
    grouped[name].ventas += 1;
    grouped[name].total += Number(venta.importe_total) || 0;
  });

  const rows = Object.entries(grouped)
    .map(([nombre, values]) => ({
      nombre,
      ventas: values.ventas,
      total: values.total,
      media: values.ventas ? values.total / values.ventas : 0,
    }))
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 6);

  if (!rows.length) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Aún no hay ventas en este filtro.</p>';
    return;
  }

  const maxVentas = Math.max(...rows.map((row) => row.ventas), 1);
  container.innerHTML = rows.map((row, index) => `
    <div class="ranking-row dashboard-ranking-row">
      <div class="pos">${index + 1}</div>
      <div class="rr-name">
        <div><b>${escapeHtml(row.nombre)}</b></div>
        <div class="rr-bar"><div class="rr-bar-fill" style="width:${(row.ventas / maxVentas) * 100}%"></div></div>
      </div>
      <div class="rr-val">${fmtNum(row.ventas)} entradas</div>
      <div class="rr-val dashboard-rr-total">${fmtEUR(row.total)}</div>
    </div>
  `).join('');
}

function renderProfileGoalPreview(monthKey) {
  const goal = getMonthlyGoalForMonth(monthKey);
  const monthSales = getMonthSales(monthKey);
  const customWorkdays = getCustomWorkdaysForMonth(monthKey);
  const effectiveDays = getEffectiveWorkdaysCount(monthKey);
  const [year, month] = String(monthKey || '').split('-').map(Number);
  const autoDays = year && month ? countWorkdaysInMonth(year, month - 1) : 22;
  const progressPct = goal > 0 ? Math.min(100, Math.round((monthSales / goal) * 100)) : 0;
  const monthLabel = formatMonthLabel(monthKey);
  const expectedDaily = goal > 0 ? goal / effectiveDays : 0;

  const preview = document.getElementById('profile-goal-preview');
  const goalInput = document.getElementById('profile-goal');
  const workdaysInput = document.getElementById('profile-goal-workdays');
  const heroMonth = document.getElementById('profile-hero-month');
  const heroProgress = document.getElementById('profile-hero-progress-label');
  const heroBar = document.querySelector('.profile-progress-fill');

  if (goalInput && document.activeElement !== goalInput) {
    goalInput.value = goal || '';
  }

  if (workdaysInput && document.activeElement !== workdaysInput) {
    workdaysInput.value = customWorkdays !== null ? customWorkdays : '';
    workdaysInput.placeholder = `Auto: ${autoDays}d`;
  }

  const isCompleted = goal > 0 && monthSales >= goal;
  const badgeHtml = goal > 0
    ? (isCompleted
      ? `<div class="goal-preview-pill pill-success">🔥 Meta 100% superada</div>`
      : `<div class="goal-preview-pill pill-progress">⚡ ${fmtEUR(goal - monthSales)} restantes</div>`)
    : `<div class="goal-preview-pill pill-none">Sin meta definida</div>`;

  if (preview) {
    preview.innerHTML = `
      <div class="goal-card-header">
        <div class="goal-card-main">
          <span class="goal-card-month">${escapeHtml(monthLabel)}</span>
          <div class="goal-card-amount">${fmtEUR(monthSales)}</div>
          <div class="goal-card-meta">
            ${goal ? `<b>${progressPct}% de tu meta</b> · Cuota estimada: <b>${fmtEUR(expectedDaily)}/día</b> (${customWorkdays !== null ? `personalizado: ${effectiveDays}d` : `auto: ${effectiveDays}d`})` : 'Sin meta guardada para este mes'}
          </div>
        </div>
        ${badgeHtml}
      </div>
      ${goal ? `
        <div class="goal-card-track">
          <div class="goal-card-track-fill" style="width:${Math.min(100, progressPct)}%; background: ${isCompleted ? 'linear-gradient(90deg, #F5A623, #00E676)' : 'linear-gradient(90deg, #F5A623, #FFD166)'};"></div>
        </div>
        <div class="goal-card-track-labels">
          <span>Vendido: <b>${fmtEUR(monthSales)}</b></span>
          <span>Objetivo: <b>${fmtEUR(goal)}</b></span>
        </div>
      ` : ''}
    `;
  }

  if (heroMonth) heroMonth.textContent = monthLabel;
  if (heroProgress) {
    heroProgress.textContent = goal > 0
      ? `${fmtEUR(monthSales)} de ${fmtEUR(goal)} · ${progressPct}%`
      : `${fmtEUR(monthSales)} · sin meta`;
  }
  if (heroBar) heroBar.style.width = `${progressPct}%`;

  document.querySelectorAll('.profile-goal-history-row').forEach((row) => {
    row.classList.toggle('is-active', row.dataset.month === monthKey);
  });
}

function renderGoalHistoryHtml(activeMonthKey) {
  const entries = (STATE.objetivosMensuales || [])
    .slice()
    .sort((a, b) => String(b.mes).localeCompare(String(a.mes)));

  if (!entries.length) {
    return '<p class="profile-goal-history-empty">Aún no hay metas guardadas. Elige un mes y guarda tu primera meta.</p>';
  }

  return `
    <div class="profile-goal-history-list">
      ${entries.map((entry) => {
    const sales = getMonthSales(entry.mes);
    const goal = Number(entry.importe) || 0;
    const pct = goal > 0 ? Math.min(100, Math.round((sales / goal) * 100)) : 0;
    const effectiveDays = getEffectiveWorkdaysCount(entry.mes);
    return `
          <button type="button" class="profile-goal-history-row ${entry.mes === activeMonthKey ? 'is-active' : ''}" data-month="${escapeHtml(entry.mes)}">
            <span class="profile-goal-history-month">${escapeHtml(formatMonthLabel(entry.mes))}</span>
            <span class="profile-goal-history-meta">${fmtEUR(sales)} / ${fmtEUR(goal)} · ${pct}% <small style="opacity:0.75;">(${effectiveDays}d)</small></span>
          </button>
        `;
  }).join('')}
    </div>
  `;
}

function openProfileSettings(initialMonthKey = null) {
  const now = new Date();
  const selectedMonthKey = initialMonthKey && /^\d{4}-\d{2}$/.test(initialMonthKey)
    ? initialMonthKey
    : toMonthInputValue(now);
  const goal = getMonthlyGoalForMonth(selectedMonthKey);
  const monthSales = getMonthSales(selectedMonthKey);
  const customWorkdays = getCustomWorkdaysForMonth(selectedMonthKey);
  const effectiveDays = getEffectiveWorkdaysCount(selectedMonthKey);
  const [selectedYear, selectedMonth] = selectedMonthKey.split('-').map(Number);
  const autoDays = countWorkdaysInMonth(selectedYear, selectedMonth - 1);
  const progressPct = goal > 0 ? Math.min(100, Math.round((monthSales / goal) * 100)) : 0;
  const selectedMonthLabel = formatMonthLabel(selectedMonthKey);
  const expectedDaily = goal > 0 ? goal / effectiveDays : 0;
  const user = STATE.currentUser || {};
  const rawUserEmail = user.email || '';
  const userEmail = escapeHtml(rawUserEmail || 'Sin correo');
  const displayName = escapeHtml(getUserDisplayName(user));
  const progressLabel = goal > 0
    ? `${fmtEUR(monthSales)} de ${fmtEUR(goal)} · ${progressPct}%`
    : `${fmtEUR(monthSales)} · sin meta`;

  const isCompleted = goal > 0 && monthSales >= goal;
  const badgeHtml = goal > 0
    ? (isCompleted
      ? `<div class="goal-preview-pill pill-success">🔥 Meta 100% superada</div>`
      : `<div class="goal-preview-pill pill-progress">⚡ ${fmtEUR(goal - monthSales)} restantes</div>`)
    : `<div class="goal-preview-pill pill-none">Sin meta definida</div>`;

  const bodyHtml = `
    <div class="profile-panel profile-panel--wide">
      <section class="profile-hero profile-hero--compact">
        <div class="profile-hero-glow" aria-hidden="true"></div>
        ${renderUserAvatarHtml(user, { size: 'lg' })}
        <div class="profile-hero-text">
          <p class="profile-hero-kicker">Tu cuenta</p>
          <h4 class="profile-hero-name">${displayName}</h4>
          <p class="profile-hero-email">${userEmail}</p>
        </div>
        <div class="profile-hero-progress">
          <div class="profile-progress-head">
            <span id="profile-hero-month">${escapeHtml(selectedMonthLabel)}</span>
            <strong id="profile-hero-progress-label">${escapeHtml(progressLabel)}</strong>
          </div>
          <div class="profile-progress-track" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100">
            <div class="profile-progress-fill" style="width:${progressPct}%"></div>
          </div>
        </div>
      </section>

      <div class="profile-main-grid">
        <section class="profile-section profile-section--goal">
          <span class="profile-section-badge profile-section-badge--goal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            Objetivo mensual
          </span>
          <p class="profile-section-desc">Define la meta del mes seleccionado. El dashboard la usará al filtrar por ese periodo.</p>
          <div class="profile-goal-inputs-grid">
            <label class="profile-field">
              <span>Mes</span>
              <input type="month" id="profile-goal-month" value="${selectedMonthKey}">
            </label>
            <label class="profile-field profile-field--goal-input">
              <span>Meta mensual (€)</span>
              <div class="profile-input-wrap">
                <span class="profile-input-prefix">€</span>
                <input type="number" id="profile-goal" min="0" step="100" value="${goal || ''}" placeholder="Ej. 20000">
              </div>
            </label>
            <label class="profile-field profile-field--goal-workdays">
              <span>Días de trabajo (opcional)</span>
              <div class="profile-input-wrap">
                <input type="number" id="profile-goal-workdays" min="1" max="31" step="1" value="${customWorkdays || ''}" placeholder="Auto: ${autoDays}d">
              </div>
            </label>
          </div>
          <div class="profile-goal-card" id="profile-goal-preview">
            <div class="goal-card-header">
              <div class="goal-card-main">
                <span class="goal-card-month">${escapeHtml(selectedMonthLabel)}</span>
                <div class="goal-card-amount">${fmtEUR(monthSales)}</div>
                <div class="goal-card-meta">
                  ${goal ? `<b>${progressPct}% de tu meta</b> · Cuota estimada: <b>${fmtEUR(expectedDaily)}/día</b> (${customWorkdays !== null ? `personalizado: ${effectiveDays}d` : `auto: ${effectiveDays}d`})` : 'Sin meta guardada para este mes'}
                </div>
              </div>
              ${badgeHtml}
            </div>
            ${goal ? `
              <div class="goal-card-track">
                <div class="goal-card-track-fill" style="width:${Math.min(100, progressPct)}%; background: ${isCompleted ? 'linear-gradient(90deg, #F5A623, #00E676)' : 'linear-gradient(90deg, #F5A623, #FFD166)'};"></div>
              </div>
              <div class="goal-card-track-labels">
                <span>Vendido: <b>${fmtEUR(monthSales)}</b></span>
                <span>Objetivo: <b>${fmtEUR(goal)}</b></span>
              </div>
            ` : ''}
          </div>
        </section>

        <section class="profile-section profile-section--history">
          <span class="profile-section-badge profile-section-badge--history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Historial de metas
          </span>
          <p class="profile-section-desc">Consulta meses anteriores y pulsa uno para editarlo.</p>
          <div id="profile-goal-history-wrap">${renderGoalHistoryHtml(selectedMonthKey)}</div>
        </section>

        <section class="profile-section profile-section--security">
          <span class="profile-section-badge profile-section-badge--lock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Seguridad
          </span>
          <p class="profile-section-desc">Mantén tu cuenta protegida. Usa una contraseña segura que no compartas con nadie.</p>
          <input class="profile-autofill-username" type="email" name="username" autocomplete="username" value="${escapeHtml(rawUserEmail)}" readonly tabindex="-1" aria-hidden="true">
          <div class="profile-fields profile-fields--security">
            <div class="profile-security-grid">
              <label class="profile-field">
                <span>Nueva contraseña</span>
                <div class="profile-input-wrap">
                  <svg class="profile-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type="password" id="profile-password" name="new-password" placeholder="Mín. 6 caracteres" autocomplete="new-password">
                  <button type="button" class="profile-pw-toggle" onclick="togglePasswordVisibility(this)" aria-label="Mostrar contraseña">
                    <svg class="pw-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="pw-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </label>
              <label class="profile-field">
                <span>Confirmar contraseña</span>
                <div class="profile-input-wrap">
                  <svg class="profile-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type="password" id="profile-password-confirm" name="new-password-confirm" placeholder="Repite la contraseña" autocomplete="new-password">
                  <button type="button" class="profile-pw-toggle" onclick="togglePasswordVisibility(this)" aria-label="Mostrar contraseña">
                    <svg class="pw-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    <svg class="pw-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  </button>
                </div>
              </label>
            </div>
          </div>
          <div class="profile-pw-tips">
            <div class="profile-pw-tip profile-pw-tip--done">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Mín. 6 caracteres obligatorio</span>
            </div>
          </div>
          <div id="profile-password-error" class="profile-password-error"></div>
          <div class="profile-password-help">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>La contraseña debe tener mínimo 6 caracteres. Te pediremos la actual al cambiar desde la app normalmente.</span>
          </div>
          <button class="btn btn-secondary profile-password-btn" id="profile-password-btn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Cambiar contraseña
          </button>
        </section>
      </div>
    </div>
  `;

  openModal({
    title: 'Mi perfil y ajustes',
    width: '1420px',
    sizeClass: 'profile-modal',
    bodyHtml,
    footHtml: `
      <button class="btn btn-ghost" id="profile-cancel-btn">Cancelar</button>
      <button class="btn btn-primary" id="profile-save-btn">Guardar perfil</button>
    `,
  });

  document.getElementById('profile-cancel-btn').addEventListener('click', closeModal);

  const monthInput = document.getElementById('profile-goal-month');
  const goalInput = document.getElementById('profile-goal');
  const workdaysInput = document.getElementById('profile-goal-workdays');
  const historyWrap = document.getElementById('profile-goal-history-wrap');

  monthInput?.addEventListener('change', () => {
    renderProfileGoalPreview(monthInput.value);
  });

  const updateLivePreview = () => {
    const monthKey = monthInput?.value || selectedMonthKey;
    const draftGoal = Math.max(0, Number(goalInput?.value) || 0);
    const draftWorkdaysVal = workdaysInput?.value;
    const [y, m] = monthKey.split('-').map(Number);
    const autoD = y && m ? countWorkdaysInMonth(y, m - 1) : 22;
    const draftDays = (draftWorkdaysVal !== '' && draftWorkdaysVal !== undefined)
      ? Math.max(1, Math.min(31, Number(draftWorkdaysVal) || 0))
      : autoD;

    const monthSales = getMonthSales(monthKey);
    const progressPct = draftGoal > 0 ? Math.min(100, Math.round((monthSales / draftGoal) * 100)) : 0;
    const expectedD = draftGoal > 0 ? draftGoal / draftDays : 0;

    const preview = document.getElementById('profile-goal-preview');
    const isCompleted = draftGoal > 0 && monthSales >= draftGoal;
    const badgeHtml = draftGoal > 0
      ? (isCompleted
        ? `<div class="goal-preview-pill pill-success">🔥 Meta 100% superada</div>`
        : `<div class="goal-preview-pill pill-progress">⚡ ${fmtEUR(draftGoal - monthSales)} restantes</div>`)
      : `<div class="goal-preview-pill pill-none">Sin meta definida</div>`;

    if (preview) {
      preview.innerHTML = `
        <div class="goal-card-header">
          <div class="goal-card-main">
            <span class="goal-card-month">${escapeHtml(formatMonthLabel(monthKey))}</span>
            <div class="goal-card-amount">${fmtEUR(monthSales)}</div>
            <div class="goal-card-meta">
              ${draftGoal ? `<b>${progressPct}% de tu meta</b> · Cuota estimada: <b>${fmtEUR(expectedD)}/día</b> (${draftWorkdaysVal ? `personalizado: ${draftDays}d` : `auto: ${draftDays}d`})` : 'Sin meta guardada para este mes'}
            </div>
          </div>
          ${badgeHtml}
        </div>
        ${draftGoal ? `
          <div class="goal-card-track">
            <div class="goal-card-track-fill" style="width:${Math.min(100, progressPct)}%; background: ${isCompleted ? 'linear-gradient(90deg, #F5A623, #00E676)' : 'linear-gradient(90deg, #F5A623, #FFD166)'};"></div>
          </div>
          <div class="goal-card-track-labels">
            <span>Vendido: <b>${fmtEUR(monthSales)}</b></span>
            <span>Objetivo: <b>${fmtEUR(draftGoal)}</b></span>
          </div>
        ` : ''}
      `;
    }
  };

  goalInput?.addEventListener('input', updateLivePreview);
  workdaysInput?.addEventListener('input', updateLivePreview);

  historyWrap?.addEventListener('click', (event) => {
    const row = event.target.closest('.profile-goal-history-row');
    if (!row?.dataset.month || !monthInput) return;
    monthInput.value = row.dataset.month;
    renderProfileGoalPreview(row.dataset.month);
  });

  const changePasswordBtn = document.getElementById('profile-password-btn');

  changePasswordBtn.addEventListener('click', async () => {
    const passwordInput = document.getElementById('profile-password');
    const passwordConfirmInput = document.getElementById('profile-password-confirm');
    const passwordError = document.getElementById('profile-password-error');
    const nextPassword = passwordInput.value.trim();
    const nextPasswordConfirm = passwordConfirmInput.value.trim();

    passwordError.textContent = '';

    if (nextPassword.length < 6) {
      passwordError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      passwordInput.focus();
      return;
    }
    if (nextPassword !== nextPasswordConfirm) {
      passwordError.textContent = 'Las contraseñas no coinciden.';
      passwordConfirmInput.focus();
      return;
    }

    changePasswordBtn.disabled = true;
    try {
      const updatedUser = await AUTH.updatePassword(nextPassword);
      if (AUTH.markInvitePasswordComplete) AUTH.markInvitePasswordComplete(updatedUser?.email || rawUserEmail);
      passwordInput.value = '';
      passwordConfirmInput.value = '';
      passwordError.textContent = '';
      toast('Contraseña cambiada.', 'success');
    } catch (err) {
      passwordError.textContent = err?.message || 'No se pudo cambiar la contraseña.';
    } finally {
      changePasswordBtn.disabled = false;
    }
  });

  document.getElementById('profile-save-btn').addEventListener('click', async () => {
    const monthKey = document.getElementById('profile-goal-month').value;
    const goalVal = document.getElementById('profile-goal').value;
    const workdaysVal = document.getElementById('profile-goal-workdays').value;
    const saveBtn = document.getElementById('profile-save-btn');
    saveBtn.disabled = true;
    try {
      await saveMonthlyGoalForMonth(monthKey, goalVal, workdaysVal);
      const historyWrapEl = document.getElementById('profile-goal-history-wrap');
      if (historyWrapEl) historyWrapEl.innerHTML = renderGoalHistoryHtml(monthKey);
      closeModal();
      renderDashboard();
      toast(`Meta de ${formatMonthLabel(monthKey)} guardada.`, 'success');
    } catch (err) {
      toast(err?.message || 'No se pudo guardar la meta mensual.', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function wireProfilePanel() {
  const btn = document.getElementById('profile-settings-btn');
  if (btn && btn.dataset.profileWired !== '1') {
    btn.dataset.profileWired = '1';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  document.querySelectorAll('[data-open-profile="1"]').forEach((el) => {
    if (el.dataset.wired === '1') return;
    el.dataset.wired = '1';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTopbarUserMenu(false);
      openProfileSettings();
    });
  });
}

function toggleTopbarUserMenu(force) {
  const wrap = document.querySelector('.topbar-user');
  const menu = document.querySelector('.topbar-user-menu');
  if (!wrap || !menu) return;
  const next = typeof force === 'boolean' ? force : !menu.classList.contains('open');
  menu.classList.toggle('open', next);
  wrap.classList.toggle('open', next);
}

function closeTopbarUserMenuOnOutside(e) {
  const wrap = document.querySelector('.topbar-user');
  if (!wrap || wrap.contains(e.target)) return;
  toggleTopbarUserMenu(false);
}

function wireTopbarUserMenu() {
  const btn = document.getElementById('profile-settings-btn');
  if (!btn || btn.dataset.menuWired === '1') return;
  btn.dataset.menuWired = '1';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTopbarUserMenu();
  });
  document.addEventListener('click', closeTopbarUserMenuOnOutside);
  const cuadBtn = document.getElementById('tbm-cuadrante-btn');
  if (cuadBtn && cuadBtn.dataset.wired !== '1') {
    cuadBtn.dataset.wired = '1';
    cuadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTopbarUserMenu(false);
      if (typeof switchView === 'function') switchView('cuadrante');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireProfilePanel();
  wireTopbarUserMenu();
});
window.openProfileSettings = openProfileSettings;
window.togglePasswordVisibility = function (btn) {
  const input = btn.previousElementSibling;
  const eye = btn.querySelector('.pw-eye');
  const eyeOff = btn.querySelector('.pw-eye-off');

  if (input && input.tagName === 'INPUT') {
    if (input.type === 'password') {
      input.type = 'text';
      if (eye) eye.style.display = 'none';
      if (eyeOff) eyeOff.style.display = 'block';
    } else {
      input.type = 'password';
      if (eye) eye.style.display = 'block';
      if (eyeOff) eyeOff.style.display = 'none';
    }
  }
};
