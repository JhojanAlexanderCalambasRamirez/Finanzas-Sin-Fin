import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database.js';
import { defaultAccount, accountBalances } from './ledger.js';

const item = { id: 'salary', type: 'income', description: 'Salario', amount: 3000000, date: '2026-11-20', category: 'Salario' };
test('SQLite conserva movimientos y revision al cerrar y abrir el archivo', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-db-'));
  let database;
  try {
    const path = join(directory, 'data.sqlite');
    database = openDatabase(path);
    const saved = database.replace([item], database.read().revision);
    database.close(); database = openDatabase(path);
    assert.deepEqual(database.read(), saved);
    assert.deepEqual(saved.transactions, [item]);
    assert.equal(database.health(), true);
  } finally { database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('SQLite rechaza una revision antigua sin sobrescribir datos', () => {
  const database = openDatabase(':memory:');
  try {
    const initial = database.read();
    const saved = database.replace([item], initial.revision);
    assert.throws(() => database.replace([], initial.revision), error => error.status === 409);
    assert.deepEqual(database.read(), saved);
    const edited = database.replace([{ ...item, amount: 4000000 }], saved.revision);
    assert.equal(edited.transactions[0].amount, 4000000);
    assert.deepEqual(database.replace([], edited.revision).transactions, []);
  } finally { database.close(); }
});
test('datos invalidos y duplicados no borran movimientos existentes', () => {
  const database = openDatabase(':memory:');
  try {
    const saved = database.replace([item], database.read().revision);
    for (const items of [[item, item], [{ ...item, amount: -10 }], null]) {
      assert.throws(() => database.replace(items, saved.revision));
      assert.deepEqual(database.read(), saved);
    }
  } finally { database.close(); }
});
test('un fallo SQL durante el reemplazo revierte borrado e inserciones', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-rollback-'));
  let database; let raw;
  try {
    const path = join(directory, 'data.sqlite'); database = openDatabase(path);
    const saved = database.replace([item], database.read().revision);
    raw = new DatabaseSync(path);
    raw.exec("CREATE TRIGGER reject_expense BEFORE INSERT ON movements WHEN NEW.type='expense' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    assert.throws(() => database.replace([{ ...item, amount: 1 }, { ...item, id: 'expense', type: 'expense' }], saved.revision));
    assert.deepEqual(database.read(), saved);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('dos conexiones al mismo archivo no sobrescriben revisiones obsoletas', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-connections-'));
  let first; let second;
  try {
    const path = join(directory, 'data.sqlite'); first = openDatabase(path); second = openDatabase(path);
    const previous = second.read();
    const saved = first.replace([item], first.read().revision);
    assert.throws(() => second.replace([], previous.revision), error => error.status === 409);
    assert.deepEqual(second.read(), saved);
  } finally { second?.close(); first?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('migra una base v1 real sin perder movimientos y cambia su revision', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-migrate-v1-'));
  let raw; let database;
  try {
    const path = join(directory, 'data.sqlite'); raw = new DatabaseSync(path);
    raw.exec(`CREATE TABLE metadata (id INTEGER PRIMARY KEY, instance TEXT, revision INTEGER);
      INSERT INTO metadata VALUES (1,'old-instance',5);
      CREATE TABLE movements (id TEXT PRIMARY KEY, type TEXT, description TEXT, amount INTEGER, date TEXT, category TEXT) STRICT;
      PRAGMA user_version=1;`);
    raw.prepare('INSERT INTO movements VALUES (?,?,?,?,?,?)').run(item.id, item.type, item.description, item.amount, item.date, item.category);
    raw.close(); raw = null;
    database = openDatabase(path);
    const state = database.readState();
    assert.deepEqual(state.accounts, [defaultAccount()]);
    assert.deepEqual(state.transactions, [{ ...item, accountId: 'principal' }]);
    assert.deepEqual(state.transfers, []);
    assert.notEqual(state.revision, 'old-instance:5');
    assert.equal(accountBalances(state, '2026-11-30')[0].balance, item.amount);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('API antigua conserva cuentas y transferencias al editar movimientos', () => {
  const database = openDatabase(':memory:');
  try {
    const current = database.readState();
    const bank = { id: 'bank', name: 'Banco', type: 'bank', initialBalance: 100, initialDate: '2026-01-01' };
    const transfer = { id: 'transfer', fromAccountId: 'principal', toAccountId: 'bank', amount: 10, description: 'Ahorro', date: '2026-11-01' };
    const saved = database.replaceState({ accounts: [...current.accounts, bank], transactions: [{ ...item, accountId: 'bank' }], transfers: [transfer] }, current.revision);
    database.replace([{ ...item, amount: 1000 }], saved.revision);
    const after = database.readState();
    assert.deepEqual(after.accounts, saved.accounts);
    assert.deepEqual(after.transfers, [transfer]);
    assert.equal(after.transactions[0].accountId, 'bank');
    assert.equal(after.transactions[0].amount, 1000);
  } finally { database.close(); }
});
test('actualizar esquema v2 conserva saldos y movimientos al crear el catalogo', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-migrate-v2-'));
  let raw; let database;
  try {
    const path = join(directory, 'data.sqlite'); database = openDatabase(path);
    database.replace([item], database.read().revision);
    const before = database.readState(); database.close(); database = null;
    raw = new DatabaseSync(path); raw.exec('DROP TABLE debt_payments; DROP TABLE debts; DROP TABLE goal_contributions; DROP TABLE savings_goals; DROP TABLE categories; DROP TABLE recurrences; DROP TABLE budgets; PRAGMA user_version=2;'); raw.close(); raw = null;
    database = openDatabase(path); const after = database.readState();
    assert.deepEqual(after.transactions, before.transactions);
    assert.deepEqual(after.accounts, before.accounts);
    assert.deepEqual(after.categories, before.categories);
    assert.notEqual(after.revision, before.revision);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('actualizar esquema v3 conserva categorias archivadas y prepara recurrencias', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-migrate-v3-')); let database; let raw;
  try {
    const path = join(directory, 'data.sqlite'); database = openDatabase(path);
    const initial = database.readState();
    const before = database.replaceState({ ...initial, categories: [...initial.categories, { name: 'Personalizada', archived: true }] }, initial.revision);
    database.close(); database = null;
    raw = new DatabaseSync(path); raw.exec('DROP TABLE debt_payments; DROP TABLE debts; DROP TABLE goal_contributions; DROP TABLE savings_goals; DROP TABLE recurrences; DROP TABLE budgets; PRAGMA user_version=3;'); raw.close(); raw = null;
    database = openDatabase(path); const after = database.readState();
    assert.deepEqual(after.categories, before.categories); assert.deepEqual(after.recurrences, []);
    assert.notEqual(after.revision, before.revision);
  } finally { raw?.close(); database?.close(); rmSync(directory, { recursive: true, force: true }); }
});
