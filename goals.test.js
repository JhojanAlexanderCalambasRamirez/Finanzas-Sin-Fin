import test from 'node:test';
import assert from 'node:assert/strict';
import { goalSummary } from './goals.js';
import { defaultAccount, validLedger, accountBalances, ledgerBackup, parseLedgerBackup, mergeLedger } from './ledger.js';
import { defaultCategories } from './movement-tools.js';
import { summarize } from './finance.js';

const goal = { id: 'emergency', name: 'Emergencias', targetAmount: 1000000, startDate: '2026-11-01', targetDate: '2026-11-30', archived: false };
const item = { id: 'contribution', goalId: goal.id, amount: 250000, date: '2026-11-15', note: 'Primer aporte' };
const fixture = () => ({ accounts: [defaultAccount()], categories: defaultCategories(), transactions: [], transfers: [], recurrences: [], budgets: [], goals: [goal], contributions: [item], debts: [], debtPayments: [] });
test('metas muestran avance, fecha vencida y cumplimiento sin alterar dinero de cuentas', () => {
  const state = fixture();
  const summary = goalSummary(state, '2026-11-30')[0];
  assert.equal(summary.saved, 250000); assert.equal(summary.remaining, 750000); assert.equal(summary.percent, 25); assert.equal(summary.status, 'in-progress');
  assert.equal(goalSummary(state, '2026-10-31')[0].status, 'not-started');
  assert.equal(goalSummary(state, '2026-11-10')[0].saved, 0);
  assert.equal(goalSummary(state, '2026-12-01')[0].status, 'overdue');
  const achieved = { ...state, contributions: [{ ...item, amount: 1200000 }] };
  assert.equal(goalSummary(achieved, '2026-12-01')[0].status, 'completed');
  assert.equal(goalSummary(achieved, '2026-12-01')[0].remaining, 0);
  assert.equal(accountBalances(achieved, '2026-12-01')[0].balance, 0);
  assert.deepEqual(summarize(achieved.transactions), { income: 0, expense: 0, balance: 0 });
});
test('rechaza metas y aportes invalidos, referencias huerfanas y fechas anteriores al inicio', () => {
  const state = fixture(); assert.equal(validLedger(state), true);
  for (const goals of [null, {}, [{ ...goal, targetAmount: 0 }], [{ ...goal, targetAmount: '1000' }], [{ ...goal, name: ' ' }], [{ ...goal, targetDate: '2026-10-01' }], [goal, goal]]) assert.equal(validLedger({ ...state, goals }), false);
  for (const contributions of [null, {}, [{ ...item, amount: -1 }], [{ ...item, amount: true }], [{ ...item, goalId: 'missing' }], [{ ...item, date: '2026-10-01' }], [item, item]]) assert.equal(validLedger({ ...state, contributions }), false);
});
test('editar y eliminar aportes recalcula avance; archivar no borra el historial', () => {
  const state = fixture(); const edited = { ...state, contributions: [{ ...item, amount: 500000 }] };
  assert.equal(goalSummary(edited, '2026-11-30')[0].percent, 50);
  assert.equal(goalSummary({ ...edited, contributions: [] }, '2026-11-30')[0].saved, 0);
  const archived = { ...state, goals: [{ ...goal, archived: true }] };
  assert.equal(validLedger(archived), true); assert.equal(goalSummary(archived, '2026-11-30')[0].saved, item.amount);
});
test('respaldo conserva metas y aportes sin duplicarlos y rechaza conflictos', () => {
  const original = fixture(); const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(original)));
  const empty = { ...original, goals: [], contributions: [] };
  assert.deepEqual(mergeLedger(empty, backup), original);
  assert.deepEqual(mergeLedger(original, backup), original);
  assert.throws(() => mergeLedger(original, { ...backup, contributions: [{ ...item, amount: 1 }] }));
  const old = ledgerBackup(original); old.version = 5; delete old.goals; delete old.contributions;
  assert.deepEqual(mergeLedger(original, parseLedgerBackup(JSON.stringify(old))).goals, [goal]);
});
