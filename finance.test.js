import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, validTransaction, parseBackup, mergeTransactions } from './finance.js';
const item = { id: 'one', type: 'income', description: 'Salario', amount: 2500000, date: '2026-11-20', category: 'Salario' };
const backup = transactions => JSON.stringify({ app: 'finanzas-sin-fin', version: 1, transactions });
test('el respaldo conserva datos y rechaza archivos ajenos o incompletos', () => {
  assert.deepEqual(parseBackup(backup([item])), [item]);
  for (const text of ['invalid', '{}', backup([{ ...item, amount: -1 }]), backup([item, item]), JSON.stringify({ app: 'finanzas-sin-fin', version: 2, transactions: [] })]) {
    assert.throws(() => parseBackup(text));
  }
});
test('importar repetidamente no duplica y los conflictos no modifican los registros', () => {
  const another = { ...item, id: 'two', type: 'expense', amount: 50000 };
  const current = [item];
  const merged = mergeTransactions(current, [item, another]);
  assert.deepEqual(mergeTransactions(merged, [item, another]), [item, another]);
  assert.throws(() => mergeTransactions(current, [{ ...item, amount: 100 }]));
  assert.deepEqual(current, [item]);
});
test('calcula balance con ingresos, gastos y periodos vacíos', () => {
  assert.deepEqual(summarize([item, { ...item, type: 'expense', amount: 500000 }]), { income: 2500000, expense: 500000, balance: 2000000 });
  assert.deepEqual(summarize([]), { income: 0, expense: 0, balance: 0 });
});
test('rechaza importes inválidos, fechas inexistentes y registros incompletos', () => {
  assert.equal(validTransaction(item), true);
  for (const change of [{ amount: -1 }, { amount: 0 }, { amount: 1.5 }, { amount: Infinity }, { date: '2026-02-30' }, { description: ' ' }, { type: 'other' }, { category: 'unknown' }]) assert.equal(validTransaction({ ...item, ...change }), false);
});
