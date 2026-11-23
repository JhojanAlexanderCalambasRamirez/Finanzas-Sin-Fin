import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiStore } from './api-store.js';

const item = { id: 'one', type: 'income', description: 'Salario', amount: 1000, date: '2026-11-20', category: 'Salario' };
const response = (data, ok = true) => ({ ok, json: async () => data });
test('el cliente usa la revision recibida y confirma datos solo tras respuesta valida', async () => {
  let revision = 'database:0'; let saved;
  const store = createApiStore(async (_url, options) => {
    if (options.method === 'PUT') { saved = JSON.parse(options.body); revision = 'database:1'; }
    return response({ revision, transactions: saved?.transactions || [] });
  });
  await assert.rejects(store.save([item]));
  assert.deepEqual(await store.load(), []);
  assert.deepEqual(await store.save([item]), [item]);
  assert.equal(saved.revision, 'database:0');
});
test('una respuesta perdida bloquea nuevos guardados hasta recargar datos', async () => {
  let writes = 0;
  const store = createApiStore(async (_url, options) => {
    if (options.method === 'PUT') { writes++; throw new Error('Conexion perdida'); }
    return response({ revision: 'database:0', transactions: [] });
  });
  await store.load();
  await assert.rejects(store.save([item]), /comprobar/);
  await assert.rejects(store.save([item]), /Recarga/);
  assert.equal(writes, 1);
  await store.load(); await assert.rejects(store.save([item])); assert.equal(writes, 2);
});
test('un conflicto de revision no se confirma como guardado', async () => {
  const store = createApiStore(async (_url, options) => options.method === 'PUT'
    ? response({ error: 'Conflicto de revision' }, false)
    : response({ revision: 'database:0', transactions: [] }));
  await store.load(); await assert.rejects(store.save([item]), /Conflicto/);
});
test('consultar mientras se guarda no pisa la revision del cliente', async () => {
  let release; let writes = 0;
  const store = createApiStore(async (_url, options) => {
    if (options.method !== 'PUT') return response({ revision: 'database:0', transactions: [] });
    writes++;
    if (writes === 1) return new Promise(resolve => { release = () => resolve(response({ revision: 'database:1', transactions: [item] })); });
    assert.equal(JSON.parse(options.body).revision, 'database:1');
    return response({ revision: 'database:2', transactions: [item] });
  });
  await store.load(); const saving = store.save([item]);
  await assert.rejects(store.load(), /operacion actual/);
  release(); await saving; await store.save([item]); assert.equal(writes, 2);
});
