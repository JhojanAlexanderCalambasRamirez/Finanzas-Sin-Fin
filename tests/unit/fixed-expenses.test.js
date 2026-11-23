import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAccount, validLedger } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';
import { fixedExpensesSummary, recordFixedExpense } from '../../src/domain/fixed-expenses.js';
import { generateRecurrences } from '../../src/domain/recurrences.js';

const fixture = () => ({
  accounts: [defaultAccount()],
  categories: defaultCategories(),
  transactions: [],
  transfers: [],
  budgets: [],
  goals: [],
  contributions: [],
  debts: [],
  debtPayments: [],
  recurrences: [
    {
      id: 'transport',
      type: 'expense',
      description: 'Tarjeta transporte',
      amount: 120000,
      category: 'Transporte',
      accountId: 'principal',
      frequency: 'monthly',
      startDate: '2026-11-01',
      endDate: '',
      paused: false,
      generatedDates: [],
    },
    {
      id: 'hair',
      type: 'expense',
      description: 'Corte de cabello',
      amount: 30000,
      category: 'Otros gastos',
      accountId: 'principal',
      frequency: 'monthly',
      startDate: '2026-11-30',
      endDate: '',
      paused: false,
      generatedDates: [],
    },
  ],
});
test('plan mensual suma transporte y cabello; registra solo el mes seleccionado sin duplicar recurrencias', () => {
  const initial = fixture();
  assert.equal(fixedExpensesSummary(initial, '2026-11').planned, 150000);
  const paid = recordFixedExpense(initial, 'transport', '2026-12');
  assert.equal(paid.transactions.length, 1);
  assert.equal(paid.transactions[0].date, '2026-12-01');
  assert.equal(initial.transactions.length, 0);
  assert.equal(validLedger(paid), true);
  assert.equal(fixedExpensesSummary(paid, '2026-12').pending, 30000);
  assert.throws(() => recordFixedExpense(paid, 'transport', '2026-12'));
  const generated = generateRecurrences(paid, '2026-12-31');
  assert.equal(
    generated.transactions.filter((item) => item.id === paid.transactions[0].id).length,
    1,
  );
});
test('reglas pausadas, finalizadas, ingresos y semanas no forman parte de gastos fijos mensuales', () => {
  const state = fixture();
  state.recurrences[0].paused = true;
  state.recurrences[1].endDate = '2026-11-30';
  state.recurrences.push(
    { ...state.recurrences[0], id: 'weekly', frequency: 'weekly', paused: false },
    { ...state.recurrences[0], id: 'income', type: 'income', paused: false },
  );
  assert.equal(fixedExpensesSummary(state, '2026-12').rows.length, 0);
  assert.equal(fixedExpensesSummary(fixture(), '2026-10').planned, 0);
  assert.throws(() => fixedExpensesSummary(state, '0000-01'));
});
test('edicion y eliminacion no ocultan pendientes ni permiten regenerar gastos ya procesados', () => {
  const state = recordFixedExpense(fixture(), 'hair', '2027-02');
  assert.equal(state.transactions[0].date, '2027-02-28');
  state.transactions[0].amount = 10000;
  assert.equal(
    fixedExpensesSummary(state, '2027-02').rows.find((item) => item.ruleId === 'hair').status,
    'partial',
  );
  state.transactions = [];
  assert.equal(
    fixedExpensesSummary(state, '2027-02').rows.find((item) => item.ruleId === 'hair').status,
    'missing',
  );
  assert.throws(() => recordFixedExpense(state, 'hair', '2027-02'));
  const blocked = fixture();
  blocked.categories.find((item) => item.name === 'Transporte').archived = true;
  assert.throws(() => recordFixedExpense(blocked, 'transport', '2026-11'));
});
