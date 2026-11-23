import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSummary } from '../../src/domain/dashboard.js';
const empty = () => ({
  accounts: [],
  transactions: [],
  transfers: [],
  categories: [],
  budgets: [],
  debts: [],
  debtPayments: [],
});
test('dashboard vacio no inventa porcentajes ni variaciones del anio cero', () => {
  const result = dashboardSummary(empty(), '0001-01');
  assert.equal(result.savingRate, null);
  assert.equal(result.previous, null);
  assert.equal(result.expenseChange, null);
  assert.deepEqual(result.alerts, []);
  assert.equal(result.hasMovements, false);
});
test('dashboard compara meses vacios y separa transferencias e ingresos', () => {
  const state = empty();
  state.transactions = [
    { id: 'a', type: 'income', amount: 1000, date: '2026-11-01' },
    { id: 'b', type: 'expense', amount: 300, date: '2026-11-02' },
    { id: 'c', type: 'expense', amount: 500, date: '2026-10-02' },
  ];
  const result = dashboardSummary(state, '2026-11');
  assert.equal(result.expenseChange, -200);
  assert.equal(result.savingRate, 70);
});
test('alertas respetan el periodo y excluyen deudas archivadas', () => {
  const state = empty();
  state.budgets = [{ id: 'b', category: 'Casa', month: '2026-11', amount: 100 }];
  state.transactions = [
    { id: 'x', type: 'expense', amount: 120, category: 'Casa', date: '2026-11-03' },
  ];
  state.debts = [
    {
      id: 'd',
      name: 'Crédito',
      amount: 300,
      installments: 3,
      firstDueDate: '2026-11-01',
      startDate: '2026-11-01',
      archived: false,
    },
  ];
  assert.equal(dashboardSummary(state, '2026-10').alerts.length, 0);
  const result = dashboardSummary(state, '2026-11');
  assert.equal(result.overdue, 100);
  assert.equal(result.pendingDebt, 300);
  assert.equal(result.alerts[0].title, 'Cuotas vencidas');
  state.debts[0].archived = true;
  assert.equal(dashboardSummary(state, '2026-11').overdue, 0);
});
