import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { createHandler } from '../../src/server/http/handler.js';
import { createLedgerStore } from '../../src/web/data/api-store.js';
import { handlerRequest, invoke } from '../helpers/http.js';
import {
  accountBalances,
  ledgerBackup,
  parseLedgerBackup,
  mergeLedger,
} from '../../src/domain/ledger.js';
import { budgetSummary } from '../../src/domain/budgets.js';
import { goalSummary } from '../../src/domain/goals.js';
import { summarize } from '../../src/domain/finance.js';
import { generateRecurrences } from '../../src/domain/recurrences.js';
import {
  recordDebtPayment,
  removeTransactionWithPayment,
  debtSummary,
} from '../../src/domain/debts.js';

function completeState(initial) {
  return {
    ...initial,
    accounts: [
      { ...initial.accounts[0], initialBalance: 500000 },
      { id: 'bank', name: 'Ahorros', type: 'bank', initialBalance: 0, initialDate: '2026-01-01' },
    ],
    transactions: [
      {
        id: 'salary',
        type: 'income',
        description: 'Salario',
        amount: 1000000,
        date: '2026-11-01',
        category: 'Salario',
        accountId: 'principal',
      },
      {
        id: 'rent',
        type: 'expense',
        description: 'Arriendo',
        amount: 100000,
        date: '2026-11-01',
        category: 'Vivienda',
        accountId: 'principal',
      },
    ],
    transfers: [
      {
        id: 'transfer',
        fromAccountId: 'principal',
        toAccountId: 'bank',
        amount: 200000,
        description: 'Ahorro',
        date: '2026-11-02',
      },
    ],
    budgets: [{ id: 'budget', month: '2026-11', category: 'Vivienda', amount: 100000 }],
    goals: [
      {
        id: 'goal',
        name: 'Emergencias',
        targetAmount: 500000,
        startDate: '2026-11-01',
        targetDate: '',
        archived: false,
      },
    ],
    contributions: [
      {
        id: 'contribution',
        goalId: 'goal',
        amount: 200000,
        date: '2026-11-02',
        note: 'Aporte registrado',
      },
    ],
  };
}
test('flujo completo: registrar, presupuestar, aportar, generar, respaldar, restaurar y reabrir', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-functional-'));
  let database;
  let restored;
  try {
    const path = join(directory, 'source.sqlite');
    database = openDatabase(path);
    const client = createLedgerStore(handlerRequest(createHandler(database)));
    let state = await client.save(completeState(await client.load()));
    assert.deepEqual(
      accountBalances(state, '2026-11-30').map((item) => item.balance),
      [1200000, 200000],
    );
    assert.equal(budgetSummary(state, '2026-11')[0].status, 'reached');
    assert.equal(goalSummary(state, '2026-11-30')[0].percent, 40);
    const before = summarize(state.transactions);
    const balances = accountBalances(state, '2026-11-30');
    state = await client.save({
      ...state,
      contributions: [{ ...state.contributions[0], amount: 400000 }],
    });
    assert.deepEqual(summarize(state.transactions), before);
    assert.deepEqual(accountBalances(state, '2026-11-30'), balances);
    state = await client.save({
      ...state,
      recurrences: [
        {
          id: 'bill',
          type: 'expense',
          description: 'Servicio',
          amount: 100000,
          accountId: 'principal',
          category: 'Vivienda',
          frequency: 'monthly',
          startDate: '2026-11-15',
          endDate: '',
          paused: false,
          generatedDates: [],
        },
      ],
    });
    state = await client.save(generateRecurrences(state, '2026-11-30'));
    assert.equal(budgetSummary(state, '2026-11')[0].status, 'exceeded');
    const count = state.transactions.length;
    assert.equal(generateRecurrences(state, '2026-11-30').transactions.length, count);
    const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(state)));
    restored = openDatabase(join(directory, 'restored.sqlite'));
    const destination = createLedgerStore(handlerRequest(createHandler(restored)));
    const restoredState = await destination.save(mergeLedger(await destination.load(), backup));
    assert.deepEqual(
      accountBalances(restoredState, '2026-11-30'),
      accountBalances(state, '2026-11-30'),
    );
    assert.deepEqual(goalSummary(restoredState, '2026-11-30'), goalSummary(state, '2026-11-30'));
    assert.deepEqual(budgetSummary(restoredState, '2026-11'), budgetSummary(state, '2026-11'));
    assert.equal(mergeLedger(restoredState, backup).transactions.length, count);
    database.close();
    database = openDatabase(path);
    assert.deepEqual(database.readState().contributions, state.contributions);
  } finally {
    restored?.close();
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('datos de metas invalidos y errores SQL no dejan cambios parciales', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-functional-rollback-'));
  let database;
  let raw;
  try {
    const path = join(directory, 'data.sqlite');
    database = openDatabase(path);
    const handler = createHandler(database);
    const current = database.replaceState(
      completeState(database.readState()),
      database.readState().revision,
    );
    const invalid = await invoke(handler, {
      url: '/api/state',
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...current,
        contributions: [{ ...current.contributions[0], goalId: 'missing' }],
      }),
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(database.readState(), current);
    raw = new DatabaseSync(path);
    raw.exec(
      "CREATE TRIGGER reject_test BEFORE INSERT ON movements WHEN NEW.amount=99999 BEGIN SELECT RAISE(ABORT,'test failure'); END;",
    );
    const failed = await invoke(handler, {
      url: '/api/state',
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...current,
        goals: [{ ...current.goals[0], targetAmount: 1000000 }],
        transactions: current.transactions.map((item) =>
          item.type === 'expense' ? { ...item, amount: 99999 } : item,
        ),
      }),
    });
    assert.equal(failed.status, 500);
    assert.deepEqual(database.readState(), current);
  } finally {
    raw?.close();
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('migracion desde esquema 5 conserva finanzas y clientes anteriores conservan metas', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-functional-migration-'));
  let database;
  let raw;
  try {
    const path = join(directory, 'data.sqlite');
    database = openDatabase(path);
    let state = database.replaceState(
      completeState(database.readState()),
      database.readState().revision,
    );
    const legacy = { ...state };
    delete legacy.goals;
    delete legacy.contributions;
    state = database.replaceState(legacy, state.revision);
    assert.equal(state.goals.length, 1);
    assert.equal(state.contributions.length, 1);
    database.close();
    database = null;
    raw = new DatabaseSync(path);
    raw.exec(
      'DROP TABLE debt_payments; DROP TABLE debts; DROP TABLE goal_contributions; DROP TABLE savings_goals; PRAGMA user_version=5;',
    );
    raw.close();
    raw = null;
    database = openDatabase(path);
    const migrated = database.readState();
    assert.deepEqual(migrated.transactions, state.transactions);
    assert.deepEqual(migrated.budgets, state.budgets);
    assert.deepEqual(migrated.goals, []);
    assert.deepEqual(migrated.contributions, []);
  } finally {
    raw?.close();
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('flujo de deuda conserva gasto unico, valida pago, restaura enlaces y migra desde esquema 6', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-debts-flow-'));
  let database;
  let destination;
  let raw;
  try {
    const path = join(directory, 'data.sqlite');
    database = openDatabase(path);
    const client = createLedgerStore(handlerRequest(createHandler(database)));
    let state = await client.save({
      ...completeState(await client.load()),
      debts: [
        {
          id: 'debt',
          name: 'Compra',
          creditor: 'Comercio',
          amount: 300000,
          startDate: '2026-01-01',
          firstDueDate: '2026-11-30',
          installments: 3,
          archived: false,
        },
      ],
    });
    const count = state.transactions.length;
    const payment = { id: 'payment', debtId: 'debt', transactionId: 'rent' };
    state = await client.save(recordDebtPayment(state, payment));
    assert.equal(state.transactions.length, count);
    assert.equal(debtSummary(state, '2026-11-30')[0].remaining, 200000);
    const invalid = await invoke(createHandler(database), {
      url: '/api/state',
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...database.readState(),
        debtPayments: [payment, { ...payment, id: 'duplicate' }],
      }),
    });
    assert.equal(invalid.status, 400);
    const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(state)));
    destination = openDatabase(join(directory, 'restored.sqlite'));
    const empty = destination.readState();
    const restored = destination.replaceState(mergeLedger(empty, backup), empty.revision);
    assert.equal(debtSummary(restored, '2026-11-30')[0].paid, 100000);
    state = await client.save(removeTransactionWithPayment(state, 'rent'));
    assert.equal(debtSummary(state, '2026-11-30')[0].paid, 0);
    database.close();
    database = openDatabase(path);
    assert.deepEqual(database.readState().debtPayments, []);
    const legacy = database.readState();
    delete legacy.debts;
    delete legacy.debtPayments;
    assert.equal(database.replaceState(legacy, legacy.revision).debts.length, 1);
    database.close();
    database = null;
    raw = new DatabaseSync(path);
    raw.exec('DROP TABLE debt_payments; DROP TABLE debts; PRAGMA user_version=6;');
    raw.close();
    raw = null;
    database = openDatabase(path);
    assert.deepEqual(database.readState().debts, []);
    assert.deepEqual(database.readState().goals, state.goals);
  } finally {
    raw?.close();
    destination?.close();
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
