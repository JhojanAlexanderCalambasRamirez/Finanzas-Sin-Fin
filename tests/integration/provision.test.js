import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { provisionDatabase } from '../../src/infrastructure/sqlite/provision.js';

test('aprovisionamiento crea directorios, catalogos y esquema; repetir conserva datos y revision', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-provision-'));
  const path = join(directory, 'nested', 'data.sqlite');
  let database;
  try {
    const first = provisionDatabase(path);
    assert.equal(first.ready, true);
    assert.equal(first.accounts, 1);
    assert.ok(first.categories > 0);
    assert.equal(first.transactions, 0);
    assert.deepEqual(provisionDatabase(path), first);
    database = openDatabase(path);
    const state = database.readState();
    const stored = database.replaceState(
      {
        ...state,
        transactions: [
          {
            id: 'seed-check',
            accountId: state.accounts[0].id,
            type: 'income',
            description: 'Ingreso de prueba',
            category: 'Salario',
            amount: 100000,
            date: '2026-11-23',
          },
        ],
      },
      state.revision,
    );
    database.close();
    database = null;
    const second = provisionDatabase(path);
    assert.equal(second.revision, stored.revision);
    assert.equal(second.transactions, 1);
    const command = spawnSync(process.execPath, ['scripts/init-db.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_PATH: path },
    });
    assert.equal(command.status, 0, command.stderr);
    assert.match(command.stdout, /movimientos: 1/);
    database = openDatabase(path);
    assert.deepEqual(database.readState(), stored);
  } finally {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
