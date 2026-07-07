/* ============================================================================
   estadisticas.js — vista "Estadísticas"
============================================================================ */

let chartMensual = null;
let chartPorParque = null;
let chartDiaSemana = null;

function initEstadisticasView() {
  document.getElementById('stats-periodo').addEventListener('change', renderEstadisticas);
}

function getVentasPeriodo() {
  const val = document.getElementById('stats-periodo').value;
  if (val === 'all') return STATE.ventas;
  const days = Number(val);
  const limite = new Date(); limite.setDate(limite.getDate() - days);
  return STATE.ventas.filter((v) => new Date(v.fecha) >= limite);
}

function renderEstadisticas() {
  const ventas = getVentasPeriodo();
  renderChartMensual();
  renderChartPorParque(ventas);
  renderChartDiaSemana(ventas);
  renderRankingDias(ventas);
  renderComparativaMensual();
}

function chartColorsStats() { return chartColors(); }

function renderChartMensual() {
  if (typeof Chart === 'undefined') return;
  const c = chartColorsStats();
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    meses.push(d);
  }
  const ingresos = meses.map((m) => STATE.ventas.filter((v) => isMismoMes(v.fecha, m)).reduce((a, v) => a + Number(v.importe_total), 0));
  const labels = meses.map((m) => m.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));

  const ctx = document.getElementById('chart-mensual').getContext('2d');
  if (chartMensual) chartMensual.destroy();
  chartMensual = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Ingresos', data: ingresos, backgroundColor: c.accent, borderRadius: 4, maxBarThickness: 26 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: c.text, boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx2) => `${ctx2.dataset.label}: ${fmtEUR(ctx2.parsed.y)}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
        y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 }, callback: (v) => v + '€' } },
      },
    },
  });
}

function renderChartPorParque(ventas) {
  if (typeof Chart === 'undefined') return;
  const c = chartColorsStats();
  const porParque = {};
  ventas.forEach((v) => { const n = parqueNombre(v.parque_id); porParque[n] = (porParque[n] || 0) + Number(v.importe_total); });
  const entries = Object.entries(porParque).sort((a, b) => b[1] - a[1]);

  const ctx = document.getElementById('chart-por-parque').getContext('2d');
  if (chartPorParque) chartPorParque.destroy();
  chartPorParque = new Chart(ctx, {
    type: 'bar',
    data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: c.palette, borderRadius: 4 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx2) => fmtEUR(ctx2.parsed.x) } } },
      scales: {
        x: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 }, callback: (v) => v + '€' } },
        y: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
      },
    },
  });
}

function renderChartDiaSemana(ventas) {
  if (typeof Chart === 'undefined') return;
  const c = chartColorsStats();
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const totals = new Array(7).fill(0);
  ventas.forEach((v) => { const idx = (new Date(v.fecha).getDay() + 6) % 7; totals[idx] += Number(v.importe_total); });

  const ctx = document.getElementById('chart-dia-semana').getContext('2d');
  if (chartDiaSemana) chartDiaSemana.destroy();
  chartDiaSemana = new Chart(ctx, {
    type: 'bar',
    data: { labels: dias, datasets: [{ data: totals, backgroundColor: c.accent, borderRadius: 6, maxBarThickness: 36 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx2) => fmtEUR(ctx2.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } },
        y: { grid: { color: c.grid }, ticks: { color: c.text, font: { size: 11 }, callback: (v) => v + '€' } },
      },
    },
  });
}

function renderRankingDias(ventas) {
  const porDia = {};
  ventas.forEach((v) => {
    const key = new Date(v.fecha).toISOString().slice(0, 10);
    porDia[key] = (porDia[key] || 0) + Number(v.importe_total);
  });
  const entries = Object.entries(porDia).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = entries.length ? entries[0][1] : 1;
  const container = document.getElementById('ranking-dias');

  if (!entries.length) { container.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No hay datos suficientes en este periodo.</p>'; return; }

  container.innerHTML = entries.map(([fecha, total], i) => `
    <div class="ranking-row">
      <div class="pos">${i + 1}</div>
      <div style="flex:1; min-width:0;">
        <div class="rr-name">${fmtDateShort(fecha)}</div>
        <div class="rr-bar"><div class="rr-bar-fill" style="width:${(total / max) * 100}%"></div></div>
      </div>
      <div class="rr-val">${fmtEUR(total)}</div>
    </div>`).join('');
}

function renderComparativaMensual() {
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    meses.push(d);
  }
  const filas = meses.map((m, idx) => {
    const ventasMes = STATE.ventas.filter((v) => isMismoMes(v.fecha, m));
    const ingresos = ventasMes.reduce((a, v) => a + Number(v.importe_total), 0);
    const ventasCount = ventasMes.length;
    const media = ventasCount ? ingresos / ventasCount : 0;
    return { mes: m, ingresos, ventasCount, media };
  });

  const tbody = document.getElementById('comparativa-tbody');
  tbody.innerHTML = filas.map((f, idx) => {
    let variacion = '—';
    if (idx > 0) {
      const prev = filas[idx - 1].ingresos;
      if (prev > 0) {
        const pct = ((f.ingresos - prev) / prev) * 100;
        variacion = `<span style="color:${pct >= 0 ? 'var(--success)' : 'var(--danger)'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span>`;
      } else if (f.ingresos > 0) {
        variacion = `<span style="color:var(--success)">▲ nuevo</span>`;
      }
    }
    return `
      <tr>
        <td><b>${f.mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</b></td>
        <td class="amount">${fmtNum(f.ventasCount)}</td>
        <td class="amount">${fmtEUR(f.ingresos)}</td>
        <td class="amount">${fmtEUR(f.media)}</td>
        <td>${variacion}</td>
      </tr>`;
  }).join('');
}
