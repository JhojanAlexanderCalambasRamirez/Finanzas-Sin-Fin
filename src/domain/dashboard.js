import { monthEnd, accountBalances } from './ledger.js';
import { summarize } from './finance.js';
import { monthlyHistory } from './reports.js';
import { budgetSummary } from './budgets.js';
import { debtSummary } from './debts.js';

export function dashboardSummary(state, month) {
  const asOf = monthEnd(month);
  const totals = summarize(state.transactions.filter((item) => item.date.startsWith(month)));
  const history = monthlyHistory(state, month, 2);
  const previous = history.length === 2 ? history[0] : null;
  const alerts = [];
  const budgets = budgetSummary(state, month);
  for (const budget of budgets.filter((item) => item.status !== 'ok')) {
    alerts.push({
      kind: budget.status === 'exceeded' ? 'danger' : 'warning',
      target: '#budgets-panel',
      title: budget.category,
      message:
        budget.status === 'exceeded'
          ? 'Presupuesto excedido'
          : budget.status === 'reached'
            ? 'Límite alcanzado'
            : 'Has consumido al menos el 80 % del límite',
    });
  }
  const debts = debtSummary(state, asOf).filter((item) => !item.archived && item.startDate <= asOf);
  const overdue = debts.reduce((sum, item) => sum + item.overdue, 0);
  const pendingDebt = debts.reduce((sum, item) => sum + item.remaining, 0);
  if (overdue)
    alerts.unshift({
      kind: 'danger',
      target: '#debts-panel',
      title: 'Cuotas vencidas',
      message: 'Hay cuotas pendientes al cierre del periodo seleccionado.',
    });
  const negativeAccounts = accountBalances(state, asOf).filter((item) => item.balance < 0).length;
  if (negativeAccounts)
    alerts.push({
      kind: 'warning',
      target: '#accounts',
      title: 'Saldos negativos',
      message: `${negativeAccounts} cuenta(s) con saldo negativo al cierre del periodo.`,
    });
  return {
    ...totals,
    previous,
    expenseChange: previous ? totals.expense - previous.expense : null,
    savingRate: totals.income > 0 ? (totals.balance / totals.income) * 100 : null,
    pendingDebt,
    overdue,
    alerts,
    hasMovements: state.transactions.length + state.transfers.length > 0,
  };
}
