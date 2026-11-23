import { validTransactionsWithCategories, parseBackup } from './finance.js';
import { categoryList, defaultCategories, validCategoryList } from './movement-tools.js';
import { validId, validText, validDate } from './validation.js';
export { validDate } from './validation.js';
import { recurrenceList, validRecurrences } from './recurrences.js';
import { budgetList, validBudgets } from './budgets.js';
import { goalList, contributionList, validGoals } from './goals.js';
import { debtList, paymentList, validDebts } from './debts.js';

export const mainAccountId = 'principal';
export const accountTypes = { cash: 'Efectivo', bank: 'Banco', wallet: 'Billetera' };
export const defaultAccount = () => ({ id: mainAccountId, name: 'Cuenta principal', type: 'cash', initialBalance: 0, initialDate: '0001-01-01' });
export function validAccount(account) {
  return !!account && validId(account.id) && validText(account.name, 60)
    && typeof account.type === 'string' && Object.hasOwn(accountTypes, account.type)
    && Number.isSafeInteger(account.initialBalance) && Math.abs(account.initialBalance) <= 1000000000000
    && validDate(account.initialDate);
}
export function validTransfer(transfer) {
  return !!transfer && validId(transfer.id) && validId(transfer.fromAccountId) && validId(transfer.toAccountId)
    && transfer.fromAccountId !== transfer.toAccountId && Number.isSafeInteger(transfer.amount)
    && transfer.amount > 0 && transfer.amount <= 1000000000000 && validDate(transfer.date)
    && validText(transfer.description, 120);
}
const unique = items => new Set(items.map(item => item.id)).size === items.length;
export function validLedger(state) {
  if (!state || !Array.isArray(state.accounts) || !state.accounts.length || state.accounts.length > 100
    || !state.accounts.every(validAccount) || !unique(state.accounts) || !state.accounts.some(account => account.id === mainAccountId)
    || !validCategoryList(categoryList(state)) || !validTransactionsWithCategories(state.transactions, categoryList(state).map(item => item.name)) || !Array.isArray(state.transfers) || state.transfers.length > 5000
    || !state.transfers.every(validTransfer) || !unique(state.transfers) || !validRecurrences(state) || !validBudgets(state) || !validGoals(state) || !validDebts(state)) return false;
  const accounts = new Map(state.accounts.map(account => [account.id, account]));
  const applicable = (id, date) => accounts.has(id) && date >= accounts.get(id).initialDate;
  let magnitude = 0;
  if (![...state.accounts.map(account => Math.abs(account.initialBalance)), ...state.transactions.map(item => item.amount), ...state.transfers.map(item => item.amount)]
    .every(amount => Number.isSafeInteger(magnitude += amount))) return false;
  return state.transactions.every(item => validDate(item.date) && applicable(item.accountId, item.date))
    && state.transfers.every(item => applicable(item.fromAccountId, item.date) && applicable(item.toAccountId, item.date));
}
export function accountBalances(state, asOf) {
  return state.accounts.map(account => {
    let balance = account.initialDate <= asOf ? account.initialBalance : 0;
    for (const item of state.transactions) {
      if (item.accountId === account.id && item.date <= asOf) balance += item.type === 'income' ? item.amount : -item.amount;
    }
    for (const transfer of state.transfers) {
      if (transfer.date > asOf) continue;
      if (transfer.fromAccountId === account.id) balance -= transfer.amount;
      if (transfer.toAccountId === account.id) balance += transfer.amount;
    }
    return { ...account, balance };
  });
}
export function monthEnd(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Selecciona un periodo valido.');
  const [year, number] = month.split('-').map(Number);
  if (year < 1 || number < 1 || number > 12) throw new Error('Selecciona un periodo valido.');
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return `${month}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
export function parseLedgerBackup(text) {
  const data = JSON.parse(text);
  if (data?.app === 'finanzas-sin-fin' && data.version === 1) {
    const transactions = parseBackup(text).map(item => ({ ...item, accountId: mainAccountId }));
    return { version: 1, accounts: [], categories: [], transactions, transfers: [], recurrences: [], budgets: [], goals: [], contributions: [], debts: [], debtPayments: [] };
  }
  if (data?.app !== 'finanzas-sin-fin' || ![2, 3, 4, 5, 6, 7].includes(data.version)
    || (data.version >= 3 && !Array.isArray(data.categories)) || (data.version >= 4 && !Array.isArray(data.recurrences))
    || (data.version >= 5 && !Array.isArray(data.budgets))
    || (data.version >= 6 && (!Array.isArray(data.goals) || !Array.isArray(data.contributions)))
    || (data.version === 7 && (!Array.isArray(data.debts) || !Array.isArray(data.debtPayments))) || !validLedger(data)) throw new Error('El respaldo de cuentas y movimientos no es valido.');
  return { version: data.version, accounts: data.accounts, categories: categoryList(data), transactions: data.transactions, transfers: data.transfers, recurrences: recurrenceList(data), budgets: budgetList(data), goals: goalList(data), contributions: contributionList(data), debts: debtList(data), debtPayments: paymentList(data) };
}
function mergeCollection(current, incoming, fields) {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (previous && fields.some(field => previous[field] !== item[field])) throw new Error('El respaldo contiene cambios en registros existentes. No se importo nada. Usa otra instancia para comparar.');
    if (!previous) merged.set(item.id, item);
  }
  return [...merged.values()];
}
export function mergeLedger(current, incoming) {
  const initial = defaultAccount();
  const pristine = current.accounts.length === 1 && !current.transactions.length && !current.transfers.length
    && Object.keys(initial).every(field => current.accounts[0][field] === initial[field]);
  const pristineCategories = JSON.stringify(categoryList(current)) === JSON.stringify(defaultCategories());
  if (pristine && pristineCategories && !recurrenceList(current).length && !budgetList(current).length && !goalList(current).length && !contributionList(current).length && !debtList(current).length && !paymentList(current).length && [2, 3, 4, 5, 6, 7].includes(incoming.version)) {
    const restored = { accounts: incoming.accounts, transactions: incoming.transactions, transfers: incoming.transfers, categories: categoryList(incoming), recurrences: recurrenceList(incoming), budgets: budgetList(incoming), goals: goalList(incoming), contributions: contributionList(incoming), debts: debtList(incoming), debtPayments: paymentList(incoming) };
    if (!validLedger(restored)) throw new Error('El respaldo no es valido.');
    return restored;
  }
  const accounts = mergeCollection(current.accounts, incoming.accounts, ['name', 'type', 'initialBalance', 'initialDate']);
  const transactions = mergeCollection(current.transactions, incoming.transactions, ['type', 'description', 'amount', 'date', 'category', 'accountId']);
  const transfers = mergeCollection(current.transfers, incoming.transfers, ['description', 'amount', 'date', 'fromAccountId', 'toAccountId']);
  const currentCategories = categoryList(current);
  const byName = new Map(currentCategories.map(item => [item.name, item]));
  const incomingCategories = incoming.version < 3
    ? [...categoryList(incoming), ...incoming.transactions.map(item => ({ name: item.category, archived: false }))]
    : categoryList(incoming);
  for (const category of incomingCategories) {
    const previous = byName.get(category.name);
    if (previous && incoming.version >= 3 && previous.archived !== category.archived) throw new Error('El respaldo tiene cambios en categorias existentes. No se importo nada.');
    if (!previous) byName.set(category.name, category);
  }
  const catalogue = [...byName.values()];
  const ruleFields = ['type', 'description', 'amount', 'category', 'accountId', 'frequency', 'startDate', 'endDate', 'paused'];
  const rules = mergeCollection(recurrenceList(current), recurrenceList(incoming), ruleFields);
  const recurrences = rules.map(rule => ({ ...rule, generatedDates: [...new Set([...rule.generatedDates, ...(recurrenceList(incoming).find(item => item.id === rule.id)?.generatedDates || [])])].sort() }));
  const budgets = mergeCollection(budgetList(current), budgetList(incoming), ['month', 'category', 'amount']);
  const goals = mergeCollection(goalList(current), goalList(incoming), ['name', 'targetAmount', 'startDate', 'targetDate', 'archived']);
  const contributions = mergeCollection(contributionList(current), contributionList(incoming), ['goalId', 'date', 'amount', 'note']);
  const debts = mergeCollection(debtList(current), debtList(incoming), ['name', 'creditor', 'amount', 'startDate', 'firstDueDate', 'installments', 'archived']);
  const debtPayments = mergeCollection(paymentList(current), paymentList(incoming), ['debtId', 'transactionId']);
  const merged = { accounts, transactions, transfers, categories: catalogue, recurrences, budgets, goals, contributions, debts, debtPayments };
  if (!validLedger(merged)) throw new Error('Revisa las cuentas, las fechas de apertura y el limite de registros. No se importo nada.');
  return merged;
}
export function ledgerBackup(state) {
  return { app: 'finanzas-sin-fin', version: 7, exportedAt: new Date().toISOString(), accounts: state.accounts, transactions: state.transactions, transfers: state.transfers, categories: categoryList(state), recurrences: recurrenceList(state), budgets: budgetList(state), goals: goalList(state), contributions: contributionList(state), debts: debtList(state), debtPayments: paymentList(state) };
}
