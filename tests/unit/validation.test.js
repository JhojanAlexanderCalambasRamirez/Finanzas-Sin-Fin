import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoneyInput, validText, validDate } from '../../src/domain/validation.js';
import { validAccount, defaultAccount, validLedger } from '../../src/domain/ledger.js';
import { validTransaction } from '../../src/domain/finance.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';

test('montos COP admiten enteros y puntos de miles sin convertir entradas ambiguas', () => {
  for (const text of ['50000', '50.000', ' 50.000 ']) assert.equal(parseMoneyInput(text), 50000);
  assert.equal(parseMoneyInput('1.000.000.000.000'), 1000000000000);
  assert.equal(parseMoneyInput('-50.000', { signed: true }), -50000);
  assert.equal(parseMoneyInput('0', { signed: true }), 0);
  for (const text of [
    '',
    ' ',
    '1e3',
    '0x10',
    '1,50',
    '1.50',
    '1.000,00',
    '1 000',
    '$50.000',
    'NaN',
    'Infinity',
    '1..000',
    '--1',
    '+100',
    '100abc',
    '1000000000001',
  ]) {
    assert.throws(() => parseMoneyInput(text), text);
  }
  for (const text of ['0', '-1', '-0']) assert.throws(() => parseMoneyInput(text));
});
test('validadores rechazan fechas inexistentes y texto invisible o con controles', () => {
  for (const date of [
    '0000-01-01',
    '2026-02-29',
    '2026-04-31',
    '20/11/2026',
    '2026-13-01',
    '2026-1-01',
    null,
    [],
  ])
    assert.equal(validDate(date), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validText('Mercado familiar', 120), true);
  for (const text of [
    ' ',
    '\u200b',
    'Nombre\nOculto',
    'Nombre\u0000',
    '\u202eTexto',
    '\ufffd',
    null,
    {},
    [],
  ])
    assert.equal(validText(text, 120), false);
});
test('tipos JSON incorrectos no pasan por coercion ni cambian un estado valido', () => {
  const account = defaultAccount();
  const item = {
    id: 'one',
    type: 'income',
    description: 'Salario',
    amount: 100,
    date: '2026-11-20',
    category: 'Salario',
  };
  const state = {
    accounts: [account],
    categories: defaultCategories(),
    transactions: [{ ...item, accountId: account.id }],
    transfers: [],
    recurrences: [],
  };
  assert.equal(validLedger(state), true);
  for (const value of [['bank'], {}, true, null, 1])
    assert.equal(validAccount({ ...account, type: value }), false);
  for (const value of ['100', true, null, [], {}, Infinity, NaN, 0.5, -1, 0])
    assert.equal(validTransaction({ ...item, amount: value }), false);
  for (const field of [
    'accounts',
    'categories',
    'transactions',
    'transfers',
    'recurrences',
    'budgets',
    'goals',
    'contributions',
    'debts',
    'debtPayments',
  ]) {
    for (const value of [null, {}, 'invalid', true, 42])
      assert.equal(validLedger({ ...state, [field]: value }), false, `${field}: ${value}`);
  }
  for (const value of [null, {}, [], true, 'invalid', 0]) assert.equal(validLedger(value), false);
});
