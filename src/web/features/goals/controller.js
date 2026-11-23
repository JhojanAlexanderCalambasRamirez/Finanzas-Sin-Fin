import { parseMoneyInput } from '../../../domain/validation.js';
import { goalList, contributionList, goalSummary, validGoals } from '../../../domain/goals.js';

export function createGoalsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  money,
  today,
  notify,
}) {
  let editingGoalId = null;
  let editingContributionId = null;
  let contributionGoalId = null;
  const goalForm = $('#goal-form');
  const contributionForm = $('#contribution-form');
  function renderGoals(asOf) {
    $('#goals-period').textContent =
      `Aportes registrados al ${asOf.split('-').reverse().join('/')}. No representan saldo reservado.`;
    $('#goal-cards').replaceChildren();
    const labels = {
      'not-started': 'Inicio posterior al periodo',
      'in-progress': 'En progreso',
      completed: 'Objetivo alcanzado',
      overdue: 'Fecha objetivo vencida',
    };
    for (const goal of goalSummary(getState(), asOf)) {
      const card = document.createElement('article');
      card.className = `account-card goal-card ${goal.status}`;
      const title = document.createElement('h3');
      title.textContent = goal.name;
      const status = document.createElement('p');
      status.className = 'goal-status';
      status.textContent = `${goal.archived ? 'Archivada · ' : ''}${labels[goal.status]}`;
      const saved = document.createElement('strong');
      saved.textContent = money(goal.saved);
      const detail = document.createElement('p');
      detail.textContent = `Objetivo ${money(goal.targetAmount)} · ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(goal.percent)} %`;
      const remaining = document.createElement('p');
      remaining.textContent = `Faltante ${money(goal.remaining)}${goal.targetDate ? ` · Fecha objetivo ${goal.targetDate.split('-').reverse().join('/')}` : ''}`;
      const progress = document.createElement('progress');
      progress.max = 100;
      progress.value = Math.min(100, goal.percent);
      progress.setAttribute('aria-label', `Avance de ${goal.name}`);
      const actions = document.createElement('div');
      actions.className = 'budget-actions';
      const addAction = (label, action) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = label;
        button.setAttribute('aria-label', `${label}: ${goal.name}`);
        button.onclick = action;
        actions.append(button);
      };
      if (!goal.archived) addAction('Registrar aporte', () => openContribution(goal));
      addAction('Historial', () => openGoalHistory(goal.id));
      addAction('Editar', () => openGoal(goal));
      addAction(goal.archived ? 'Reactivar' : 'Archivar', async () => {
        const goals = goalList(getState()).map((item) =>
          item.id === goal.id ? { ...item, archived: !item.archived } : item,
        );
        if (await persist({ ...getState(), goals })) {
          render();
          notify(goal.archived ? 'Meta reactivada.' : 'Meta archivada. Sus aportes se conservan.');
        }
      });
      card.append(title, status, saved, detail, progress, remaining, actions);
      $('#goal-cards').append(card);
    }
    if (!goalList(getState()).length) {
      const empty = document.createElement('p');
      empty.className = 'form-intro';
      empty.textContent = 'Crea una meta y lleva el seguimiento de tus aportes.';
      $('#goal-cards').append(empty);
    }
  }
  function openGoal(goal = null) {
    editingGoalId = goal?.id || null;
    goalForm.reset();
    $('#goal-error').textContent = '';
    $('#goal-title').textContent = goal ? 'Editar meta' : 'Nueva meta';
    goalForm.elements.startDate.value = today();
    if (goal)
      for (const field of ['name', 'targetAmount', 'startDate', 'targetDate'])
        goalForm.elements[field].value = goal[field];
    $('#goal-dialog').showModal();
    goalForm.elements.name.focus();
  }
  $('#new-goal').onclick = () => openGoal();
  goalForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(goalForm);
      const previous = goalList(getState()).find((goal) => goal.id === editingGoalId);
      const goal = {
        id: editingGoalId || crypto.randomUUID(),
        name: data.get('name').trim(),
        targetAmount: parseMoneyInput(data.get('targetAmount')),
        startDate: data.get('startDate'),
        targetDate: data.get('targetDate'),
        archived: previous?.archived || false,
      };
      const goals = previous
        ? goalList(getState()).map((item) => (item.id === goal.id ? goal : item))
        : [...goalList(getState()), goal];
      if (!validGoals({ ...getState(), goals }))
        throw new Error(
          'Revisa nombre, objetivo y fechas. El inicio no puede ser posterior a los aportes existentes y la fecha objetivo no puede ser anterior al inicio.',
        );
      if (await persist({ ...getState(), goals })) {
        render();
        $('#goal-dialog').close();
        notify('Meta guardada. Los saldos de tus cuentas no cambiaron.');
      }
    } catch (error) {
      $('#goal-error').textContent = error.message;
    }
  };
  function openContribution(goal, item = null) {
    if (goal.archived && !item) return;
    contributionGoalId = goal.id;
    editingContributionId = item?.id || null;
    contributionForm.reset();
    $('#contribution-title').textContent = item ? 'Editar aporte' : 'Registrar aporte';
    $('#contribution-goal').textContent = goal.name;
    $('#contribution-error').textContent = '';
    contributionForm.elements.date.min = goal.startDate;
    contributionForm.elements.date.value = item?.date || today();
    if (item)
      for (const field of ['amount', 'date', 'note'])
        contributionForm.elements[field].value = item[field];
    if ($('#goal-history').open) $('#goal-history').close();
    $('#contribution-dialog').showModal();
    contributionForm.elements.amount.focus();
  }
  contributionForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(contributionForm);
      const item = {
        id: editingContributionId || crypto.randomUUID(),
        goalId: contributionGoalId,
        amount: parseMoneyInput(data.get('amount')),
        date: data.get('date'),
        note: data.get('note').trim(),
      };
      const contributions = editingContributionId
        ? contributionList(getState()).map((previous) =>
            previous.id === item.id ? item : previous,
          )
        : [...contributionList(getState()), item];
      if (!validGoals({ ...getState(), contributions }))
        throw new Error(
          'Revisa la nota, el monto y la fecha. El aporte debe corresponder a una meta existente y no ser anterior a su inicio.',
        );
      if (await persist({ ...getState(), contributions })) {
        $('#month').value = item.date.slice(0, 7);
        render();
        $('#contribution-dialog').close();
        notify('Aporte de seguimiento guardado. No se creó un ingreso ni un gasto.');
      }
    } catch (error) {
      $('#contribution-error').textContent = error.message;
    }
  };
  function openGoalHistory(goalId) {
    const goal = goalList(getState()).find((item) => item.id === goalId);
    if (!goal) return;
    $('#goal-history-title').textContent = `Aportes: ${goal.name}`;
    $('#history-error').textContent = '';
    $('#contribution-list').replaceChildren();
    const entries = contributionList(getState())
      .filter((item) => item.goalId === goalId)
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    for (const item of entries) {
      const row = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${item.date.split('-').reverse().join('/')} · ${item.note} · ${money(item.amount)}`;
      const actions = document.createElement('div');
      actions.className = 'budget-actions';
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar aporte ${item.note}`);
      edit.onclick = () => openContribution(goal, item);
      const remove = document.createElement('button');
      remove.className = 'secondary';
      remove.textContent = 'Eliminar';
      remove.setAttribute('aria-label', `Eliminar aporte ${item.note}`);
      remove.onclick = async () => {
        if (!confirm(`¿Eliminar el aporte de seguimiento “${item.note}”? No se moverá dinero.`))
          return;
        if (
          await persist({
            ...getState(),
            contributions: contributionList(getState()).filter(
              (previous) => previous.id !== item.id,
            ),
          })
        ) {
          render();
          openGoalHistory(goalId);
          notify('Aporte de seguimiento eliminado.');
        }
      };
      actions.append(edit, remove);
      row.append(text, actions);
      $('#contribution-list').append(row);
    }
    if (!entries.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Esta meta aún no tiene aportes registrados.';
      $('#contribution-list').append(empty);
    }
    setBusy();
    if (!$('#goal-history').open) $('#goal-history').showModal();
  }

  return { render: renderGoals };
}
