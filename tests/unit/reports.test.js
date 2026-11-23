import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyHistory, movementsCsv } from '../../src/domain/reports.js';

const item = {
  id: 'one',
  type: 'income',
  description: 'Salario',
  amount: 1000,
  date: '2026-11-01',
  category: 'Salario',
  accountId: 'main',
};
const fixture = () => ({
  accounts: [
    { id: 'main', name: 'Principal' },
    { id: 'bank', name: 'Banco' },
  ],
  transactions: [item, { ...item, id: 'expense', type: 'expense', amount: 200 }],
  transfers: [
    {
      id: 'transfer',
      date: '2026-11-02',
      description: 'Ahorro',
      amount: 300,
      fromAccountId: 'main',
      toAccountId: 'bank',
    },
  ],
});
test('historial concilia ingresos, gastos, meses vacios y cambio de anio', () => {
  const history = monthlyHistory(fixture(), '2027-01');
  assert.deepEqual(
    history.map((row) => row.month),
    ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'],
  );
  assert.deepEqual(history[3], { month: '2026-11', income: 1000, expense: 200, balance: 800 });
  assert.equal(history.at(-1).balance, 0);
  assert.equal(monthlyHistory(fixture(), '0001-01').length, 1);
  assert.throws(() => monthlyHistory(fixture(), '2026-13'));
});
test('CSV respeta filtros y exporta transferencias una sola vez', () => {
  const csv = movementsCsv(fixture(), { month: '2026-11', type: 'transfer', accountId: 'bank' });
  assert.ok(csv.startsWith('\ufeff'));
  assert.equal(csv.trim().split('\r\n').length, 2);
  assert.ok(csv.includes('"Principal";"Banco";"300"'));
  assert.ok(!csv.includes('"Salario"'));
});
test('CSV escapa comillas, separadores y formulas de hoja de calculo', () => {
  const state = fixture();
  state.transactions = [{ ...item, description: ' =SUM(1;2) "texto"' }];
  state.transfers = [];
  const csv = movementsCsv(state, { month: '2026-11' });
  assert.ok(csv.includes('"\' =SUM(1;2) ""texto"""'));
  assert.equal(csv.trim().split('\r\n').length, 2);
});
