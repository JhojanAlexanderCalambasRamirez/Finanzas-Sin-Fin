import { summarize } from './finance.js';
import { validDate } from './validation.js';
import { filterMovements } from './movement-tools.js';

export function monthlyHistory(state, month, count = 6) {
  if (
    !/^\d{4}-\d{2}$/.test(month) ||
    !validDate(`${month}-01`) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 24
  )
    throw new Error('Periodo de informe no valido.');
  const [year, number] = month.split('-').map(Number);
  const selected = year * 12 + number - 1;
  const result = [];
  for (let index = count - 1; index >= 0; index--) {
    const offset = selected - index;
    const currentYear = Math.floor(offset / 12);
    if (currentYear < 1) continue;
    const current = `${String(currentYear).padStart(4, '0')}-${String((offset % 12) + 1).padStart(2, '0')}`;
    result.push({
      month: current,
      ...summarize(state.transactions.filter((item) => item.date.startsWith(current))),
    });
  }
  return result;
}
function cell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function movementsCsv(state, filters) {
  const names = new Map(state.accounts.map((item) => [item.id, item.name]));
  const rows = [
    ['Fecha', 'Tipo', 'Descripcion', 'Categoria', 'Cuenta origen', 'Cuenta destino', 'Monto (COP)'],
  ];
  for (const item of filterMovements(state, filters))
    rows.push([
      item.date,
      { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' }[item.type],
      item.description,
      item.kind === 'transfer' ? '' : item.category,
      names.get(item.kind === 'transfer' ? item.fromAccountId : item.accountId),
      item.kind === 'transfer' ? names.get(item.toAccountId) : '',
      item.amount,
    ]);
  return '\ufeff' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
