import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.js';
import { createHandler } from './http-handler.js';

test('HTTP real registra un gasto, rechaza monto invalido y conserva SQLite al reabrir', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-network-'));
  const path = join(directory, 'test.sqlite'); let database; let server;
  try {
    database = openDatabase(path); server = http.createServer(createHandler(database));
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base + '/health')).status, 200);
    for (const asset of ['/', '/dashboard.js', '/loans.js', '/backup.css']) assert.equal((await fetch(base + asset)).status, 200);
    const initial = await (await fetch(base + '/api/state')).json();
    const next = { ...initial, transactions: [{ id: 'network-expense', type: 'expense', accountId: initial.accounts[0].id, description: 'Mercado de prueba', category: initial.categories[0].name, amount: 50000, date: '2026-11-23' }] };
    const save = payload => fetch(base + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const response = await save(next); assert.equal(response.status, 200);
    const stored = await response.json(); assert.equal(stored.transactions[0].amount, 50000);
    assert.equal((await save({ ...stored, transactions: [{ ...stored.transactions[0], amount: '1e3' }] })).status, 400);
    assert.equal((await save(next)).status, 409);
    const after = await (await fetch(base + '/api/state')).json(); assert.deepEqual(after, stored);
    await new Promise(resolve => server.close(resolve)); server = null;
    database.close(); database = openDatabase(path);
    assert.equal(database.readState().transactions[0].amount, 50000);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    database?.close(); rmSync(directory, { recursive: true, force: true });
  }
});
