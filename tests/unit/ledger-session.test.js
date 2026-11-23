import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerSession } from '../../src/web/application/ledger-session.js';
import { defaultAccount } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';

const state = () => ({
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

test('sesion coordina carga, guardado y doble envio sin depender del DOM', async () => {
  let finish;
  let writes = 0;
  const session = createLedgerSession({
    load: async () => state(),
    save: (next) => {
      writes++;
      return new Promise((resolve) => {
        finish = () => resolve(next);
      });
    },
  });
  const changes = [];
  session.subscribe(() => changes.push(session.status));
  assert.equal(await session.save(state()), false);
  await session.load();
  const pending = session.save(state());
  assert.equal(session.status.saving, true);
  assert.equal(await session.save(state()), false);
  await assert.rejects(session.load(), /operación/);
  finish();
  assert.equal(await pending, true);
  assert.equal(writes, 1);
  assert.equal(session.status.saving, false);
  assert.ok(changes.length >= 4);
});

test('respuesta incierta bloquea nuevas escrituras hasta recargar; entrada invalida no llama al transporte', async () => {
  let writes = 0;
  const session = createLedgerSession({
    load: async () => state(),
    save: async () => {
      writes++;
      throw new Error('Respuesta perdida');
    },
  });
  await session.load();
  await assert.rejects(session.save({ ...state(), accounts: [] }), /Revisa/);
  assert.equal(writes, 0);
  assert.equal(session.status.ready, true);
  await assert.rejects(session.save(state()), /perdida/);
  assert.equal(session.status.ready, false);
  assert.equal(session.status.saving, false);
  assert.equal(await session.save(state()), false);
  assert.equal(writes, 1);
  await session.load();
  assert.equal(session.status.ready, true);
});
