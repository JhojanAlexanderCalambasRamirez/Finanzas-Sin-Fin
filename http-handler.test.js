import test from 'node:test';
import assert from 'node:assert/strict';
import { invoke } from './testing-helpers.js';
import { openDatabase } from './database.js';
import { createHandler } from './http-handler.js';
import { createLedgerStore } from './api-store.js';
import { accountBalances } from './ledger.js';
import { saveCategory } from './movement-tools.js';

test('API valida, guarda, consulta y rechaza conflictos de revision', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  try {
    const initial = JSON.parse((await invoke(handler)).body);
    const item = { id: 'one', type: 'income', description: 'Salario', amount: 1000, date: '2026-11-20', category: 'Salario' };
    const options = { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'http://localhost:3080' }, body: JSON.stringify({ revision: initial.revision, transactions: [item] }) };
    const saved = await invoke(handler, options); assert.equal(saved.status, 200);
    assert.deepEqual(JSON.parse(saved.body).transactions, [item]);
    assert.equal((await invoke(handler, options)).status, 409);
    assert.deepEqual(JSON.parse((await invoke(handler)).body), JSON.parse(saved.body));
  } finally { database.close(); }
});
test('API rechaza origen ajeno, JSON invalido y cuerpo excesivo sin escribir', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  try {
    const initial = database.read();
    for (const [options, status] of [
      [{ headers: { host: 'malicious.example:3080' } }, 403],
      [{ headers: { 'sec-fetch-site': 'cross-site' } }, 403],
      [{ method: 'PUT', headers: { origin: 'https://other.example', 'content-type': 'application/json' } }, 403],
      [{ method: 'PUT' }, 415],
      [{ method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{' }, 400],
      [{ method: 'PUT', headers: { 'content-type': 'application/json' }, body: 'null' }, 400],
      [{ method: 'PUT', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(5 * 1024 * 1024 + 1) }, 413],
      [{ method: 'DELETE' }, 405]
    ]) assert.equal((await invoke(handler, options)).status, status);
    assert.deepEqual(database.read(), initial);
  } finally { database.close(); }
});
test('servidor sirve interfaz y modulos, salud y 404 sin exponer la base de datos', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  try {
    for (const url of ['/', '/app.js', '/api-store.js', '/finance.js', '/ledger.js', '/movement-tools.js', '/validation.js', '/recurrences.js', '/budgets.js', '/goals.js', '/debts.js', '/reports.js', '/transaction-store.js', '/styles.css', '/backup.css']) {
      const response = await invoke(handler, { url });
      assert.equal(response.status, 200); assert.ok(response.body.length);
    }
    assert.equal((await invoke(handler, { url: '/data/finanzas.sqlite' })).status, 404);
    assert.equal(JSON.parse((await invoke(handler, { url: '/health' })).body).storage, 'sqlite');
  } finally { database.close(); }
});
test('cliente de cuentas usa API y SQLite para guardar transferencias y rechazar una sesion obsoleta', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  const request = async (url, options = {}) => {
    const result = await invoke(handler, { url, method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
    return { ok: result.status >= 200 && result.status < 300, json: async () => JSON.parse(result.body) };
  };
  try {
    const first = createLedgerStore(request); const stale = createLedgerStore(request);
    const initial = await first.load(); await stale.load();
    const bank = { id: 'bank', name: 'Banco', type: 'bank', initialBalance: 100000, initialDate: '2026-01-01' };
    const transfer = { id: 'transfer', fromAccountId: 'principal', toAccountId: bank.id, amount: 30000, description: 'Ahorro', date: '2026-11-01' };
    const saved = await first.save({ ...initial, accounts: [...initial.accounts, bank], transfers: [transfer] });
    assert.deepEqual(accountBalances(saved, '2026-11-30').map(account => account.balance), [-30000, 130000]);
    await assert.rejects(stale.save(initial), /otra sesion/);
    const edited = await first.save({ ...saved, transfers: [{ ...transfer, amount: 50000 }] });
    assert.deepEqual(accountBalances(edited, '2026-11-30').map(account => account.balance), [-50000, 150000]);
    assert.deepEqual((await createLedgerStore(request).load()).transfers, edited.transfers);
    const removed = await first.save({ ...edited, transfers: [] });
    assert.deepEqual(accountBalances(removed, '2026-11-30').map(account => account.balance), [0, 100000]);
  } finally { database.close(); }
});
test('API persiste categorias personalizadas, renombrado historico y archivo sin alterar importes', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  try {
    const initial = database.readState();
    const custom = saveCategory(initial, null, 'Mascotas');
    custom.transactions.push({ id: 'vet', type: 'expense', description: 'Veterinaria', amount: 80000, date: '2026-11-20', category: 'Mascotas', accountId: 'principal' });
    const save = async state => invoke(handler, { method: 'PUT', url: '/api/state', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) });
    let result = await save({ ...custom, revision: initial.revision }); assert.equal(result.status, 200);
    let state = JSON.parse(result.body);
    result = await save(saveCategory(state, 'Mascotas', 'Cuidado animal')); assert.equal(result.status, 200);
    state = JSON.parse(result.body);
    state.categories = state.categories.map(item => item.name === 'Cuidado animal' ? { ...item, archived: true } : item);
    result = await save(state); assert.equal(result.status, 200);
    state = JSON.parse(result.body);
    assert.equal(state.transactions[0].category, 'Cuidado animal');
    assert.equal(state.transactions[0].amount, 80000);
    assert.equal(state.categories.find(item => item.name === 'Cuidado animal').archived, true);
    const revision = state.revision;
    result = await save({ ...state, transactions: [{ ...state.transactions[0], category: 'No existe' }] });
    assert.equal(result.status, 400); assert.equal(database.readState().revision, revision);
  } finally { database.close(); }
});
test('API devuelve 400 ante tipos falsos y datos corruptos sin modificar SQLite', async () => {
  const database = openDatabase(':memory:'); const handler = createHandler(database);
  try {
    const state = database.readState();
    const item = { id: 'one', type: 'income', description: 'Salario', amount: 100, date: '2026-11-20', category: 'Salario', accountId: 'principal' };
    const base = { ...state, transactions: [item] };
    const corrupt = [
      { ...base, accounts: [{ ...base.accounts[0], type: ['bank'] }] },
      { ...base, categories: null }, { ...base, recurrences: {} },
      ...['100', true, null, [], {}, -1, 0, 0.5].map(amount => ({ ...base, transactions: [{ ...item, amount }] })),
      ...['2026-02-30', '0000-01-01', '20/11/2026'].map(date => ({ ...base, transactions: [{ ...item, date }] })),
      ...[' ', '\u200b', 'Texto\u0000'].map(description => ({ ...base, transactions: [{ ...item, description }] })),
      { ...base, transactions: [item, item] },
      { ...base, transactions: [{ ...item, accountId: 'no existe' }] }
    ];
    for (const invalid of corrupt) {
      const result = await invoke(handler, { url: '/api/state', method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(invalid) });
      assert.equal(result.status, 400); assert.deepEqual(database.readState(), state);
    }
    assert.equal((await invoke(handler, { headers: { host: '[' } })).status, 400);
    assert.equal((await invoke(handler, { headers: { host: 'localhost:3080/path' } })).status, 403);
  } finally { database.close(); }
});
