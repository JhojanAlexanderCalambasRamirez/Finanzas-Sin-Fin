import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { defaultAccount, validLedger, ledgerBackup, parseLedgerBackup, mergeLedger } from './ledger.js';
import { defaultCategories, saveCategory } from './movement-tools.js';
import { budgetSummary } from './budgets.js';
import { openDatabase } from './database.js';

const budget = { id: 'budget', month: '2026-11', category: 'Vivienda', amount: 100000 };
const expense = { id: 'rent', type: 'expense', description: 'Arriendo', amount: 80000, date: '2026-11-15', category: 'Vivienda', accountId: 'principal' };
const fixture = () => ({ accounts: [defaultAccount()], categories: defaultCategories(), transactions: [expense], transfers: [], recurrences: [], budgets: [budget], goals: [], contributions: [], debts: [], debtPayments: [] });
test('consumo incluye solo gastos del mes y categoria; ingresos y otros meses no descuentan', () => {
  const state = fixture(); state.transactions.push({ ...expense, id: 'income', type: 'income', amount: 50000 }, { ...expense, id: 'old', date: '2026-10-15' }, { ...expense, id: 'other', category: 'Ocio' });
  const summary = budgetSummary(state, '2026-11')[0];
  assert.equal(summary.spent, 80000); assert.equal(summary.remaining, 20000); assert.equal(summary.percent, 80); assert.equal(summary.status, 'warning');
  assert.deepEqual(budgetSummary(state, '2026-12'), []);
});
test('avisos distinguen disponible, 80 por ciento, limite y exceso', () => {
  for (const [amount, status] of [[0, 'ok'], [79999, 'ok'], [80000, 'warning'], [100000, 'reached'], [100001, 'exceeded']]) {
    const state = fixture(); state.transactions = amount ? [{ ...expense, amount }] : [];
    const summary = budgetSummary(state, '2026-11')[0]; assert.equal(summary.status, status); assert.equal(summary.remaining, budget.amount - amount);
  }
});
test('rechaza duplicados por mes y categoria y montos o referencias invalidos', () => {
  assert.equal(validLedger(fixture()), true);
  for (const budgets of [null, {}, [{ ...budget, amount: '1000' }], [{ ...budget, amount: 0 }], [{ ...budget, amount: 1.5 }], [{ ...budget, amount: -1 }], [{ ...budget, month: '2026-13' }], [{ ...budget, category: 'No existe' }], [budget, { ...budget, id: 'other' }]]) {
    assert.equal(validLedger({ ...fixture(), budgets }), false);
  }
});
test('renombrar o archivar categoria conserva limite y calculos', () => {
  const renamed = saveCategory(fixture(), 'Vivienda', 'Mi vivienda');
  assert.equal(renamed.budgets[0].category, 'Mi vivienda');
  renamed.categories = renamed.categories.map(item => ({ ...item, archived: item.name === 'Mi vivienda' }));
  assert.equal(validLedger(renamed), true); assert.equal(budgetSummary(renamed, '2026-11')[0].spent, 80000);
});
test('respaldo completo conserva presupuestos, repeticiones y conflictos', () => {
  const original = fixture(); const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(original)));
  const empty = { accounts: [defaultAccount()], categories: defaultCategories(), transactions: [], transfers: [], recurrences: [], budgets: [] };
  assert.deepEqual(mergeLedger(empty, backup), original);
  assert.deepEqual(mergeLedger(original, backup), original);
  assert.throws(() => mergeLedger(original, { ...backup, budgets: [{ ...budget, amount: 50000 }] }));
  assert.throws(() => mergeLedger(original, { ...backup, budgets: [{ ...budget, id: 'new-id' }] }));
  const old = ledgerBackup(original); old.version = 4; delete old.budgets;
  assert.deepEqual(mergeLedger(original, parseLedgerBackup(JSON.stringify(old))).budgets, [budget]);
});
test('SQLite persiste, conserva con clientes antiguos y valida la migracion v4', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-budgets-')); let database; let raw;
  try {
    const path = join(directory, 'data.sqlite'); database = openDatabase(path);
    database.replaceState(fixture(), database.readState().revision);
    database.close(); database = openDatabase(path);
    const saved = database.readState(); assert.deepEqual(saved.budgets, [budget]);
    const legacy = { ...saved }; delete legacy.budgets;
    assert.deepEqual(database.replaceState(legacy, saved.revision).budgets, [budget]);
    const current = database.readState();
    assert.throws(() => database.replaceState({ ...current, budgets: [budget, { ...budget, id: 'duplicate' }] }, current.revision));
    assert.deepEqual(database.readState(), current);
    database.close(); database = null;
    raw = new DatabaseSync(path); raw.exec('DROP TABLE debt_payments; DROP TABLE debts; DROP TABLE goal_contributions; DROP TABLE savings_goals; DROP TABLE budgets; PRAGMA user_version=4;'); raw.close(); raw = null;
    database = openDatabase(path); const migrated = database.readState();
    assert.deepEqual(migrated.transactions, saved.transactions); assert.deepEqual(migrated.budgets, []);
    assert.notEqual(migrated.revision, current.revision);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('un fallo SQL revierte el presupuesto y los movimientos juntos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-budget-rollback-')); let database; let raw;
  try {
    const path = join(directory, 'data.sqlite'); database = openDatabase(path);
    const saved = database.replaceState(fixture(), database.readState().revision);
    raw = new DatabaseSync(path);
    raw.exec("CREATE TRIGGER reject_test BEFORE INSERT ON movements WHEN NEW.amount=99999 BEGIN SELECT RAISE(ABORT,'test failure'); END;");
    assert.throws(() => database.replaceState({ ...saved, budgets: [{ ...budget, amount: 500000 }], transactions: [{ ...expense, amount: 99999 }] }, saved.revision));
    assert.deepEqual(database.readState(), saved);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
