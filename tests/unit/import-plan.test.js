import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareImport } from '../../src/domain/import-plan.js';
import { defaultAccount, ledgerBackup } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';
const state = () => ({
  accounts: [defaultAccount()],
  categories: defaultCategories(),
  transactions: [],
  transfers: [],
  recurrences: [],
  budgets: [],
  goals: [],
  contributions: [],
  debts: [],
  debtPayments: [],
});
test('vista previa calcula cantidades y saldo sin mutar datos ni duplicar respaldo identico', () => {
  const current = state();
  const source = state();
  source.transactions.push({
    id: 'income',
    type: 'income',
    description: 'Salario',
    category: 'Salario',
    accountId: 'principal',
    amount: 100000,
    date: '2026-11-23',
  });
  const original = structuredClone(current);
  const plan = prepareImport(current, JSON.stringify(ledgerBackup(source)));
  assert.deepEqual(current, original);
  assert.equal(plan.totalBalance, 100000);
  assert.equal(plan.changed, true);
  assert.equal(plan.lastDate, '2026-11-23');
  assert.equal(plan.rows.find((row) => row.field === 'transactions').added, 1);
  assert.equal(prepareImport(plan.next, JSON.stringify(ledgerBackup(source))).changed, false);
});
test('vista previa rechaza JSON corrupto, exceso de tamaño y conflictos sin cambiar el estado', () => {
  const current = state();
  const snapshot = structuredClone(current);
  for (const text of ['{', 'x'.repeat(5 * 1024 * 1024 + 1), '{}'])
    assert.throws(() => prepareImport(current, text));
  assert.deepEqual(current, snapshot);
  current.transactions = [
    {
      id: 'same',
      type: 'income',
      accountId: 'principal',
      category: 'Salario',
      description: 'Ingreso',
      amount: 1000,
      date: '2026-11-23',
    },
  ];
  const conflict = { ...current, transactions: [{ ...current.transactions[0], amount: 2000 }] };
  assert.throws(() => prepareImport(current, JSON.stringify(ledgerBackup(conflict))), /cambios/);
  assert.equal(current.transactions[0].amount, 1000);
});
