import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransactionStore } from '../../src/web/data/legacy-store.js';
import { summarize, parseBackup, mergeTransactions } from '../../src/domain/finance.js';

const income = {
  id: 'salary',
  type: 'income',
  description: 'Salario',
  amount: 3000000,
  date: '2026-11-20',
  category: 'Salario',
};
const expense = {
  ...income,
  id: 'food',
  type: 'expense',
  description: 'Mercado',
  amount: 200000,
  category: 'Otros gastos',
};
function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}
test('crear, editar, restaurar y eliminar conserva los saldos al recargar', () => {
  const storage = memoryStorage();
  const store = createTransactionStore(storage);
  assert.deepEqual(store.load(), []);
  store.save([income, expense]);
  const edited = { ...expense, amount: 350000 };
  store.save([income, edited]);
  assert.equal(summarize(createTransactionStore(storage).load()).balance, 2650000);
  const backup = JSON.stringify({
    app: 'finanzas-sin-fin',
    version: 1,
    transactions: store.load(),
  });
  const destination = createTransactionStore(memoryStorage());
  destination.load();
  destination.save(mergeTransactions([], parseBackup(backup)));
  assert.deepEqual(destination.load(), [income, edited]);
  store.save([income]);
  assert.deepEqual(createTransactionStore(storage).load(), [income]);
});
test('datos corruptos o duplicados bloquean escrituras y conservan el original', () => {
  for (const original of ['{', '{}', JSON.stringify([income, income])]) {
    const storage = memoryStorage(original);
    const store = createTransactionStore(storage);
    assert.throws(() => store.load());
    assert.throws(() => store.save([expense]));
    assert.equal(storage.getItem(), original);
  }
});
test('una pestana desactualizada no sobrescribe cambios de otra', () => {
  const storage = memoryStorage();
  const first = createTransactionStore(storage);
  const second = createTransactionStore(storage);
  first.load();
  second.load();
  first.save([income]);
  assert.throws(() => second.save([expense]), /otra pestana/);
  assert.deepEqual(first.load(), [income]);
});
test('fallo de almacenamiento no confirma escritura ni impide reintentar', () => {
  const storage = memoryStorage();
  const store = createTransactionStore(storage);
  store.load();
  const write = storage.setItem;
  storage.setItem = () => {
    throw new Error('Sin espacio');
  };
  assert.throws(() => store.save([income]), /Sin espacio/);
  assert.equal(storage.getItem(), null);
  storage.setItem = write;
  store.save([income]);
  assert.deepEqual(store.load(), [income]);
});
