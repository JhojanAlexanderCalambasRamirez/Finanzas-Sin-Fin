import { categories } from './finance.js';
import { validText } from './validation.js';

export const normalizeText = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()
    .replace(/\s+/g, ' ');
export const defaultCategories = () => categories.map((name) => ({ name, archived: false }));
export const categoryList = (state) =>
  state.categories === undefined ? defaultCategories() : state.categories;
export function validCategoryList(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.length <= 100 &&
    items.every(
      (item) =>
        item &&
        validText(item.name, 60) &&
        item.name === item.name.trim() &&
        typeof item.archived === 'boolean',
    ) &&
    new Set(items.map((item) => normalizeText(item.name))).size === items.length
  );
}
export function saveCategory(state, oldName, name) {
  name = name.trim();
  const current = categoryList(state);
  if (oldName && !current.some((item) => item.name === oldName))
    throw new Error('La categoria ya no existe. Recarga la pagina.');
  const next = oldName
    ? current.map((item) => (item.name === oldName ? { ...item, name } : item))
    : [...current, { name, archived: false }];
  if (!validCategoryList(next))
    throw new Error('Usa un nombre unico de 1 a 60 caracteres. Maximo: 100 categorias.');
  return {
    ...state,
    categories: next,
    transactions: state.transactions.map((item) =>
      item.category === oldName ? { ...item, category: name } : item,
    ),
    ...(state.recurrences === undefined
      ? {}
      : {
          recurrences: state.recurrences.map((rule) =>
            rule.category === oldName ? { ...rule, category: name } : rule,
          ),
        }),
    ...(state.budgets === undefined
      ? {}
      : {
          budgets: state.budgets.map((budget) =>
            budget.category === oldName ? { ...budget, category: name } : budget,
          ),
        }),
  };
}
export function filterMovements(
  state,
  { month, type = 'all', accountId = '', category = '', query = '' },
) {
  const names = new Map(state.accounts.map((account) => [account.id, account.name]));
  const words = normalizeText(query).split(' ').filter(Boolean);
  return [
    ...state.transactions.map((item) => ({ ...item, kind: 'transaction' })),
    ...state.transfers.map((item) => ({ ...item, kind: 'transfer', type: 'transfer' })),
  ]
    .filter((item) => {
      if (!item.date.startsWith(month) || (type !== 'all' && item.type !== type)) return false;
      if (
        accountId &&
        (item.kind === 'transfer'
          ? item.fromAccountId !== accountId && item.toAccountId !== accountId
          : item.accountId !== accountId)
      )
        return false;
      if (category && (item.kind === 'transfer' || item.category !== category)) return false;
      const text = normalizeText(
        [
          item.description,
          item.category || 'Transferencia',
          item.date,
          { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' }[item.type],
          names.get(item.accountId),
          names.get(item.fromAccountId),
          names.get(item.toAccountId),
        ]
          .filter(Boolean)
          .join(' '),
      );
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
