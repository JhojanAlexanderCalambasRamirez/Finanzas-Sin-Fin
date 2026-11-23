import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, summarize } from './finance.js';
import { defaultAccount, validLedger, ledgerBackup, parseLedgerBackup, mergeLedger } from './ledger.js';
import { defaultCategories, validCategoryList, saveCategory, filterMovements } from './movement-tools.js';

const salary = { id: 'salary', type: 'income', description: 'Pago mensual', amount: 3000000, date: '2026-11-15', accountId: 'principal', category: 'Salario' };
const course = { ...salary, id: 'course', type: 'expense', description: 'Curso de programación', amount: 100000, category: categories[8] };
const transfer = { id: 'transfer', fromAccountId: 'principal', toAccountId: 'bank', amount: 50000, date: '2026-11-15', description: 'Reserva mensual' };
const fixture = () => ({ accounts: [defaultAccount(), { id: 'bank', name: 'Ahorros', type: 'bank', initialBalance: 0, initialDate: '2026-01-01' }],
  categories: defaultCategories(), transactions: [salary, course, { ...salary, id: 'past', date: '2026-10-15' }], transfers: [transfer], recurrences: [], budgets: [], goals: [], contributions: [], debts: [], debtPayments: [] });

test('busqueda combina mes, tipo, cuenta, categoria y palabras sin tildes', () => {
  const state = fixture(); const original = structuredClone(state);
  const visible = filterMovements(state, { month: '2026-11', type: 'expense', accountId: 'principal', category: categories[8], query: 'PROGRAMACION  principal' });
  assert.deepEqual(visible.map(item => item.id), ['course']);
  assert.deepEqual(summarize(visible), { income: 0, expense: 100000, balance: -100000 });
  assert.deepEqual(state, original);
  assert.deepEqual(filterMovements(state, { month: '2026-11', query: 'no existe' }), []);
  assert.equal(filterMovements(state, { month: '2026-11' }).length, 3);
});
test('filtro por cuenta encuentra transferencias por ambos extremos y categoria las excluye', () => {
  const state = fixture();
  for (const accountId of ['principal', 'bank']) assert.deepEqual(filterMovements(state, { month: '2026-11', type: 'transfer', accountId }).map(item => item.id), ['transfer']);
  assert.deepEqual(filterMovements(state, { month: '2026-11', type: 'transfer', category: 'Salario' }), []);
  assert.deepEqual(filterMovements(state, { month: '2026-11', accountId: 'bank', query: 'ahorros reserva' }).map(item => item.id), ['transfer']);
});
test('crear y renombrar categorias actualiza historial sin alterar totales', () => {
  const state = fixture();
  const created = saveCategory(state, null, ' Mascotas ');
  assert.equal(created.categories.at(-1).name, 'Mascotas');
  const renamed = saveCategory(created, 'Salario', 'Honorarios');
  assert.equal(renamed.transactions.find(item => item.id === 'salary').category, 'Honorarios');
  assert.equal(validLedger(renamed), true);
  assert.deepEqual(summarize(renamed.transactions), summarize(state.transactions));
  assert.equal(state.transactions[0].category, 'Salario');
  assert.throws(() => saveCategory(state, null, '  EDUCACION '));
  assert.throws(() => saveCategory(state, 'Salario', 'Otros gastos'));
  assert.equal(validCategoryList([{ name: 'Duplicado', archived: false }, { name: 'DUPLICÁDO', archived: true }]), false);
});
test('archivar conserva historial, filtros y respaldo completo de categorias personalizadas', () => {
  const renamed = saveCategory(fixture(), 'Salario', 'Honorarios');
  const state = { ...renamed, categories: renamed.categories.map(item => ({ ...item, archived: item.name === 'Honorarios' })) };
  assert.equal(validLedger(state), true);
  assert.equal(filterMovements(state, { month: '2026-11', category: 'Honorarios' }).length, 1);
  const backup = parseLedgerBackup(JSON.stringify(ledgerBackup(state)));
  const restored = mergeLedger({ accounts: [defaultAccount()], categories: defaultCategories(), transactions: [], transfers: [] }, backup);
  assert.deepEqual(restored, state);
  assert.deepEqual(mergeLedger(restored, backup), state);
  assert.throws(() => mergeLedger(restored, { ...backup, categories: backup.categories.map(item => ({ ...item, archived: false })) }));
});
test('respaldo v2 mantiene compatibilidad y catalogo actual al importar', () => {
  const state = fixture();
  const old = JSON.stringify({ app: 'finanzas-sin-fin', version: 2, accounts: state.accounts, transactions: state.transactions, transfers: state.transfers });
  const archived = { ...state, categories: state.categories.map(item => ({ ...item, archived: true })) };
  assert.deepEqual(mergeLedger(archived, parseLedgerBackup(old)), archived);
  assert.throws(() => parseLedgerBackup(JSON.stringify({ ...ledgerBackup(state), categories: [] })));
});
test('una categoria llamada all se puede filtrar sin confundirse con todas', () => {
  const state = saveCategory(fixture(), 'Salario', 'all');
  assert.deepEqual(filterMovements(state, { month: '2026-11', category: 'all' }).map(item => item.id), ['salary']);
});
