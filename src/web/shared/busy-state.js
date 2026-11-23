import { $ } from './dom.js';

export function renderBusyState(
  { saving, processing, ready },
  { pendingRecurrences, pendingBudgets, page, pageCount },
) {
  const disabled = saving || processing || !ready;
  $('.private').textContent = saving
    ? 'Guardando…'
    : ready
      ? 'Datos cargados en este equipo'
      : 'Sin conexión confirmada';
  $('#reload-data').hidden = ready || saving;
  $('#reload-data').disabled = saving || processing;
  for (const form of document.querySelectorAll('dialog form'))
    form.setAttribute('aria-busy', String(saving));
  for (const button of document.querySelectorAll(
    '#add, #first, #new-account, #new-category, #new-rule, #new-budget, #copy-budgets, #new-goal, #new-debt, #debt-cards button, #debt-payment-list button, #goal-cards button, #contribution-list button, #budget-cards button, #preview-rules, #export, #import, #migrate, #rows button, #account-cards button, #category-list button, #rule-list button, button[type="submit"]',
  ))
    button.disabled = disabled;
  $('#confirm-generation').disabled = disabled || !pendingRecurrences;
  $('#confirm-budget-copy').disabled = disabled || !pendingBudgets;
  $('#export-csv').disabled = disabled;
  $('#previous-page').disabled = disabled || page <= 1;
  $('#next-page').disabled = disabled || page >= pageCount;
  for (const button of document.querySelectorAll('[data-close]')) button.disabled = saving;
  for (const input of document.querySelectorAll('dialog input')) input.readOnly = saving;
  for (const select of document.querySelectorAll('dialog select')) {
    if (saving) {
      if (select.dataset.wasDisabled === undefined)
        select.dataset.wasDisabled = String(select.disabled);
      select.disabled = true;
    } else if (select.dataset.wasDisabled !== undefined) {
      select.disabled = select.dataset.wasDisabled === 'true';
      delete select.dataset.wasDisabled;
    }
  }
}
