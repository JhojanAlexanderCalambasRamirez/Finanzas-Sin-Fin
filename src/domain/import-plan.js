import { parseLedgerBackup, mergeLedger, accountBalances } from './ledger.js';

export const importLabels = {
  accounts: 'Cuentas',
  transactions: 'Ingresos y gastos',
  transfers: 'Transferencias',
  categories: 'Categorías',
  recurrences: 'Reglas recurrentes',
  budgets: 'Presupuestos',
  goals: 'Metas',
  contributions: 'Aportes',
  debts: 'Deudas',
  debtPayments: 'Pagos de deuda',
};
export function prepareImport(current, text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error('El respaldo debe ser JSON y no superar 5 MB.');
  const incoming = parseLedgerBackup(text);
  const next = mergeLedger(current, incoming);
  const rows = Object.entries(importLabels).map(([field, label]) => ({
    field,
    label,
    current: current[field]?.length || 0,
    incoming: incoming[field]?.length || 0,
    result: next[field].length,
    added: Math.max(0, next[field].length - (current[field]?.length || 0)),
  }));
  const changed = rows.some(
    (row) => JSON.stringify(next[row.field]) !== JSON.stringify(current[row.field] || []),
  );
  const dates = [...incoming.transactions, ...incoming.transfers].map((item) => item.date).sort();
  return {
    next,
    rows,
    changed,
    lastDate: dates.at(-1) || '',
    totalBalance: accountBalances(next, '9999-12-31').reduce(
      (sum, account) => sum + account.balance,
      0,
    ),
  };
}
