import test from 'node:test';
import assert from 'node:assert/strict';
import { debtSummary, validDebts, recordDebtPayment, removeTransactionWithPayment } from './debts.js';
import { defaultAccount, validLedger, ledgerBackup, parseLedgerBackup, mergeLedger, accountBalances } from './ledger.js';
import { defaultCategories } from './movement-tools.js';
import { summarize } from './finance.js';

const debt = { id: 'debt', name: 'Compra', creditor: 'Comercio', amount: 100001, startDate: '2026-01-01', firstDueDate: '2026-01-31', installments: 3, archived: false };
const expense = { id: 'expense', type: 'expense', description: 'Pago', amount: 40000, date: '2026-02-01', category: 'Otros gastos', accountId: 'principal' };
const payment = { id: 'payment', debtId: 'debt', transactionId: 'expense' };
const fixture = () => ({ accounts: [defaultAccount()], categories: defaultCategories(), transactions: [expense], transfers: [], recurrences: [], budgets: [], goals: [], contributions: [], debts: [debt], debtPayments: [] });
test('cuotas mantienen dia ancla, suman el total exacto y aplican pagos a las mas antiguas', () => {
  const state = recordDebtPayment(fixture(), payment);
  const summary = debtSummary(state, '2026-03-01')[0];
  assert.deepEqual(summary.schedule.map(item => item.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(summary.schedule.reduce((sum, item) => sum + item.amount, 0), 100001);
  assert.deepEqual(summary.schedule.map(item => item.amount), [33334, 33334, 33333]);
  assert.equal(summary.paid, 40000); assert.equal(summary.remaining, 60001); assert.equal(summary.overdue, 26668);
  assert.equal(summary.schedule[0].status, 'paid'); assert.equal(summary.status, 'overdue');
  assert.equal(debtSummary(state, '2026-01-30')[0].paid, 0);
});
test('asociar gasto existente no duplica egresos ni cambia el saldo de cuentas', () => {
  const original = fixture(); const linked = recordDebtPayment(original, payment);
  assert.equal(linked.transactions.length, original.transactions.length);
  assert.deepEqual(summarize(linked.transactions), summarize(original.transactions));
  assert.deepEqual(accountBalances(linked, '2026-02-28'), accountBalances(original, '2026-02-28'));
  assert.throws(() => recordDebtPayment(linked, { ...payment, id: 'other' }));
});
test('crear pago nuevo crea un solo gasto y no permite sobrepago', () => {
  const original = { ...fixture(), transactions: [] };
  const linked = recordDebtPayment(original, payment, expense);
  assert.equal(linked.transactions.length, 1); assert.equal(linked.debtPayments.length, 1); assert.equal(validLedger(linked), true);
  const tooMuch = { ...expense, id: 'excess', amount: 70000 };
  assert.throws(() => recordDebtPayment(linked, { id: 'another', debtId: debt.id, transactionId: tooMuch.id }, tooMuch));
  assert.equal(original.transactions.length, 0);
});
test('editar y borrar el gasto actualiza la deuda y elimina referencias huerfanas', () => {
  const linked = recordDebtPayment(fixture(), payment);
  const edited = { ...linked, transactions: [{ ...expense, amount: 50000 }] };
  assert.equal(debtSummary(edited, '2026-02-28')[0].paid, 50000);
  assert.equal(validLedger({ ...linked, transactions: [] }), false);
  assert.equal(validLedger({ ...linked, transactions: [{ ...expense, type: 'income' }] }), false);
  const removed = removeTransactionWithPayment(linked, expense.id);
  assert.deepEqual(removed.debtPayments, []); assert.equal(debtSummary(removed, '2026-02-28')[0].paid, 0);
  assert.equal(validLedger(removed), true);
});
test('rechaza cuotas, fechas, referencias y pagos invalidos', () => {
  const state = fixture(); assert.equal(validDebts(state), true);
  for (const change of [{ installments: 0 }, { installments: '3' }, { installments: 361 }, { amount: 0 }, { firstDueDate: '2025-12-31' }, { firstDueDate: '9999-12-31' }, { creditor: ' ' }]) assert.equal(validLedger({ ...state, debts: [{ ...debt, ...change }] }), false);
  for (const payments of [null, {}, [{ ...payment, debtId: 'missing' }], [{ ...payment, transactionId: 'missing' }]]) assert.equal(validLedger({ ...state, debtPayments: payments }), false);
});
test('respaldo conserva deudas y pagos, rechaza duplicados y conserva datos con respaldo antiguo', () => {
  const state = recordDebtPayment(fixture(), payment); const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(state)));
  const empty = { ...fixture(), transactions: [], debts: [], debtPayments: [] };
  assert.deepEqual(mergeLedger(empty, backup), state);
  assert.deepEqual(mergeLedger(state, backup), state);
  assert.throws(() => mergeLedger(state, { ...backup, debtPayments: [{ ...payment, id: 'duplicate-link' }] }));
  const old = ledgerBackup(state); old.version = 6; delete old.debts; delete old.debtPayments;
  assert.deepEqual(mergeLedger(state, parseLedgerBackup(JSON.stringify(old))).debtPayments, [payment]);
});
