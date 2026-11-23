import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { createHandler } from '../../src/server/http/handler.js';
import { createLedgerStore } from '../../src/web/data/api-store.js';
import { handlerRequest } from '../helpers/http.js';
import { fixedExpensesSummary, recordFixedExpense } from '../../src/domain/fixed-expenses.js';
import {
  accountBalances,
  ledgerBackup,
  parseLedgerBackup,
  mergeLedger,
} from '../../src/domain/ledger.js';
import { generateRecurrences } from '../../src/domain/recurrences.js';

test('transporte, cabello y cuota: cliente/API/SQLite, saldos, deduplicacion y respaldo', async () => {
  const database = openDatabase(':memory:');
  const restored = openDatabase(':memory:');
  try {
    const client = createLedgerStore(handlerRequest(createHandler(database)));
    const initial = await client.load();
    let state = await client.save({
      ...initial,
      accounts: [{ ...initial.accounts[0], initialBalance: 500000 }],
      recurrences: [
        ['transport', 'Tarjeta de transporte', 120000],
        ['hair', 'Corte de cabello', 30000],
        ['fee', 'Cuota mensual', 50000],
      ].map(([id, description, amount]) => ({
        id,
        description,
        amount,
        type: 'expense',
        frequency: 'monthly',
        category: 'Otros gastos',
        accountId: 'principal',
        startDate: '2026-11-01',
        endDate: '',
        paused: false,
        generatedDates: [],
      })),
    });
    assert.equal(fixedExpensesSummary(state, '2026-11').pending, 200000);
    for (const id of ['transport', 'hair', 'fee'])
      state = await client.save(recordFixedExpense(state, id, '2026-11'));
    assert.equal(fixedExpensesSummary(state, '2026-11').pending, 0);
    assert.equal(accountBalances(state, '2026-11-30')[0].balance, 300000);
    state = await client.save(generateRecurrences(state, '2026-11-30'));
    assert.equal(state.transactions.length, 3);
    assert.throws(() => recordFixedExpense(state, 'fee', '2026-11'));
    const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(await client.load())));
    const merged = mergeLedger(restored.readState(), backup);
    const saved = restored.replaceState(merged, restored.readState().revision);
    assert.equal(fixedExpensesSummary(saved, '2026-11').recorded, 200000);
    assert.equal(accountBalances(saved, '2026-11-30')[0].balance, 300000);
  } finally {
    database.close();
    restored.close();
  }
});
