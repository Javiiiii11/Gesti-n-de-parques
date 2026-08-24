/* ============================================================================
   dashboard.js — vista "Dashboard"
============================================================================ */

let chartPeriodo = null;
let chartParques = null;
let chartObjetivo = null;
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
    .filter((venta) => isMismoMes(venta.fecha, ref))
    .reduce((acc, venta) => acc + Number(venta.importe_total || 0), 0);
}

function getMonthlyGoalForMonth(monthKey) {
  const entry = (STATE.objetivosMensuales || []).find((row) => row.mes === monthKey);
  return Math.max(0, Number(entry?.importe) || 0);
}

async function saveMonthlyGoalForMonth(monthKey, value) {
  const saved = await DB.setObjetivoMensual(monthKey, value);
  const list = STATE.objetivosMensuales || [];
  const idx = list.findIndex((row) => row.mes === monthKey);
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
  STATE.objetivosMensuales = list.sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  return saved;
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
    const name = parqueNombre(venta.parque_id);
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
  const goalMonthKey = getGoalMonthKeyFromFilters(filters, referenceDate);
  const goal = getMonthlyGoalForMonth(goalMonthKey);
  const goalMonthLabel = formatMonthLabel(goalMonthKey);

  const sum = (arr, key) => arr.reduce((acc, venta) => acc + Number(venta[key] || 0), 0);
  
  // Calculate stats from filtered data
  const filteredTotal = sum(filtradas, 'importe_total');
  const filteredCount = filtradas.length;
  
  // Get sales by park from filtered data
  const filteredSalesByPark = {};
  filtradas.forEach((venta) => {
    const name = parqueNombre(venta.parque_id);
    if (!filteredSalesByPark[name]) filteredSalesByPark[name] = { ventas: 0, total: 0 };
    filteredSalesByPark[name].ventas += 1;
    filteredSalesByPark[name].total += Number(venta.importe_total) || 0;
  });
  
  const topParkEntry = Object.entries(filteredSalesByPark).sort((a, b) => b[1].ventas - a[1].ventas)[0];
  const topParkName = topParkEntry ? topParkEntry[0] : '—';
  const topParkEntries = topParkEntry ? topParkEntry[1].ventas : 0;
  const topParkRevenue = topParkEntry ? topParkEntry[1].total : 0;
  
  // Calculate average per sale in filtered data
  const averagePerSale = filteredCount ? filteredTotal / filteredCount : 0;
  
  // Ventas del día de referencia dentro del periodo seleccionado
  const referenceDay = toDateInputValue(referenceDate);
  const ventasHoy = STATE.ventas.filter((venta) => isSameLocalDay(venta.fecha, referenceDay));
  const totalHoy = sum(ventasHoy, 'importe_total');
  const countHoy = ventasHoy.length;

  // Get first and last sale in filtered data
  const firstFilteredSale = filtradas.length ? filtradas.reduce((min, venta) => new Date(venta.fecha) < new Date(min.fecha) ? venta : min, filtradas[0]) : null;
  const lastFilteredSale = filtradas.length ? filtradas.reduce((max, venta) => new Date(venta.fecha) > new Date(max.fecha) ? venta : max, filtradas[0]) : null;
  const daysInFilter = firstFilteredSale && lastFilteredSale ? daysBetweenInclusive(firstFilteredSale.fecha, lastFilteredSale.fecha) : 0;
  const dailyAverageFiltered = daysInFilter ? filteredTotal / daysInFilter : 0;

  const filteredSummary = buildDashboardFilterSummary(filters, filtradas.length);
  
  // Meta y métricas calculadas sobre el mes del periodo seleccionado
  const mesReferencia = STATE.ventas.filter((venta) => isMismoMes(venta.fecha, referenceDate));
  const currentMonthSales = sum(mesReferencia, 'importe_total');
  const goalRemaining = Math.max(0, goal - currentMonthSales);
  const goalProgress = goal > 0 ? Math.min(100, (currentMonthSales / goal) * 100) : 0;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth();
  const isCurrentReferenceMonth = referenceYear === now.getFullYear() && referenceMonth === now.getMonth();
  const referenceDayNumber = isCurrentReferenceMonth ? now.getDate() : daysInMonth(referenceYear, referenceMonth);

  // Días laborables reales del mes de referencia (excluye fines de semana)
  const actualMonthWorkdays = countWorkdaysInMonth(referenceYear, referenceMonth);
  const workdaysElapsed = countWorkdaysElapsed(referenceYear, referenceMonth, referenceDayNumber);
  const workdaysRemaining = isCurrentReferenceMonth
    ? countWorkdaysRemaining(referenceYear, referenceMonth, referenceDayNumber)
    : 0;

  // Meta base: objetivo / días laborables reales del mes
  const expectedDailyGoal = goal / actualMonthWorkdays;
  // Ritmo actual / media diaria del mes seleccionado
  const currentPace = workdaysElapsed > 0 ? currentMonthSales / workdaysElapsed : 0;
  const averageDailyMonthSales = currentPace;
  // Cálculo dinámico: lo que falta repartido entre los días pendientes
  const missingPerWorkingDay = workdaysRemaining > 0 ? goalRemaining / workdaysRemaining : goalRemaining;
  const dailyGoalRemaining = missingPerWorkingDay;
  const workdaysLeft = workdaysRemaining;
  const workdaysTotal = actualMonthWorkdays;

  // Ventas de la semana de la fecha de referencia
  const inicioSemana = new Date(referenceDate);
  inicioSemana.setDate(referenceDate.getDate() - (referenceDate.getDay() || 7) + 1);
  inicioSemana.setHours(0, 0, 0, 0);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 7);
  const ventasSemana = STATE.ventas.filter((venta) => {
    const fechaVenta = new Date(venta.fecha);
    return fechaVenta >= inicioSemana && fechaVenta < finSemana;
  });
  const totalSemana = sum(ventasSemana, 'importe_total');
  const countSemana = ventasSemana.length;

  document.getElementById('dashboard-filter-summary').textContent = filteredSummary;

  const stats = [
    { label: 'Total en filtro', value: fmtEUR(filteredTotal), sub: `${fmtNum(filteredCount)} entradas`, icon: 'M12 8v8M8 12h8' },
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
  renderRankingParques(filtradas);
}

function buildDashboardFilterSummary(filters, totalFiltered) {
  const periodLabel = filters.period === 'day' ? `Día ${filters.value}` : filters.period === 'month' ? `Mes ${filters.value}` : filters.period === 'year' ? `Año ${filters.year}` : 'Todo el histórico';
  const parkLabel = filters.parqueId === 'all' ? 'Todos los parques' : parqueNombre(filters.parqueId);
  return `${periodLabel} · ${parkLabel} · ${fmtNum(totalFiltered)} ventas en el filtro`;
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
  const remaining = Math.max(0, goal - currentMonthSales);
  const palette = chartPalette();
  chartObjetivo = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Vendido', 'Pendiente'],
      datasets: [{
        data: [currentMonthSales, remaining],
        backgroundColor: [palette.accent, palette.grid],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx2) => `${ctx2.label}: ${fmtEUR(ctx2.parsed)}` } },
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

  // Estado visual según si la cuota diaria sube o baja respecto a la meta original
  const quotaState = missingPerWorkingDay > expectedDailyGoal && expectedDailyGoal > 0 ? 'up' : (missingPerWorkingDay < expectedDailyGoal && expectedDailyGoal > 0 ? 'down' : 'on');
  const quotaStateColor = quotaState === 'up' ? '#F5A623' : quotaState === 'down' ? '#00E676' : 'var(--accent)';
const quotaStateLabel =
    quotaState === 'up'
        ? '🚀 Has vendido menos de lo previsto, ¡sube la cuota!'
        : quotaState === 'down'
            ? '🔥 ¡Vas por delante! Sigue así 💪🏻'
            : '👍🏻 Vas al ritmo esperado';
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
        <span>Lo que falta</span>
        <b class="goal-remaining">${fmtEUR(goalRemaining)}</b>
      </div>
      <div class="goal-progress-bar">
        <div class="goal-progress-fill" style="width:${percentage}%"></div>
      </div>
      <div class="goal-progress-meta">${percentage.toFixed(1)}% completado</div>

      <div class="goal-mini-grid">
        <div class="goal-mini-card goal-mini-card-primary">
          <span>Cuota / día restante</span>
          <b>${fmtEUR(missingPerWorkingDay)}</b>
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

      <div class="goal-status-note" style="background:${quotaStateColor}14; color:${quotaStateColor}; border-color:${quotaStateColor}33;">
        ${quotaStateLabel}
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

function renderRankingParques(ventas) {
  const grouped = {};
  ventas.forEach((venta) => {
    const name = parqueNombre(venta.parque_id);
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

  const container = document.getElementById('ranking-parques');
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
  const progressPct = goal > 0 ? Math.min(100, Math.round((monthSales / goal) * 100)) : 0;
  const monthLabel = formatMonthLabel(monthKey);

  const preview = document.getElementById('profile-goal-preview');
  const goalInput = document.getElementById('profile-goal');
  const barWrap = document.getElementById('profile-goal-bar-wrap');
  const heroMonth = document.getElementById('profile-hero-month');
  const heroProgress = document.getElementById('profile-hero-progress-label');
  const heroBar = document.querySelector('.profile-progress-fill');

  if (goalInput) {
    goalInput.value = goal || '';
  }

  if (preview) {
    preview.innerHTML = `
      <span>${escapeHtml(monthLabel)}</span>
      <strong>${fmtEUR(monthSales)}</strong>
      <small>${goal ? `${progressPct}% de tu meta` : 'Sin meta guardada para este mes'}</small>
    `;
  }

  if (barWrap) {
    barWrap.innerHTML = goal ? `
      <div class="profile-goal-bar">
        <div class="profile-goal-bar-fill" style="width:${progressPct}%"></div>
      </div>
      <div class="profile-goal-bar-labels">
        <span>${fmtEUR(monthSales)}</span>
        <span>${fmtEUR(goal)}</span>
      </div>
    ` : '';
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
        return `
          <button type="button" class="profile-goal-history-row ${entry.mes === activeMonthKey ? 'is-active' : ''}" data-month="${escapeHtml(entry.mes)}">
            <span class="profile-goal-history-month">${escapeHtml(formatMonthLabel(entry.mes))}</span>
            <span class="profile-goal-history-meta">${fmtEUR(sales)} / ${fmtEUR(goal)} · ${pct}%</span>
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
  const progressPct = goal > 0 ? Math.min(100, Math.round((monthSales / goal) * 100)) : 0;
  const selectedMonthLabel = formatMonthLabel(selectedMonthKey);
  const user = STATE.currentUser || {};
  const rawUserEmail = user.email || '';
  const userEmail = escapeHtml(rawUserEmail || 'Sin correo');
  const displayName = escapeHtml(getUserDisplayName(user));
  const progressLabel = goal > 0
    ? `${fmtEUR(monthSales)} de ${fmtEUR(goal)} · ${progressPct}%`
    : `${fmtEUR(monthSales)} · sin meta`;

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
          <div class="profile-fields profile-fields--goal">
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
            <div class="profile-goal-preview" id="profile-goal-preview">
              <span>${escapeHtml(selectedMonthLabel)}</span>
              <strong>${fmtEUR(monthSales)}</strong>
              <small>${goal ? `${progressPct}% de tu meta` : 'Sin meta guardada'}</small>
            </div>
          </div>
          <div id="profile-goal-bar-wrap">
            ${goal ? `
              <div class="profile-goal-bar">
                <div class="profile-goal-bar-fill" style="width:${progressPct}%"></div>
              </div>
              <div class="profile-goal-bar-labels">
                <span>${fmtEUR(monthSales)}</span>
                <span>${fmtEUR(goal)}</span>
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
  const historyWrap = document.getElementById('profile-goal-history-wrap');

  monthInput?.addEventListener('change', () => {
    renderProfileGoalPreview(monthInput.value);
  });
  goalInput?.addEventListener('input', () => {
    const monthKey = monthInput?.value || selectedMonthKey;
    const draftGoal = Math.max(0, Number(goalInput.value) || 0);
    const monthSales = getMonthSales(monthKey);
    const progressPct = draftGoal > 0 ? Math.min(100, Math.round((monthSales / draftGoal) * 100)) : 0;
    const preview = document.getElementById('profile-goal-preview');
    if (preview) {
      preview.innerHTML = `
        <span>${escapeHtml(formatMonthLabel(monthKey))}</span>
        <strong>${fmtEUR(monthSales)}</strong>
        <small>${draftGoal ? `${progressPct}% de tu meta` : 'Sin meta guardada para este mes'}</small>
      `;
    }
  });
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
    const saveBtn = document.getElementById('profile-save-btn');
    saveBtn.disabled = true;
    try {
      await saveMonthlyGoalForMonth(monthKey, document.getElementById('profile-goal').value);
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
}

document.addEventListener('DOMContentLoaded', () => {
  wireProfilePanel();
  wireTopbarUserMenu();
});
window.openProfileSettings = openProfileSettings;
window.togglePasswordVisibility = function(btn) {
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
