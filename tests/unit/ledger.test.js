import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../../src/domain/finance.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';
import {
  defaultAccount,
  validLedger,
  accountBalances,
  monthEnd,
  ledgerBackup,
  parseLedgerBackup,
  mergeLedger,
} from '../../src/domain/ledger.js';

const main = { ...defaultAccount(), initialBalance: 1000000, initialDate: '2026-01-01' };
const bank = {
  id: 'bank',
  name: 'Banco',
  type: 'bank',
  initialBalance: 500000,
  initialDate: '2026-01-01',
};
const income = {
  id: 'salary',
  type: 'income',
  description: 'Salario',
  amount: 2000000,
  date: '2026-11-10',
  category: 'Salario',
  accountId: main.id,
};
const expense = { ...income, id: 'food', type: 'expense', description: 'Mercado', amount: 200000 };
const transfer = {
  id: 'transfer',
  fromAccountId: main.id,
  toAccountId: bank.id,
  amount: 300000,
  description: 'Ahorro',
  date: '2026-11-15',
};
const state = () => ({
  accounts: [main, bank],
  transactions: [income, expense],
  transfers: [transfer],
  categories: defaultCategories(),
  recurrences: [],
  budgets: [],
  goals: [],
  contributions: [],
  debts: [],
  debtPayments: [],
});
test('transferencias actualizan ambas cuentas sin cambiar ingresos, gastos ni saldo global', () => {
  const ledger = state();
  assert.equal(validLedger(ledger), true);
  const balances = accountBalances(ledger, '2026-11-30');
  assert.deepEqual(
    balances.map((account) => account.balance),
    [2500000, 800000],
  );
  assert.equal(
    balances.reduce((sum, account) => sum + account.balance, 0),
    3300000,
  );
  assert.deepEqual(summarize(ledger.transactions), {
    income: 2000000,
    expense: 200000,
    balance: 1800000,
  });
  assert.equal(
    accountBalances({ ...ledger, transfers: [] }, '2026-11-30').reduce(
      (sum, account) => sum + account.balance,
      0,
    ),
    3300000,
  );
});
test('saldos respetan corte, fecha inicial y registros futuros', () => {
  assert.deepEqual(
    accountBalances(state(), '2025-12-31').map((account) => account.balance),
    [0, 0],
  );
  assert.deepEqual(
    accountBalances(state(), '2026-10-31').map((account) => account.balance),
    [1000000, 500000],
  );
  assert.deepEqual(
    accountBalances(state(), '2026-11-14').map((account) => account.balance),
    [2800000, 500000],
  );
  assert.equal(monthEnd('2024-02'), '2024-02-29');
  assert.equal(monthEnd('2026-02'), '2026-02-28');
  assert.equal(monthEnd('0099-12'), '0099-12-31');
  assert.throws(() => monthEnd('2026-13'));
});
test('rechaza referencias inexistentes, fechas anteriores a apertura y cuentas iguales', () => {
  for (const ledger of [
    { ...state(), transfers: [{ ...transfer, toAccountId: main.id }] },
    { ...state(), transfers: [{ ...transfer, toAccountId: 'missing' }] },
    { ...state(), transfers: [{ ...transfer, date: '2025-12-31' }] },
    { ...state(), transactions: [{ ...income, accountId: 'missing' }] },
    { ...state(), transactions: [{ ...income, date: '2026-02-30' }] },
    { ...state(), accounts: [{ ...main, initialDate: '2026-12-01' }, bank] },
  ])
    assert.equal(validLedger(ledger), false);
  assert.equal(
    validLedger({ ...state(), accounts: [{ ...main, initialBalance: -1000 }, bank] }),
    true,
  );
});
test('respaldo completo restaura cuenta principal editada en instalacion nueva y no duplica', () => {
  const original = state();
  const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(original)));
  const empty = { accounts: [defaultAccount()], transactions: [], transfers: [] };
  const restored = mergeLedger(empty, backup);
  assert.deepEqual(restored, original);
  assert.deepEqual(mergeLedger(restored, backup), original);
  assert.throws(() =>
    mergeLedger(original, { ...backup, accounts: [{ ...main, name: 'Cambio' }, bank] }),
  );
  assert.throws(() =>
    parseLedgerBackup(JSON.stringify({ ...ledgerBackup(original), accounts: [main] })),
  );
});
test('respaldo antiguo asigna cuenta principal sin cambiar saldos iniciales actuales', () => {
  const { accountId, ...legacy } = income;
  const incoming = parseLedgerBackup(
    JSON.stringify({ app: 'finanzas-sin-fin', version: 1, transactions: [legacy] }),
  );
  const merged = mergeLedger({ accounts: [main], transactions: [], transfers: [] }, incoming);
  assert.deepEqual(merged.accounts, [main]);
  assert.equal(merged.transactions[0].accountId, main.id);
  assert.equal(accountBalances(merged, '2026-11-30')[0].balance, 3000000);
});
