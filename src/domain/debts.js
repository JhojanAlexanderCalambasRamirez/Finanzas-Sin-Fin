import { validDate, validId, validText } from './validation.js';
import { validTransactionWithCategories } from './finance.js';
import { categoryList } from './movement-tools.js';

export const debtList = (state) => (state.debts === undefined ? [] : state.debts);
export const paymentList = (state) => (state.debtPayments === undefined ? [] : state.debtPayments);
export function installmentDate(debt, index) {
  const [year, month, day] = debt.firstDueDate.split('-').map(Number);
  const offset = year * 12 + month - 1 + index;
  const targetYear = Math.floor(offset / 12);
  if (targetYear > 9999) return null;
  const prefix = `${String(targetYear).padStart(4, '0')}-${String((offset % 12) + 1).padStart(2, '0')}`;
  const last = new Date(`${prefix}-01T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return `${prefix}-${String(Math.min(day, last.getUTCDate())).padStart(2, '0')}`;
}
export function validDebts(state) {
  const debts = debtList(state);
  const payments = paymentList(state);
  if (
    !Array.isArray(debts) ||
    debts.length > 100 ||
    !Array.isArray(payments) ||
    payments.length > 5000
  )
    return false;
  if (
    !Array.from(debts).every(
      (debt) =>
        debt &&
        validId(debt.id) &&
        validText(debt.name, 60) &&
        validText(debt.creditor, 100) &&
        Number.isSafeInteger(debt.amount) &&
        debt.amount > 0 &&
        debt.amount <= 1000000000000 &&
        Number.isSafeInteger(debt.installments) &&
        debt.installments >= 1 &&
        debt.installments <= 360 &&
        debt.installments <= debt.amount &&
        validDate(debt.startDate) &&
        validDate(debt.firstDueDate) &&
        debt.firstDueDate >= debt.startDate &&
        typeof debt.archived === 'boolean' &&
        validDate(installmentDate(debt, debt.installments - 1)),
    ) ||
    new Set(debts.map((debt) => debt.id)).size !== debts.length
  )
    return false;
  const byDebt = new Map(debts.map((debt) => [debt.id, debt]));
  const transactions = new Map(state.transactions.map((item) => [item.id, item]));
  const ids = new Set();
  const expenseIds = new Set();
  const paid = new Map();
  return Array.from(payments).every((payment) => {
    if (
      !payment ||
      !validId(payment.id) ||
      !byDebt.has(payment.debtId) ||
      ids.has(payment.id) ||
      expenseIds.has(payment.transactionId)
    )
      return false;
    const expense = transactions.get(payment.transactionId);
    const debt = byDebt.get(payment.debtId);
    if (!expense || expense.type !== 'expense' || expense.date < debt.startDate) return false;
    const total = (paid.get(debt.id) || 0) + expense.amount;
    if (!Number.isSafeInteger(total) || total > debt.amount) return false;
    ids.add(payment.id);
    expenseIds.add(expense.id);
    paid.set(debt.id, total);
    return true;
  });
}
export function debtSummary(state, asOf) {
  const transactions = new Map(state.transactions.map((item) => [item.id, item]));
  const totals = new Map();
  for (const payment of paymentList(state)) {
    const item = transactions.get(payment.transactionId);
    if (item && item.date <= asOf)
      totals.set(payment.debtId, (totals.get(payment.debtId) || 0) + item.amount);
  }
  return debtList(state).map((debt) => {
    const paid = totals.get(debt.id) || 0;
    let available = paid;
    const base = Math.floor(debt.amount / debt.installments);
    const extra = debt.amount % debt.installments;
    const schedule = Array.from({ length: debt.installments }, (_, index) => {
      const amount = base + (index < extra ? 1 : 0);
      const applied = Math.min(available, amount);
      available -= applied;
      const date = installmentDate(debt, index);
      const remaining = amount - applied;
      return {
        number: index + 1,
        date,
        amount,
        paid: applied,
        remaining,
        status: !remaining ? 'paid' : date < asOf ? 'overdue' : date === asOf ? 'due' : 'pending',
      };
    });
    const remaining = debt.amount - paid;
    const overdue = schedule
      .filter((item) => item.status === 'overdue')
      .reduce((sum, item) => sum + item.remaining, 0);
    return {
      ...debt,
      paid,
      remaining,
      overdue,
      schedule,
      firstPending: schedule.find((item) => item.remaining)?.date || '',
      status:
        debt.startDate > asOf
          ? 'not-started'
          : !remaining
            ? 'paid'
            : overdue
              ? 'overdue'
              : 'active',
    };
  });
}
export function recordDebtPayment(state, payment, expense = null) {
  let next = state;
  if (expense) {
    const account = state.accounts.find((item) => item.id === expense.accountId);
    if (
      expense.id !== payment.transactionId ||
      state.transactions.some((item) => item.id === expense.id) ||
      expense.type !== 'expense' ||
      !validTransactionWithCategories(
        expense,
        categoryList(state).map((item) => item.name),
      ) ||
      !account ||
      expense.date < account.initialDate
    )
      throw new Error('El gasto del pago no es valido o ya existe.');
    next = { ...state, transactions: [...state.transactions, expense] };
  }
  next = { ...next, debtPayments: [...paymentList(state), payment] };
  if (!validDebts(next))
    throw new Error(
      'Revisa la deuda y el gasto: no se admiten pagos duplicados, anteriores al inicio ni superiores al saldo pendiente.',
    );
  return next;
}
export function removeTransactionWithPayment(state, id) {
  return {
    ...state,
    transactions: state.transactions.filter((item) => item.id !== id),
    debtPayments: paymentList(state).filter((item) => item.transactionId !== id),
  };
}
