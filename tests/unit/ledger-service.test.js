import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerService } from '../../src/application/ledger-service.js';
import { defaultAccount } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';

const initial = () => ({
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

test('servicio valida antes de escribir e hidrata colecciones omitidas de clientes anteriores', () => {
  const current = initial();
  let written;
  const service = createLedgerService({
    readState: () => current,
    replaceState: (state, revision) => {
      written = { state, revision };
      return state;
    },
  });
  service.replaceState(
    { accounts: current.accounts, transactions: [], transfers: [] },
    'expected:1',
  );
  assert.deepEqual(written, { state: current, revision: 'expected:1' });
  written = null;
  assert.throws(() => service.replaceState({ ...current, accounts: [] }, 'expected:1'), /Revisa/);
  assert.equal(written, null);
  assert.throws(() => service.replaceState(null, 'expected:1'), /Estado/);
});
