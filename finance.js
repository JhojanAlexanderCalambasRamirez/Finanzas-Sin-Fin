export const categories = ['Salario', 'Otros ingresos', 'Alimentación', 'Vivienda', 'Transporte', 'Servicios', 'Salud', 'Ocio', 'Educación', 'Otros gastos'];
import { validText, validId, validDate } from './validation.js';
export function validTransaction(item) {
  return validTransactionWithCategories(item, categories);
}
export function validTransactionWithCategories(item, categoryNames) {
  return !!item && validId(item.id) && ['income', 'expense'].includes(item.type)
    && validText(item.description, 120)
    && categoryNames.includes(item.category) && Number.isSafeInteger(item.amount) && item.amount > 0 && item.amount <= 1000000000000
    && validDate(item.date);
}

export function validTransactions(items) {
  return validTransactionsWithCategories(items, categories);
}
export function validTransactionsWithCategories(items, categoryNames) {
  return Array.isArray(items) && items.length <= 5000 && items.every(item => validTransactionWithCategories(item, categoryNames))
    && new Set(items.map(item => item.id)).size === items.length;
}
export function summarize(items) {
  const income = items.filter(x => x.type === 'income').reduce((sum, x) => sum + x.amount, 0);
  const expense = items.filter(x => x.type === 'expense').reduce((sum, x) => sum + x.amount, 0);
  return { income, expense, balance: income - expense };
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'finanzas-sin-fin' || data.version !== 1 || !validTransactions(data.transactions)) {
    throw new Error('El archivo no es un respaldo valido de Finanzas sin fin.');
  }
  return data.transactions;
}

export function mergeTransactions(current, incoming) {
  const merged = new Map(current.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (previous && ['type', 'description', 'amount', 'date', 'category'].some(field => previous[field] !== item[field])) {
      throw new Error('Un movimiento del respaldo tiene cambios respecto al registro actual. Importa en un navegador vacio para conservar ambas versiones por separado.');
    }
    merged.set(item.id, item);
  }
  return [...merged.values()];
}
