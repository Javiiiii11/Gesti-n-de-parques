/* ============================================================================
   dashboard.js — vista "Dashboard"
============================================================================ */

let chartEvolucion = null;
let chartParquesMes = null;

const MONTHLY_GOAL_KEY = 'parksales_objetivo_mensual';
function getMonthlyGoal() { return Number(localStorage.getItem(MONTHLY_GOAL_KEY)) || 3000; }
function setMonthlyGoal(v) { localStorage.setItem(MONTHLY_GOAL_KEY, v); }

function renderDashboard() {
  const now = new Date();
  const ventasHoy = STATE.ventas.filter((v) => isMismoDia(v.fecha, now));
  const ventasSemana = STATE.ventas.filter((v) => isMismaSemana(v.fecha, now));
  const ventasMes = STATE.ventas.filter((v) => isMismoMes(v.fecha, now));

  const sum = (arr, key) => arr.reduce((acc, v) => acc + Number(v[key] || 0), 0);
  const totalAcumulado = sum(STATE.ventas, 'importe_total');
  const totalVentas = STATE.ventas.length;
  const promedioVenta = totalVentas ? totalAcumulado / totalVentas : 0;

  const porParque = {};
  const porCliente = {};
  STATE.ventas.forEach((v) => {
    porParque[v.parque_id] = porParque[v.parque_id] || [];
    porParque[v.parque_id].push(Number(v.importe_total) || 0);
    const cliente = v.cliente_nombre || 'Cliente';
    porCliente[cliente] = (porCliente[cliente] || 0) + Number(v.importe_total || 0);
  });
  const topParqueId = Object.keys(porParque).sort((a, b) => sumBy(porParque[b]) - sumBy(porParque[a]))[0];
  const topParqueNombre = topParqueId ? parqueNombre(topParqueId) : '—';
  const topCliente = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0];

  const stats = [
    { label: 'Ventas de hoy', value: fmtEUR(sum(ventasHoy, 'importe_total')), sub: `${fmtNum(ventasHoy.length)} ventas`, icon: 'M12 8v8M8 12h8' },
    { label: 'Ventas de la semana', value: fmtEUR(sum(ventasSemana, 'importe_total')), sub: `${fmtNum(ventasSemana.length)} ventas`, icon: 'M3 6h18M3 12h18M3 18h18' },
    { label: 'Ventas del mes', value: fmtEUR(sum(ventasMes, 'importe_total')), sub: `${fmtNum(ventasMes.length)} ventas`, icon: 'M3 3v18h18' },
    { label: 'Total acumulado', value: fmtEUR(totalAcumulado), sub: `${fmtNum(totalVentas)} ventas totales`, icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { label: 'Venta media', value: fmtEUR(promedioVenta), sub: topCliente ? `Cliente top: ${topCliente[0]}` : 'Sin datos aún', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { label: 'Parque más vendido', value: topParqueNombre, sub: topParqueId ? `${fmtNum(sumBy(porParque[topParqueId]))} €` : 'Sin datos aún', icon: 'M3 21l7-14 4 8 3-5 4 11H3z' },
  ];

  document.getElementById('dashboard-stats').innerHTML = stats.map((s) => `
    <div class="stat-card">
      <div class="stat-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${s.icon}"/></svg>${escapeHtml(s.label)}</div>
      <div class="stat-value">${typeof s.value === 'string' && s.value.length > 14 ? escapeHtml(s.value) : s.value}</div>
      <div class="stat-sub">${escapeHtml(s.sub)}</div>
    </div>`).join('');

  renderChartEvolucion();
  renderChartParquesMes(ventasMes);
  renderRankingParques();
  renderGoalWidget(totalAcumulado, promedioVenta, topParqueNombre, topCliente);
}

function sumBy(values) {
  return values.reduce((acc, value) => acc + Number(value || 0), 0);
}

function chartColors() {
  const styles = getComputedStyle(document.body);
  return {
    accent: styles.getPropertyValue('--accent').trim() || '#F5A623',
    text: styles.getPropertyValue('--text-secondary').trim() || '#8B95AC',
    grid: styles.getPropertyValue('--border-soft').trim() || '#1C2740',
    palette: ['#F5A623', '#60A5FA', '#34D399', '#F87171', '#A78BFA', '#F472B6', '#38BDF8', '#FBBF24'],
  };
}

function renderChartEvolucion() {
  if (typeof Chart === 'undefined') return;
  const c = chartColors();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  const data = days.map((d) => STATE.ventas.filter((v) => isMismoDia(v.fecha, d)).reduce((acc, v) => acc + Number(v.importe_total), 0));
  const labels = days.map((d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }));

  const ctx = document.getElementById('chart-evolucion').getContext('2d');
  if (chartEvolucion) chartEvolucion.destroy();
  chartEvolucion = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Ingresos (€)', data,
      borderColor: c.accent, backgroundColor: 'rgba(245,166,35,0.12)',
      fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx2) => fmtEUR(ctx2.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.text, maxTicksLimit: 8, font: { size: 11 } } },
        y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 }, callback: (v) => v + '€' } },
      },
    },
  });
}

function renderChartParquesMes(ventasMes) {
  if (typeof Chart === 'undefined') return;
  const c = chartColors();
  const porParque = {};
  ventasMes.forEach((v) => { const n = parqueNombre(v.parque_id); porParque[n] = (porParque[n] || 0) + Number(v.importe_total); });
  const labels = Object.keys(porParque);
  const data = Object.values(porParque);

  const ctx = document.getElementById('chart-parques-mes').getContext('2d');
  if (chartParquesMes) chartParquesMes.destroy();

  if (!labels.length) {
    chartParquesMes = null;
    ctx.clearRect(0, 0, 400, 400);
    return;
  }

  chartParquesMes = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: c.palette, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, font: { size: 11 }, padding: 12 } },
        tooltip: { callbacks: { label: (ctx2) => `${ctx2.label}: ${fmtEUR(ctx2.parsed)}` } },
      },
    },
  });
}

function renderRankingParques() {
  const porParque = {};
  STATE.ventas.forEach((v) => {
    const nombre = parqueNombre(v.parque_id);
    if (!porParque[nombre]) porParque[nombre] = [];
    porParque[nombre].push(Number(v.importe_total) || 0);
  });
  const entries = Object.entries(porParque).map(([nombre, importes]) => {
    const ventas = importes.length;
    const total = sumBy(importes);
    const media = ventas ? total / ventas : 0;
    return { nombre, ventas, total, media };
  }).sort((a, b) => b.total - a.total).slice(0, 6);

  const container = document.getElementById('ranking-parques');
  if (!entries.length) { container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">Aún no hay ventas registradas.</p>'; return; }

  container.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr><th>Parque</th><th>Ventas</th><th>Media</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${entries.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.nombre)}</b></td>
              <td class="amount">${fmtNum(row.ventas)}</td>
              <td class="amount">${fmtEUR(row.media)}</td>
              <td class="amount">${fmtEUR(row.total)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderGoalWidget(totalAcumulado, promedioVenta, topParqueNombre, topCliente) {
  document.getElementById('goal-widget').innerHTML = `
    <div class="goal-card" style="align-items:flex-start; gap:16px;">
      <div style="flex:1;">
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:2px;">Resumen rápido</div>
        <div style="font-family:var(--font-display); font-weight:700; font-size:22px; margin-bottom:6px;">${fmtEUR(totalAcumulado)}</div>
        <div style="color:var(--text-muted); font-size:12.5px; line-height:1.6;">
          Media por venta: <b style="color:var(--text-primary);">${fmtEUR(promedioVenta)}</b><br>
          Parque top: <b style="color:var(--text-primary);">${escapeHtml(topParqueNombre || '—')}</b><br>
          Cliente top: <b style="color:var(--text-primary);">${escapeHtml(topCliente ? topCliente[0] : '—')}</b>
        </div>
      </div>
    </div>`;
}
