import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { ledgerBackup, accountBalances } from '../../src/domain/ledger.js';
import { prepareImport } from '../../src/domain/import-plan.js';

test('un archivo JSON traslada todos los modulos entre dos bases independientes y conserva saldos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-transfer-'));
  let source;
  let target;
  try {
    source = openDatabase(join(directory, 'pc-a.sqlite'));
    target = openDatabase(join(directory, 'pc-b.sqlite'));
    const initial = source.readState();
    const complete = {
      ...initial,
      accounts: [
        { ...initial.accounts[0], initialBalance: 200000 },
        {
          id: 'bank',
          name: 'Banco',
          type: 'bank',
          initialBalance: 10000,
          initialDate: '2026-01-01',
        },
      ],
      categories: initial.categories.map((item) => ({ ...item, archived: item.name === 'Ocio' })),
      transactions: [
        {
          id: 'salary',
          accountId: 'principal',
          type: 'income',
          description: 'Salario',
          category: 'Salario',
          amount: 100000,
          date: '2026-11-01',
        },
        {
          id: 'rec:fee:2026-11-01',
          accountId: 'principal',
          type: 'expense',
          description: 'Cuota',
          category: 'Vivienda',
          amount: 10000,
          date: '2026-11-01',
        },
      ],
      transfers: [
        {
          id: 'transfer',
          fromAccountId: 'principal',
          toAccountId: 'bank',
          amount: 5000,
          date: '2026-11-02',
          description: 'Ahorro',
        },
      ],
      recurrences: [
        {
          id: 'fee',
          type: 'expense',
          frequency: 'monthly',
          description: 'Cuota',
          category: 'Vivienda',
          accountId: 'principal',
          amount: 10000,
          startDate: '2026-11-01',
          endDate: '',
          paused: false,
          generatedDates: ['2026-11-01'],
        },
      ],
      budgets: [{ id: 'limit', month: '2026-11', category: 'Vivienda', amount: 50000 }],
      goals: [
        {
          id: 'goal',
          name: 'Emergencias',
          targetAmount: 50000,
          startDate: '2026-01-01',
          targetDate: '',
          archived: false,
        },
      ],
      contributions: [
        { id: 'contribution', goalId: 'goal', amount: 5000, date: '2026-11-02', note: 'Aporte' },
      ],
      debts: [
        {
          id: 'debt',
          name: 'Credito',
          creditor: 'Acreedor de prueba',
          amount: 20000,
          startDate: '2026-01-01',
          firstDueDate: '2026-11-01',
          installments: 2,
          archived: false,
        },
      ],
      debtPayments: [{ id: 'payment', debtId: 'debt', transactionId: 'rec:fee:2026-11-01' }],
    };
    const saved = source.replaceState(complete, initial.revision);
    const file = join(directory, 'mis-finanzas.json');
    writeFileSync(file, JSON.stringify(ledgerBackup(saved)));
    const plan = prepareImport(target.readState(), readFileSync(file, 'utf8'));
    const imported = target.replaceState(plan.next, target.readState().revision);
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
    ])
      assert.deepEqual(imported[field], saved[field], field);
    assert.deepEqual(accountBalances(imported, '2026-11-30'), accountBalances(saved, '2026-11-30'));
    assert.equal(prepareImport(imported, readFileSync(file, 'utf8')).changed, false);
    target.close();
    target = openDatabase(join(directory, 'pc-b.sqlite'));
    assert.deepEqual(target.readState(), imported);
  } finally {
    source?.close();
    target?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
