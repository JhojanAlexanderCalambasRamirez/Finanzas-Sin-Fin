import { categoryList } from '../../../domain/movement-tools.js';
import { parseMoneyInput, validDate } from '../../../domain/validation.js';
import {
  budgetList,
  budgetSummary,
  previewBudgetCopy,
  copyBudgets,
} from '../../../domain/budgets.js';
import { monthlyHistory } from '../../../domain/reports.js';

export function createBudgetsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  money,
  notify,
}) {
  let editingBudgetId = null;
  let budgetCopyPreview = null;
  const budgetForm = $('#budget-form');
  function renderBudgets() {
    const summaries = budgetSummary(getState(), $('#month').value);
    const limit = summaries.reduce((sum, budget) => sum + budget.amount, 0);
    const spent = summaries.reduce((sum, budget) => sum + budget.spent, 0);
    const budgeted = new Set(summaries.map((budget) => budget.category));
    const unbudgeted = getState()
      .transactions.filter(
        (item) =>
          item.type === 'expense' &&
          item.date.startsWith($('#month').value) &&
          !budgeted.has(item.category),
      )
      .reduce((sum, item) => sum + item.amount, 0);
    $('#budget-summary').textContent =
      `Periodo ${$('#month').value} · Límites ${money(limit)} · Gastado en categorías con límite ${money(spent)} · Gastos sin límite ${money(unbudgeted)}`;
    $('#budget-cards').replaceChildren();
    const labels = {
      ok: 'Dentro del límite',
      warning: 'Atención: 80 % o más',
      reached: 'Límite alcanzado',
      exceeded: 'Límite superado',
    };
    for (const budget of summaries) {
      const card = document.createElement('article');
      card.className = `account-card budget-card ${budget.status}`;
      const title = document.createElement('h3');
      title.textContent = budget.category;
      const status = document.createElement('p');
      status.className = 'budget-status';
      status.textContent = labels[budget.status];
      const value = document.createElement('strong');
      value.textContent = money(budget.spent);
      const detail = document.createElement('p');
      detail.textContent = `De ${money(budget.amount)} · ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(budget.percent)} % usado`;
      const remaining = document.createElement('p');
      remaining.textContent =
        budget.remaining < 0
          ? `Exceso: ${money(-budget.remaining)}`
          : `Disponible: ${money(budget.remaining)}`;
      const progress = document.createElement('progress');
      progress.max = 100;
      progress.value = Math.min(100, budget.percent);
      progress.setAttribute('aria-label', `Consumo del presupuesto ${budget.category}`);
      const actions = document.createElement('div');
      actions.className = 'budget-actions';
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar límite ${budget.category}`);
      edit.onclick = () => openBudget(budget);
      const remove = document.createElement('button');
      remove.className = 'secondary';
      remove.textContent = 'Quitar límite';
      remove.setAttribute('aria-label', `Quitar límite ${budget.category}`);
      remove.onclick = async () => {
        if (
          !confirm(
            `¿Quitar el límite de ${budget.category} para ${budget.month}? Los movimientos se conservarán.`,
          )
        )
          return;
        if (
          await persist({
            ...getState(),
            budgets: budgetList(getState()).filter((item) => item.id !== budget.id),
          })
        ) {
          render();
          notify('Límite eliminado. Los gastos se conservan.');
        }
      };
      actions.append(edit, remove);
      card.append(title, status, value, detail, progress, remaining, actions);
      $('#budget-cards').append(card);
    }
    if (!summaries.length) {
      const empty = document.createElement('p');
      empty.className = 'form-intro';
      empty.textContent =
        'Este mes aún no tiene límites. Crea uno para empezar a comparar tus gastos.';
      $('#budget-cards').append(empty);
    }
  }
  function openBudget(budget = null) {
    editingBudgetId = budget?.id || null;
    budgetForm.reset();
    $('#budget-error').textContent = '';
    $('#budget-title').textContent = budget ? 'Editar límite mensual' : 'Nuevo límite mensual';
    budgetForm.elements.month.value = budget?.month || $('#month').value;
    const select = budgetForm.elements.category;
    select.replaceChildren();
    for (const category of categoryList(getState()).filter(
      (item) => !item.archived || item.name === budget?.category,
    )) {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = `${category.name}${category.archived ? ' (archivada)' : ''}`;
      select.append(option);
    }
    if (budget) {
      select.value = budget.category;
      budgetForm.elements.amount.value = budget.amount;
    }
    $('#budget-dialog').showModal();
    budgetForm.elements.amount.focus();
  }
  $('#new-budget').onclick = () => openBudget();
  budgetForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(budgetForm);
      const budget = {
        id: editingBudgetId || crypto.randomUUID(),
        month: data.get('month'),
        category: data.get('category'),
        amount: parseMoneyInput(data.get('amount')),
      };
      if (
        !validDate(`${budget.month}-01`) ||
        !categoryList(getState()).some((category) => category.name === budget.category)
      )
        throw new Error('Selecciona un mes y una categoría válidos.');
      if (
        budgetList(getState()).some(
          (item) =>
            item.id !== budget.id &&
            item.month === budget.month &&
            item.category === budget.category,
        )
      )
        throw new Error('Ya existe un límite para esa categoría y mes. Edita el límite existente.');
      const budgets = editingBudgetId
        ? budgetList(getState()).map((item) => (item.id === editingBudgetId ? budget : item))
        : [...budgetList(getState()), budget];
      if (await persist({ ...getState(), budgets })) {
        $('#month').value = budget.month;
        render();
        $('#budget-dialog').close();
        notify('Presupuesto guardado. Los avisos se actualizan con tus gastos registrados.');
      }
    } catch (error) {
      $('#budget-error').textContent = error.message;
    }
  };
  $('#copy-budgets').addEventListener('click', () => {
    if (!isReady() || isSaving() || isProcessing()) return;
    const history = monthlyHistory(getState(), $('#month').value, 2);
    if (history.length < 2) {
      notify('No hay un mes anterior válido para copiar.');
      return;
    }
    budgetCopyPreview = previewBudgetCopy(getState(), history[0].month, $('#month').value);
    $('#budget-copy-error').textContent = '';
    $('#budget-copy-summary').textContent =
      'De ' +
      budgetCopyPreview.sourceMonth +
      ' a ' +
      budgetCopyPreview.targetMonth +
      ': ' +
      budgetCopyPreview.candidates.length +
      ' límite(s) para copiar. Omitidos: ' +
      budgetCopyPreview.skipped +
      '. Si no hay candidatos, crea un límite o selecciona otro periodo.';
    $('#budget-copy-list').replaceChildren(
      ...budgetCopyPreview.candidates.map((item) => {
        const li = document.createElement('li');
        li.textContent = item.category + ': ' + money(item.amount);
        return li;
      }),
    );
    setBusy();
    $('#budget-copy-dialog').showModal();
  });
  $('#confirm-budget-copy').addEventListener('click', async () => {
    if (!isReady() || isSaving() || isProcessing() || !budgetCopyPreview?.candidates.length) return;
    try {
      const preview = budgetCopyPreview;
      const next = copyBudgets(getState(), preview.sourceMonth, preview.targetMonth, () =>
        crypto.randomUUID(),
      );
      if (await persist(next)) {
        $('#budget-copy-dialog').close();
        render();
        notify('Límites copiados. Los gastos y límites existentes se conservaron.');
      }
    } catch (error) {
      $('#budget-copy-error').textContent = error.message;
    }
  });
  $('#budget-copy-dialog').addEventListener('close', () => {
    budgetCopyPreview = null;
    setBusy();
  });

  return {
    render: renderBudgets,
    get pendingCount() {
      return budgetCopyPreview?.candidates.length || 0;
    },
  };
}
