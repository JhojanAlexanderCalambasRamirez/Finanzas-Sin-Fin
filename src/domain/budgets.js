import { validId, validDate } from './validation.js';
import { categoryList } from './movement-tools.js';

export const budgetList = (state) => (state.budgets === undefined ? [] : state.budgets);
export function previewBudgetCopy(state, sourceMonth, targetMonth) {
  if (
    ![sourceMonth, targetMonth].every(
      (month) =>
        typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) && validDate(`${month}-01`),
    ) ||
    sourceMonth === targetMonth
  )
    throw new Error('Selecciona dos meses válidos y distintos.');
  const existing = new Set(
    budgetList(state)
      .filter((item) => item.month === targetMonth)
      .map((item) => item.category),
  );
  const active = new Set(
    categoryList(state)
      .filter((item) => !item.archived)
      .map((item) => item.name),
  );
  const source = budgetList(state).filter((item) => item.month === sourceMonth);
  const candidates = source.filter(
    (item) => active.has(item.category) && !existing.has(item.category),
  );
  return { sourceMonth, targetMonth, candidates, skipped: source.length - candidates.length };
}
export function copyBudgets(state, sourceMonth, targetMonth, makeId) {
  const preview = previewBudgetCopy(state, sourceMonth, targetMonth);
  const additions = preview.candidates.map((item) => ({
    ...item,
    id: makeId(),
    month: targetMonth,
  }));
  const next = { ...state, budgets: [...budgetList(state), ...additions] };
  if (!validBudgets(next))
    throw new Error(
      'No se pudieron copiar los límites: revisa identificadores y el máximo de 1000 presupuestos.',
    );
  return next;
}
export function validBudgets(state) {
  const budgets = budgetList(state);
  if (!Array.isArray(budgets) || budgets.length > 1000) return false;
  const ids = new Set();
  const slots = new Set();
  return Array.from(budgets).every((budget) => {
    if (
      !budget ||
      !validId(budget.id) ||
      typeof budget.month !== 'string' ||
      !/^\d{4}-\d{2}$/.test(budget.month) ||
      !validDate(`${budget.month}-01`) ||
      !Number.isSafeInteger(budget.amount) ||
      budget.amount <= 0 ||
      budget.amount > 1000000000000 ||
      !categoryList(state).some((category) => category.name === budget.category)
    )
      return false;
    const slot = JSON.stringify([budget.month, budget.category]);
    if (ids.has(budget.id) || slots.has(slot)) return false;
    ids.add(budget.id);
    slots.add(slot);
    return true;
  });
}
export function budgetSummary(state, month) {
  const spent = new Map();
  for (const item of state.transactions) {
    if (item.type === 'expense' && item.date.startsWith(month))
      spent.set(item.category, (spent.get(item.category) || 0) + item.amount);
  }
  return budgetList(state)
    .filter((budget) => budget.month === month)
    .map((budget) => {
      const expense = spent.get(budget.category) || 0;
      const percent = (expense / budget.amount) * 100;
      return {
        ...budget,
        spent: expense,
        remaining: budget.amount - expense,
        percent,
        status:
          expense > budget.amount
            ? 'exceeded'
            : expense === budget.amount
              ? 'reached'
              : percent >= 80
                ? 'warning'
                : 'ok',
      };
    });
}
