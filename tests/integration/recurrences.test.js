import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  defaultAccount,
  validLedger,
  ledgerBackup,
  parseLedgerBackup,
  mergeLedger,
} from '../../src/domain/ledger.js';
import { defaultCategories, saveCategory } from '../../src/domain/movement-tools.js';
import { previewRecurrences, generateRecurrences } from '../../src/domain/recurrences.js';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';

const rule = () => ({
  id: 'rent',
  type: 'expense',
  description: 'Arriendo',
  amount: 100000,
  accountId: 'principal',
  category: 'Vivienda',
  frequency: 'monthly',
  startDate: '2024-01-31',
  endDate: '',
  paused: false,
  generatedDates: [],
});
const fixture = () => ({
  accounts: [defaultAccount()],
  categories: defaultCategories(),
  transactions: [],
  transfers: [],
  recurrences: [rule()],
  budgets: [],
  goals: [],
  contributions: [],
  debts: [],
  debtPayments: [],
});
test('mensual mantiene dia ancla al pasar por febrero bisiesto y meses cortos', () => {
  const state = fixture();
  const before = structuredClone(state);
  assert.deepEqual(
    previewRecurrences(state, '2024-04-30').entries.map((item) => item.date),
    ['2024-01-31', '2024-02-29', '2024-03-31', '2024-04-30'],
  );
  assert.deepEqual(state, before);
  const normal = { ...state, recurrences: [{ ...rule(), startDate: '2026-01-31' }] };
  assert.deepEqual(
    previewRecurrences(normal, '2026-03-31').entries.map((item) => item.date),
    ['2026-01-31', '2026-02-28', '2026-03-31'],
  );
});
test('semanal respeta inicio, fin y corte; pausa no genera y categoria archivada se informa', () => {
  const state = {
    ...fixture(),
    recurrences: [
      { ...rule(), frequency: 'weekly', startDate: '2026-11-01', endDate: '2026-11-20' },
    ],
  };
  assert.deepEqual(
    previewRecurrences(state, '2026-12-31').entries.map((item) => item.date),
    ['2026-11-01', '2026-11-08', '2026-11-15'],
  );
  assert.equal(
    previewRecurrences(
      { ...state, recurrences: [{ ...state.recurrences[0], paused: true }] },
      '2026-12-31',
    ).entries.length,
    0,
  );
  const archived = {
    ...state,
    categories: state.categories.map((item) => ({ ...item, archived: item.name === 'Vivienda' })),
  };
  assert.equal(previewRecurrences(archived, '2026-12-31').blocked.length, 1);
  assert.equal(previewRecurrences(archived, '2026-12-31').entries.length, 0);
});
test('generar dos veces, editar o eliminar un movimiento no vuelve a generarlo', () => {
  const saved = generateRecurrences(fixture(), '2024-03-31');
  assert.equal(validLedger(saved), true);
  assert.equal(saved.transactions.length, 3);
  assert.equal(previewRecurrences(saved, '2024-03-31').entries.length, 0);
  const deleted = { ...saved, transactions: saved.transactions.slice(1) };
  assert.equal(generateRecurrences(deleted, '2024-03-31').transactions.length, 2);
  const edited = {
    ...saved,
    transactions: saved.transactions.map((item) => ({ ...item, date: '2024-04-01', amount: 1 })),
  };
  assert.equal(generateRecurrences(edited, '2024-03-31').transactions.length, 3);
});
test('limite de vista previa y colisiones se rechazan sin mutar el estado', () => {
  const state = fixture();
  assert.throws(() => previewRecurrences(state, '2099-12-31'), /500/);
  const transaction = previewRecurrences(state, '2024-01-31').entries[0].transaction;
  assert.throws(
    () => previewRecurrences({ ...state, transactions: [transaction] }, '2024-01-31'),
    /identificador/,
  );
  assert.deepEqual(state.recurrences[0].generatedDates, []);
});
test('respaldo restaura reglas y fechas generadas sin duplicados; renombrado actualiza reglas', () => {
  const state = generateRecurrences(fixture(), '2024-02-29');
  const renamed = saveCategory(state, 'Vivienda', 'Arriendo y vivienda');
  assert.equal(renamed.recurrences[0].category, 'Arriendo y vivienda');
  const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(renamed)));
  const empty = {
    accounts: [defaultAccount()],
    categories: defaultCategories(),
    transactions: [],
    transfers: [],
    recurrences: [],
  };
  const restored = mergeLedger(empty, backup);
  assert.deepEqual(restored, renamed);
  assert.equal(previewRecurrences(restored, '2024-02-29').entries.length, 0);
});
test('SQLite conserva deduplicacion al reabrir y rechaza borrar sus marcadores', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-recurring-'));
  let database;
  try {
    const path = join(directory, 'data.sqlite');
    database = openDatabase(path);
    let current = database.replaceState(fixture(), database.readState().revision);
    current = database.replaceState(generateRecurrences(current, '2024-02-29'), current.revision);
    database.close();
    database = openDatabase(path);
    current = database.readState();
    assert.equal(previewRecurrences(current, '2024-02-29').entries.length, 0);
    assert.throws(() =>
      database.replaceState(
        { ...current, recurrences: [{ ...current.recurrences[0], generatedDates: [] }] },
        current.revision,
      ),
    );
    assert.throws(() => database.replaceState({ ...current, recurrences: [] }, current.revision));
    assert.deepEqual(database.readState(), current);
    assert.throws(
      () => database.replaceState(generateRecurrences(current, '2024-03-31'), 'obsolete'),
      (error) => error.status === 409,
    );
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('vista previa informa el limite de movimientos antes de intentar guardar', () => {
  const state = fixture();
  state.transactions = Array.from({ length: 5000 }, (_, index) => ({
    id: `manual-${index}`,
    type: 'expense',
    description: 'Registro',
    amount: 1,
    date: '2024-01-01',
    accountId: 'principal',
    category: 'Vivienda',
  }));
  assert.throws(() => previewRecurrences(state, '2024-01-31'), /5000 movimientos/);
  assert.equal(state.transactions.length, 5000);
  assert.deepEqual(state.recurrences[0].generatedDates, []);
});
