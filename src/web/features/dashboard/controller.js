import { dashboardSummary } from '../../../domain/dashboard.js';
import { summarize } from '../../../domain/finance.js';
import { categoryList } from '../../../domain/movement-tools.js';

export function createDashboardController({ $, getState, isReady, money }) {
  function renderDashboard() {
    if (!isReady()) {
      for (const id of ['#saving-rate', '#expense-change', '#pending-debt'])
        $(id).textContent = '—';
      $('#dashboard-alerts').replaceChildren();
      $('#dashboard-empty').textContent =
        'Conecta con tus datos para consultar alertas y comparaciones.';
      return;
    }
    const result = dashboardSummary(getState(), $('#month').value);
    $('#saving-rate').textContent =
      result.savingRate === null
        ? 'Sin ingresos'
        : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(result.savingRate) +
          ' %';
    $('#expense-change').textContent =
      result.expenseChange === null
        ? 'Sin periodo anterior'
        : result.expenseChange === 0
          ? 'Sin variación'
          : (result.expenseChange > 0 ? '+ ' : '− ') + money(Math.abs(result.expenseChange));
    $('#comparison-period').textContent = result.previous
      ? 'Respecto a ' + result.previous.month + '. Incluye movimientos futuros ya registrados.'
      : 'No hay un mes anterior válido para comparar.';
    $('#pending-debt').textContent = money(result.pendingDebt);
    $('#overdue-total').textContent =
      'Cuotas vencidas al cierre: ' + money(result.overdue) + '. Excluye deudas archivadas.';
    $('#dashboard-alerts').replaceChildren(
      ...result.alerts.map((alert) => {
        const li = document.createElement('li');
        li.className = 'priority ' + alert.kind;
        const link = document.createElement('a');
        link.href = alert.target;
        link.textContent = alert.title + ': ' + alert.message + ' Ver detalle';
        li.append(link);
        return li;
      }),
    );
    $('#dashboard-empty').textContent = result.alerts.length
      ? ''
      : result.hasMovements
        ? 'Sin alertas de presupuesto, cuotas o saldos negativos para este periodo.'
        : 'Empieza creando tus cuentas y registrando un movimiento. Las alertas aparecerán aquí.';
  }

  function renderSummary() {
    const items = getState().transactions.filter((item) => item.date.startsWith($('#month').value));
    const totals = summarize(items);
    for (const field of ['income', 'expense', 'balance'])
      $(`#${field}`).textContent = money(totals[field]);
    $('#categories').replaceChildren();
    const grouped = categoryList(getState())
      .map(({ name }) => ({
        name,
        amount: items
          .filter((item) => item.type === 'expense' && item.category === name)
          .reduce((sum, item) => sum + item.amount, 0),
      }))
      .filter((group) => group.amount)
      .sort((a, b) => b.amount - a.amount);
    if (!grouped.length) {
      const empty = document.createElement('p');
      empty.className = 'category-empty';
      empty.textContent = 'Cuando registres gastos, aquí verás en qué categorías se concentran.';
      $('#categories').append(empty);
    }
    for (const group of grouped) {
      const block = document.createElement('div');
      block.className = 'category-item';
      const label = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = group.name;
      const amount = document.createElement('strong');
      amount.textContent = money(group.amount);
      label.append(name, amount);
      const track = document.createElement('div');
      track.className = 'track';
      const bar = document.createElement('div');
      bar.style.width = `${(group.amount / totals.expense) * 100}%`;
      track.append(bar);
      block.append(label, track);
      $('#categories').append(block);
    }
  }

  return { render: renderDashboard, renderSummary };
}
