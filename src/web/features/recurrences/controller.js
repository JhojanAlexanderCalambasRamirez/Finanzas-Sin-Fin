import { summarize } from '../../../domain/finance.js';
import { validLedger } from '../../../domain/ledger.js';
import { categoryList } from '../../../domain/movement-tools.js';
import { parseMoneyInput, validDate } from '../../../domain/validation.js';
import {
  recurrenceList,
  previewRecurrences,
  generateRecurrences,
} from '../../../domain/recurrences.js';

export function createRecurrencesController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  accountName,
  money,
  today,
  notify,
  clearFilters,
}) {
  let editingRuleId = null;
  let previewDate = null;
  let previewCount = 0;
  const ruleForm = $('#rule-form');
  function renderRules() {
    $('#rule-list').replaceChildren();
    for (const rule of recurrenceList(getState())) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = rule.description;
      const detail = document.createElement('small');
      detail.textContent = `${rule.type === 'income' ? 'Ingreso' : 'Gasto'} ${money(rule.amount)} · ${rule.frequency === 'monthly' ? 'Mensual' : 'Semanal'} · ${accountName(rule.accountId)} · ${rule.paused ? 'Pausada' : 'Activa'} · ${rule.generatedDates.length} fechas procesadas`;
      label.append(detail);
      const actions = document.createElement('div');
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar regla ${rule.description}`);
      edit.onclick = () => openRule(rule);
      const pause = document.createElement('button');
      pause.className = 'secondary';
      pause.textContent = rule.paused ? 'Reactivar' : 'Pausar';
      pause.setAttribute('aria-label', `${pause.textContent} regla ${rule.description}`);
      pause.onclick = async () => {
        const recurrences = recurrenceList(getState()).map((item) =>
          item.id === rule.id ? { ...item, paused: !item.paused } : item,
        );
        if (await persist({ ...getState(), recurrences })) {
          render();
          notify(
            rule.paused
              ? 'Regla reactivada. Revisa sus fechas pendientes antes de registrarlas.'
              : 'Regla pausada. Sus movimientos anteriores se conservan.',
          );
        }
      };
      actions.append(edit, pause);
      row.append(label, actions);
      $('#rule-list').append(row);
    }
    if (!recurrenceList(getState()).length) {
      const empty = document.createElement('li');
      empty.textContent =
        'Crea una regla para tu salario, arriendo u otros movimientos habituales.';
      $('#rule-list').append(empty);
    }
  }
  function openRule(rule = null) {
    editingRuleId = rule?.id || null;
    ruleForm.reset();
    $('#rule-error').textContent = '';
    $('#rule-title').textContent = rule ? 'Editar regla recurrente' : 'Nueva regla recurrente';
    for (const [name, options] of [
      [
        'accountId',
        getState().accounts.map((account) => ({ value: account.id, label: account.name })),
      ],
      [
        'category',
        categoryList(getState())
          .filter((category) => !category.archived || category.name === rule?.category)
          .map((category) => ({
            value: category.name,
            label: `${category.name}${category.archived ? ' (archivada)' : ''}`,
          })),
      ],
    ]) {
      const select = ruleForm.elements[name];
      select.replaceChildren();
      for (const option of options) {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.append(element);
      }
    }
    ruleForm.elements.startDate.value = today();
    if (rule)
      for (const field of [
        'type',
        'description',
        'amount',
        'accountId',
        'category',
        'frequency',
        'startDate',
        'endDate',
      ])
        ruleForm.elements[field].value = rule[field];
    $('#rule-dialog').showModal();
    ruleForm.elements.description.focus();
  }
  $('#new-rule').onclick = () => openRule();
  ruleForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(ruleForm);
      const previous = recurrenceList(getState()).find((rule) => rule.id === editingRuleId);
      const rule = {
        id: editingRuleId || crypto.randomUUID(),
        type: data.get('type'),
        description: data.get('description').trim(),
        amount: parseMoneyInput(data.get('amount')),
        accountId: data.get('accountId'),
        category: data.get('category'),
        frequency: data.get('frequency'),
        startDate: data.get('startDate'),
        endDate: data.get('endDate'),
        paused: previous?.paused || false,
        generatedDates: previous?.generatedDates || [],
      };
      const recurrences = previous
        ? recurrenceList(getState()).map((item) => (item.id === rule.id ? rule : item))
        : [...recurrenceList(getState()), rule];
      if (!validLedger({ ...getState(), recurrences }))
        throw new Error(
          'Revisa descripción, cuenta, categoría, fechas y límite de reglas. El inicio debe ser desde la apertura de la cuenta y el fin no puede ser anterior al inicio.',
        );
      if (await persist({ ...getState(), recurrences })) {
        render();
        $('#rule-dialog').close();
        notify('Regla guardada. Revisa pendientes para crear sus movimientos.');
      }
    } catch (error) {
      $('#rule-error').textContent = error.message;
    }
  };
  $('#preview-rules').onclick = () => {
    previewCount = 0;
    previewDate = null;
    try {
      const through = $('#recurrence-through').value;
      if (!validDate(through)) throw new Error('Selecciona una fecha de corte válida.');
      const preview = previewRecurrences(getState(), through);
      previewDate = through;
      previewCount = preview.entries.length;
      const totals = summarize(preview.entries.map((item) => item.transaction));
      $('#preview-summary').textContent =
        `${previewCount} movimientos hasta ${through.split('-').reverse().join('/')}. Ingresos: ${money(totals.income)}. Gastos: ${money(totals.expense)}. Solo se guardarán al pulsar Registrar pendientes.`;
      $('#preview-warnings').textContent = preview.blocked.map((item) => item.reason).join(' ');
      $('#generation-error').textContent = '';
      $('#preview-list').replaceChildren();
      for (const entry of preview.entries) {
        const row = document.createElement('li');
        row.textContent = `${entry.date.split('-').reverse().join('/')} · ${entry.transaction.description} · ${accountName(entry.transaction.accountId)} · ${money(entry.transaction.amount)}`;
        $('#preview-list').append(row);
      }
      setBusy();
      $('#preview-dialog').showModal();
    } catch (error) {
      notify(error.message);
      $('#recurrence-through').focus();
      setBusy();
    }
  };
  $('#confirm-generation').onclick = async () => {
    if (!previewDate || !previewCount || isSaving() || isProcessing() || !isReady()) return;
    try {
      const count = previewCount;
      const through = previewDate;
      if (await persist(generateRecurrences(getState(), through))) {
        $('#month').value = through.slice(0, 7);
        clearFilters();
        previewCount = 0;
        render();
        $('#preview-dialog').close();
        notify(
          `${count} movimientos recurrentes registrados. Sus fechas no se volverán a generar.`,
        );
      }
    } catch (error) {
      $('#generation-error').textContent = error.message;
    }
  };

  return {
    render: renderRules,
    editRule(id) {
      const rule = recurrenceList(getState()).find((item) => item.id === id);
      if (rule) openRule(rule);
    },
    openMonthlyExpense(month) {
      openRule();
      $('#rule-title').textContent = 'Nuevo gasto fijo mensual';
      ruleForm.elements.type.value = 'expense';
      ruleForm.elements.frequency.value = 'monthly';
      ruleForm.elements.startDate.value = month + '-01';
      ruleForm.elements.category.value = 'Transporte';
    },
    get pendingCount() {
      return previewCount;
    },
  };
}
