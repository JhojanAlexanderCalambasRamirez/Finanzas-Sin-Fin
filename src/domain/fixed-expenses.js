import { recurrenceList, recurrenceDate } from './recurrences.js';
import { categoryList } from './movement-tools.js';
import { monthEnd, validLedger } from './ledger.js';

export function fixedExpensesSummary(state, month) {
  const end = monthEnd(month);
  const [year, number] = month.split('-').map(Number);
  const rows = recurrenceList(state)
    .filter((rule) => rule.type === 'expense' && rule.frequency === 'monthly' && !rule.paused)
    .flatMap((rule) => {
      const [startYear, startMonth] = rule.startDate.split('-').map(Number);
      const index = (year - startYear) * 12 + number - startMonth;
      if (index < 0) return [];
      const date = recurrenceDate(rule, index);
      if (!date || date > end || (rule.endDate && date > rule.endDate)) return [];
      const transactionId = `rec:${rule.id}:${date}`;
      const expense = state.transactions.find((item) => item.id === transactionId);
      const processed = rule.generatedDates.includes(date);
      const blocked = categoryList(state).find((item) => item.name === rule.category)?.archived;
      const recorded =
        expense?.type === 'expense' && expense.date.startsWith(month) ? expense.amount : 0;
      const status = processed
        ? !recorded
          ? 'missing'
          : recorded < rule.amount
            ? 'partial'
            : 'recorded'
        : expense
          ? 'collision'
          : blocked
            ? 'blocked'
            : 'pending';
      return [
        {
          ruleId: rule.id,
          name: rule.description,
          category: rule.category,
          accountId: rule.accountId,
          date,
          expected: rule.amount,
          recorded,
          remaining: Math.max(0, rule.amount - recorded),
          status,
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return {
    rows,
    planned: rows.reduce((sum, item) => sum + item.expected, 0),
    recorded: rows.reduce((sum, item) => sum + item.recorded, 0),
    pending: rows.reduce((sum, item) => sum + item.remaining, 0),
  };
}

export function recordFixedExpense(state, ruleId, month) {
  const row = fixedExpensesSummary(state, month).rows.find((item) => item.ruleId === ruleId);
  if (!row || row.status !== 'pending')
    throw new Error(
      'Este gasto no está pendiente de registro. Revisa su regla o el movimiento existente.',
    );
  const transaction = {
    id: `rec:${row.ruleId}:${row.date}`,
    type: 'expense',
    description: row.name,
    amount: row.expected,
    date: row.date,
    category: row.category,
    accountId: row.accountId,
  };
  const next = {
    ...state,
    transactions: [...state.transactions, transaction],
    recurrences: recurrenceList(state).map((rule) =>
      rule.id === row.ruleId
        ? { ...rule, generatedDates: [...rule.generatedDates, row.date] }
        : rule,
    ),
  };
  if (!validLedger(next))
    throw new Error('El gasto supera los límites o sus datos no son válidos. No se registró.');
  return next;
}
