import { validDate, validId, validText } from './validation.js';
import { validTransactionWithCategories } from './finance.js';
import { categoryList } from './movement-tools.js';

export const recurrenceList = (state) => (state.recurrences === undefined ? [] : state.recurrences);
export function validRecurrences(state) {
  const rules = recurrenceList(state);
  if (
    !Array.isArray(rules) ||
    rules.length > 100 ||
    new Set(rules.map((rule) => rule?.id)).size !== rules.length
  )
    return false;
  let dates = 0;
  return rules.every((rule) => {
    if (
      !rule ||
      !validId(rule.id, 64) ||
      !['weekly', 'monthly'].includes(rule.frequency) ||
      typeof rule.paused !== 'boolean' ||
      !validDate(rule.startDate) ||
      (rule.endDate !== '' && (!validDate(rule.endDate) || rule.endDate < rule.startDate)) ||
      !validText(rule.description, 120) ||
      !Array.isArray(rule.generatedDates) ||
      rule.generatedDates.length > 5000 ||
      !rule.generatedDates.every(validDate) ||
      new Set(rule.generatedDates).size !== rule.generatedDates.length
    )
      return false;
    dates += rule.generatedDates.length;
    const account = state.accounts.find((account) => account.id === rule.accountId);
    return (
      dates <= 5000 &&
      !!account &&
      rule.startDate >= account.initialDate &&
      validTransactionWithCategories(
        { ...rule, date: rule.startDate },
        categoryList(state).map((item) => item.name),
      )
    );
  });
}
export function recurrenceDate(rule, index) {
  if (rule.frequency === 'weekly') {
    const date = new Date(`${rule.startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index * 7);
    const text = date.toISOString().slice(0, 10);
    return validDate(text) ? text : null;
  }
  const [year, month, day] = rule.startDate.split('-').map(Number);
  const offset = year * 12 + month - 1 + index;
  const targetYear = Math.floor(offset / 12);
  if (targetYear > 9999) return null;
  const prefix = `${String(targetYear).padStart(4, '0')}-${String((offset % 12) + 1).padStart(2, '0')}`;
  const last = new Date(`${prefix}-01T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return `${prefix}-${String(Math.min(day, last.getUTCDate())).padStart(2, '0')}`;
}
export function previewRecurrences(state, through) {
  if (!validDate(through) || !validRecurrences(state))
    throw new Error('Revisa las reglas y la fecha de corte.');
  const entries = [];
  const blocked = [];
  const existing = new Set(state.transactions.map((item) => item.id));
  for (const rule of recurrenceList(state)) {
    if (rule.paused) continue;
    if (categoryList(state).find((category) => category.name === rule.category)?.archived) {
      blocked.push({
        ruleId: rule.id,
        reason: `La categoria de ${rule.description} esta archivada.`,
      });
      continue;
    }
    const generated = new Set(rule.generatedDates);
    const limit = rule.endDate && rule.endDate < through ? rule.endDate : through;
    for (let index = 0; ; index++) {
      const date = recurrenceDate(rule, index);
      if (!date || date > limit) break;
      if (generated.has(date)) continue;
      const id = `rec:${rule.id}:${date}`;
      if (existing.has(id))
        throw new Error(
          'Hay un movimiento con el identificador de una recurrencia pendiente. No se generaron registros.',
        );
      entries.push({
        ruleId: rule.id,
        date,
        transaction: {
          id,
          type: rule.type,
          description: rule.description,
          amount: rule.amount,
          date,
          category: rule.category,
          accountId: rule.accountId,
        },
      });
      if (entries.length > 500)
        throw new Error(
          'Hay mas de 500 pendientes. Selecciona una fecha de corte anterior para generarlos por partes.',
        );
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date) || a.ruleId.localeCompare(b.ruleId));
  if (state.transactions.length + entries.length > 5000)
    throw new Error(
      'Los pendientes superan el limite de 5000 movimientos. Selecciona una fecha de corte anterior.',
    );
  if (
    recurrenceList(state).reduce((sum, rule) => sum + rule.generatedDates.length, 0) +
      entries.length >
    5000
  )
    throw new Error('Se alcanzo el limite de 5000 fechas recurrentes procesadas.');
  return { entries, blocked };
}
export function generateRecurrences(state, through) {
  const preview = previewRecurrences(state, through);
  return {
    ...state,
    transactions: [...state.transactions, ...preview.entries.map((item) => item.transaction)],
    recurrences: recurrenceList(state).map((rule) => ({
      ...rule,
      generatedDates: [
        ...rule.generatedDates,
        ...preview.entries.filter((item) => item.ruleId === rule.id).map((item) => item.date),
      ],
    })),
  };
}
