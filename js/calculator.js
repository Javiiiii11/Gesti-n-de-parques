/* ============================================================================
   calculator.js — Modal de Calculadora (Estándar + División de Entradas)
============================================================================ */

let calcCurrentInput = '0';
let calcPrevInput = null;
let calcOperator = null;
let calcShouldReset = false;
let calcKeydownListener = null;

function initCalculator() {
  const btn = document.getElementById('calc-toggle');
  if (btn) {
    btn.addEventListener('click', openCalculatorModal);
  }
}

function openCalculatorModal() {
  calcCurrentInput = '0';
  calcPrevInput = null;
  calcOperator = null;
  calcShouldReset = false;

  openModal({
    title: '🧮 Calculadora',
    bodyHtml: `
      <!-- Pestañas de la Calculadora -->
      <div style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:10px;">
        <button type="button" class="btn btn-sm btn-primary" id="tab-calc-std" style="flex:1;">Calculadora Normal</button>
        <button type="button" class="btn btn-sm btn-ghost" id="tab-calc-tickets" style="flex:1;">Calculadora de Entradas</button>
      </div>

      <!-- VISTA 1: CALCULADORA ESTÁNDAR -->
      <div id="calc-view-std">
        <div class="calc-display-wrap">
          <div class="calc-subdisplay" id="calc-subdisplay">&nbsp;</div>
          <div class="calc-display" id="calc-display">0</div>
        </div>
        <div class="calc-grid">
          <button class="calc-btn danger" data-calc="AC">AC</button>
          <button class="calc-btn fn" data-calc="DEL">⌫</button>
          <button class="calc-btn fn" data-calc="%">%</button>
          <button class="calc-btn op" data-calc="/">÷</button>

          <button class="calc-btn" data-calc="7">7</button>
          <button class="calc-btn" data-calc="8">8</button>
          <button class="calc-btn" data-calc="9">9</button>
          <button class="calc-btn op" data-calc="*">×</button>

          <button class="calc-btn" data-calc="4">4</button>
          <button class="calc-btn" data-calc="5">5</button>
          <button class="calc-btn" data-calc="6">6</button>
          <button class="calc-btn op" data-calc="-">−</button>

          <button class="calc-btn" data-calc="1">1</button>
          <button class="calc-btn" data-calc="2">2</button>
          <button class="calc-btn" data-calc="3">3</button>
          <button class="calc-btn op" data-calc="+">+</button>

          <button class="calc-btn zero" data-calc="0">0</button>
          <button class="calc-btn" data-calc=".">,</button>
          <button class="calc-btn equals" data-calc="=" style="grid-column: span 2;">=</button>
        </div>
      </div>

      <!-- VISTA 2: CALCULADORA DE ENTRADAS / DIVISIÓN -->
      <div id="calc-view-tickets" style="display:none;">
        <div class="form-grid" style="gap:14px;">
          <div class="form-field full">
            <label for="tcalc-total">Precio total del grupo (€)</label>
            <input type="number" step="0.01" min="0" id="tcalc-total" placeholder="Ej. 120.00" style="font-size:16px; font-weight:700;">
          </div>
          
          <div class="form-field full">
            <label for="tcalc-count">Número de personas / entradas</label>
            <input type="number" min="1" id="tcalc-count" value="1" style="font-size:16px; font-weight:700;">
            <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap; align-items:center;">
              <span style="font-size:12px; color:var(--text-muted); margin-right:4px;">Dividir entre:</span>
              <button type="button" class="sp-preset-pill tcalc-pill" data-persons="2">2 personas</button>
              <button type="button" class="sp-preset-pill tcalc-pill" data-persons="3">3 personas</button>
              <button type="button" class="sp-preset-pill tcalc-pill" data-persons="4">4 personas</button>
              <button type="button" class="sp-preset-pill tcalc-pill" data-persons="5">5 personas</button>
            </div>
          </div>

          <!-- Resultado -->
          <div class="card card-pad" style="background:var(--bg-elevated); border:1px solid var(--border); text-align:center; margin-top:4px;">
            <div style="font-size:11.5px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); margin-bottom:4px;">Precio individual por entrada</div>
            <div id="tcalc-result" style="font-size:30px; font-weight:800; color:var(--accent);">0.00 €</div>
            <div id="tcalc-subresult" style="font-size:12px; color:var(--text-secondary); margin-top:4px;">Indica precio y personas para calcular</div>
          </div>
        </div>
      </div>
    `,
    footHtml: `
      <button class="btn btn-ghost" id="calc-modal-close">Cerrar</button>
      <button class="btn btn-primary" id="calc-apply-price" style="display:none;">Usar este precio (€)</button>
    `
  });

  // Listener cerrar
  const btnClose = document.getElementById('calc-modal-close');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  // Pestañas
  const tabStd = document.getElementById('tab-calc-std');
  const tabTickets = document.getElementById('tab-calc-tickets');
  const viewStd = document.getElementById('calc-view-std');
  const viewTickets = document.getElementById('calc-view-tickets');
  const btnApply = document.getElementById('calc-apply-price');

  if (tabStd && tabTickets) {
    tabStd.addEventListener('click', () => {
      tabStd.className = 'btn btn-sm btn-primary';
      tabTickets.className = 'btn btn-sm btn-ghost';
      viewStd.style.display = 'block';
      viewTickets.style.display = 'none';
      if (btnApply) btnApply.style.display = 'none';
    });

    tabTickets.addEventListener('click', () => {
      tabTickets.className = 'btn btn-sm btn-primary';
      tabStd.className = 'btn btn-sm btn-ghost';
      viewStd.style.display = 'none';
      viewTickets.style.display = 'block';
      if (btnApply) btnApply.style.display = 'inline-flex';
      document.getElementById('tcalc-total')?.focus();
    });
  }

  wireStandardCalculator();
  wireTicketCalculator();
}

/* ---------- Lógica Calculadora Estándar ---------- */
function wireStandardCalculator() {
  const display = document.getElementById('calc-display');
  const subdisplay = document.getElementById('calc-subdisplay');
  const grid = document.querySelector('.calc-grid');

  if (!display || !grid) return;

  function updateDisplay() {
    display.textContent = calcCurrentInput.replace('.', ',');
    if (calcOperator && calcPrevInput !== null) {
      const opSym = { '/': '÷', '*': '×', '-': '−', '+': '+' }[calcOperator] || calcOperator;
      subdisplay.textContent = `${calcPrevInput.replace('.', ',')} ${opSym}`;
    } else {
      subdisplay.innerHTML = '&nbsp;';
    }
  }

  function handleInput(val) {
    if (val === 'AC') {
      calcCurrentInput = '0';
      calcPrevInput = null;
      calcOperator = null;
      calcShouldReset = false;
    } else if (val === 'DEL') {
      if (calcCurrentInput.length > 1) {
        calcCurrentInput = calcCurrentInput.slice(0, -1);
      } else {
        calcCurrentInput = '0';
      }
    } else if (val === '%') {
      const num = parseFloat(calcCurrentInput) || 0;
      calcCurrentInput = String(num / 100);
    } else if (['+', '-', '*', '/'].includes(val)) {
      if (calcOperator && !calcShouldReset && calcPrevInput !== null) {
        calculateResult();
      }
      calcPrevInput = calcCurrentInput;
      calcOperator = val;
      calcShouldReset = true;
    } else if (val === '=') {
      if (calcOperator && calcPrevInput !== null) {
        calculateResult();
        calcOperator = null;
        calcPrevInput = null;
        calcShouldReset = true;
      }
    } else if (val === '.') {
      if (calcShouldReset) {
        calcCurrentInput = '0.';
        calcShouldReset = false;
      } else if (!calcCurrentInput.includes('.')) {
        calcCurrentInput += '.';
      }
    } else {
      // DÍGITOS 0-9
      if (calcCurrentInput === '0' || calcShouldReset) {
        calcCurrentInput = val;
        calcShouldReset = false;
      } else {
        if (calcCurrentInput.length < 12) {
          calcCurrentInput += val;
        }
      }
    }
    updateDisplay();
  }

  function calculateResult() {
    const a = parseFloat(calcPrevInput) || 0;
    const b = parseFloat(calcCurrentInput) || 0;
    let res = 0;

    switch (calcOperator) {
      case '+': res = a + b; break;
      case '-': res = a - b; break;
      case '*': res = a * b; break;
      case '/': res = b !== 0 ? a / b : 'Error'; break;
    }

    if (res === 'Error') {
      calcCurrentInput = '0';
      toast('No se puede dividir por cero', 'error');
    } else {
      calcCurrentInput = String(Math.round(res * 10000) / 10000);
    }
  }

  grid.querySelectorAll('button[data-calc]').forEach(btn => {
    btn.addEventListener('click', () => handleInput(btn.dataset.calc));
  });

  // Soporte para Teclado Físico / Teclado Numérico
  if (calcKeydownListener) {
    document.removeEventListener('keydown', calcKeydownListener);
  }

  calcKeydownListener = (e) => {
    const backdrop = document.getElementById('modal-backdrop');
    const viewStd = document.getElementById('calc-view-std');
    if (!backdrop || !backdrop.classList.contains('active') || !viewStd || viewStd.style.display === 'none') {
      return;
    }

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      return;
    }

    let val = null;
    if (e.key >= '0' && e.key <= '9') val = e.key;
    else if (e.key === '.' || e.key === ',') val = '.';
    else if (e.key === '+') val = '+';
    else if (e.key === '-') val = '-';
    else if (e.key === '*' || e.key.toLowerCase() === 'x') val = '*';
    else if (e.key === '/') val = '/';
    else if (e.key === 'Enter' || e.key === '=') val = '=';
    else if (e.key === 'Backspace') val = 'DEL';
    else if (e.key.toLowerCase() === 'c') val = 'AC';
    else if (e.key === '%') val = '%';

    if (val !== null) {
      e.preventDefault();
      handleInput(val);

      const btn = grid.querySelector(`button[data-calc="${val}"]`);
      if (btn) {
        btn.classList.add('active-key');
        setTimeout(() => btn.classList.remove('active-key'), 120);
      }
    }
  };

  document.addEventListener('keydown', calcKeydownListener);
}

/* ---------- Lógica Calculadora de Entradas ---------- */
function wireTicketCalculator() {
  const totalInput = document.getElementById('tcalc-total');
  const countInput = document.getElementById('tcalc-count');
  const resultDisplay = document.getElementById('tcalc-result');
  const subresultDisplay = document.getElementById('tcalc-subresult');
  const btnApply = document.getElementById('calc-apply-price');
  const pills = document.querySelectorAll('.tcalc-pill');

  if (!totalInput || !countInput) return;

  let currentCalculatedPrice = 0;

  function calculate() {
    const total = parseFloat(totalInput.value) || 0;
    const count = parseInt(countInput.value, 10) || 1;

    if (total > 0 && count > 0) {
      currentCalculatedPrice = total / count;
      resultDisplay.textContent = fmtEUR(currentCalculatedPrice);
      subresultDisplay.textContent = `${total.toFixed(2)} € ÷ ${count} ${count === 1 ? 'persona/entrada' : 'personas/entradas'} = ${currentCalculatedPrice.toFixed(2)} € cada una`;
    } else {
      currentCalculatedPrice = 0;
      resultDisplay.textContent = '0.00 €';
      subresultDisplay.textContent = 'Indica precio total y cantidad';
    }
  }

  totalInput.addEventListener('input', calculate);
  countInput.addEventListener('input', calculate);

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      countInput.value = pill.dataset.persons;
      calculate();
    });
  });

  if (btnApply) {
    btnApply.addEventListener('click', () => {
      if (currentCalculatedPrice <= 0) {
        toast('Introduce un importe válido', 'error');
        return;
      }
      const priceFormatted = currentCalculatedPrice.toFixed(2);
      
      const vImporte = document.getElementById('v-importe');
      const cfImporte = document.getElementById('cf-importe');

      if (vImporte && document.getElementById('view-venta-rapida').classList.contains('active')) {
        vImporte.value = priceFormatted;
        if (typeof updateTicketPreview === 'function') updateTicketPreview();
        toast(`Importe ${priceFormatted} € aplicado al formulario de venta`, 'success');
        closeModal();
      } else if (cfImporte) {
        cfImporte.value = priceFormatted;
        toast(`Importe ${priceFormatted} € aplicado al apunte`, 'success');
        closeModal();
      } else {
        navigator.clipboard.writeText(priceFormatted);
        toast(`Importe ${priceFormatted} € copiado al portapapeles`, 'success');
        closeModal();
      }
    });
  }
}
